import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(repoRoot, "migrations");

const expected = [
  "0001_free_safe_core.sql",
  "0002_draft_review_learning.sql",
  "0003_source_intelligence.sql",
  "0004_opportunity_intelligence.sql",
  "0005_opportunity_review_learning.sql",
  "0006_agent_settings.sql",
  "0006_opportunity_run_audit.sql",
  "0007_source_expansion_memory.sql",
  "0008_source_expansion_strategy_quality.sql",
  "0009_source_expansion_query_hints.sql",
  "0010_source_expansion_strategy_origin_yield.sql",
  "0011_source_expansion_strategy_origin_yield_backfill.sql",
  "0012_growth_autonomy_core.sql",
  "0013_growth_audit_events.sql",
  "0014_growth_campaign_intelligence.sql",
  "0015_growth_operator_cycle_events.sql",
  "0016_growth_strategy_memory.sql",
  "0017_growth_blackboard.sql",
  "0018_growth_cycle_memory_snapshots.sql",
  "0019_growth_approval_requests.sql",
  "0020_growth_autonomous_discovery.sql",
  "0021_business_autopilot_foundation.sql",
  "0022_business_website_audit_records.sql",
  "0023_growth_activity_budget_ledger.sql",
];

const allowedDuplicatePrefixes = new Map([
  ["0006", ["0006_agent_settings.sql", "0006_opportunity_run_audit.sql"]],
]);

if (!fs.existsSync(migrationsDir)) {
  console.error(`Missing migration directory: ${migrationsDir}`);
  process.exit(1);
}

const numericFiles = fs.readdirSync(migrationsDir)
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort((a, b) => a.localeCompare(b));

const missing = expected.filter((file) => !numericFiles.includes(file));
const unexpected = numericFiles.filter((file) => !expected.includes(file));
const orderMismatch = numericFiles.length === expected.length
  && numericFiles.some((file, index) => file !== expected[index]);

const prefixGroups = new Map();
for (const file of numericFiles) {
  const prefix = file.slice(0, 4);
  const group = prefixGroups.get(prefix) || [];
  group.push(file);
  prefixGroups.set(prefix, group);
}

const invalidDuplicateGroups = [];
for (const [prefix, files] of prefixGroups) {
  if (files.length < 2) continue;
  const allowed = allowedDuplicatePrefixes.get(prefix) || [];
  if (files.length !== allowed.length || files.some((file, index) => file !== allowed[index])) {
    invalidDuplicateGroups.push({ prefix, files, allowed });
  }
}

console.log(JSON.stringify({
  migrationDirectory: migrationsDir,
  expectedCount: expected.length,
  actualCount: numericFiles.length,
  ordering: "full-filename-lexicographic",
  intentionalDuplicatePrefixes: [...allowedDuplicatePrefixes.keys()],
  missing,
  unexpected,
  invalidDuplicateGroups,
  orderMismatch,
}, null, 2));

if (missing.length || unexpected.length || invalidDuplicateGroups.length || orderMismatch) {
  console.error("Migration inventory does not match the reviewed authoritative list.");
  console.error("Add or rename migrations only together with this checker and migrations/README.md.");
  process.exit(1);
}

console.log("All reviewed migration files are present in exact authoritative order.");
console.log("Run npm run db:migrations:print -- --local or --remote to print explicit-target dry-run commands.");
