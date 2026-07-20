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
const plannerWrapper = read("src/routes/plannerAdminProtected.ts");
const growthWrapper = read("src/routes/growthAdminProtected.ts");
const packageJson = JSON.parse(read("package.json") || "{}");
const protectedHandlers = [
  "src/routes/admin.ts",
  "src/routes/tools.ts",
  "src/routes/autonomySettingsAdmin.ts",
  "src/routes/legacyExecutionSafetyAdmin.ts",
  "src/routes/businessAutopilotAdmin.ts",
  "src/routes/businessAutopilotPeopleAdmin.ts",
  "src/routes/businessAutopilotWebsiteAdmin.ts",
  "src/routes/opportunitiesAdmin.ts",
  "src/routes/opportunityReviewAdmin.ts",
  "src/routes/sourcesAdmin.ts",
  "src/routes/sourceBatchAdmin.ts",
  "src/routes/draftReviewAdmin.ts",
  "src/routes/plannerAdminProtected.ts",
  "src/routes/plannerRoutesAdmin.ts",
  "src/routes/growthAdminProtected.ts",
  "src/routes/growthCapabilitiesAdmin.ts",
];

for (const [name, content] of [
  ["authentication helper", auth],
  ["Worker dispatcher", index],
  ["protected planner wrapper", plannerWrapper],
  ["protected Growth wrapper", growthWrapper],
]) {
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
  'import { handlePlannerAdmin } from "./routes/plannerAdminProtected"',
  'import { handleGrowthAdmin } from "./routes/growthAdminProtected"',
  'matchesWorkerRouteFamily("admin", pathname)',
  'matchesWorkerRouteFamily("tools", pathname)',
  'if (protectedRoute && !(await isAdminRequestAuthorized(req, env)))',
  'error: "Unauthorized"',
  "status: 401",
]) {
  if (!index.includes(token)) errors.push(`Worker dispatcher is missing central authentication token: ${token}`);
}
if (index.includes('from "./routes/plannerAdmin"')) {
  errors.push("Worker dispatcher must not import the legacy planner implementation directly");
}
if (index.includes('from "./routes/growthAdmin"')) {
  errors.push("Worker dispatcher must not import the legacy Growth fallback implementation directly");
}

function requireProtectedWrapper(content, label, implementationImport, delegateCall) {
  for (const token of [
    'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
    implementationImport,
    'await isAdminRequestAuthorized(request, env)',
    'request.method === "OPTIONS"',
    'status: 405',
    delegateCall,
  ]) {
    if (!content.includes(token)) errors.push(`${label} is missing: ${token}`);
  }
  const wrapperAuthPosition = content.indexOf("await isAdminRequestAuthorized(request, env)");
  const wrapperOptionsPosition = content.indexOf('request.method === "OPTIONS"');
  const wrapperDelegatePosition = content.indexOf(delegateCall);
  if (
    wrapperAuthPosition < 0 ||
    wrapperOptionsPosition < 0 ||
    wrapperDelegatePosition < 0 ||
    !(wrapperAuthPosition < wrapperOptionsPosition && wrapperOptionsPosition < wrapperDelegatePosition)
  ) {
    errors.push(`${label} must authenticate before OPTIONS handling and delegate only afterward`);
  }
}

requireProtectedWrapper(
  plannerWrapper,
  "Protected planner wrapper",
  'import { handlePlannerAdmin as handlePlannerAdminImplementation } from "./plannerAdmin"',
  'return handlePlannerAdminImplementation(request, env, pathname, json)',
);
requireProtectedWrapper(
  growthWrapper,
  "Protected Growth wrapper",
  'import { handleGrowthAdmin as handleGrowthAdminImplementation } from "./growthAdmin"',
  'return handleGrowthAdminImplementation(request, env, pathname, json)',
);

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

const opportunityReview = read("src/routes/opportunityReviewAdmin.ts");
for (const token of [
  "function confirmed(body: any): boolean",
  "if (!confirmed(body))",
  'error: "confirm_required"',
  "Opportunity review-state and strategy-score changes require explicit confirmation",
]) {
  if (!opportunityReview.includes(token)) errors.push(`Opportunity review confirmation contract is missing: ${token}`);
}
const opportunityBodyPosition = opportunityReview.indexOf("const body = await request.json()");
const opportunityConfirmPosition = opportunityReview.indexOf("if (!confirmed(body))");
const opportunityMutationPosition = opportunityReview.indexOf("return json(await reviewOpportunity");
if (opportunityBodyPosition < 0 || opportunityConfirmPosition < 0 || opportunityMutationPosition < 0 || !(opportunityBodyPosition < opportunityConfirmPosition && opportunityConfirmPosition < opportunityMutationPosition)) {
  errors.push("Opportunity review confirmation must run after body parsing and before review-state or strategy-score mutation");
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
  plannerRuntimeUsesProtectedWrapper: true,
  directPlannerImplementationImportAllowed: false,
  growthFallbackRuntimeUsesProtectedWrapper: true,
  directGrowthFallbackImplementationImportAllowed: false,
  publicRoutesRequireAdminToken: false,
  protectedHandlersUsingSharedAuthentication: protectedHandlers,
  draftReviewRequiresConfirmation: true,
  opportunityReviewRequiresConfirmation: true,
  unauthenticatedProtectedPreflightAllowed: false,
  localBearerEqualityAllowed: false,
  handlerDefenceInDepthRequired: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
