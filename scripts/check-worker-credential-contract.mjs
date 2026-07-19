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
const readme = read("README.md");
const packageJson = JSON.parse(read("package.json") || "{}");

for (const [name, content] of Object.entries({ db, wrangler, readme })) {
  if (!content) errors.push(`Missing credential contract dependency: ${name}`);
}

for (const required of [
  "ADMIN_TOKEN?: string;",
  "export function getAdminToken(env: Env): string | undefined",
  "return env.ADMIN_TOKEN;",
]) {
  if (!db.includes(required)) errors.push(`src/db.ts is missing canonical credential token: ${required}`);
}

const forbiddenAliases = ["PUBLIC_CONTROL_KEY", "OUTBOUND_AGENT_ADMIN_TOKEN"];
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
  for (const alias of forbiddenAliases) {
    if (content.includes(alias)) errors.push(`${relative} must not reference legacy credential alias: ${alias}`);
  }
}

for (const [name, content] of Object.entries({ "wrangler.toml": wrangler, "README.md": readme })) {
  for (const alias of forbiddenAliases) {
    if (content.includes(alias)) errors.push(`${name} must not advertise legacy credential alias: ${alias}`);
  }
}

if (!readme.includes("wrangler secret put ADMIN_TOKEN")) {
  errors.push("README.md must document ADMIN_TOKEN as the canonical Worker secret");
}
if (!wrangler.includes("ADMIN_TOKEN")) {
  errors.push("wrangler.toml must identify ADMIN_TOKEN as the required server-side credential");
}

const expectedCommand = "node scripts/check-worker-credential-contract.mjs";
if (packageJson.scripts?.["worker:credential-contract:check"] !== expectedCommand) {
  errors.push(`package.json must expose worker:credential-contract:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run worker:credential-contract:check")) {
  errors.push("check:local must include worker:credential-contract:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "canonical-server-side-worker-credential",
  canonicalCredential: "ADMIN_TOKEN",
  legacyCredentialAliasesAllowed: false,
  publicControlCredentialAllowed: false,
  browserCredentialExposureAllowed: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
