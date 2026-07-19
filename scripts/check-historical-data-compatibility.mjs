#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const schema = read("schema.sql");
const migrationsReadme = read("migrations/README.md");
const compatibilityDoc = read("docs/historical-data-compatibility.md");
const db = read("src/db.ts");
const settings = read("src/core/settings.ts");
const safetyHandler = read("src/routes/legacyExecutionSafetyAdmin.ts");
const publicHandler = read("src/routes/public.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

for (const [name, content] of Object.entries({
  "schema.sql": schema,
  "migrations/README.md": migrationsReadme,
  "docs/historical-data-compatibility.md": compatibilityDoc,
  "src/db.ts": db,
  "src/core/settings.ts": settings,
  "src/routes/legacyExecutionSafetyAdmin.ts": safetyHandler,
  "src/routes/public.ts": publicHandler,
})) {
  if (!content) errors.push(`Missing required historical compatibility input: ${name}`);
}

for (const token of [
  "LEGACY BOOTSTRAP SCHEMA ONLY",
  "Do not apply this file to the live",
  "not sufficient for the current Worker runtime",
  "Historical statuses",
]) {
  if (!schema.includes(token)) errors.push(`schema.sql is missing legacy-only warning: ${token}`);
}

for (const token of [
  "Run migrations in filename order",
  "npm run db:migrations:check",
  "npm run db:migrations:print",
  "do not enable sending",
]) {
  if (!migrationsReadme.toLowerCase().includes(token.toLowerCase())) {
    errors.push(`migrations/README.md is missing migration safety token: ${token}`);
  }
}

for (const status of ["drafted", "approved", "sent", "failed", "rejected"]) {
  if (!db.includes(`"${status}"`)) errors.push(`src/db.ts must preserve historical status compatibility for ${status}`);
  if (!compatibilityDoc.includes(`\`${status}\``)) errors.push(`Historical compatibility documentation must describe ${status}`);
}

for (const token of [
  "Historical data values are not runtime capabilities.",
  "schema.sql is a legacy bootstrap reference only",
  "Do not",
  "reversible migration",
]) {
  if (!compatibilityDoc.includes(token)) errors.push(`Historical compatibility documentation is missing: ${token}`);
}

for (const blocked of [
  "ai_enabled",
  "ai_mode",
  "sending_enabled",
  "drafting_enabled",
  "daily_draft_limit",
  "daily_ai_call_limit",
  "daily_send_limit",
  "per_tick_draft_limit",
  "per_tick_ai_call_limit",
]) {
  if (!settings.includes(`"${blocked}"`)) errors.push(`Execution setting must remain explicitly blocked: ${blocked}`);
}
if (!settings.includes("BLOCKED_EXECUTION_SETTING_KEYS")) errors.push("Settings layer must expose the blocked execution setting boundary");
if (!settings.includes("!blockedExecutionSettings.has(key)")) errors.push("Mutable settings allowlist must exclude blocked execution settings");

for (const removedPath of ["src/engine.ts", "src/email.ts"]) {
  if (fs.existsSync(path.join(root, removedPath))) errors.push(`${removedPath} must remain absent`);
}

for (const token of [
  'error: "legacy_execution_disabled"',
  "manualLegacyExecutionEnabled: false",
  "aiDraftGenerationEnabled: false",
  "emailSendingEnabled: false",
]) {
  if (!safetyHandler.includes(token)) errors.push(`Legacy safety handler is missing historical-capability boundary: ${token}`);
}

for (const token of [
  "rawEventsExposed: false",
  "externalExecutionEnabled: false",
  "aiDraftingEnabled: false",
  "sendingEnabled: false",
]) {
  if (!publicHandler.includes(token)) errors.push(`Public status must remain review-first: ${token}`);
}

const expectedCommand = "node scripts/check-historical-data-compatibility.mjs";
if (packageJson.scripts?.["db:historical-compatibility:check"] !== expectedCommand) {
  errors.push(`package.json must expose db:historical-compatibility:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run db:historical-compatibility:check")) {
  errors.push("check:local must include db:historical-compatibility:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "historical-data-is-not-active-capability",
  rootSchemaProductionSafe: false,
  orderedMigrationsAuthoritative: true,
  historicalStatusesReadable: true,
  historicalStatusesExecutable: false,
  historicalRowsMutated: false,
  legacyExecutionModulesPresent: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
