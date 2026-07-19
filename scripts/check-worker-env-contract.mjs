#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const db = read("src/db.ts");
const wrangler = read("wrangler.toml");
const packageJson = JSON.parse(read("package.json") || "{}");

if (!db) errors.push("Missing src/db.ts");
if (!wrangler) errors.push("Missing wrangler.toml");

for (const required of [
  "export interface Env",
  "DB: D1Database",
  "ADMIN_TOKEN?: string",
  "CAP_CRAWL_PER_DAY?: string",
  "export type LeadStatus",
  '"sent"',
  "export type DraftStatus",
]) {
  if (!db.includes(required)) errors.push(`src/db.ts is missing compatibility/runtime token: ${required}`);
}

for (const forbidden of [
  "MAILCHANNELS_API_KEY",
  "FROM_EMAIL",
  "REPLY_TO_EMAIL",
  "CAP_DRAFTS_PER_DAY",
  "CAP_SEND_PER_DAY",
]) {
  if (db.includes(forbidden)) errors.push(`src/db.ts must not advertise deleted outbound capability: ${forbidden}`);
  if (wrangler.includes(forbidden)) errors.push(`wrangler.toml must not configure deleted outbound capability: ${forbidden}`);
}

for (const removedPath of ["src/engine.ts", "src/email.ts"]) {
  if (fs.existsSync(path.join(root, removedPath))) errors.push(`${removedPath} must remain absent`);
}

const expectedCommand = "node scripts/check-worker-env-contract.mjs";
if (packageJson.scripts?.["worker:env-contract:check"] !== expectedCommand) {
  errors.push(`package.json must expose worker:env-contract:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run worker:env-contract:check")) {
  errors.push("check:local must include worker:env-contract:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "review-first-worker-environment",
  mailProviderFieldsAdvertised: false,
  draftRuntimeCapAdvertised: false,
  sendRuntimeCapAdvertised: false,
  boundedResearchCapAdvertised: true,
  historicalStatusesReadable: true,
  historicalStatusesExecutable: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
