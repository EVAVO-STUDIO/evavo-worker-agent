import { validatePublicResearchUrl } from "./publicResearchFetch";

export type OpportunityDeadlineEvidence = {
  raw: string;
  normalizedDate: string | null;
  status: "future" | "today" | "past" | "unparsed";
  daysRemaining: number | null;
};

export type OpportunityValueEvidence = {
  raw: string;
  amountCents: number | null;
  currency: "AUD" | "NZD" | null;
  qualifier: "up_to" | "from" | "exact_or_unspecified";
};

export type OpportunityEvidence = {
  sourceUrl: string;
  linkText: string;
  nearbyText: string;
  matchedTerms: string[];
  detectedDeadlineText?: string;
  detectedValueText?: string;
  disqualifierText?: string;
  deadline?: OpportunityDeadlineEvidence;
  value?: OpportunityValueEvidence;
  evidenceQualityScore: number;
  evidenceStrength: "weak" | "moderate" | "strong";
  missingFacts: string[];
  reviewFlags: string[];
};

export type OpportunityScoreBreakdown = {
  typeScore: number;
  intentScore: number;
  sourceAuthorityScore: number;
  evavoFitScore: number;
  urgencyScore: number;
  valueScore: number;
  evidenceQualityScore: number;
  effortScore: number;
  riskPenalty: number;
  learningAdjustment: number;
  total: number;
};

export type OpportunityCandidate = {
  url: string;
  title: string;
  opportunityType: string;
  score: number;
  confidence: "low" | "medium" | "high";
  signals: string[];
  recommendedAction: string;
  reviewOnly: true;
  executable: false;
  deliverable: false;
  authoritativeForExecution: false;
  evidence?: OpportunityEvidence & Record<string, unknown>;
  scoreBreakdown?: OpportunityScoreBreakdown;
};

const TYPE_SIGNALS: Array<{ type: string; score: number; terms: string[] }> = [
  { type: "government_grant", score: 32, terms: ["grant", "funding", "voucher", "rebate", "business support", "innovation fund"] },
  { type: "tender", score: 34, terms: ["tender", "procurement", "supplier panel", "request for tender", "rft", "rfq", "request for quote"] },
  { type: "rfp_or_eoi", score: 32, terms: ["request for proposal", "rfp", "expression of interest", "eoi", "invitation to quote"] },
  { type: "agency_partner", score: 34, terms: ["white label", "overflow", "contract developer", "digital partner", "agency partner", "implementation partner"] },
  { type: "tech_help_needed", score: 30, terms: ["website redesign", "website redevelopment", "new website", "web developer", "wordpress help", "shopify help", "technical support", "digital transformation"] },
  { type: "contract_role_signal", score: 22, terms: ["digital producer", "web producer", "front end", "frontend", "ux designer", "web designer", "contract role"] },
  { type: "partnership_opening", score: 24, terms: ["partner with us", "partnership", "sponsorship", "collaboration", "vendor", "suppliers", "become a supplier"] },
  { type: "award_or_accelerator", score: 18, terms: ["award", "accelerator", "incubator", "challenge", "startup program"] },
];

const NEGATIVE_TERMS = ["privacy policy", "terms of use", "login", "sign in", "cookie", "accessibility", "subscribe", "newsletter", "media release", "annual report"];
const DEFINITIVE_DISQUALIFIERS = ["applications closed", "submissions closed", "opportunity closed", "no longer accepting", "not accepting applications", "expired opportunity", "archived opportunity", "past event"];
const HIGH_INTENT_TERMS = ["closes", "closing date", "applications close", "apply now", "submit proposal", "register interest", "request a quote", "funding available", "seeking", "looking for", "needed", "required", "suppliers wanted", "open now"];
const EVAVO_FIT_TERMS = ["website", "web app", "app", "digital", "ux", "ui", "automation", "ecommerce", "e-commerce", "platform", "portal", "interactive", "3d", "ar", "vr", "ai", "chatbot", "software"];
const VALUE_TERMS = ["funding", "grant", "$", "aud", "nzd", "budget", "contract", "tender", "procurement"];
const ELIGIBILITY_TERMS = ["eligible", "eligibility", "who can apply", "applicants", "criteria", "requirements"];
const SCOPE_TERMS = ["scope", "services", "deliverables", "statement of work", "requirements", "project brief"];
const DEADLINE_PATTERN = /(?:closes?|closing date|applications close|deadline)\s*(?::|-)?\s*([^.;|]{3,100})/i;
const VALUE_PATTERN = /(?:(up to|from)\s+)?((?:AUD|NZD)\s*)?\$?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)(?:\s*(million|m|thousand|k))?/i;
const GENERIC_LINK_TITLE_PATTERN = /^(?:click here|read more|learn more|more|view|details|download|apply|open)$/i;
const TRACKING_QUERY_KEYS = new Set(["gclid", "fbclid", "msclkid", "dclid", "yclid", "_ga"]);

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_match, decimal) => String.fromCodePoint(Number(decimal)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));
}

function normalizeText(value: string): string {
  return decodeEntities(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termPattern(term: string): RegExp {
  if (term === "$") return /\$/;
  const flexible = escapeRegex(term.trim()).replace(/\\?\s+/g, "[\\s_-]+");
  return new RegExp(`(?:^|[^a-z0-9])${flexible}(?=$|[^a-z0-9])`, "i");
}

function includesAny(text: string, terms: string[]): string[] {
  return terms.filter((term) => termPattern(term).test(text));
}

function sourceAuthorityScoreFor(candidateUrl: string, sourceUrl: string): number {
  const hosts = [candidateUrl, sourceUrl].map((value) => {
    try {
      return new URL(value).hostname.toLowerCase();
    } catch {
      return "";
    }
  });
  if (hosts.some((host) => host.endsWith(".gov.au") || host.endsWith(".govt.nz"))) return 14;
  if (hosts.some((host) => /(^|\.)(tenders|grants)\.gov\.au$/.test(host) || host === "gets.govt.nz")) return 14;
  if (hosts.some((host) => host.endsWith(".edu.au") || host.endsWith(".ac.nz"))) return 8;
  return 0;
}

function evidenceStrength(score: number): "weak" | "moderate" | "strong" {
  if (score >= 65) return "strong";
  if (score >= 38) return "moderate";
  return "weak";
}

function confidenceFor(score: number, qualityScore: number): "low" | "medium" | "high" {
  if (score >= 65 && qualityScore >= 60) return "high";
  if (score >= 38 && qualityScore >= 32) return "medium";
  return "low";
}

function actionFor(type: string, score: number): string {
  if (score >= 70) return type === "government_grant" ? "shortlist_for_eligibility_review" : "shortlist_for_operator_review";
  if (score >= 45) return "review_evidence_and_source";
  return "retain_low_priority_signal";
}

function canonicalPublicUrl(href: string, baseUrl: string): string | null {
  const decision = validatePublicResearchUrl(href, baseUrl);
  if (!decision.ok || !decision.url) return null;
  const url = new URL(decision.url);
  url.hash = "";
  for (const key of Array.from(url.searchParams.keys())) {
    const lower = key.toLowerCase();
    if (lower.startsWith("utm_") || lower.startsWith("mc_") || TRACKING_QUERY_KEYS.has(lower)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url.toString();
}

function nearbyText(html: string, startIndex: number, endIndex: number): string {
  const before = html.slice(Math.max(0, startIndex - 600), startIndex);
  const after = html.slice(endIndex, Math.min(html.length, endIndex + 800));
  return normalizeText(`${before} ${after}`).slice(0, 1200);
}

function firstPattern(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[0]?.replace(/\s+/g, " ").trim().slice(0, 180);
}

function monthIndex(raw: string): number | null {
  const normalized = raw.toLowerCase().slice(0, 3);
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const index = months.indexOf(normalized);
  return index >= 0 ? index : null;
}

function validDate(year: number, month: number, day: number): Date | null {
  const date = new Date(Date.UTC(year, month, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) return null;
  return date;
}

function parseDeadlineDate(raw: string): Date | null {
  const iso = raw.match(/\b(20\d{2})-(0?[1-9]|1[0-2])-(0?[1-9]|[12]\d|3[01])\b/);
  if (iso) return validDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));

  const numeric = raw.match(/\b(0?[1-9]|[12]\d|3[01])[\/-](0?[1-9]|1[0-2])[\/-](20\d{2})\b/);
  if (numeric) return validDate(Number(numeric[3]), Number(numeric[2]) - 1, Number(numeric[1]));

  const dayMonth = raw.match(/\b(0?[1-9]|[12]\d|3[01])\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(20\d{2})\b/i);
  if (dayMonth) {
    const month = monthIndex(dayMonth[2]);
    return month === null ? null : validDate(Number(dayMonth[3]), month, Number(dayMonth[1]));
  }

  const monthDay = raw.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(0?[1-9]|[12]\d|3[01]),?\s+(20\d{2})\b/i);
  if (monthDay) {
    const month = monthIndex(monthDay[1]);
    return month === null ? null : validDate(Number(monthDay[3]), month, Number(monthDay[2]));
  }
  return null;
}

function deadlineEvidence(raw: string | undefined): OpportunityDeadlineEvidence | undefined {
  if (!raw) return undefined;
  const parsed = parseDeadlineDate(raw);
  if (!parsed) return { raw, normalizedDate: null, status: "unparsed", daysRemaining: null };
  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const deltaDays = Math.round((parsed.getTime() - todayUtc) / 86_400_000);
  return {
    raw,
    normalizedDate: parsed.toISOString().slice(0, 10),
    status: deltaDays > 0 ? "future" : deltaDays === 0 ? "today" : "past",
    daysRemaining: deltaDays,
  };
}

function valueEvidence(raw: string | undefined): OpportunityValueEvidence | undefined {
  if (!raw) return undefined;
  const match = raw.match(VALUE_PATTERN);
  if (!match) return { raw, amountCents: null, currency: null, qualifier: "exact_or_unspecified" };
  const qualifier = match[1]?.toLowerCase() === "up to" ? "up_to" : match[1]?.toLowerCase() === "from" ? "from" : "exact_or_unspecified";
  const currency = match[2]?.trim().toUpperCase() === "AUD" ? "AUD" : match[2]?.trim().toUpperCase() === "NZD" ? "NZD" : null;
  const multiplier = /million|m/i.test(match[4] || "") ? 1_000_000 : /thousand|k/i.test(match[4] || "") ? 1_000 : 1;
  const amount = Number(match[3].replace(/,/g, "")) * multiplier;
  const amountCents = Number.isFinite(amount) && amount >= 0 && amount <= Number.MAX_SAFE_INTEGER / 100 ? Math.round(amount * 100) : null;
  return { raw, amountCents, currency, qualifier };
}

function scoreCandidate(title: string, url: string, sourceUrl: string, contextText: string): OpportunityCandidate | null {
  const combined = `${title} ${url} ${contextText}`;
  const negativeMatches = includesAny(`${title} ${url}`, NEGATIVE_TERMS);
  if (negativeMatches.length > 0) return null;

  const definitiveDisqualifiers = includesAny(combined, DEFINITIVE_DISQUALIFIERS);
  if (definitiveDisqualifiers.length > 0) return null;

  let opportunityType = "unknown";
  let typeScore = 0;
  const signals: string[] = [];
  const matchedTerms: string[] = [];

  for (const bucket of TYPE_SIGNALS) {
    const matches = includesAny(combined, bucket.terms);
    if (!matches.length) continue;
    const bucketScore = bucket.score + Math.min(20, matches.length * 6);
    if (bucketScore > typeScore) {
      opportunityType = bucket.type;
      typeScore = bucketScore;
    }
    matchedTerms.push(...matches);
    signals.push(...matches.map((match) => `${bucket.type}:${match}`));
  }

  const highIntent = includesAny(combined, HIGH_INTENT_TERMS);
  const evavoFit = includesAny(combined, EVAVO_FIT_TERMS);
  const valueTerms = includesAny(combined, VALUE_TERMS);
  const eligibilityTerms = includesAny(combined, ELIGIBILITY_TERMS);
  const scopeTerms = includesAny(combined, SCOPE_TERMS);
  const sourceAuthorityScore = sourceAuthorityScoreFor(url, sourceUrl);
  const intentScore = Math.min(24, highIntent.length * 8);
  const evavoFitScore = Math.min(18, evavoFit.length * 4);
  const detectedDeadlineText = firstPattern(combined, DEADLINE_PATTERN);
  const detectedValueText = firstPattern(combined, VALUE_PATTERN);
  const deadline = deadlineEvidence(detectedDeadlineText);
  const value = valueEvidence(detectedValueText);
  const valueScore = valueTerms.length ? 8 : 0;
  const urgencyScore = deadline?.status === "future" || deadline?.status === "today" ? 8 : highIntent.some((term) => /close|deadline/i.test(term)) ? 4 : 0;
  const effortScore = opportunityType === "tender" || opportunityType === "rfp_or_eoi" ? 6 : 0;
  const riskPenalty = deadline?.status === "past" ? 60 : 0;

  if (highIntent.length) signals.push(...highIntent.map((match) => `intent:${match}`));
  if (evavoFit.length) signals.push(...evavoFit.map((match) => `evavo_fit:${match}`));
  if (valueTerms.length) signals.push(...valueTerms.map((match) => `value:${match}`));
  if (deadline?.normalizedDate) signals.push(`deadline:${deadline.normalizedDate}`);
  if (deadline?.status === "past") signals.push("risk:past_deadline");

  if (/jobs|careers|work-with-us|join-us/i.test(url) && opportunityType === "unknown") {
    opportunityType = "contract_role_signal";
    typeScore = Math.max(typeScore, 18);
    signals.push("path:jobs_or_careers");
  }

  if (deadline?.status === "past") return null;

  const missingFacts: string[] = [];
  if (!deadline) missingFacts.push("deadline");
  if (!value) missingFacts.push("budget_or_value");
  if (!eligibilityTerms.length) missingFacts.push("eligibility");
  if (!scopeTerms.length) missingFacts.push("scope_or_deliverables");

  let evidenceQualityScore = 0;
  if (typeScore > 0) evidenceQualityScore += 24;
  if (highIntent.length) evidenceQualityScore += 18;
  if (evavoFit.length) evidenceQualityScore += 14;
  if (sourceAuthorityScore > 0) evidenceQualityScore += 12;
  if (deadline?.normalizedDate) evidenceQualityScore += 14;
  else if (deadline) evidenceQualityScore += 5;
  if (value?.amountCents !== null) evidenceQualityScore += 10;
  else if (value) evidenceQualityScore += 4;
  if (eligibilityTerms.length) evidenceQualityScore += 4;
  if (scopeTerms.length) evidenceQualityScore += 4;
  evidenceQualityScore = Math.max(0, Math.min(100, evidenceQualityScore));

  const reviewFlags: string[] = [];
  if (deadline?.status === "unparsed") reviewFlags.push("deadline_present_but_unparsed");
  if (value && value.amountCents === null) reviewFlags.push("value_present_but_unparsed");
  if (value?.amountCents !== null && !value.currency) reviewFlags.push("currency_unverified");
  if (sourceAuthorityScore === 0) reviewFlags.push("source_authority_unverified");
  if (evidenceQualityScore < 38) reviewFlags.push("weak_evidence");

  const learningAdjustment = 0;
  let score = typeScore + intentScore + sourceAuthorityScore + evavoFitScore + valueScore + urgencyScore - effortScore - riskPenalty + learningAdjustment;
  if (score < 18) return null;
  score = Math.max(0, Math.min(100, score));

  const evidence: OpportunityEvidence = {
    sourceUrl,
    linkText: title,
    nearbyText: contextText.slice(0, 1000),
    matchedTerms: Array.from(new Set([...matchedTerms, ...highIntent, ...evavoFit, ...valueTerms, ...eligibilityTerms, ...scopeTerms])).slice(0, 32),
    detectedDeadlineText,
    detectedValueText,
    deadline,
    value,
    evidenceQualityScore,
    evidenceStrength: evidenceStrength(evidenceQualityScore),
    missingFacts,
    reviewFlags,
  };

  const scoreBreakdown: OpportunityScoreBreakdown = {
    typeScore,
    intentScore,
    sourceAuthorityScore,
    evavoFitScore,
    urgencyScore,
    valueScore,
    evidenceQualityScore,
    effortScore,
    riskPenalty,
    learningAdjustment,
    total: score,
  };

  return {
    url,
    title: title || url,
    opportunityType,
    score,
    confidence: confidenceFor(score, evidenceQualityScore),
    signals: Array.from(new Set(signals)).slice(0, 32),
    recommendedAction: actionFor(opportunityType, score),
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    evidence,
    scoreBreakdown,
  };
}

export function extractOpportunityCandidates(html: string, sourceUrl: string, limit = 50): OpportunityCandidate[] {
  const canonicalSourceUrl = canonicalPublicUrl(sourceUrl, sourceUrl);
  if (!canonicalSourceUrl) return [];
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const candidates: OpportunityCandidate[] = [];
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) !== null && seen.size < 800) {
    const url = canonicalPublicUrl(match[1], canonicalSourceUrl);
    const title = normalizeText(match[2]);
    if (!url || url === canonicalSourceUrl || seen.has(url) || !title || title.length < 3 || GENERIC_LINK_TITLE_PATTERN.test(title)) continue;
    seen.add(url);
    const context = nearbyText(html, match.index, match.index + match[0].length);
    const candidate = scoreCandidate(title, url, canonicalSourceUrl, context);
    if (candidate) candidates.push(candidate);
  }

  return candidates.sort((a, b) => b.score - a.score || (b.evidence?.evidenceQualityScore || 0) - (a.evidence?.evidenceQualityScore || 0) || a.title.localeCompare(b.title)).slice(0, Math.max(1, Math.min(100, limit)));
}

export function summarizeOpportunityPreview(candidates: OpportunityCandidate[]) {
  const byType = candidates.reduce<Record<string, number>>((acc, candidate) => {
    acc[candidate.opportunityType] = (acc[candidate.opportunityType] || 0) + 1;
    return acc;
  }, {});

  const qualityScores = candidates.map((candidate) => candidate.evidence?.evidenceQualityScore || 0);
  return {
    total: candidates.length,
    highConfidence: candidates.filter((candidate) => candidate.confidence === "high").length,
    mediumConfidence: candidates.filter((candidate) => candidate.confidence === "medium").length,
    strongEvidence: candidates.filter((candidate) => candidate.evidence?.evidenceStrength === "strong").length,
    weakEvidence: candidates.filter((candidate) => candidate.evidence?.evidenceStrength === "weak").length,
    missingDeadline: candidates.filter((candidate) => candidate.evidence?.missingFacts.includes("deadline")).length,
    missingBudgetOrValue: candidates.filter((candidate) => candidate.evidence?.missingFacts.includes("budget_or_value")).length,
    byType,
    topScore: candidates[0]?.score || 0,
    topEvidenceQualityScore: qualityScores.length ? Math.max(...qualityScores) : 0,
  };
}
