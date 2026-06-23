import { Env } from "../db";

interface SchemaRow {
  name: string;
  type: string;
  sql: string | null;
}

export async function buildSchemaReport(env: Env) {
  const { results } = (await env.DB.prepare(
    `SELECT name, type, sql
     FROM sqlite_master
     WHERE type IN ('table', 'index')
     ORDER BY type, name`
  ).all()) as { results?: SchemaRow[] };

  const items = results || [];
  const names = new Set(items.map((item) => item.name));
  const warnings: string[] = [];

  for (const table of [
    "usage_counters",
    "budget_decisions",
    "agent_decisions",
    "draft_reviews",
    "strategy_scores",
    "sources",
    "source_runs",
    "lead_discoveries",
    "source_scores",
  ]) {
    if (!names.has(table)) warnings.push(`missing_${table}_table`);
  }

  for (const index of [
    "idx_leads_status_updated",
    "idx_leads_website_url",
    "idx_drafts_status_updated",
    "idx_events_created",
    "idx_events_type_created",
    "idx_draft_reviews_draft_created",
    "idx_draft_reviews_lead_created",
    "idx_strategy_scores_score",
    "idx_sources_status_next_run",
    "idx_sources_url",
    "idx_source_runs_source_started",
    "idx_lead_discoveries_lead",
    "idx_lead_discoveries_source",
  ]) {
    if (!names.has(index)) warnings.push(`missing_${index}`);
  }

  if (names.has("suppression") && names.has("suppressions")) {
    warnings.push("duplicate_suppression_tables_canonical_is_suppression");
  }

  return {
    ok: true,
    tables: items.filter((item) => item.type === "table"),
    indexes: items.filter((item) => item.type === "index"),
    warnings,
  };
}
