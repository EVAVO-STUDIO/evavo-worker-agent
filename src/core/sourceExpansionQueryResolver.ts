import type { Env } from "../db";
import { logEvent, nowISO, uuid } from "../db";
import { PUBLIC_RESEARCH_FETCH_CONTRACT, validatePublicResearchUrl } from "./publicResearchFetch";

const SOURCE_URL_PATTERN = /(tender|tenders|procurement|supplier|suppliers|contract|contracts|grant|grants|funding|funds|investment|opportunit|rfp|eoi|panel|marketplace|creative|screen|innovation|digital|business-support|program)/i;
const NOISE_URL_PATTERN = /(login|signin|register|cart|privacy|terms|policy|cookie|facebook|instagram|linkedin|twitter|x\.com|youtube|tiktok|\.pdf$|\.jpg$|\.png$|\.zip$|mailto:|tel:)/i;

type QueryHintRow = {
  id: string;
  query_text: string;
  strategy: string;
  country?: string | null;
  region?: string | null;
  category?: string | null;
  intent?: string | null;
  score?: number | null;
};

type ResolveOptions = {
  hintId: string;
  urls: string[];
  note?: string;
};

function normalizeUrl(raw: string) {
  const decision = validatePublicResearchUrl(raw);
  return decision.ok && decision.url ? decision.url.replace(/\/+$/, "") : null;
}

function domainOf(raw: string) {
  try {
    return new URL(raw).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
  }
}

function confidence(score: number): "low" | "medium" | "high" {
  if (score >= 78) return "high";
  if (score >= 55) return "medium";
  return "low";
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function existingDomains(env: Env) {
  if (!(await tableExists(env, "opportunity_sources"))) return new Set<string>();
  const rows = await env.DB.prepare("SELECT url FROM opportunity_sources LIMIT 5000").all<{ url: string }>();
  return new Set((rows.results || []).map((row) => domainOf(row.url)));
}

async function getHint(env: Env, id: string): Promise<QueryHintRow | null> {
  return env.DB.prepare(
    `SELECT id, query_text, strategy, country, region, category, intent, score
     FROM source_expansion_query_hints
     WHERE id = ?
     LIMIT 1`
  ).bind(id).first<QueryHintRow>();
}

function scoreResolvedUrl(url: string, hint: QueryHintRow) {
  const lower = url.toLowerCase();
  if (NOISE_URL_PATTERN.test(lower)) return null;
  const reasons: string[] = ["query_hint:resolved_by_operator", `query_strategy:${hint.strategy}`, `url_policy:${PUBLIC_RESEARCH_FETCH_CONTRACT}`];
  let score = 35 + Math.round((Number(hint.score || 50) - 50) * 0.25);
  let sourceType = "query_hint_resolved_source";
  let category = hint.category || "opportunities";

  if (SOURCE_URL_PATTERN.test(lower)) {
    score += 22;
    reasons.push("url:source_language_match");
  }
  if (/tender|procurement|supplier|contract|rfp|eoi|panel|marketplace/.test(lower)) {
    score += 16;
    sourceType = "government_tenders";
    category = "tenders";
    reasons.push("url:tender_procurement_signal");
  }
  if (/grant|funding|funds|investment|program|business-support/.test(lower)) {
    score += 14;
    sourceType = "government_grants";
    category = "grants";
    reasons.push("url:grant_funding_signal");
  }
  if (/digital|innovation|technology|creative|screen/.test(lower)) {
    score += 8;
    reasons.push("url:evavo_relevance_signal");
  }
  const domain = domainOf(url);
  if (/\.gov\.au$|\.govt\.nz$|gov\.au$|govt\.nz$/.test(domain)) {
    score += 12;
    reasons.push("domain:government");
  }
  score = Math.max(1, Math.min(100, Math.round(score)));
  if (score < 40) return null;
  return { domain, score, confidence: confidence(score), sourceType, category, reasons };
}

export async function resolveQueryHintUrls(env: Env, options: ResolveOptions) {
  const hasHints = await tableExists(env, "source_expansion_query_hints");
  const hasCandidates = await tableExists(env, "source_expansion_candidates");
  if (!hasHints || !hasCandidates) {
    return { ok: false, error: "missing_migration", requiredMigration: hasHints ? "0007_source_expansion_memory.sql" : "0009_source_expansion_query_hints.sql" };
  }
  const hint = await getHint(env, options.hintId);
  if (!hint) return { ok: false, error: "query_hint_not_found" };

  const submittedUrls = Array.from(new Set((options.urls || []).map((url) => String(url || "").trim()).filter(Boolean))).slice(0, 25);
  const uniqueUrls: string[] = [];
  const results: any[] = [];
  let rejected = 0;
  for (const [index, rawUrl] of submittedUrls.entries()) {
    const decision = validatePublicResearchUrl(rawUrl);
    if (!decision.ok || !decision.url) {
      rejected += 1;
      results.push({ index, status: "rejected", reason: decision.error || "invalid_research_url", inputRedacted: true });
      continue;
    }
    const normalized = normalizeUrl(decision.url);
    if (normalized && !uniqueUrls.includes(normalized)) uniqueUrls.push(normalized);
  }

  const existing = await existingDomains(env);
  const now = nowISO();
  const note = typeof options.note === "string" && options.note.trim() ? options.note.replace(/\s+/g, " ").trim().slice(0, 500) : null;
  const statements: D1PreparedStatement[] = [];
  let saved = 0;
  let duplicate = 0;

  for (const url of uniqueUrls) {
    const scored = scoreResolvedUrl(url, hint);
    if (!scored) {
      rejected += 1;
      results.push({ url, status: "rejected", reason: "low_signal_or_noise" });
      continue;
    }
    const status = existing.has(scored.domain) ? "duplicate_existing_source" : "candidate";
    statements.push(env.DB.prepare(
      `INSERT INTO source_expansion_candidates (id, url, domain, label, source_type, country, region, category, status, score, confidence, strategy, seed_id, discovery_depth, reasons_json, evidence_json, first_seen_at_iso, last_seen_at_iso, next_review_at_iso, quality_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'query_hint_resolved', ?, 1, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(url) DO UPDATE SET
         label = excluded.label,
         source_type = excluded.source_type,
         status = CASE WHEN status = 'saved' THEN status ELSE excluded.status END,
         score = MAX(score, excluded.score),
         confidence = excluded.confidence,
         strategy = 'query_hint_resolved',
         seed_id = excluded.seed_id,
         reasons_json = excluded.reasons_json,
         evidence_json = excluded.evidence_json,
         last_seen_at_iso = excluded.last_seen_at_iso,
         seen_count = seen_count + 1,
         quality_score = MAX(quality_score, excluded.quality_score)`
    ).bind(
      uuid(),
      url,
      scored.domain,
      url.replace(/^https?:\/\//i, "").slice(0, 140),
      scored.sourceType,
      hint.country || null,
      hint.region || null,
      scored.category,
      status,
      scored.score,
      scored.confidence,
      hint.id,
      JSON.stringify(scored.reasons),
      JSON.stringify({
        queryHintId: hint.id,
        queryText: hint.query_text,
        note,
        resolvedAtISO: now,
        urlPolicyContract: PUBLIC_RESEARCH_FETCH_CONTRACT,
        reviewOnly: true,
        executable: false,
        deliverable: false,
        authoritativeForExecution: false,
        externalExecutionAllowed: false,
      }),
      now,
      now,
      now,
      scored.score,
    ));
    if (status === "duplicate_existing_source") duplicate += 1;
    else saved += 1;
    results.push({ url, status, score: scored.score, reasons: scored.reasons, reviewOnly: true, executable: false });
  }

  statements.push(env.DB.prepare(
    `UPDATE source_expansion_query_hints SET
       used_count = used_count + 1,
       result_count = result_count + ?,
       last_used_at_iso = ?,
       updated_at_iso = ?,
       notes = ?
     WHERE id = ?`
  ).bind(saved + duplicate, now, now, note || "Resolved into source expansion candidate URLs", hint.id));

  await env.DB.batch(statements);
  await logEvent(env, "source_expansion_query_hint_resolved", `Resolved query hint ${hint.id}: ${saved} candidate(s), ${duplicate} duplicate(s), ${rejected} rejected.`);
  return {
    ok: true,
    mode: "source_expansion_query_hint_resolved",
    urlPolicyContract: PUBLIC_RESEARCH_FETCH_CONTRACT,
    hintId: hint.id,
    queryText: hint.query_text,
    submitted: submittedUrls.length,
    publicUrlsAccepted: uniqueUrls.length,
    saved,
    duplicate,
    rejected,
    results,
    candidateAndHintUpdateAtomic: true,
    reviewOnly: true,
    executable: false,
    deliverable: false,
    authoritativeForExecution: false,
    externalExecutionAllowed: false,
  };
}
