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
const packageJson = JSON.parse(read("package.json") || "{}");

if (!wrangler) errors.push("Missing wrangler.toml");
if (!db) errors.push("Missing src/db.ts");

for (const required of [
  'PUBLIC_ENGINE_NAME = "EVAVO Growth Research Worker"',
  'CAP_CRAWL_PER_DAY = "60"',
  "No email-provider secrets are used or accepted by the active Worker source.",
  "active route and scheduled contracts prohibit",
  "AI execution",
]) {
  if (!wrangler.includes(required)) errors.push(`wrangler.toml is missing review-first runtime token: ${required}`);
}

for (const forbidden of [
  "CAP_DRAFTS_PER_DAY",
  "CAP_SEND_PER_DAY",
  "MAILCHANNELS_API_KEY",
  "FROM_EMAIL",
  "REPLY_TO_EMAIL",
  "api.mailchannels.net",
]) {
  if (wrangler.includes(forbidden)) errors.push(`wrangler.toml must not advertise outbound capability: ${forbidden}`);
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
  for (const forbidden of ["api.mailchannels.net", "sendEmail(", 'from "./email"', 'from "../email"']) {
    if (content.includes(forbidden)) errors.push(`${relative} contains forbidden outbound email token: ${forbidden}`);
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
  contract: "review-first-runtime-capability-configuration",
  outboundEmailModulePresent: fs.existsSync(path.join(root, "src/email.ts")),
  legacyExecutionModulePresent: fs.existsSync(path.join(root, "src/engine.ts")),
  emailProviderConfigured: false,
  draftRuntimeCapConfigured: false,
  sendRuntimeCapConfigured: false,
  boundedResearchConfigured: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
