#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const wrangler = read("wrangler.toml");
const db = read("src/db.ts");
const settings = read("src/core/settings.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

if (!wrangler) errors.push("Missing wrangler.toml");
if (!db) errors.push("Missing src/db.ts");
if (!settings) errors.push("Missing src/core/settings.ts");

for (const required of [
  '# Historical Cloudflare deployment identifier retained to avoid renaming the live Worker.',
  '# The active public service identity is EVAVO Growth Research Worker.',
  'name = "evavo-outbound-agent"',
  'PUBLIC_ENGINE_NAME = "EVAVO Growth Research Worker"',
  'CAP_CRAWL_PER_DAY = "60"',
  'Historical schedules retained for internal-only maintenance.',
  'They must not fetch',
  'public sources, discover opportunities, generate drafts or perform external actions.',
  'Historical D1 resource name retained for compatibility with the live database.',
  'This identifier does not describe an enabled outbound capability.',
  'database_name = "evavo_outbound_agent"',
  "No email-provider secrets are used or accepted by the active Worker source.",
  "active route and scheduled contracts prohibit",
  "AI execution",
]) {
  if (!wrangler.includes(required)) errors.push(`wrangler.toml is missing review-first runtime token: ${required}`);
}

for (const forbidden of [
  "PUBLIC_CONTROL_KEY",
  "OUTBOUND_AGENT_ADMIN_TOKEN",
  "CAP_DRAFTS_PER_DAY",
  "CAP_SEND_PER_DAY",
  "MAILCHANNELS_API_KEY",
  "FROM_EMAIL",
  "REPLY_TO_EMAIL",
  "api.mailchannels.net",
]) {
  if (wrangler.includes(forbidden)) errors.push(`wrangler.toml must not advertise legacy or outbound capability: ${forbidden}`);
  if (db.includes(forbidden)) errors.push(`src/db.ts Env must not advertise legacy or outbound capability: ${forbidden}`);
}

for (const required of [
  "export interface Env",
  "DB: D1Database",
  "ADMIN_TOKEN?: string",
  "CAP_CRAWL_PER_DAY?: string",
  "export function getAdminToken(env: Env): string | undefined",
  "return env.ADMIN_TOKEN;",
  "export type LeadStatus",
  '"sent"',
  "export type DraftStatus",
]) {
  if (!db.includes(required)) errors.push(`src/db.ts is missing runtime or historical compatibility token: ${required}`);
}

for (const required of [
  "BLOCKED_EXECUTION_SETTING_KEYS",
  '"ai_enabled"',
  '"ai_mode"',
  '"sending_enabled"',
  '"drafting_enabled"',
  '"daily_draft_limit"',
  '"daily_ai_call_limit"',
  '"daily_send_limit"',
  '"per_tick_draft_limit"',
  '"per_tick_ai_call_limit"',
  "!blockedExecutionSettings.has(key)",
  "never generally",
  "mutable",
]) {
  if (!settings.includes(required)) errors.push(`settings contract is missing immutable execution token: ${required}`);
}

const blockedListMatch = settings.match(/BLOCKED_EXECUTION_SETTING_KEYS\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\s*as const/);
const blockedList = blockedListMatch?.[1] || "";
for (const key of [
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
  if (!blockedList.includes(`"${key}"`)) errors.push(`Execution setting must remain blocked from general writes: ${key}`);
}

for (const removedPath of ["src/engine.ts", "src/email.ts"]) {
  if (fs.existsSync(path.join(root, removedPath))) errors.push(`${removedPath} must remain absent`);
}

const srcRoot = path.join(root, "src");
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const sourceFiles = fs.existsSync(srcRoot)
  ? walk(srcRoot).filter((file) => /\.(ts|tsx)$/.test(file))
  : [];

for (const absolute of sourceFiles) {
  const relative = path.relative(root, absolute).replaceAll("\\", "/");
  const content = fs.readFileSync(absolute, "utf8");
  for (const forbidden of [
    "PUBLIC_CONTROL_KEY",
    "OUTBOUND_AGENT_ADMIN_TOKEN",
    "api.mailchannels.net",
    "sendEmail(",
    'from "./email"',
    'from "../email"',
  ]) {
    if (content.includes(forbidden)) errors.push(`${relative} contains forbidden runtime token: ${forbidden}`);
  }
}

const expectedCommand = "node scripts/check-runtime-capability-config.mjs";
if (packageJson.scripts?.["runtime:capability-config:check"] !== expectedCommand) {
  errors.push(`package.json must expose runtime:capability-config:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run runtime:capability-config:check")) {
  errors.push("check:local must include runtime:capability-config:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "review-first-runtime-capability-configuration-v2-resource-compatibility",
  canonicalCredential: "ADMIN_TOKEN",
  activePublicServiceIdentity: "EVAVO Growth Research Worker",
  historicalWorkerResourceIdentifierRetained: true,
  historicalDatabaseResourceIdentifierRetained: true,
  historicalResourceNamesAuthoritativeForCapability: false,
  scheduledWorkInternalOnly: true,
  scheduledExternalResearchEnabled: false,
  legacyCredentialAliasesAdvertised: false,
  publicControlCredentialAdvertised: false,
  outboundEmailModulePresent: fs.existsSync(path.join(root, "src/email.ts")),
  legacyExecutionModulePresent: fs.existsSync(path.join(root, "src/engine.ts")),
  mailProviderFieldsAdvertised: false,
  emailProviderConfigured: false,
  draftRuntimeCapConfigured: false,
  sendRuntimeCapConfigured: false,
  executionSettingsGenerallyMutable: false,
  historicalStatusesReadable: true,
  historicalStatusesExecutable: false,
  boundedResearchConfigured: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
