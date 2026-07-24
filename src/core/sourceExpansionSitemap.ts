import type { Env } from "../db";
import { logEvent, nowISO, uuid } from "../db";
import { fetchPublicResearchText, validatePublicResearchUrl } from "./publicResearchFetch";

type SitemapSeed = {
  id: string;
  url: string;
  label?: string | null;
  strategy: string;
  country?: string | null;
  region?: string | null;
  category?: string | null;
  quality_score?: number | null;
};

type SitemapCandidate = {
  url: string;
  domain: string;
  label: string;
  score: number;
  confidence: "low" | "medium" | "high";
  sourceType: string;
  country: string | null;
  region: string | null;
  category: string | null;
  reasons: string[];
  evidence: Record<string, unknown>;
};

const OPPORTUNITY_PATH_PATTERN = /(tender|tenders|procurement|supplier|suppliers|contract|contracts|grant|grants|funding|funds|investment|opportunit|rfp|eoi|panel|marketplace|creative|screen|innovation|digital)/i;
const NOISE_PATH_PATTERN = /(login|signin|register|cart|privacy|terms|policy|cookie|contact|about|news|media|event|blog|\.pdf$|\.jpg$|\.png$|\.zip$)/i;

function normalizeUrl(raw: string, base?: string) {
  const decision = validatePublicResearchUrl(raw.trim(), base);
  return decision.ok && decision.url ? decision.url.replace(/\/+$/, "") : null;
}

function domainOf(raw: string) {
  try {
    return new URL(raw).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
  }
}

function baseOrigin(raw: string) {
  const decision = validatePublicResearchUrl(raw);
  if (!decision.ok || !decision.url) return null;
  return new URL(decision.url).origin;
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

async function activeSeeds(env: Env, limit: number) {
  const hasExpansionSeeds = await tableExists(env, "source_expansion_seeds");
  if (hasExpansionSeeds) {
    const rows = await env.DB.prepare(
      `SELECT id, url, label, strategy, country, region, category, quality_score
       FROM source_expansion_seeds
       WHERE status = 'active'
       ORDER BY quality_score DESC, priority DESC, updated_at_iso ASC
       LIMIT ?`
    ).bind(limit).all<SitemapSeed>();
    return rows.results || [];
  }
  const hasSources = await tableExists(env, "opportunity_sources");
  if (!hasSources) return [];
  const rows = await env.DB.prepare(
    `SELECT id, url, label, source_type AS strategy, country, region, category, priority AS quality_score
     FROM opportunity_sources
     WHERE status = 'active'
     ORDER BY priority DESC, updated_at_iso ASC
     LIMIT ?`
  ).bind(limit).all<SitemapSeed>();
  return rows.results || [];
}

async function existingDomains(env: Env) {
  if (!(await tableExists(env, "opportunity_sources"))) return new Set<string>();
  const rows = await env.DB.prepare("SELECT url FROM opportunity_sources LIMIT 5000").all<{ url: string }>();
  return new Set((rows.results || []).map((row) => domainOf(row.url)));
}

function robotsSitemapUrls(robotsText: string, origin: string) {
  const urls = new Set<string>();
  const lines = robotsText.split(/\r?\n/);
  for (const line of lines) {
    const match = line.match(/^\s*Sitemap\s*:\s*(.+)$/i);
    if (!match) continue;
    const url = normalizeUrl(match[1]);
    if (url) urls.add(url);
  }
  const standardSitemap = normalizeUrl(`${origin}/sitemap.xml`);
  const standardIndex = normalizeUrl(`${origin}/sitemap_index.xml`);
  if (standardSitemap) urls.add(standardSitemap);
  if (standardIndex) urls.add(standardIndex);
  return Array.from(urls).slice(0, 5);
}

function extractSitemapLocs(xml: string, sitemapUrl: string, max: number) {
  const locs = new Set<string>();
  const regex = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(xml)) && locs.size < max) {
    const url = normalizeUrl(match[1], sitemapUrl);
    if (!url || NOISE_PATH_PATTERN.test(url)) continue;
    if (OPPORTUNITY_PATH_PATTERN.test(url)) locs.add(url);
  }
  return Array.from(locs);
}

function candidateFromUrl(url: string, seed: SitemapSeed): SitemapCandidate | null {
  const lower = url.toLowerCase();
  if (!OPPORTUNITY_PATH_PATTERN.test(lower) || NOISE_PATH_PATTERN.test(lower)) return null;
  const reasons: string[] = ["sitemap:opportunity_path_match"];
  let score = 35;
  let category = seed.category || "opportunities";
  let sourceType = "sitemap_discovered_source";
  if (/tender|procurement|supplier|contract|rfp|eoi|panel/.test(lower)) { score += 26; category = "tenders"; sourceType = "government_tenders"; reasons.push("sitemap:tender_procurement_signal"); }
  if (/grant|funding|funds|investment/.test(lower)) { score += 24; category = "grants"; sourceType = "government_grants"; reasons.push("sitemap:grant_funding_signal"); }
  if (/digital|innovation|technology|creative|screen/.test(lower)) { score += 10; reasons.push("sitemap:evavo_relevance_signal"); }
  const domain = domainOf(url);
  if (/\.gov\.au$|\.govt\.nz$|gov\.au$|govt\.nz$/.test(domain)) { score += 12; reasons.push("sitemap:government_domain"); }
  score += Math.round((Number(seed.quality_score || 50) - 50) * 0.12);
  score = Math.max(0, Math.min(100, Math.round(score)));
  if (score < 40) return null;
  return {
    url,
    domain,
    label: url.replace(/^https?:\/\//i, "").slice(0, 140),
    score,
    confidence: confidence(score),
    sourceType,
    country: seed.country || null,
    region: seed.region || null,
    category,
    reasons,
    evidence: { seedId: seed.id, seedUrl: seed.url, sitemapStrategy: true, discoveredAtISO: nowISO() },
  };
}

async function upsertCandidate(env: Env, candidate: SitemapCandidate, seed: SitemapSeed, existing: Set<string>) {
  const now = nowISO();
  const status = existing.has(candidate.domain) ? "duplicate_existing_source" : "candidate";
  await env.DB.prepare(
    `INSERT INTO source_expansion_candidates (id, url, domain, label, source_type, country, region, category, status, score, confidence, strategy, seed_id, discovery_depth, reasons_json, evidence_json, first_seen_at_iso, last_seen_at_iso, next_review_at_iso, quality_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sitemap_discovery', ?, 1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET
       label = excluded.label,
       source_type = excluded.source_type,
       status = CASE WHEN status = 'saved' THEN status ELSE excluded.status END,
       score = MAX(score, excluded.score),
       confidence = excluded.confidence,
       strategy = 'sitemap_discovery',
       seed_id = excluded.seed_id,
       reasons_json = excluded.reasons_json,
       evidence_json = excluded.evidence_json,
       last_seen_at_iso = excluded.last_seen_at_iso,
       seen_count = seen_count + 1,
       quality_score = MAX(quality_score, excluded.quality_score)`
  ).bind(uuid(), candidate.url, candidate.domain, candidate.label, candidate.sourceType, candidate.country, candidate.region, candidate.category, status, candidate.score, candidate.confidence, seed.id, JSON.stringify(candidate.reasons), JSON.stringify(candidate.evidence), now, now, now, candidate.score).run();
  return status;
}

function receipt(result: Awaited<ReturnType<typeof fetchPublicResearchText>>, kind: "robots" | "sitemap") {
  return {
    kind,
    contract: result.contract,
    requestedUrl: result.requestedUrl,
    finalUrl: result.finalUrl,
    status: result.status,
    contentType: result.contentType,
    bytes: result.bytes,
    bodySha256: result.bodySha256,
    redirectCount: result.redirectCount,
    elapsedMs: result.elapsedMs,
    fetchedAtISO: result.fetchedAtISO,
    timeoutScope: result.timeoutScope,
    error: result.error,
  };
}

export async function runSitemapSourceExpansion(env: Env, options: { limitSeeds?: number; maxFetches?: number; maxSitemapUrls?: number; maxCandidates?: number } = {}) {
  const hasCandidates = await tableExists(env, "source_expansion_candidates");
  if (!hasCandidates) return { ok: false, error: "missing_migration", requiredMigration: "0007_source_expansion_memory.sql" };
  const limitSeeds = Math.max(1, Math.min(10, Math.round(Number(options.limitSeeds || 3))));
  const maxFetches = Math.max(1, Math.min(10, Math.round(Number(options.maxFetches || 4))));
  const maxSitemapUrls = Math.max(5, Math.min(100, Math.round(Number(options.maxSitemapUrls || 50))));
  const maxCandidates = Math.max(5, Math.min(100, Math.round(Number(options.maxCandidates || 30))));
  const seeds = await activeSeeds(env, limitSeeds);
  const existing = await existingDomains(env);
  const discovered: SitemapCandidate[] = [];
  const fetchReceipts: Array<Record<string, unknown>> = [];
  let fetches = 0;
  let successfulFetches = 0;
  let sitemapUrlsFound = 0;
  let candidatesNewOrUpdated = 0;
  let duplicates = 0;
  let failures = 0;
  let lastFailureCode: string | null = null;

  for (const seed of seeds) {
    if (fetches >= maxFetches || discovered.length >= maxCandidates) break;
    const origin = baseOrigin(seed.url);
    if (!origin) {
      failures += 1;
      lastFailureCode = "invalid_research_url";
      continue;
    }
    let sitemapUrls = robotsSitemapUrls("", origin);
    const robotsUrl = normalizeUrl(`${origin}/robots.txt`);
    if (robotsUrl && fetches < maxFetches) {
      const robots = await fetchPublicResearchText(robotsUrl, { maxBytes: 262_144 });
      fetches += 1;
      fetchReceipts.push({ seedId: seed.id, ...receipt(robots, "robots") });
      if (robots.ok) {
        successfulFetches += 1;
        sitemapUrls = robotsSitemapUrls(robots.body, origin);
      } else {
        failures += 1;
        lastFailureCode = robots.error || "research_fetch_failed";
      }
    }

    for (const sitemapUrl of sitemapUrls) {
      if (fetches >= maxFetches || discovered.length >= maxCandidates) break;
      const response = await fetchPublicResearchText(sitemapUrl, { maxBytes: 1_048_576 });
      fetches += 1;
      const sitemapReceipt = receipt(response, "sitemap");
      fetchReceipts.push({ seedId: seed.id, ...sitemapReceipt });
      if (!response.ok) {
        failures += 1;
        lastFailureCode = response.error || "research_fetch_failed";
        continue;
      }
      successfulFetches += 1;
      const effectiveSitemapUrl = response.finalUrl || sitemapUrl;
      const locs = extractSitemapLocs(response.body, effectiveSitemapUrl, maxSitemapUrls);
      sitemapUrlsFound += locs.length;
      for (const loc of locs) {
        if (discovered.length >= maxCandidates) break;
        const candidate = candidateFromUrl(loc, seed);
        if (!candidate) continue;
        candidate.evidence = { ...candidate.evidence, sitemapFetch: sitemapReceipt };
        const status = await upsertCandidate(env, candidate, seed, existing);
        if (status === "duplicate_existing_source") duplicates += 1;
        else candidatesNewOrUpdated += 1;
        discovered.push(candidate);
      }
    }
  }

  const runStatus = seeds.length === 0
    ? "skipped"
    : failures > 0 && successfulFetches === 0
      ? "failed"
      : "completed";
  const runError = runStatus === "skipped"
    ? "no_active_seeds"
    : runStatus === "failed"
      ? lastFailureCode || "all_sitemap_fetches_failed"
      : failures > 0
        ? `partial_source_failures:${failures}`
        : null;
  await logEvent(env, "source_expansion_sitemap_run", `Confirmed sitemap expansion attempted ${fetches} fetch(es), successful ${successfulFetches}, failed ${failures}, found ${discovered.length} candidate(s).`);
  return {
    ok: true,
    mode: "source_expansion_sitemap_run",
    fetchContract: "public_research_fetch_v1",
    runStatus,
    runError,
    seedsChecked: seeds.length,
    fetches,
    successfulFetches,
    sitemapUrlsFound,
    candidatesFound: discovered.length,
    candidatesNewOrUpdated,
    duplicates,
    failures,
    fetchReceipts: fetchReceipts.slice(0, 15),
    preview: discovered.slice(0, 25),
    safety: { bounded: true, publicWebOnly: true, redirectsValidated: true, responseBytesBounded: true, fullOperationTimeout: true, maxFetches, maxSitemapUrls, maxCandidates, callsAI: false, sendsEmail: false, savesOpportunitySources: false, candidateSaveStillRequiresConfirmation: true },
  };
}
