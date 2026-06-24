import type { Env } from "../db";
import { logEvent, nowISO, uuid } from "../db";

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

function baseOrigin(raw: string) {
  try {
    return new URL(raw).origin;
  } catch {
    return null;
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
  urls.add(`${origin}/sitemap.xml`);
  urls.add(`${origin}/sitemap_index.xml`);
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
  let fetches = 0;
  let sitemapUrlsFound = 0;
  let candidatesNewOrUpdated = 0;
  let duplicates = 0;
  let failures = 0;

  for (const seed of seeds) {
    if (fetches >= maxFetches || discovered.length >= maxCandidates) break;
    const origin = baseOrigin(seed.url);
    if (!origin) continue;
    let sitemapUrls = [`${origin}/sitemap.xml`];
    try {
      const robots = await fetch(`${origin}/robots.txt`, { headers: { "user-agent": "EVAVO Opportunity Intelligence Source Discovery/1.0" } });
      fetches += 1;
      if (robots.ok) sitemapUrls = robotsSitemapUrls(await robots.text(), origin);
    } catch {
      failures += 1;
    }

    for (const sitemapUrl of sitemapUrls) {
      if (fetches >= maxFetches || discovered.length >= maxCandidates) break;
      try {
        const response = await fetch(sitemapUrl, { headers: { "user-agent": "EVAVO Opportunity Intelligence Source Discovery/1.0" } });
        fetches += 1;
        if (!response.ok) continue;
        const xml = await response.text();
        const locs = extractSitemapLocs(xml, sitemapUrl, maxSitemapUrls);
        sitemapUrlsFound += locs.length;
        for (const loc of locs) {
          if (discovered.length >= maxCandidates) break;
          const candidate = candidateFromUrl(loc, seed);
          if (!candidate) continue;
          const status = await upsertCandidate(env, candidate, seed, existing);
          if (status === "duplicate_existing_source") duplicates += 1;
          else candidatesNewOrUpdated += 1;
          discovered.push(candidate);
        }
      } catch {
        failures += 1;
      }
    }
  }

  await logEvent(env, "source_expansion_sitemap_run", `Sitemap expansion checked ${seeds.length} seed(s), found ${discovered.length} candidate(s).`);
  return {
    ok: true,
    mode: "source_expansion_sitemap_run",
    seedsChecked: seeds.length,
    fetches,
    sitemapUrlsFound,
    candidatesFound: discovered.length,
    candidatesNewOrUpdated,
    duplicates,
    failures,
    preview: discovered.slice(0, 25),
    safety: { bounded: true, maxFetches, maxSitemapUrls, maxCandidates, callsAI: false, sendsEmail: false, savesOpportunitySources: false, candidateSaveStillRequiresConfirmation: true },
  };
}
