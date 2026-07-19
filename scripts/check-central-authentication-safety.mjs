#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const auth = read("src/core/adminAuthentication.ts");
const index = read("src/index.ts");
const packageJson = JSON.parse(read("package.json") || "{}");
const protectedHandlers = [
  "src/routes/admin.ts",
  "src/routes/tools.ts",
  "src/routes/autonomySettingsAdmin.ts",
  "src/routes/legacyExecutionSafetyAdmin.ts",
  "src/routes/businessAutopilotAdmin.ts",
  "src/routes/opportunitiesAdmin.ts",
  "src/routes/sourceBatchAdmin.ts",
  "src/routes/draftReviewAdmin.ts",
];

for (const [name, content] of [["authentication helper", auth], ["Worker dispatcher", index]]) {
  if (!content) errors.push(`Missing ${name}`);
}

for (const token of [
  'authorization.startsWith("Bearer ")',
  'authorization.slice("Bearer ".length)',
  'token.trim() !== token',
  '/\\s/.test(token)',
  'crypto.subtle.digest("SHA-256"',
  "difference |= leftDigest[index] ^ rightDigest[index]",
  "return constantTimeEqual(provided, expected)",
]) {
  if (!auth.includes(token)) errors.push(`Authentication helper is missing: ${token}`);
}

for (const token of [
  'import { isAdminRequestAuthorized } from "./core/adminAuthentication"',
  'matchesWorkerRouteFamily("admin", pathname)',
  'matchesWorkerRouteFamily("tools", pathname)',
  'if (protectedRoute && !(await isAdminRequestAuthorized(req, env)))',
  'error: "Unauthorized"',
  "status: 401",
]) {
  if (!index.includes(token)) errors.push(`Worker dispatcher is missing central authentication token: ${token}`);
}

const healthPosition = index.indexOf('matchesWorkerRouteFamily("health", pathname)');
const authPosition = index.indexOf("if (protectedRoute && !(await isAdminRequestAuthorized(req, env)))");
const opportunityPosition = index.indexOf("switch (resolveOpportunityRouteHandlerId(pathname))");
const publicPosition = index.indexOf('matchesWorkerRouteFamily("public", pathname)');
if (healthPosition < 0 || authPosition < 0 || opportunityPosition < 0 || !(healthPosition < authPosition && authPosition < opportunityPosition)) {
  errors.push("Central authentication must run after public health and before protected route resolution");
}
if (publicPosition < 0 || publicPosition <= authPosition) {
  errors.push("Public routing must remain outside the protected-route authentication branch");
}

for (const relativePath of protectedHandlers) {
  const content = read(relativePath);
  if (!content) {
    errors.push(`Missing protected handler: ${relativePath}`);
    continue;
  }
  for (const token of [
    'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
    'await isAdminRequestAuthorized(request, env)',
    'error: "Unauthorized"',
  ]) {
    if (!content.includes(token)) errors.push(`${relativePath} is missing shared authentication token: ${token}`);
  }
  const handlerAuthPosition = content.indexOf("await isAdminRequestAuthorized(request, env)");
  const optionsPosition = content.indexOf('request.method === "OPTIONS"');
  if (optionsPosition >= 0 && (handlerAuthPosition < 0 || handlerAuthPosition >= optionsPosition)) {
    errors.push(`${relativePath} must authenticate before OPTIONS handling`);
  }
  for (const forbidden of [
    "getAdminToken",
    "function authorized(",
    "authorization ===",
    "authorization ==",
    "`Bearer ${token}`",
    'request.method === "OPTIONS") return json({ ok: true',
  ]) {
    if (content.includes(forbidden)) errors.push(`${relativePath} contains forbidden local authentication token: ${forbidden}`);
  }
}

const draftReview = read("src/routes/draftReviewAdmin.ts");
for (const token of [
  "function confirmed(body: any): boolean",
  "if (!confirmed(body))",
  'error: "confirm_required"',
  "Draft review-state changes require explicit confirmation",
]) {
  if (!draftReview.includes(token)) errors.push(`Draft review confirmation contract is missing: ${token}`);
}
const draftBodyPosition = draftReview.indexOf("const body = await request.json()");
const draftConfirmPosition = draftReview.indexOf("if (!confirmed(body))");
const draftReviewCallPosition = draftReview.indexOf("const result = await reviewDraft");
if (draftBodyPosition < 0 || draftConfirmPosition < 0 || draftReviewCallPosition < 0 || !(draftBodyPosition < draftConfirmPosition && draftConfirmPosition < draftReviewCallPosition)) {
  errors.push("Draft review confirmation must run after body parsing and before review-state mutation");
}

for (const forbidden of [
  "authorization ===",
  "authorization ==",
  "provided === expected",
  "provided == expected",
  "PUBLIC_CONTROL_KEY",
  "OUTBOUND_AGENT_ADMIN_TOKEN",
]) {
  if (auth.includes(forbidden)) errors.push(`Authentication helper contains forbidden token: ${forbidden}`);
}

const expectedCommand = "node scripts/check-central-authentication-safety.mjs";
if (packageJson.scripts?.["worker:central-auth-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose worker:central-auth-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run worker:central-auth-safety:check")) {
  errors.push("check:local must include worker:central-auth-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "central-protected-route-authentication",
  canonicalCredential: "ADMIN_TOKEN",
  strictBearerParsing: true,
  constantTimeDigestComparison: true,
  centralAuthenticationBeforeProtectedDispatch: true,
  publicRoutesRequireAdminToken: false,
  protectedHandlersUsingSharedAuthentication: protectedHandlers,
  draftReviewRequiresConfirmation: true,
  unauthenticatedProtectedPreflightAllowed: false,
  localBearerEqualityAllowed: false,
  handlerDefenceInDepthRequired: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
