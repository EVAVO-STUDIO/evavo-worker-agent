#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const applyOne = read("scripts/apply-one-migration.mjs");
const printCommands = read("scripts/print-migration-commands.mjs");
const inventory = read("scripts/check-migrations-present.mjs");
const refusal = read("scripts/refuse-legacy-schema-init.mjs");
const migrationReadme = read("migrations/README.md");
const packageJson = JSON.parse(read("package.json") || "{}");

for (const [name, content] of Object.entries({ applyOne, printCommands, inventory, refusal, migrationReadme })) {
  if (!content) errors.push(`Missing migration safety dependency: ${name}`);
}

for (const token of [
  'const expectedDatabaseName = "evavo_outbound_agent"',
  'const isLocal = process.argv.includes("--local")',
  'const isRemote = process.argv.includes("--remote")',
  'if (isLocal === isRemote)',
  'Remote execution requires --confirm-database',
  'process.argv.includes("--confirm-unapplied")',
  'process.argv.includes("--allow-rerun")',
  '0011_source_expansion_strategy_origin_yield_backfill.sql',
  'Duplicate numeric prefixes are intentionally not auto-selected.',
  'classification: rerunnable ? "rerunnable-data" : "one-time-schema"',
]) {
  if (!applyOne.includes(token)) errors.push(`Single-migration helper is missing safeguard: ${token}`);
}

for (const forbidden of [
  "const isLocal = process.argv.includes('--local')",
  "if (!isLocal) commandArgs.push('--remote')",
  "file.includes(value)",
]) {
  if (applyOne.includes(forbidden)) errors.push(`Single-migration helper contains unsafe legacy behavior: ${forbidden}`);
}

for (const token of [
  'if (isLocal === isRemote)',
  'Select exactly one target: --local or --remote.',
  'Use only one selector: --from or --only.',
  'Use the complete migration filename.',
  'ordering: "full-filename-lexicographic"',
  'executionDefault: "dry-run"',
  '--confirm-unapplied',
  '--allow-rerun',
]) {
  if (!printCommands.includes(token)) errors.push(`Migration printer is missing safeguard: ${token}`);
}

for (const token of [
  '"0006_agent_settings.sql"',
  '"0006_opportunity_run_audit.sql"',
  'const allowedDuplicatePrefixes = new Map',
  'const unexpected = numericFiles.filter',
  'Migration inventory does not match the reviewed authoritative list.',
  'ordering: "full-filename-lexicographic"',
]) {
  if (!inventory.includes(token)) errors.push(`Migration inventory checker is missing safeguard: ${token}`);
}

if (inventory.includes("console.warn('Additional numeric migration")) {
  errors.push("Unexpected migration files must fail validation rather than warn");
}

for (const token of [
  "legacy_schema_initialization_disabled",
  "remoteDatabaseMustNotBeReset: true",
  "db:migrations:check",
  "db:migrations:print",
]) {
  if (!refusal.includes(token)) errors.push(`Legacy schema refusal helper is missing: ${token}`);
}

for (const forbiddenScript of [
  "wrangler d1 execute evavo_outbound_agent --file=./schema.sql",
  "wrangler d1 execute evavo_outbound_agent --file=./schema.sql --remote",
]) {
  for (const [name, command] of Object.entries(packageJson.scripts || {})) {
    if (String(command).includes(forbiddenScript)) errors.push(`package.json script ${name} still executes legacy schema.sql`);
  }
}

const expectedCommand = "node scripts/check-migration-execution-safety.mjs";
if (packageJson.scripts?.["db:migration-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose db:migration-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run db:migration-safety:check")) {
  errors.push("check:local must include db:migration-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "d1-migration-execution-safety",
  targetSelectionExplicit: true,
  remoteDatabaseConfirmationRequired: true,
  oneTimeMigrationAcknowledgementRequired: true,
  rerunnableMigrationAcknowledgementRequired: true,
  ambiguousPrefixSelectionAllowed: false,
  unexpectedMigrationFilesAllowed: false,
  legacySchemaExecutionAllowed: false,
  liveDatabaseMutatedByCheck: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
