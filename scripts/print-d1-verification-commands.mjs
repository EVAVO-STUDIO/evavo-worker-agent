import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const expectedDatabaseName = "evavo_outbound_agent";
const databaseName = process.env.D1_DATABASE_NAME || expectedDatabaseName;
const isLocal = process.argv.includes("--local");
const isRemote = process.argv.includes("--remote");

if (isLocal === isRemote) {
  console.error("Select exactly one target: --local or --remote.");
  console.error("Examples:");
  console.error("  npm run db:verify:print -- --local");
  console.error("  npm run db:verify:print -- --remote");
  process.exit(1);
}

if (isRemote && databaseName !== expectedDatabaseName) {
  console.error(`Remote verification is restricted to ${expectedDatabaseName}; received ${databaseName}.`);
  process.exit(1);
}

const commands = [
  {
    label: "Confirm strategy score table exists",
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='source_expansion_strategy_scores';",
  },
  {
    label: "Confirm origin-yield columns exist",
    sql: "PRAGMA table_info(source_expansion_strategy_scores);",
  },
  {
    label: "Show latest strategy rows with origin-yield counts",
    sql: "SELECT strategy, quality_score, recommendation, origin_saved_count, origin_query_hint_count, origin_public_link_graph_count, origin_sitemap_count, origin_source_expansion_count, updated_at_iso FROM source_expansion_strategy_scores ORDER BY updated_at_iso DESC LIMIT 10;",
  },
  {
    label: "Show saved source origin note counts",
    sql: "SELECT CASE WHEN notes LIKE '%origin=query_hint%' THEN 'query_hint' WHEN notes LIKE '%origin=public_link_graph%' THEN 'public_link_graph' WHEN notes LIKE '%origin=sitemap%' THEN 'sitemap' WHEN notes LIKE '%origin=source_expansion%' THEN 'source_expansion' WHEN notes LIKE '%origin=source_candidate_preview%' THEN 'source_candidate_preview' WHEN notes LIKE '%origin=%' THEN 'other_origin' ELSE 'manual_or_unknown' END AS origin, COUNT(*) AS count FROM opportunity_sources GROUP BY origin ORDER BY count DESC;",
  },
  {
    label: "Confirm Business Autopilot foundation tables exist",
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('business_organizations','business_people','business_websites','business_pages','business_signals','business_opportunities','business_service_matches','business_audit_packs','business_action_drafts','business_approval_requests','business_execution_records','business_suppression_list','business_content_ideas','business_content_calendar','business_followups','business_learning_events') ORDER BY name;",
  },
  {
    label: "Confirm Business website/funnel audit tables exist",
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('business_website_audit_runs','business_audit_observations') ORDER BY name;",
  },
  { label: "Inspect Business people allowed-use columns", sql: "PRAGMA table_info(business_people);" },
  { label: "Inspect Business page content hash columns", sql: "PRAGMA table_info(business_pages);" },
  { label: "Inspect Business website audit run columns", sql: "PRAGMA table_info(business_website_audit_runs);" },
  { label: "Inspect Business audit observation columns", sql: "PRAGMA table_info(business_audit_observations);" },
  {
    label: "Show Business table row counts",
    sql: "SELECT 'business_organizations' AS table_name, COUNT(*) AS count FROM business_organizations UNION ALL SELECT 'business_people', COUNT(*) FROM business_people UNION ALL SELECT 'business_websites', COUNT(*) FROM business_websites UNION ALL SELECT 'business_pages', COUNT(*) FROM business_pages UNION ALL SELECT 'business_signals', COUNT(*) FROM business_signals UNION ALL SELECT 'business_website_audit_runs', COUNT(*) FROM business_website_audit_runs UNION ALL SELECT 'business_audit_observations', COUNT(*) FROM business_audit_observations UNION ALL SELECT 'business_opportunities', COUNT(*) FROM business_opportunities UNION ALL SELECT 'business_audit_packs', COUNT(*) FROM business_audit_packs UNION ALL SELECT 'business_action_drafts', COUNT(*) FROM business_action_drafts UNION ALL SELECT 'business_approval_requests', COUNT(*) FROM business_approval_requests UNION ALL SELECT 'business_learning_events', COUNT(*) FROM business_learning_events;",
  },
];

const targetFlag = isRemote ? "--remote" : "--local";

console.log(JSON.stringify({
  target: isRemote ? "remote" : "local",
  databaseName,
  commandCount: commands.length,
  readOnlyVerification: true,
}, null, 2));
console.log("");
console.log(`cd ${repoRoot}`);
console.log("");
for (const command of commands) {
  console.log(`# ${command.label}`);
  console.log(`npx wrangler d1 execute ${databaseName} ${targetFlag} --command "${command.sql.replaceAll('"', '\\"')}"`);
  console.log("");
}
console.log("Notes:");
console.log("- These commands are read-only verification queries.");
console.log("- Run npm run db:migrations:check first if the local migration inventory may be stale.");
console.log("- If schema elements are missing, inspect applied state before executing any one-time migration.");
console.log("- Use the complete migration filename with db:migration:one; duplicate numeric prefixes are not auto-selected.");
