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
const admin = read("src/routes/admin.ts");
const tools = read("src/routes/tools.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

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

for (const token of [
  'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
  'if (!(await isAdminRequestAuthorized(request, env)))',
  'error: "Unauthorized"',
  'error: "method_not_allowed"',
  "status: 405",
]) {
  if (!tools.includes(token)) errors.push(`Tools handler is missing shared authentication token: ${token}`);
}
const toolsAuthPosition = tools.indexOf("if (!(await isAdminRequestAuthorized(request, env)))");
const toolsOptionsPosition = tools.indexOf('request.method === "OPTIONS"');
if (toolsAuthPosition < 0 || toolsOptionsPosition < 0 || toolsAuthPosition >= toolsOptionsPosition) {
  errors.push("Tools authentication must run before OPTIONS handling");
}

if (!admin.includes("getAdminToken")) errors.push("Admin handler must retain defence-in-depth authentication");
if (!admin.includes('error: "Unauthorized"')) errors.push("Admin handler must retain a 401 response");

for (const forbidden of [
  "authorization ===",
  "authorization ==",
  "provided === expected",
  "provided == expected",
  "PUBLIC_CONTROL_KEY",
  "OUTBOUND_AGENT_ADMIN_TOKEN",
]) {
  if (auth.includes(forbidden)) errors.push(`Authentication helper contains forbidden token: ${forbidden}`);
  if (tools.includes(forbidden)) errors.push(`Tools handler contains forbidden authentication token: ${forbidden}`);
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
  toolsUseSharedAuthentication: true,
  unauthenticatedToolsPreflightAllowed: false,
  handlerDefenceInDepthRequired: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
