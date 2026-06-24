import type { Env } from "../db";
import { logEvent, nowISO, uuid } from "../db";

type QueryHint = {
  queryText: string;
  strategy: string;
  country: string;
  region: string | null;
  category: string;
  intent: string;
  score: number;
  confidence: "low" | "medium" | "high";
  reasons: string[];
  evidence: Record<string, unknown>;
};

const AU_REGIONS = ["NSW", "VIC", "QLD", "SA", "WA", "TAS", "ACT", "NT"];
const NZ_REGIONS = ["Auckland", "Wellington", "Canterbury", "Otago", "Waikato"];

const QUERY_TEMPLATES = [
  {
    strategy: "query_tender_portal_discovery",
    category: "tenders",
    intent: "find_procurement_source_pages",
    country: "AU",
    regions: ["national", ...AU_REGIONS],
    phrases: [
      "government digital services procurement opportunities",
      "supplier portal digital services tenders",
      "procurement opportunities website development government",
      "ICT services supplier panel tenders",
      "digital transformation tender opportunities",
    ],
    score: 74,
  },
  {
    strategy: "query_tender_portal_discovery",
    category: "tenders",
    intent: "find_procurement_source_pages",
    country: "NZ",
    regions: ["national", ...NZ_REGIONS],
    phrases: [
      "government digital services procurement opportunities",
      "supplier opportunities digital transformation government",
      "web development procurement opportunities",
      "ICT services tender portal",
      "digital services supplier panel opportunities",
    ],
    score: 72,
  },
  {
    strategy: "query_grant_portal_discovery",
    category: "grants",
    intent: "find_grant_source_pages",
    country: "AU",
    regions: ["national", ...AU_REGIONS],
    phrases: [
      "digital innovation grants business support",
      "small business digital transformation grants",
      "technology grants startup innovation",
      "creative digital project funding grants",
      "regional business digital grants",
    ],
    score: 70,
  },
  {
    strategy: "query_grant_portal_discovery",
    category: "grants",
    intent: "find_grant_source_pages",
    country: "NZ",
    regions: ["national", ...NZ_REGIONS],
    phrases: [
      "business digital capability grants",
      "innovation funding digital technology",
      "startup grant digital services",
      "creative digital funding programme",
      "regional business support digital transformation",
    ],
    score: 68,
  },
  {
    strategy: "query_creative_funding_discovery",
    category: "creative_funding",
    intent: "find_creative_funding_source_pages",
    country: "AU",
    regions: ["national", "NSW", "VIC", "QLD", "SA", "WA"],
    phrases: [
      "screen digital funding opportunities",
      "arts digital project grants",
      "creative technology funding program",
      "interactive media funding grant",
      "cultural digital innovation funding",
    ],
    score: 66,
  },
  {
    strategy: "query_supplier_panel_discovery",
    category: "supplier_panels",
    intent: "find_panel_or_marketplace_source_pages",
    country: "AU",
    regions: ["national", ...AU_REGIONS],
    phrases: [
      "digital services supplier panel application",
      "government supplier panel web development",
      "ICT marketplace supplier opportunities",
      "professional services panel digital agency",
      "vendor panel registration digital services",
    ],
    score: 64,
  },
];

function slugRegion(region: string | null) {
  if (!region || region === "national") return "national";
  return region;
}

function buildQuery(template: any, region: string, phrase: string) {
  const scope = region === "national" ? template.country : `${region} ${template.country}`;
  return `${scope} ${phrase}`.replace(/\s+/g, " ").trim();
}

function searchUrl(query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

export function generateQueryHints(limit = 80): QueryHint[] {
  const hints: QueryHint[] = [];
  for (const template of QUERY_TEMPLATES) {
    for (const region of template.regions) {
      for (const phrase of template.phrases) {
        const queryText = buildQuery(template, region, phrase);
        const regionalBoost = region === "national" ? 4 : 0;
        const score = Math.max(1, Math.min(100, template.score + regionalBoost));
        hints.push({
          queryText,
          strategy: template.strategy,
          country: template.country,
          region: slugRegion(region),
          category: template.category,
          intent: template.intent,
          score,
          confidence: score >= 72 ? "high" : score >= 58 ? "medium" : "low",
          reasons: [
            `strategy:${template.strategy}`,
            `intent:${template.intent}`,
            `country:${template.country}`,
            `region:${slugRegion(region)}`,
            `category:${template.category}`,
            "query_hint:operator_or_future_search_seed",
          ],
          evidence: {
            generatedAtISO: nowISO(),
            source: "built_in_query_pattern_generator",
            note: "Search hint only. Not a live source. Must resolve to a real URL before saving opportunity_sources.",
          },
        });
        if (hints.length >= limit) return hints;
      }
    }
  }
  return hints;
}

export async function saveQueryHints(env: Env, options: { limit?: number; strategy?: string } = {}) {
  const hasTable = await tableExists(env, "source_expansion_query_hints");
  if (!hasTable) return { ok: false, error: "missing_migration", requiredMigration: "0009_source_expansion_query_hints.sql" };
  const limit = Math.max(1, Math.min(150, Math.round(Number(options.limit || 80))));
  let hints = generateQueryHints(limit * 2);
  if (options.strategy) hints = hints.filter((hint) => hint.strategy === options.strategy);
  hints = hints.slice(0, limit);
  const now = nowISO();
  let inserted = 0;
  let updated = 0;

  for (const hint of hints) {
    const result = await env.DB.prepare(
      `INSERT INTO source_expansion_query_hints (id, query_text, strategy, country, region, category, intent, status, score, confidence, search_url, reasons_json, evidence_json, created_at_iso, updated_at_iso, next_review_at_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'candidate', ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(query_text) DO UPDATE SET
         score = MAX(score, excluded.score),
         confidence = excluded.confidence,
         search_url = excluded.search_url,
         reasons_json = excluded.reasons_json,
         evidence_json = excluded.evidence_json,
         seen_count = seen_count + 1,
         updated_at_iso = excluded.updated_at_iso`
    ).bind(
      uuid(),
      hint.queryText,
      hint.strategy,
      hint.country,
      hint.region,
      hint.category,
      hint.intent,
      hint.score,
      hint.confidence,
      searchUrl(hint.queryText),
      JSON.stringify(hint.reasons),
      JSON.stringify(hint.evidence),
      now,
      now,
      now,
    ).run();
    const changes = Number(result.meta?.changes || 0);
    if (changes) inserted += 1;
    else updated += 1;
  }

  await logEvent(env, "source_expansion_query_hints_generated", `Generated ${hints.length} source expansion query hint(s).`);
  return { ok: true, mode: "source_expansion_query_hints_generated", count: hints.length, inserted, updated, hints };
}

export async function listQueryHints(env: Env, options: { status?: string; strategy?: string; limit?: number } = {}) {
  const hasTable = await tableExists(env, "source_expansion_query_hints");
  if (!hasTable) return { ok: false, error: "missing_migration", requiredMigration: "0009_source_expansion_query_hints.sql" };
  const status = options.status || "candidate";
  const limit = Math.max(1, Math.min(150, Math.round(Number(options.limit || 80))));
  const clauses = ["status = ?"];
  const binds: any[] = [status];
  if (options.strategy) {
    clauses.push("strategy = ?");
    binds.push(options.strategy);
  }
  binds.push(limit);
  const rows = await env.DB.prepare(
    `SELECT id, query_text, strategy, country, region, category, intent, status, score, confidence, search_url, reasons_json, evidence_json, seen_count, used_count, result_count, created_at_iso, updated_at_iso, last_used_at_iso, next_review_at_iso, notes
     FROM source_expansion_query_hints
     WHERE ${clauses.join(" AND ")}
     ORDER BY score DESC, updated_at_iso DESC
     LIMIT ?`
  ).bind(...binds).all<any>();
  return { ok: true, mode: "source_expansion_query_hints", count: rows.results?.length || 0, hints: rows.results || [] };
}
