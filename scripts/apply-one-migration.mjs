import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(repoRoot, "migrations");
const expectedDatabaseName = "evavo_outbound_agent";
const databaseName = process.env.D1_DATABASE_NAME || expectedDatabaseName;
const shouldExecute = process.argv.includes("--execute");
const isLocal = process.argv.includes("--local");
const isRemote = process.argv.includes("--remote");
const confirmDatabase = argumentValue("--confirm-database");
const confirmsUnapplied = process.argv.includes("--confirm-unapplied");
const allowsRerun = process.argv.includes("--allow-rerun");
const migrationArg = process.argv.find((arg) => /^\d{4}(?:_|$)/.test(arg)) || "";

const RERUNNABLE_MIGRATIONS = new Set([
  "0011_source_expansion_strategy_origin_yield_backfill.sql",
]);

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] || "";
}

function usage() {
  console.log("Usage:");
  console.log("  npm run db:migration:one -- 0011_source_expansion_strategy_origin_yield_backfill.sql --local --execute --allow-rerun");
  console.log("  npm run db:migration:one -- 0022_business_website_audit_records.sql --remote --execute --confirm-database evavo_outbound_agent --confirm-unapplied");
  console.log("");
  console.log("Default mode is dry-run. Target selection is always explicit: pass exactly one of --local or --remote.");
  console.log("One-time schema migrations require --confirm-unapplied when executing.");
  console.log("Known rerunnable data migrations require --allow-rerun when executing.");
}

if (!migrationArg) {
  usage();
  process.exit(1);
}

if (isLocal === isRemote) {
  console.error("Select exactly one target: --local or --remote.");
  process.exit(1);
}

if (isRemote && databaseName !== expectedDatabaseName) {
  console.error(`Remote execution is restricted to ${expectedDatabaseName}; received ${databaseName}.`);
  process.exit(1);
}

if (isRemote && confirmDatabase !== expectedDatabaseName) {
  console.error(`Remote execution requires --confirm-database ${expectedDatabaseName}.`);
  process.exit(1);
}

if (!fs.existsSync(migrationsDir)) {
  console.error(`Could not find migrations directory: ${migrationsDir}`);
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir)
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort((a, b) => a.localeCompare(b));

const exactFilename = migrationArg.endsWith(".sql") ? migrationArg : "";
const matches = exactFilename
  ? files.filter((file) => file === exactFilename)
  : files.filter((file) => file === migrationArg || file.startsWith(`${migrationArg}_`));

if (!matches.length) {
  console.error(`No migration matched ${migrationArg}`);
  process.exit(1);
}

if (matches.length > 1) {
  console.error(`Migration argument ${migrationArg} matched multiple files:`);
  for (const file of matches) console.error(`- ${file}`);
  console.error("Use the complete migration filename. Duplicate numeric prefixes are intentionally not auto-selected.");
  process.exit(1);
}

const file = matches[0];
const rerunnable = RERUNNABLE_MIGRATIONS.has(file);

if (shouldExecute && rerunnable && !allowsRerun) {
  console.error(`${file} is classified as rerunnable data maintenance and requires --allow-rerun.`);
  process.exit(1);
}

if (shouldExecute && !rerunnable && !confirmsUnapplied) {
  console.error(`${file} is classified as one-time schema work and requires --confirm-unapplied.`);
  console.error("Verify the remote or local migration state before proceeding.");
  process.exit(1);
}

const commandArgs = ["wrangler", "d1", "execute", databaseName];
if (isRemote) commandArgs.push("--remote");
if (isLocal) commandArgs.push("--local");
commandArgs.push("--file", `migrations/${file}`);

console.log(JSON.stringify({
  migration: file,
  classification: rerunnable ? "rerunnable-data" : "one-time-schema",
  target: isRemote ? "remote" : "local",
  databaseName,
  execute: shouldExecute,
  safeguards: {
    explicitTarget: true,
    remoteDatabaseConfirmed: !isRemote || confirmDatabase === expectedDatabaseName,
    unappliedConfirmed: rerunnable || confirmsUnapplied,
    rerunAcknowledged: !rerunnable || allowsRerun,
  },
}, null, 2));
console.log("");
console.log(`cd ${repoRoot}`);
console.log(`npx ${commandArgs.join(" ")}`);

if (!shouldExecute) {
  console.log("");
  console.log("Dry-run only. Add --execute plus the classification-specific acknowledgement to execute.");
  process.exit(0);
}

console.log("");
console.log(`Executing ${file} against ${isRemote ? "remote" : "local"} D1 database ${databaseName}...`);
const result = spawnSync("npx", commandArgs, {
  cwd: repoRoot,
  stdio: "inherit",
  shell: process.platform === "win32",
});

process.exit(result.status ?? 1);
