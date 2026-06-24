import type { Env } from "../db";
import { logEvent, nowISO, uuid } from "../db";

type ExpansionSeed = {
  id: string;
  url: string;
  label?: string | null;
  strategy: string;
  country?: string | null;
  region?: string | null;
  category?: string | null;
  status: string;
  priority: number;
  depth: number;
  quality_score: number;
  strategy_quality_score?: number | null;
  strategy_recommendation?: string | null;
  selection_score?: number | null;
  selection_reason?: string | null;
};

type ExpansionCandidate = {
  url: string;
  domain: string;
  label: string;
  sourceType: string;
  country: string | null;
  region: string | null;
  category: string | null;
  score: number;
  confidence: "low" | "medium" | "high";
  strategy: string;
  reasons: string[];
  evidence: Record<string, unknown>;
};

type ExpansionOptions = {
  limitSeeds?: number;
  maxFetches?: number;
  maxLinksPerSeed?: number;
  maxCandidates?: number;
  strategy?: string;
  dryRun?: boolean;
};

const DEFAULT_SEEDS = [
  { url: "https://www.tenders.gov.au/", label: "AusTender", strategy: "registry_tender_portal", country: "AU", region: "national", category: "tenders", priority: 90 },
  { url: "https://www.grants.gov.au/", label: "GrantConnect", strategy: "registry_grant_portal", country: "AU", region: "national", category: "grants", priority: 90 },
  { url: "https://www.tenders.vic.gov.au/", label: "Buying for Victoria", strategy: "state_tender_portal", country: "AU", region: "VIC", category: "tenders", priority: 80 },
  { url: "https://www.buy.nsw.gov.au/supplier-centre/opportunities", label: "NSW procurement opportunities", strategy: "state_tender_portal", country: "AU", region: "NSW", category: "tenders", priority: 80 },
  { url: "https://www.gets.govt.nz/", label: "NZ GETS", strategy: "registry_tender_portal", country: "NZ", region: "national", category: "tenders", priority: 80 },
  { url: "https://creative.gov.au/investment-and-development/", label: "Creative Australia investment", strategy: "creative_funding_registry", country: "AU", region: "national", category: "creative_funding", priority: 70 },
  { url: "https://business.govt.nz/", label: "NZ business support", strategy: "business_support_registry", country: "NZ", region: "national", category: "grants", priority: 65 },
];

const STRATEGY_PATTERNS = [
  { strategy: "registry_tender_portal", pattern: /(tender|procurement|supplier|contract|opportunit)/i, sourceType: "government_tenders", category: "tenders", weight: 34 },
  { strategy: "registry_grant_portal", pattern: /(grant|funding|program|investment|support)/i, sourceType: "government_grants", category: "grants", weight: 32 },
  { strategy: "state_tender_portal", pattern: /(tender|procurement|buy|supplier|contract)/i, sourceType: "government_tenders", category: "tenders", weight: 30 },
  { strategy: "creative_funding_registry", pattern: /(creative|arts|screen|culture|fund|grant|investment)/i, sourceType: "creative_grants", category: "creative_funding", weight: 26 },
  { strategy: "business_support_registry", pattern: /(business|startup|innovation|digital|grant|funding|program)/i, sourceType: "business_grants", category: "grants", weight: 24 },
  { strategy: "digital_service_signal", pattern: /(digital|technology|platform|website|portal|service|innovation|ai|automation)/i, sourceType: "government_digital_signal", category: "digital_services", weight: 20 },
];

const BAD_URL_PATTERN = /(login|signin|register|cart|privacy|terms|facebook|instagram|linkedin|twitter|x\.com|youtube|tiktok|\.pdf$|\.jpg$|\.png$|\.zip$|mailto:|tel:)/i;

function normalizeUrl(raw: string, base?: string) {
  try {
    const url = new URL(raw.trim(), base);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function domainOf(raw: string) {
  try {
    return new URL(raw).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
  }
}

function classifyConfidence(score: number): "low" | "medium" | "high" {
  if (score >= 78) return "high";
  if (score >= 55) return "medium";
  return "low";
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function ensureTables(env: Env) {
  return {
    seeds: await tableExists(env, "source_expansion_seeds"),
    candidates: await tableExists(env, "source_expansion_candidates"),
    runs: await tableExists(env, "source_expansion_runs"),
    attempts: await tableExists(env, "source_expansion_attempts"),
    rejections: await tableExists(env, "source_expansion_rejections"),
    strategyScores: await tableExists(env, "source_expansion_strategy_scores"),
  };
}

export async function bootstrapSourceExpansionSeeds(env: Env) {
  const tables = await ensureTables(env);
  if (!tables.seeds) return { ok: false, error: "missing_migration", requiredMigration: "0007_source_expansion_memory.sql" };
  const now = nowISO();
  let inserted = 0;
  for (const seed of DEFAULT_SEEDS) {
    const id = uuid();
    const result = await env.DB.prepare(
      `INSERT OR IGNORE INTO source_expansion_seeds (id, url, label, strategy, country, region, category, status, priority, depth, next_run_at_iso, notes, created_at_iso, updated_at_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, 0, ?, 'Bootstrapped default expansion seed', ?, ?)`
    ).bind(id, seed.url, seed.label, seed.strategy, seed.country, seed.region, seed.category, seed.priority, now, now, now).run();
    if (result.meta?.changes) inserted += Number(result.meta.changes || 0);
  }
  if (inserted) await logEvent(env, "source_expansion_seeds_bootstrapped", `Bootstrapped ${inserted} source expansion seed(s).`);
  return { ok: true, inserted, seedCount: DEFAULT_SEEDS.length };
}

function strategyAdjustment(recommendation?: string | null) {
  if (recommendation === "prioritise_strategy") return 12;
  if (recommendation === "continue_strategy") return 7;
  if (recommendation === "tighten_strategy_filters") return -4;
  if (recommendation === "cool_down_strategy") return -14;
  if (recommendation === "deprioritise_strategy") return -18;
  return 0;
}

function selectionReason(seed: ExpansionSeed) {
  const parts = [`seed_priority:${seed.priority}`, `seed_quality:${seed.quality_score}`];
  if (seed.strategy_quality_score !== null && seed.strategy_quality_score !== undefined) parts.push(`strategy_quality:${seed.strategy_quality_score}`);
  if (seed.strategy_recommendation) parts.push(`strategy_recommendation:${seed.strategy_recommendation}`);
  if (seed.selection_score !== null && seed.selection_score !== undefined) parts.push(`selection_score:${seed.selection_score}`);
  return parts.join("|");
}

async function dueSeeds(env: Env, options: ExpansionOptions): Promise<ExpansionSeed[]> {
  const now = nowISO();
  const limit = Math.max(1, Math.min(25, Math.round(Number(options.limitSeeds || 5))));
  const clauses = ["s.status = 'active'", "(s.cooldown_until_iso IS NULL OR s.cooldown_until_iso <= ?)", "(s.next_run_at_iso IS NULL OR s.next_run_at_iso <= ?)"];
  const binds: any[] = [now, now];
  if (options.strategy) {
    clauses.push("s.strategy = ?");
    binds.push(options.strategy);
  }
  binds.push(limit);

  const strategyJoin = await tableExists(env, "source_expansion_strategy_scores");
  const rows = await env.DB.prepare(
    `SELECT
       s.id,
       s.url,
       s.label,
       s.strategy,
       s.country,
       s.region,
       s.category,
       s.status,
       s.priority,
       s.depth,
       s.quality_score,
       ${strategyJoin ? "COALESCE(ss.quality_score, 50)" : "50"} AS strategy_quality_score,
       ${strategyJoin ? "ss.recommendation" : "NULL"} AS strategy_recommendation,
       (s.priority * 0.45 + s.quality_score * 0.35 + ${strategyJoin ? "COALESCE(ss.quality_score, 50)" : "50"} * 0.20 + ${strategyJoin ? "CASE ss.recommendation WHEN 'prioritise_strategy' THEN 12 WHEN 'continue_strategy' THEN 7 WHEN 'tighten_strategy_filters' THEN -4 WHEN 'cool_down_strategy' THEN -14 WHEN 'deprioritise_strategy' THEN -18 ELSE 0 END" : "0"}) AS selection_score
     FROM source_expansion_seeds s
     ${strategyJoin ? "LEFT JOIN source_expansion_strategy_scores ss ON ss.strategy = s.strategy" : ""}
     WHERE ${clauses.join(" AND ")}
     ORDER BY selection_score DESC, s.priority DESC, s.quality_score DESC, s.updated_at_iso ASC
     LIMIT ?`
  ).bind(...binds).all<ExpansionSeed>();

  return (rows.results || []).map((seed) => ({
    ...seed,
    selection_reason: selectionReason(seed),
  }));
}

function extractLinks(html: string, baseUrl: string, maxLinks: number) {
  const links: Array<{ url: string; text: string }> = [];
  const regex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) && links.length < maxLinks) {
    const url = normalizeUrl(match[1], baseUrl);
    if (!url || BAD_URL_PATTERN.test(url)) continue;
    const text = String(match[2] || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
    if (!text && !/(tender|grant|funding|procurement|opportunit|supplier|digital|creative)/i.test(url)) continue;
    links.push({ url, text });
  }
  return links;
}

function scoreLink(link: { url: string; text: string }, seed: ExpansionSeed): ExpansionCandidate | null {
  const haystack = `${link.url} ${link.text}`.toLowerCase();
  if (BAD_URL_PATTERN.test(haystack)) return null;
  const reasons: string[] = [];
  let score = 18;
  let sourceType = seed.strategy || "opportunity_directory";
  let category = seed.category || null;

  for (const pattern of STRATEGY_PATTERNS) {
    if (pattern.pattern.test(haystack)) {
      score += pattern.weight;
      sourceType = pattern.sourceType;
      category = category || pattern.category;
      reasons.push(`strategy:${pattern.strategy}`);
    }
  }

  const domain = domainOf(link.url);
  if (/\.gov\.au$|\.govt\.nz$|gov\.au$|govt\.nz$/.test(domain)) {
    score += 18;
    reasons.push("authority:government_domain");
  }
  if (/tender|grant|procurement|funding|supplier|opportunit/.test(haystack)) {
    score += 16;
    reasons.push("keyword:opportunity_source_language");
  }
  if (/digital|technology|website|portal|platform|innovation|creative|screen|arts/.test(haystack)) {
    score += 8;
    reasons.push("keyword:evavo_relevance");
  }
  if (domain === domainOf(seed.url)) {
    score += 4;
    reasons.push("same_domain:seed_deepening");
  }
  if (seed.strategy_quality_score !== null && seed.strategy_quality_score !== undefined) {
    const adjustment = Math.round((Number(seed.strategy_quality_score) - 50) * 0.18) + strategyAdjustment(seed.strategy_recommendation);
    if (adjustment !== 0) {
      score += adjustment;
      reasons.push(`strategy_quality_adjustment:${adjustment}`);
    }
  }

  if (!reasons.length || score < 35) return null;
  score = Math.max(0, Math.min(100, Math.round(score)));
  return {
    url: link.url,
    domain,
    label: link.text || domain,
    sourceType,
    country: seed.country || null,
    region: seed.region || null,
    category,
    score,
    confidence: classifyConfidence(score),
    strategy: seed.strategy,
    reasons,
    evidence: { seedId: seed.id, seedUrl: seed.url, seedSelectionReason: seed.selection_reason, strategyQualityScore: seed.strategy_quality_score ?? null, strategyRecommendation: seed.strategy_recommendation ?? null, linkText: link.text, discoveredAtISO: nowISO() },
  };
}

async function existingSourceDomains(env: Env) {
  if (!(await tableExists(env, "opportunity_sources"))) return new Set<string>();
  const rows = await env.DB.prepare("SELECT url FROM opportunity_sources LIMIT 5000").all<{ url: string }>();
  return new Set((rows.results || []).map((row) => domainOf(row.url)));
}

async function upsertCandidate(env: Env, candidate: ExpansionCandidate, seed: ExpansionSeed, existingDomains: Set<string>) {
  const now = nowISO();
  if (existingDomains.has(candidate.domain)) {
    await env.DB.prepare(
      `INSERT INTO source_expansion_candidates (id, url, domain, label, source_type, country, region, category, status, score, confidence, strategy, seed_id, discovery_depth, reasons_json, evidence_json, first_seen_at_iso, last_seen_at_iso, duplicate_count, quality_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'duplicate_existing_source', ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
       ON CONFLICT(url) DO UPDATE SET
         last_seen_at_iso = excluded.last_seen_at_iso,
         duplicate_count = duplicate_count + 1,
         status = 'duplicate_existing_source',
         evidence_json = excluded.evidence_json`
    ).bind(uuid(), candidate.url, candidate.domain, candidate.label, candidate.sourceType, candidate.country, candidate.region, candidate.category, candidate.score, candidate.confidence, candidate.strategy, seed.id, seed.depth + 1, JSON.stringify(candidate.reasons), JSON.stringify(candidate.evidence), now, now, candidate.score).run();
    return "duplicate" as const;
  }

  const result = await env.DB.prepare(
    `INSERT INTO source_expansion_candidates (id, url, domain, label, source_type, country, region, category, status, score, confidence, strategy, seed_id, discovery_depth, reasons_json, evidence_json, first_seen_at_iso, last_seen_at_iso, next_review_at_iso, quality_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'candidate', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET
       label = excluded.label,
       source_type = excluded.source_type,
       country = excluded.country,
       region = excluded.region,
       category = excluded.category,
       score = MAX(score, excluded.score),
       confidence = excluded.confidence,
       strategy = excluded.strategy,
       seed_id = excluded.seed_id,
       reasons_json = excluded.reasons_json,
       evidence_json = excluded.evidence_json,
       last_seen_at_iso = excluded.last_seen_at_iso,
       seen_count = seen_count + 1,
       quality_score = MAX(quality_score, excluded.quality_score)`
  ).bind(uuid(), candidate.url, candidate.domain, candidate.label, candidate.sourceType, candidate.country, candidate.region, candidate.category, candidate.score, candidate.confidence, candidate.strategy, seed.id, seed.depth + 1, JSON.stringify(candidate.reasons), JSON.stringify(candidate.evidence), now, now, now, candidate.score).run();

  return result.meta?.changes ? "saved" as const : "updated" as const;
}

async function startRun(env: Env, options: ExpansionOptions, seeds: ExpansionSeed[]) {
  const id = uuid();
  const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO source_expansion_runs (id, run_type, strategy, started_at_iso, status, settings_json)
     VALUES (?, 'source_expansion', ?, ?, 'running', ?)`
  ).bind(id, options.strategy || null, now, JSON.stringify({ ...options, selectedSeeds: seeds.map((seed) => ({ id: seed.id, url: seed.url, strategy: seed.strategy, selectionScore: seed.selection_score, selectionReason: seed.selection_reason })) })).run();
  return id;
}

async function finishRun(env: Env, runId: string, patch: Record<string, unknown>) {
  await env.DB.prepare(
    `UPDATE source_expansion_runs SET
       finished_at_iso = ?,
       status = ?,
       seeds_checked = ?,
       pages_fetched = ?,
       links_found = ?,
       candidates_found = ?,
       candidates_new = ?,
       candidates_updated = ?,
       candidates_rejected = ?,
       skipped = ?,
       failed = ?,
       error = ?
     WHERE id = ?`
  ).bind(
    nowISO(),
    patch.status || "completed",
    patch.seedsChecked || 0,
    patch.pagesFetched || 0,
    patch.linksFound || 0,
    patch.candidatesFound || 0,
    patch.candidatesNew || 0,
    patch.candidatesUpdated || 0,
    patch.candidatesRejected || 0,
    patch.skipped || 0,
    patch.failed || 0,
    patch.error || null,
    runId,
  ).run();
}

export async function runSourceExpansion(env: Env, options: ExpansionOptions = {}) {
  const tables = await ensureTables(env);
  if (!tables.seeds || !tables.candidates || !tables.runs || !tables.attempts) {
    return { ok: false, error: "missing_migration", requiredMigration: "0007_source_expansion_memory.sql", tables };
  }

  await bootstrapSourceExpansionSeeds(env);
  const maxFetches = Math.max(1, Math.min(10, Math.round(Number(options.maxFetches || 3))));
  const maxLinksPerSeed = Math.max(5, Math.min(80, Math.round(Number(options.maxLinksPerSeed || 40))));
  const maxCandidates = Math.max(5, Math.min(100, Math.round(Number(options.maxCandidates || 40))));
  const seeds = await dueSeeds(env, { ...options, limitSeeds: Math.min(options.limitSeeds || maxFetches, maxFetches) });
  const runId = await startRun(env, { ...options, maxFetches, maxLinksPerSeed, maxCandidates }, seeds);
  const existingDomains = await existingSourceDomains(env);
  const seenCandidates: ExpansionCandidate[] = [];
  let pagesFetched = 0;
  let linksFound = 0;
  let candidatesFound = 0;
  let candidatesNew = 0;
  let candidatesUpdated = 0;
  let candidatesRejected = 0;
  let skipped = 0;
  let failed = 0;

  for (const seed of seeds) {
    if (pagesFetched >= maxFetches || seenCandidates.length >= maxCandidates) break;
    const attemptId = uuid();
    const started = Date.now();
    let fetchStatus: number | null = null;
    let contentType: string | null = null;
    let bytes = 0;
    let seedLinksFound = 0;
    let seedCandidatesFound = 0;
    let seedCandidatesNew = 0;
    let seedCandidatesUpdated = 0;
    let seedCandidatesRejected = 0;
    let error: string | null = null;

    try {
      const response = await fetch(seed.url, { headers: { "user-agent": "EVAVO Opportunity Intelligence Source Discovery/1.0" } });
      fetchStatus = response.status;
      contentType = response.headers.get("content-type");
      const html = await response.text();
      bytes = html.length;
      pagesFetched += 1;
      if (!response.ok) throw new Error(`fetch_status_${response.status}`);
      if (contentType && !/html|text/i.test(contentType)) throw new Error(`unsupported_content_type_${contentType}`);

      const links = extractLinks(html, seed.url, maxLinksPerSeed);
      linksFound += links.length;
      seedLinksFound = links.length;
      for (const link of links) {
        if (seenCandidates.length >= maxCandidates) break;
        const candidate = scoreLink(link, seed);
        if (!candidate) {
          candidatesRejected += 1;
          seedCandidatesRejected += 1;
          continue;
        }
        candidatesFound += 1;
        seedCandidatesFound += 1;
        const result = await upsertCandidate(env, candidate, seed, existingDomains);
        if (result === "saved") {
          candidatesNew += 1;
          seedCandidatesNew += 1;
        } else if (result === "updated" || result === "duplicate") {
          candidatesUpdated += 1;
          seedCandidatesUpdated += 1;
        }
        seenCandidates.push(candidate);
      }

      await env.DB.prepare(
        `UPDATE source_expansion_seeds SET
           last_run_at_iso = ?,
           next_run_at_iso = ?,
           success_count = success_count + 1,
           candidate_count = candidate_count + ?,
           quality_score = MIN(100, quality_score + ?),
           notes = ?,
           updated_at_iso = ?
         WHERE id = ?`
      ).bind(nowISO(), new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(), seedCandidatesFound, seedCandidatesFound ? 3 : 0, `Last selected: ${seed.selection_reason}`, nowISO(), seed.id).run();
    } catch (err) {
      failed += 1;
      error = err instanceof Error ? err.message : String(err);
      await env.DB.prepare(
        `UPDATE source_expansion_seeds SET
           last_run_at_iso = ?,
           next_run_at_iso = ?,
           cooldown_until_iso = ?,
           failure_count = failure_count + 1,
           quality_score = MAX(0, quality_score - 8),
           notes = ?,
           updated_at_iso = ?
         WHERE id = ?`
      ).bind(nowISO(), new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(), new Date(Date.now() + 1000 * 60 * 60 * 24 * 3).toISOString(), `Failed after selection: ${seed.selection_reason}`, nowISO(), seed.id).run();
    }

    await env.DB.prepare(
      `INSERT INTO source_expansion_attempts (id, run_id, seed_id, seed_url, strategy, fetch_status, content_type, elapsed_ms, bytes, links_found, candidates_found, candidates_new, candidates_updated, candidates_rejected, error, created_at_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(attemptId, runId, seed.id, seed.url, `${seed.strategy}|${seed.selection_reason || "selection_reason:unknown"}`, fetchStatus, contentType, Date.now() - started, bytes, seedLinksFound, seedCandidatesFound, seedCandidatesNew, seedCandidatesUpdated, seedCandidatesRejected, error, nowISO()).run();
  }

  await finishRun(env, runId, {
    status: failed && !pagesFetched ? "failed" : "completed",
    seedsChecked: seeds.length,
    pagesFetched,
    linksFound,
    candidatesFound,
    candidatesNew,
    candidatesUpdated,
    candidatesRejected,
    skipped,
    failed,
  });

  await logEvent(env, "source_expansion_run", `Source expansion run checked ${seeds.length} seed(s), found ${candidatesFound} candidate(s), new ${candidatesNew}.`);

  return {
    ok: true,
    mode: "source_expansion_run",
    runId,
    seedsChecked: seeds.length,
    selectedSeeds: seeds.map((seed) => ({ id: seed.id, url: seed.url, strategy: seed.strategy, selectionScore: seed.selection_score, selectionReason: seed.selection_reason })),
    pagesFetched,
    linksFound,
    candidatesFound,
    candidatesNew,
    candidatesUpdated,
    candidatesRejected,
    skipped,
    failed,
    preview: seenCandidates.slice(0, 25),
    safety: {
      bounded: true,
      maxFetches,
      maxLinksPerSeed,
      maxCandidates,
      callsAI: false,
      sendsEmail: false,
      savesOpportunitySources: false,
      candidateSaveStillRequiresConfirmation: true,
    },
  };
}

export async function listSourceExpansionCandidates(env: Env, options: { status?: string; limit?: number } = {}) {
  const tables = await ensureTables(env);
  if (!tables.candidates) return { ok: false, error: "missing_migration", requiredMigration: "0007_source_expansion_memory.sql", tables };
  const status = options.status || "candidate";
  const limit = Math.max(1, Math.min(100, Math.round(Number(options.limit || 50))));
  const rows = await env.DB.prepare(
    `SELECT id, url, domain, label, source_type, country, region, category, status, score, confidence, strategy, seed_id, discovery_depth, reasons_json, evidence_json, first_seen_at_iso, last_seen_at_iso, seen_count, duplicate_count, failure_count, quality_score
     FROM source_expansion_candidates
     WHERE status = ?
     ORDER BY score DESC, quality_score DESC, last_seen_at_iso DESC
     LIMIT ?`
  ).bind(status, limit).all<any>();
  return { ok: true, mode: "source_expansion_candidates", status, count: rows.results?.length || 0, candidates: rows.results || [] };
}
