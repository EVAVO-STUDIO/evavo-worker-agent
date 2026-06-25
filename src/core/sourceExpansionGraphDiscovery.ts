import type { Env } from "../db";
import { logEvent, nowISO, uuid } from "../db";

type GraphSeed = {
  id: string | null;
  url: string;
  label?: string | null;
  country?: string | null;
  region?: string | null;
  category?: string | null;
  strategy?: string | null;
};

type GraphCandidate = {
  url: string;
  domain: string;
  label: string;
  sourceType: string;
  country?: string | null;
  region?: string | null;
  category: string;
  score: number;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  evidence: Record<string, unknown>;
};

function normalizeUrl(raw: string, base?: string) {
  try {
    const url = base ? new URL(raw, base) : new URL(raw);
    if (!/^https?:$/.test(url.protocol)) return null;
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

function labelFromUrl(url: string) {
  const domain = domainOf(url).replace(/\.(gov\.au|govt\.nz|com\.au|org\.au|com|org|net)$/i, "");
  return domain.split(/[.-]/).filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") || domainOf(url);
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function extractLinks(html: string, baseUrl: string, maxLinks: number) {
  const links: string[] = [];
  const regex = /<a\s+[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) && links.length < maxLinks) {
    const href = normalizeUrl(match[1], baseUrl);
    if (!href) continue;
    links.push(href);
  }
  return unique(links).slice(0, maxLinks);
}

function isNoiseUrl(url: string) {
  const lower = url.toLowerCase();
  if (/facebook|instagram|linkedin|twitter\.com|x\.com|youtube|tiktok|mailto:|tel:/.test(lower)) return true;
  if (/\.(pdf|jpg|jpeg|png|gif|svg|zip|doc|docx|xls|xlsx|ppt|pptx)(\?|$)/.test(lower)) return true;
  if (/\/login|\/signin|\/account|\/privacy|\/terms|\/cookie|\/search\?/.test(lower)) return true;
  return false;
}

function classifyGraphLink(url: string, seed: GraphSeed) {
  const lower = url.toLowerCase();
  const reasons: string[] = ["graph_discovery:public_link" ];
  let score = 26;
  let sourceType = "relationship_graph_source";
  let category = seed.category || "opportunities";

  if (/partner|partners|ecosystem|alliance|allies/.test(lower)) { score += 24; reasons.push("graph_discovery:partner_signal"); sourceType = "partner_directory"; category = "partner_signals"; }
  if (/client|clients|customer|customers|case-stud|case_stud|work|portfolio/.test(lower)) { score += 20; reasons.push("graph_discovery:client_or_work_signal"); sourceType = "client_directory"; category = "market_signals"; }
  if (/supplier|suppliers|vendor|vendors|procurement|panel|contractor|contractors/.test(lower)) { score += 26; reasons.push("graph_discovery:supplier_procurement_signal"); sourceType = "supplier_directory"; category = "supplier_panels"; }
  if (/grant|funding|funded|program|accelerator|incubator/.test(lower)) { score += 24; reasons.push("graph_discovery:funding_signal"); sourceType = "funding_directory"; category = "grants"; }
  if (/tender|rfp|rfq|eoi|opportunit|procurement/.test(lower)) { score += 28; reasons.push("graph_discovery:opportunity_signal"); sourceType = "opportunity_directory"; category = "tenders"; }
  if (/digital|technology|innovation|creative|design|web|software|data|ai/.test(lower)) { score += 12; reasons.push("graph_discovery:evavo_relevant_signal"); }
  if (/\.gov\.au|\.govt\.nz|gov\.au|govt\.nz/.test(domainOf(url))) { score += 14; reasons.push("graph_discovery:government_domain"); }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const confidence = score >= 72 ? "high" : score >= 50 ? "medium" : "low";
  return { score, confidence, sourceType, category, reasons } as const;
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function existingDomains(env: Env) {
  const domains = new Set<string>();
  if (await tableExists(env, "opportunity_sources")) {
    const rows = await env.DB.prepare("SELECT url FROM opportunity_sources LIMIT 10000").all<any>();
    for (const row of rows.results || []) domains.add(domainOf(row.url));
  }
  return domains;
}

async function seeds(env: Env, limit: number): Promise<GraphSeed[]> {
  if (await tableExists(env, "source_expansion_seeds")) {
    const rows = await env.DB.prepare(
      `SELECT id, url, label, country, region, category, strategy
       FROM source_expansion_seeds
       WHERE status = 'active'
       ORDER BY quality_score DESC, priority DESC, updated_at_iso DESC
       LIMIT ?`
    ).bind(limit).all<any>();
    if (rows.results?.length) return rows.results.map((row) => ({ id: row.id, url: row.url, label: row.label, country: row.country, region: row.region, category: row.category, strategy: row.strategy }));
  }
  if (await tableExists(env, "opportunity_sources")) {
    const rows = await env.DB.prepare(
      `SELECT id, url, label, country, region, category, source_type AS strategy
       FROM opportunity_sources
       WHERE status = 'active'
       ORDER BY priority DESC, updated_at_iso DESC
       LIMIT ?`
    ).bind(limit).all<any>();
    return (rows.results || []).map((row) => ({ id: row.id, url: row.url, label: row.label, country: row.country, region: row.region, category: row.category, strategy: row.strategy }));
  }
  return [];
}

async function upsertCandidate(env: Env, candidate: GraphCandidate, seed: GraphSeed) {
  const now = nowISO();
  const existing = await env.DB.prepare("SELECT id, seen_count, duplicate_count, status FROM source_expansion_candidates WHERE url = ? LIMIT 1").bind(candidate.url).first<any>();
  const evidence = JSON.stringify({ ...candidate.evidence, seedUrl: seed.url, seedLabel: seed.label || null, discoveryMethod: "relationship_graph" });
  const reasons = JSON.stringify(candidate.reasons);
  if (existing?.id) {
    await env.DB.prepare(
      `UPDATE source_expansion_candidates
       SET score = MAX(score, ?), confidence = ?, strategy = 'relationship_graph', reasons_json = ?, evidence_json = ?, last_seen_at_iso = ?, seen_count = seen_count + 1
       WHERE id = ?`
    ).bind(candidate.score, candidate.confidence, reasons, evidence, now, existing.id).run();
    return { inserted: false, updated: true };
  }
  await env.DB.prepare(
    `INSERT INTO source_expansion_candidates (id, url, domain, label, source_type, country, region, category, status, score, confidence, strategy, seed_id, discovery_depth, reasons_json, evidence_json, first_seen_at_iso, last_seen_at_iso, quality_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'candidate', ?, ?, 'relationship_graph', ?, 1, ?, ?, ?, ?, ?)`
  ).bind(uuid(), candidate.url, candidate.domain, candidate.label, candidate.sourceType, candidate.country || null, candidate.region || null, candidate.category, candidate.score, candidate.confidence, seed.id, reasons, evidence, now, now, Math.max(30, candidate.score)).run();
  return { inserted: true, updated: false };
}

export async function runRelationshipGraphDiscovery(env: Env, options: { limitSeeds?: number; maxFetches?: number; maxLinksPerSeed?: number; maxCandidates?: number } = {}) {
  if (!(await tableExists(env, "source_expansion_candidates"))) return { ok: false, error: "missing_migration", requiredMigration: "0007_source_expansion_memory.sql" };
  const limitSeeds = Math.max(1, Math.min(10, Math.round(Number(options.limitSeeds || 3))));
  const maxFetches = Math.max(1, Math.min(10, Math.round(Number(options.maxFetches || 3))));
  const maxLinksPerSeed = Math.max(10, Math.min(100, Math.round(Number(options.maxLinksPerSeed || 50))));
  const maxCandidates = Math.max(5, Math.min(100, Math.round(Number(options.maxCandidates || 40))));
  const existing = await existingDomains(env);
  const seedRows = await seeds(env, limitSeeds);
  let pagesFetched = 0;
  let linksFound = 0;
  let candidatesFound = 0;
  let candidatesNew = 0;
  let candidatesUpdated = 0;
  let duplicates = 0;
  let rejected = 0;
  let failed = 0;
  const found: GraphCandidate[] = [];

  for (const seed of seedRows) {
    if (pagesFetched >= maxFetches || found.length >= maxCandidates) break;
    try {
      const response = await fetch(seed.url, { headers: { accept: "text/html,application/xhtml+xml" } });
      pagesFetched += 1;
      if (!response.ok) { failed += 1; continue; }
      const contentType = response.headers.get("content-type") || "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) { rejected += 1; continue; }
      const html = await response.text();
      const links = extractLinks(html, seed.url, maxLinksPerSeed);
      linksFound += links.length;
      for (const link of links) {
        if (found.length >= maxCandidates) break;
        if (isNoiseUrl(link)) { rejected += 1; continue; }
        const domain = domainOf(link);
        if (domain === domainOf(seed.url)) continue;
        if (existing.has(domain)) { duplicates += 1; continue; }
        const classified = classifyGraphLink(link, seed);
        if (classified.score < 45) { rejected += 1; continue; }
        const candidate: GraphCandidate = {
          url: link,
          domain,
          label: labelFromUrl(link),
          sourceType: classified.sourceType,
          country: seed.country || null,
          region: seed.region || null,
          category: classified.category,
          score: classified.score,
          confidence: classified.confidence,
          reasons: classified.reasons,
          evidence: { sourceSeedUrl: seed.url, sourceSeedStrategy: seed.strategy || null, relationshipDomain: domain },
        };
        found.push(candidate);
        const saved = await upsertCandidate(env, candidate, seed);
        candidatesFound += 1;
        if (saved.inserted) candidatesNew += 1;
        if (saved.updated) candidatesUpdated += 1;
      }
    } catch {
      failed += 1;
    }
  }

  await logEvent(env, "source_expansion_relationship_graph_run", `Relationship graph discovery fetched ${pagesFetched} page(s), found ${candidatesFound} candidate(s).`);
  return {
    ok: true,
    mode: "source_expansion_relationship_graph_discovery",
    seedsChecked: seedRows.length,
    pagesFetched,
    linksFound,
    candidatesFound,
    candidatesNew,
    candidatesUpdated,
    duplicates,
    rejected,
    failed,
    candidates: found.slice(0, 25),
    safety: { writesTables: ["source_expansion_candidates", "events"], callsAI: false, sendsEmail: false, callsNetwork: true, publicWebOnly: true, respectsAccessControls: true },
  };
}
