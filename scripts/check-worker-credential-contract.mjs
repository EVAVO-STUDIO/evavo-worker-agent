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
const auth = read("src/core/adminAuthentication.ts");
const tests = read("tests/adminAuthentication.test.ts");
const policy = read("docs/admin-token-security.md");
const wrangler = read("wrangler.toml");
const readme = read("README.md");
const packageJson = JSON.parse(read("package.json") || "{}");

for (const [name, content] of Object.entries({ db, auth, tests, policy, wrangler, readme })) {
  if (!content) errors.push(`Missing credential contract dependency: ${name}`);
}

for (const required of [
  "ADMIN_TOKEN?: string;",
  "export function getAdminToken(env: Env): string | undefined",
  "return env.ADMIN_TOKEN;",
]) {
  if (!db.includes(required)) errors.push(`src/db.ts is missing canonical credential token: ${required}`);
}

for (const required of [
  "ADMIN_TOKEN_MIN_BYTES = 32",
  "ADMIN_TOKEN_MAX_BYTES = 256",
  "function hasValidAdminTokenShape",
  "value.trim() !== value",
  "/\\s/.test(value)",
  "byteLength >= ADMIN_TOKEN_MIN_BYTES",
  "byteLength <= ADMIN_TOKEN_MAX_BYTES",
  "hasValidAdminTokenShape(token) ? token : null",
  "!expected || !provided || !hasValidAdminTokenShape(expected)",
  'crypto.subtle.digest("SHA-256"',
  "difference |= leftDigest[index] ^ rightDigest[index]",
]) {
  if (!auth.includes(required)) errors.push(`administrator authentication is missing bounded credential behavior: ${required}`);
}

for (const required of [
  'test("administrator authentication accepts only an exact bounded bearer credential"',
  'test("weak configured credentials fail closed even when the caller supplies the same value"',
  'test("oversized and whitespace-bearing credentials are rejected before comparison"',
  'test("credential byte bounds apply to multibyte input"',
  "ADMIN_TOKEN_MIN_BYTES - 1",
  "ADMIN_TOKEN_MAX_BYTES + 1",
]) {
  if (!tests.includes(required)) errors.push(`administrator authentication tests are missing: ${required}`);
}

for (const required of [
  "# Administrator token security",
  "minimum UTF-8 length: **32 bytes**",
  "maximum UTF-8 length: **256 bytes**",
  "wrangler secret put ADMIN_TOKEN",
  "fails closed",
  "No browser client should possess this credential.",
]) {
  if (!policy.includes(required)) errors.push(`administrator token policy is missing: ${required}`);
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
if (packageJson.scripts?.["test:core"] !== "node --test") {
  errors.push("package.json must retain deterministic Node core tests");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "canonical-bounded-server-side-worker-credential-v2",
  canonicalCredential: "ADMIN_TOKEN",
  minimumCredentialBytes: 32,
  maximumCredentialBytes: 256,
  weakConfiguredCredentialFailsClosed: true,
  oversizedCredentialRejectedBeforeDigest: true,
  strictBearerSchemeRequired: true,
  constantTimeDigestComparisonRequired: true,
  deterministicBehavioralTestsRequired: true,
  legacyCredentialAliasesAllowed: false,
  publicControlCredentialAllowed: false,
  browserCredentialExposureAllowed: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
