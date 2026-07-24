#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const boundedJson = read("src/core/boundedJsonRequest.ts");
const index = read("src/index.ts");
const sources = read("src/routes/sourcesAdmin.ts");
const sourceBatch = read("src/routes/sourceBatchAdmin.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

for (const [name, content] of [
  ["bounded JSON helper", boundedJson],
  ["Worker dispatcher", index],
  ["sources handler", sources],
  ["source batch handler", sourceBatch],
]) {
  if (!content) errors.push(`Missing ${name}`);
}

for (const token of [
  'BOUNDED_JSON_REQUEST_CONTRACT = "bounded_admin_json_request_v1"',
  "readBoundedJsonObject",
  "isExplicitJsonConfirmation",
  '(value as JsonObject).confirm === true',
]) {
  if (!boundedJson.includes(token)) errors.push(`Bounded source confirmation helper is missing: ${token}`);
}

for (const token of [
  "function sourceActionRequiresConfirmation(pathname: string, method: string): boolean",
  'method !== "POST"',
  'pathname === "/admin/sources"',
  'pathname === "/admin/seeds"',
  'pathname === "/admin/sources/run-tiny"',
  "test|expand-preview|expand-commit|cooldown|retire|activate",
  "async function sourceActionConfirmationFailure(request: Request, pathname: string)",
  "readBoundedJsonObject(request.clone())",
  "boundedJsonFailurePayload(parsed)",
  "isExplicitJsonConfirmation(parsed.value)",
  'error: "confirm_required"',
  "requiredPayload: { confirm: true }",
  "confirmationCoercionAllowed: false",
  "Source writes and bounded source-network actions require exact JSON confirmation",
  "const sourceConfirmationFailure = await sourceActionConfirmationFailure(req, pathname)",
  "if (sourceConfirmationFailure) return sourceConfirmationFailure",
]) {
  if (!index.includes(token)) errors.push(`Source confirmation boundary is missing: ${token}`);
}

const authPosition = index.indexOf("if (protectedRoute && !(await isAdminRequestAuthorized(req, env)))");
const confirmationPosition = index.indexOf("const sourceConfirmationFailure = await sourceActionConfirmationFailure(req, pathname)");
const opportunityRoutingPosition = index.indexOf("switch (resolveOpportunityRouteHandlerId(pathname))");
const operationsRoutingPosition = index.indexOf("switch (resolveOperationsRouteHandlerId(pathname))");
if (authPosition < 0 || confirmationPosition < 0 || opportunityRoutingPosition < 0 || operationsRoutingPosition < 0) {
  errors.push("Could not locate authentication, source confirmation, and routing boundaries");
} else if (!(authPosition < confirmationPosition && confirmationPosition < opportunityRoutingPosition && confirmationPosition < operationsRoutingPosition)) {
  errors.push("Source confirmation must run after authentication and before all protected route dispatch");
}

for (const [label, content] of [
  ["sources handler", sources],
  ["source batch handler", sourceBatch],
]) {
  for (const token of [
    'from "../core/boundedJsonRequest"',
    "readBoundedJsonObject(request)",
    "boundedJsonFailurePayload(parsed)",
    "isExplicitJsonConfirmation(parsed.value)",
    'error: "confirm_required"',
    "requiredPayload: { confirm: true }",
    "confirmationCoercionAllowed: false",
    "requestReceipt",
    "bodySha256",
  ]) {
    if (!content.includes(token)) errors.push(`${label} must retain bounded exact confirmation: ${token}`);
  }
}

for (const token of [
  'pathname === "/admin/sources" || pathname === "/admin/seeds"',
  "const previewMatch = pathname.match",
  "const commitMatch = pathname.match",
  "const testMatch = pathname.match",
  "const actionMatch = pathname.match",
  "const confirmed = await confirmedBody(request, json)",
]) {
  if (!sources.includes(token)) errors.push(`Sources handler must retain confirmation coverage: ${token}`);
}

for (const forbidden of [
  'url.searchParams.get("confirm")',
  "request.json()",
  "request.clone().json()",
  'body?.confirm === 1',
  'body?.confirm === "1"',
  'body?.confirm === "true"',
  'body?.confirm !== true && body?.confirm !== 1',
  'request.method === "POST") return await handleSourcesAdmin',
  "sourceActionConfirmationFailure(req, pathname).catch",
  "confirm_required_override",
]) {
  if (index.includes(forbidden) || sources.includes(forbidden) || sourceBatch.includes(forbidden)) {
    errors.push(`Source confirmation implementation contains forbidden bypass or coercion: ${forbidden}`);
  }
}

const expectedCommand = "node scripts/check-source-action-confirmation-safety.mjs";
if (packageJson.scripts?.["sources:confirmation-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose sources:confirmation-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run sources:confirmation-safety:check")) {
  errors.push("check:local must include sources:confirmation-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "source-action-confirmation-boundary-v2-bounded-exact-json",
  protectedActions: [
    "source-add",
    "source-test",
    "source-expand-preview",
    "source-expand-commit",
    "source-cooldown",
    "source-retire",
    "source-activate",
    "source-run-tiny",
  ],
  authenticationBeforeConfirmation: true,
  confirmationBeforeRouting: true,
  requestBodyPreservedWithClone: true,
  boundedRequestBodyRequired: true,
  exactJsonBooleanConfirmationRequired: true,
  queryStringConfirmationAllowed: false,
  numericOrStringConfirmationAllowed: false,
  handlerLevelConfirmationDefenseInDepthRequired: true,
  requestFingerprintRequired: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
