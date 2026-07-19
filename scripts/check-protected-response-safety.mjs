#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const index = read("src/index.ts");
const admin = read("src/routes/admin.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

if (!index) errors.push("Missing src/index.ts");
if (!admin) errors.push("Missing src/routes/admin.ts");

for (const token of [
  'headers.set("content-type", "application/json; charset=utf-8")',
  'headers.set("cache-control", "no-store")',
  'headers.set("x-content-type-options", "nosniff")',
  'headers.set("referrer-policy", "no-referrer")',
]) {
  if (!index.includes(token)) errors.push(`Shared JSON responder is missing: ${token}`);
  if (!admin.includes(token)) errors.push(`Admin fallback responder is missing: ${token}`);
}

for (const forbidden of [
  'access-control-allow-origin": "*"',
  'access-control-allow-origin", "*"',
  'access-control-allow-methods": "GET, POST, OPTIONS"',
]) {
  if (admin.includes(forbidden)) errors.push(`Protected admin route must not advertise wildcard browser access: ${forbidden}`);
}

for (const token of [
  'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
  "await isAdminRequestAuthorized(request, env)",
]) {
  if (!admin.includes(token)) errors.push(`Admin shared authentication contract is missing: ${token}`);
}
const authPosition = admin.indexOf("await isAdminRequestAuthorized(request, env)");
const optionsPosition = admin.indexOf('request.method === "OPTIONS"');
if (authPosition < 0 || optionsPosition < 0 || authPosition >= optionsPosition) {
  errors.push("Admin authentication must run before OPTIONS handling");
}

for (const forbidden of ["getAdminToken", "`Bearer ${token}`", "function authorized("]) {
  if (admin.includes(forbidden)) errors.push(`Admin fallback must use shared authentication instead of: ${forbidden}`);
}

for (const token of [
  'error: "method_not_allowed"',
  "status: 405",
  'headers: { allow: "GET, POST" }',
  'error: "Unauthorized"',
  "status: 401",
]) {
  if (!admin.includes(token)) errors.push(`Protected admin method/auth contract is missing: ${token}`);
}

const expectedCommand = "node scripts/check-protected-response-safety.mjs";
if (packageJson.scripts?.["worker:protected-response-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose worker:protected-response-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run worker:protected-response-safety:check")) {
  errors.push("check:local must include worker:protected-response-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "protected-worker-response-safety",
  wildcardAdminCorsAllowed: false,
  browserPreflightAllowedWithoutAuthentication: false,
  sharedAdminAuthenticationRequired: true,
  protectedResponsesCacheable: false,
  contentTypeSniffingAllowed: false,
  referrerDisclosureAllowed: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
