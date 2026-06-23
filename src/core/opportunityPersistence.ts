import type { Env } from "../db";
import { uuid } from "../db";
import type { OpportunityCandidate } from "./opportunityDiscovery";

type OpportunitySourceLike = {
  id: string;
  url: string;
  label?: string | null;
  source_type?: string | null;
  country?: string | null;
  region?: string | null;
  category?: string | null;
};

export type SaveOpportunityCandidateResult =
  | {
      saved: true;
      id: string;
      normalizedUrl: string;
      normalizedTitle: string;
      score: number;
      confidence: "low" | "medium" | "high";
      opportunityType: string;
    }
  | {
      saved: false;
      reason: "duplicate" | "invalid_url" | "missing_title" | "score_too_low" | "invalid_candidate";
      existingId?: string;
      normalizedUrl?: string;
      normalizedTitle?: string;
      score?: number;
      opportunityType?: string;
    };

export type SaveOpportunityCandidateOptions = {
  minScore?: number;
  discoveredBy?: "scheduled" | "commit-preview" | "manual";
  nowISO?: string;
  notes?: string | null;
};

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function normalizeConfidence(value: unknown): "low" | "medium" | "high" {
  if (value === "high" || value === "medium" || value === "low") return value;
  return "low";
}

export function normalizeOpportunityUrl(rawUrl: unknown, sourceUrl: string): string | null {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return null;
  try {
    const url = new URL(rawUrl.trim(), sourceUrl);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function normalizeOpportunityTitle(rawTitle: unknown): string | null {
  if (typeof rawTitle !== "string") return null;
  const title = rawTitle.replace(/\s+/g, " ").trim();
  if (title.length < 3) return null;
  if (/^(click here|read more|learn more|more|view|details|download)$/i.test(title)) return null;
  return title.slice(0, 300);
}

function buildEvidenceJson(source: OpportunitySourceLike, candidate: OpportunityCandidate, normalizedUrl: string, discoveredBy: string) {
  const signals = Array.isArray(candidate.signals) ? candidate.signals.slice(0, 24) : [];
  return JSON.stringify({
    schemaVersion: "opportunity_evidence_v2",
    discoveredBy,
    source: {
      id: source.id,
      url: source.url,
      label: source.label || null,
      sourceType: source.source_type || null,
      country: source.country || null,
      region: source.region || null,
      category: source.category || null,
    },
    candidate: {
      url: normalizedUrl,
      title: candidate.title,
      opportunityType: candidate.opportunityType || "unknown",
      score: candidate.score,
      confidence: candidate.confidence,
      recommendedAction: candidate.recommendedAction || "review_manually",
      signals,
    },
    evidence: candidate.evidence || {
      sourceUrl: source.url,
      linkText: candidate.title,
      nearbyText: "",
      matchedTerms: signals,
    },
    scoreBreakdown: candidate.scoreBreakdown || {
      typeScore: 0,
      intentScore: 0,
      sourceAuthorityScore: 0,
      evavoFitScore: 0,
      urgencyScore: 0,
      valueScore: 0,
      effortScore: 0,
      riskPenalty: 0,
      learningAdjustment: 0,
      total: candidate.score,
    },
  });
}

export async function saveOpportunityCandidate(
  env: Env,
  source: OpportunitySourceLike,
  candidate: OpportunityCandidate,
  options: SaveOpportunityCandidateOptions = {},
): Promise<SaveOpportunityCandidateResult> {
  if (!candidate || typeof candidate !== "object") return { saved: false, reason: "invalid_candidate" };

  const normalizedUrl = normalizeOpportunityUrl(candidate.url, source.url);
  if (!normalizedUrl) return { saved: false, reason: "invalid_url" };

  const normalizedTitle = normalizeOpportunityTitle(candidate.title);
  if (!normalizedTitle) return { saved: false, reason: "missing_title", normalizedUrl };

  const score = clampInt(candidate.score, 0, 0, 100);
  const minScore = clampInt(options.minScore ?? 1, 1, 1, 100);
  if (score < minScore) {
    return {
      saved: false,
      reason: "score_too_low",
      normalizedUrl,
      normalizedTitle,
      score,
      opportunityType: candidate.opportunityType || "unknown",
    };
  }

  const existing = await env.DB.prepare("SELECT id FROM opportunities WHERE url = ? AND title = ? LIMIT 1")
    .bind(normalizedUrl, normalizedTitle)
    .first<any>();
  if (existing?.id) return { saved: false, reason: "duplicate", existingId: existing.id, normalizedUrl, normalizedTitle, score, opportunityType: candidate.opportunityType || "unknown" };

  const now = options.nowISO || new Date().toISOString();
  const id = uuid();
  const confidence = normalizeConfidence(candidate.confidence);
  const signals = Array.isArray(candidate.signals) ? candidate.signals : [];
  const urgencyScore = candidate.scoreBreakdown?.urgencyScore ? Math.min(100, score + candidate.scoreBreakdown.urgencyScore) : signals.some((signal: string) => String(signal).startsWith("intent:")) ? Math.min(100, score + 5) : score;
  const effortScore = candidate.scoreBreakdown?.effortScore ?? Math.max(0, 100 - score);
  const riskScore = candidate.scoreBreakdown?.riskPenalty ?? (confidence === "high" ? 10 : confidence === "medium" ? 25 : 45);
  const opportunityType = candidate.opportunityType || "unknown";
  const discoveredBy = options.discoveredBy || "manual";

  await env.DB.prepare(
    `INSERT INTO opportunities (
      id, source_id, url, title, opportunity_type, issuer, country, region, category, amount_text, estimated_value_cents, currency,
      opens_at_iso, closes_at_iso, discovered_at_iso, updated_at_iso, status,
      fit_score, urgency_score, value_score, effort_score, risk_score, total_score, confidence,
      summary, eligibility_summary, recommended_action, evidence_json, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    source.id,
    normalizedUrl,
    normalizedTitle,
    opportunityType,
    source.label || null,
    source.country || null,
    source.region || null,
    source.category || null,
    candidate.evidence?.detectedValueText || null,
    null,
    null,
    null,
    candidate.evidence?.detectedDeadlineText || null,
    now,
    now,
    "new",
    score,
    urgencyScore,
    candidate.scoreBreakdown?.valueScore ?? score,
    effortScore,
    riskScore,
    score,
    confidence,
    `Discovered from ${source.label || source.url}: ${normalizedTitle}`,
    null,
    candidate.recommendedAction || "review_manually",
    buildEvidenceJson(source, { ...candidate, title: normalizedTitle, url: normalizedUrl, score, confidence }, normalizedUrl, discoveredBy),
    options.notes || null,
  ).run();

  return { saved: true, id, normalizedUrl, normalizedTitle, score, confidence, opportunityType };
}
