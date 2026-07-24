#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
};

const policy = read("src/routes/operationsRoutePolicy.ts");
const index = read("src/index.ts");
const autonomy = read("src/routes/autonomySettingsAdmin.ts");
const legacySafety = read("src/routes/legacyExecutionSafetyAdmin.ts");
const draftReview = read("src/routes/draftReviewAdmin.ts");

const ids = [
  "legacy-admin-safety",
  "autonomy-settings",
  "planner-routes",
  "planner",
  "source-batch",
  "sources",
  "draft-review",
  "strategy-scores",
];
for (const id of ids) {
  const policyCount = policy.split(`id: "${id}"`).length - 1;
  const caseCount = index.split(`case "${id}":`).length - 1;
  if (policyCount !== 1) errors.push(`Operational route policy ${id} must exist exactly once (${policyCount})`);
  if (caseCount !== 1) errors.push(`Operational dispatcher case ${id} must exist exactly once (${caseCount})`);
}

for (const token of [
  'import { resolveOperationsRouteHandlerId } from "./routes/operationsRoutePolicy"',
  'import { handleLegacyExecutionSafetyAdmin } from "./routes/legacyExecutionSafetyAdmin"',
  "switch (resolveOperationsRouteHandlerId(pathname))",
  "return await handleLegacyExecutionSafetyAdmin(req, env, pathname, jsonResponse)",
  "return await handleAutonomySettingsAdmin(req, env, pathname, jsonResponse)",
  "return await handlePlannerRoutesAdmin(req, env, pathname, jsonResponse)",
  "return await handlePlannerAdmin(req, env, pathname, jsonResponse)",
  "return await handleSourceBatchAdmin(req, env, pathname, jsonResponse)",
  "return await handleSourcesAdmin(req, env, pathname, jsonResponse)",
  "return await handleDraftReviewAdmin(req, env, pathname, jsonResponse)",
]) {
  if (!index.includes(token)) errors.push(`Operational dispatcher is missing: ${token}`);
}

for (const raw of [
  'pathname === "/admin/settings/autonomy"',
  'pathname === "/admin/planner/routes"',
  'pathname === "/admin/planner" || pathname.startsWith("/admin/planner/")',
  'pathname === "/admin/sources/run-tiny"',
  'pathname.startsWith("/admin/sources") || pathname === "/admin/seeds"',
  'pathname.startsWith("/admin/draft-review")',
  'pathname.startsWith("/admin/strategy-scores")',
]) {
  if (index.includes(raw)) errors.push(`Raw operational route ownership must remain in the typed registry: ${raw}`);
}

for (const unsafe of [
  'authentication: "none"',
  'callsAI: true',
  'canSendEmail: true',
  'canPostSocial: true',
  'canSubmitForms: true',
  'writeConfirmation: "handler-defined"',
]) {
  if (policy.includes(unsafe)) errors.push(`Operational policy contains unsafe or ambiguous capability: ${unsafe}`);
}
for (const required of [
  'authentication: "handler-enforced"',
  'networkPosture: "read-only-research"',
  'writeConfirmation: "handler-enforced"',
  'writeConfirmation: "not-applicable"',
  'mutationPosture: "read-only"',
  'mutationPosture: "mixed-internal"',
  "callsAI: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
]) {
  if (!policy.includes(required)) errors.push(`Operational policy is missing: ${required}`);
}

for (const [label, source, tokens] of [
  ["Autonomy settings handler", autonomy, [
    "readBoundedJsonObject<AutonomySettingsBody>(request",
    "isExplicitJsonConfirmation(parsed.value)",
    "requiredPayload: { confirm: true }",
    "confirmationCoercionAllowed: false",
    'AUTONOMY_SETTINGS_LEASE = "autonomy-settings"',
    "manualResearchLeaseConflict(AUTONOMY_SETTINGS_LEASE)",
    "await env.DB.batch([",
    "settingsAndAuditAtomic: true",
    "concurrentSettingsWriteAllowed: false",
  ]],
  ["Legacy compatibility handler", legacySafety, [
    "readBoundedJsonObject<LegacySettingsBody>(request",
    "readBoundedJsonObject<LegacyDraftDecisionBody>(request",
    "isExplicitJsonConfirmation(parsed.value)",
    "requiredPayload: { confirm: true }",
    "confirmationCoercionAllowed: false",
    'LEGACY_SETTINGS_LEASE = "legacy-safe-settings"',
    'const actionKey = `draft-review:${draftId}`',
    "manualResearchLeaseConflict",
    "await env.DB.batch(statements)",
    "reviewStateAndAuditAtomic: true",
    "readRouteMutatesSettings: false",
    "responseMutatesSettings: false",
    'error: "legacy_execution_disabled"',
    "allowedKinds: []",
  ]],
  ["Draft review handler", draftReview, [
    "readBoundedJsonObject<DraftReviewBody>(request",
    "isExplicitJsonConfirmation(parsed.value)",
    "requiredPayload: { confirm: true }",
    "concurrentDuplicateReviewAllowed: false",
    "concurrentStrategyScoreMutationAllowed: false",
  ]],
]) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} is missing: ${token}`);
  }
}

for (const [label, source] of [
  ["Autonomy settings handler", autonomy],
  ["Legacy compatibility handler", legacySafety],
  ["Draft review handler", draftReview],
]) {
  for (const forbidden of [
    "request.json()",
    "request.clone().json()",
    "function confirmed(",
    "body?.confirm === 1",
    'body?.confirm === "1"',
  ]) {
    if (source.includes(forbidden)) errors.push(`${label} contains stale confirmation behavior: ${forbidden}`);
  }
}

const legacyPolicyStart = policy.indexOf('id: "legacy-admin-safety"');
const autonomyPolicyStart = policy.indexOf('id: "autonomy-settings"');
const plannerRoutesPosition = policy.indexOf('id: "planner-routes"');
const plannerPosition = policy.indexOf('id: "planner"');
const sourceBatchPosition = policy.indexOf('id: "source-batch"');
const sourcesPosition = policy.indexOf('id: "sources"');
if (legacyPolicyStart < 0 || autonomyPolicyStart < 0 || legacyPolicyStart >= autonomyPolicyStart) {
  errors.push("Legacy manual safety policy must precede autonomy settings and broad operational routes");
}
if (plannerRoutesPosition < 0 || plannerPosition < 0 || plannerRoutesPosition >= plannerPosition) {
  errors.push("Planner route catalogue must precede the general planner policy");
}
if (sourceBatchPosition < 0 || sourcesPosition < 0 || sourceBatchPosition >= sourcesPosition) {
  errors.push("Tiny source batch must precede the broad sources policy");
}

const priorities = [...policy.matchAll(/priority:\s*(\d+)/g)].map((match) => Number(match[1]));
if (priorities.length !== ids.length) errors.push(`Expected ${ids.length} operational priorities, found ${priorities.length}`);
if (new Set(priorities).size !== priorities.length) errors.push("Operational route priorities must be unique");
for (let indexValue = 1; indexValue < priorities.length; indexValue += 1) {
  if (priorities[indexValue] <= priorities[indexValue - 1]) {
    errors.push("Operational route priorities must be strictly increasing");
  }
}

for (const route of [
  "/admin/run",
  "/admin/settings",
  "/admin/settings/autonomy",
  "/admin/planner/routes",
  "/admin/sources/run-tiny",
  "/admin/seeds",
  "/admin/strategy-scores",
]) {
  if (!policy.includes(`"${route}"`)) errors.push(`Operational policy is missing ${route}`);
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "typed-operational-route-policy-v2-bounded-writes",
  routeGroups: ids,
  legacyManualExecutionRoutable: false,
  readRoutesMutateState: false,
  autonomySettingsRequireExactConfirmation: true,
  legacySettingsRequireExactConfirmation: true,
  draftReviewsRequireExactConfirmation: true,
  writePoliciesAmbiguous: false,
  externalResearchOnly: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
