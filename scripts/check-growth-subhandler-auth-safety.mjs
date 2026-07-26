#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const approvalRequests = read("src/routes/growthApprovalRequestsAdmin.ts");
const strategyMemory = read("src/routes/growthStrategyMemoryAdmin.ts");
const campaignIntelligence = read("src/routes/growthCampaignIntelligenceAdmin.ts");
const blackboard = read("src/routes/growthBlackboardAdmin.ts");
const growthFallback = read("src/routes/growthAdmin.ts");
const growthFallbackWrapper = read("src/routes/growthAdminProtected.ts");
const growthAudit = read("src/core/growthAudit.ts");
const growthBrief = read("src/core/growthBrief.ts");
const growthFallbackTest = read("tests/growthAdminFallbackSafety.test.ts");
const growthAuditSummaryTest = read("tests/growthAuditSummary.test.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

const protectedHandlers = [
  ["Growth approval requests handler", approvalRequests],
  ["Growth strategy memory handler", strategyMemory],
  ["Growth campaign intelligence handler", campaignIntelligence],
  ["Growth blackboard handler", blackboard],
];

for (const [label, content] of protectedHandlers) {
  if (!content) errors.push(`Missing ${label}`);
  for (const token of [
    'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
    "await isAdminRequestAuthorized(request, env)",
    'error: "Unauthorized"',
    'request.method === "OPTIONS"',
    "status: 405",
    'allow: "GET, POST"',
  ]) {
    if (!content.includes(token)) errors.push(`${label} is missing protected-boundary token: ${token}`);
  }

  const authPosition = content.indexOf("await isAdminRequestAuthorized(request, env)");
  const optionsPosition = content.indexOf('request.method === "OPTIONS"');
  if (authPosition < 0 || optionsPosition < 0 || authPosition >= optionsPosition) {
    errors.push(`${label} must authenticate before OPTIONS handling`);
  }

  for (const forbidden of [
    "getAdminToken",
    "function authorized(",
    "function authorised(",
    "authorization ===",
    "authorization ==",
    "`Bearer ${token}`",
    'request.method === "OPTIONS") return json({ ok: true',
  ]) {
    if (content.includes(forbidden)) errors.push(`${label} contains forbidden authentication token: ${forbidden}`);
  }
}

for (const [label, content, persistenceCalls] of [
  [
    "Growth approval requests handler",
    approvalRequests,
    ["saveGrowthApprovalRequest(env,", "updateGrowthApprovalRequestStatus(env,"],
  ],
  [
    "Growth strategy memory handler",
    strategyMemory,
    [
      "upsertGrowthObjective(env,",
      "upsertGrowthKeyResult(env,",
      "upsertGrowthTargetSegment(env,",
      "upsertGrowthOfferProfile(env,",
      "upsertGrowthPositioningProfile(env,",
      "upsertGrowthRuntimeConstraint(env,",
    ],
  ],
  [
    "Growth campaign intelligence handler",
    campaignIntelligence,
    [
      "saveGrowthOperatorCycleEvent(env,",
      "upsertGrowthCampaign(env,",
      "upsertGrowthExperiment(env,",
      "upsertGrowthCampaignMetric(env,",
      "createGrowthEvidenceItem(env,",
      "createGrowthLearningNote(env,",
      "saveGrowthDecision(env,",
    ],
  ],
  [
    "Growth blackboard handler",
    blackboard,
    [
      "upsertGrowthBlackboardFact(env,",
      "upsertGrowthEntity(env,",
      "upsertGrowthEntityRelationship(env,",
      "upsertGrowthMarketSignal(env,",
      "upsertGrowthAsset(env,",
    ],
  ],
]) {
  for (const call of persistenceCalls) {
    const callPosition = content.indexOf(call);
    if (callPosition < 0) {
      errors.push(`${label} is missing persistence call: ${call}`);
      continue;
    }
    const bodyPosition = content.lastIndexOf("const body = await parseBody(request)", callPosition);
    const confirmPosition = content.lastIndexOf("if (!confirmed(url, body))", callPosition);
    if (bodyPosition < 0 || confirmPosition < 0 || !(bodyPosition < confirmPosition && confirmPosition < callPosition)) {
      errors.push(`${label} must confirm after body parsing and before persistence call: ${call}`);
    }
  }
}

for (const token of [
  "internalMetadataOnly: true",
  "externalStateChange: false",
  "callsAI: false",
  "callsNetwork: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
]) {
  for (const [label, content] of protectedHandlers) {
    if (!content.includes(token)) errors.push(`${label} safety token is missing: ${token}`);
  }
}

for (const token of [
  'intParam(url, "limit", 10, 1, 50)',
  'intParam(url, "experimentLimit", 10, 1, 50)',
  'intParam(url, "decisionLimit", 10, 1, 50)',
  'intParam(url, "metricLimit", 10, 1, 50)',
  'intParam(url, "evidenceLimit", 10, 1, 50)',
  'intParam(url, "learningLimit", 10, 1, 50)',
]) {
  if (!campaignIntelligence.includes(token)) errors.push(`Growth campaign intelligence limit is missing: ${token}`);
}
for (const token of [
  'intParam(url, "limit", 50, 1, 100)',
  'pathname === "/admin/growth/blackboard/facts"',
  'pathname === "/admin/growth/blackboard/entities"',
  'pathname === "/admin/growth/blackboard/relationships"',
  'pathname === "/admin/growth/blackboard/signals"',
  'pathname === "/admin/growth/blackboard/assets"',
]) {
  if (!blackboard.includes(token)) errors.push(`Growth blackboard bound or route is missing: ${token}`);
}

for (const token of [
  'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
  "await isAdminRequestAuthorized(request, env)",
  "return handleGrowthAdminImplementation(request, env, pathname, json)",
  'request.method === "OPTIONS"',
  'allow: "GET, POST"',
]) {
  if (!growthFallbackWrapper.includes(token)) {
    errors.push(`Growth fallback wrapper is missing shared-authentication token: ${token}`);
  }
}
const wrapperAuth = growthFallbackWrapper.indexOf("await isAdminRequestAuthorized(request, env)");
const wrapperOptions = growthFallbackWrapper.indexOf('request.method === "OPTIONS"');
const wrapperDelegate = growthFallbackWrapper.indexOf("return handleGrowthAdminImplementation(request, env, pathname, json)");
if (wrapperAuth < 0 || wrapperOptions < 0 || wrapperDelegate < 0 || !(wrapperAuth < wrapperOptions && wrapperOptions < wrapperDelegate)) {
  errors.push("Growth fallback wrapper must authenticate before OPTIONS handling and delegation");
}

for (const token of [
  'import { Env, todayUTC } from "../db"',
  'from "../core/boundedJsonRequest"',
  "listGrowthAuditEventSummaries",
  "toGrowthAuditEventSummary",
  "MAX_GROWTH_ADMIN_BODY_BYTES = 32_768",
  "SENSITIVE_GROWTH_INPUT_KEYS",
  "SENSITIVE_GROWTH_INPUT_KEY_FRAGMENTS",
  "isSensitiveInputKey",
  "normalized.includes(fragment)",
  "containsSensitiveInputKey",
  "readBoundedJsonObject<Record<string, any>>(request",
  "boundedJsonFailurePayload(parsed)",
  "isExplicitJsonConfirmation(parsed.value)",
  'error: "forbidden_growth_input_key"',
  "requestBodySha256: parsed.bodySha256",
  "confirmationCoercionAllowed: false",
  "boundedJsonRequired: true",
  "exactBooleanConfirmationRequired: true",
  "sensitiveInputKeysAllowed: false",
  "rawErrorsExposed: false",
  "auditSnapshotsExposed: false",
  "rawErrorExposed: false",
  'diagnosticCode = missingGrowthTable',
  "inputSnapshot: auditInput(",
  "audit: toGrowthAuditEventSummary(audit)",
]) {
  if (!growthFallback.includes(token)) errors.push(`Growth fallback is missing hardened-boundary token: ${token}`);
}

for (const forbidden of [
  "getAdminToken",
  "function authorized(",
  "function authorised(",
  "authorization ===",
  "authorization ==",
  "`Bearer ${token}`",
  "request.json()",
  'url.searchParams.get("confirm")',
  "body?.confirm === 1",
  'body?.confirm === "1"',
  "message,",
  "message: message",
  "events: await listGrowthAuditEvents",
  "audit,\n        safety:",
  "requestBodySha256: parsed.requestBodySha256,\n        safety:",
]) {
  if (growthFallback.includes(forbidden)) errors.push(`Growth fallback contains forbidden legacy token: ${forbidden}`);
}

for (const call of [
  "upsertGrowthGoal(env,",
  "upsertGrowthChannel(env,",
  "upsertGrowthSignal(env,",
  "upsertGrowthAction(env,",
  "planGrowthActionFromSignal(env,",
  "updateGrowthSignalStatus(",
  "updateGrowthActionStatus(",
]) {
  const callPosition = growthFallback.indexOf(call);
  if (callPosition < 0) {
    errors.push(`Growth fallback is missing persistence call: ${call}`);
    continue;
  }
  const parsePosition = growthFallback.lastIndexOf("const parsed = await readConfirmedBody(request, json)", callPosition);
  const successPosition = growthFallback.lastIndexOf("if (!parsed.ok) return parsed.response", callPosition);
  if (parsePosition < 0 || successPosition < 0 || !(parsePosition < successPosition && successPosition < callPosition)) {
    errors.push(`Growth fallback must complete bounded exact confirmation before persistence call: ${call}`);
  }
}

for (const token of [
  "GrowthAuditEventSummary",
  "toGrowthAuditEventSummary",
  "hasInputSnapshot",
  "hasOutputSnapshot",
  "hasSafetyResult",
  "hasBudgetResult",
  "listGrowthAuditEventSummaries",
]) {
  if (!growthAudit.includes(token)) errors.push(`Growth audit summary boundary is missing: ${token}`);
}
for (const forbidden of [
  "inputSnapshot: row.input_snapshot",
  "outputSnapshot: row.output_snapshot",
  "safetyResult: row.safety_result",
  "budgetResult: row.budget_result",
]) {
  if (growthAudit.includes(forbidden)) errors.push(`Growth audit summary exposes forbidden snapshot field: ${forbidden}`);
}

for (const token of [
  "listGrowthAuditEventSummaries",
  "latestAuditEvents: auditEvents",
  "auditSnapshotsExposed: false",
]) {
  if (!growthBrief.includes(token)) errors.push(`Growth brief audit reduction is missing: ${token}`);
}
if (growthBrief.includes("listGrowthAuditEvents")) {
  errors.push("Growth brief must not expose raw audit events");
}

for (const token of [
  'test("Growth fallback uses shared authentication before request parsing or persistence"',
  'test("query confirmation cannot replace exact JSON confirmation"',
  'test("coerced confirmation is rejected before persistence"',
  "oauthAccessToken",
  "providerApiKey",
  "serviceRoleSecret",
  'test("non-JSON fallback writes fail through the bounded request contract"',
  'test("unexpected database failures are reduced to finite diagnostics"',
  "forbidden_growth_input_key",
  "json_content_type_required",
  "rawErrorExposed",
  "auditSnapshotsExposed",
  "requestBodySha256",
  "database-secret-detail-must-not-reach-response",
]) {
  if (!growthFallbackTest.includes(token)) errors.push(`Growth fallback test is missing: ${token}`);
}

for (const token of [
  'test("Growth audit summaries preserve references while discarding snapshots"',
  'test("empty stored snapshot objects become false presence flags"',
  "input-secret-must-not-project",
  "output-secret-must-not-project",
  "requestBodySha256",
  "input_snapshot",
  "output_snapshot",
  "Object.isFrozen(summary)",
]) {
  if (!growthAuditSummaryTest.includes(token)) errors.push(`Growth audit summary test is missing: ${token}`);
}

const expectedCommand = "node scripts/check-growth-subhandler-auth-safety.mjs";
if (packageJson.scripts?.["growth:subhandler-auth-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose growth:subhandler-auth-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run growth:subhandler-auth-safety:check")) {
  errors.push("check:local must include growth:subhandler-auth-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "growth-subhandler-authentication-safety",
  approvalRequestsUseSharedAuthentication: true,
  approvalRequestWritesRequireConfirmation: true,
  strategyMemoryUsesSharedAuthentication: true,
  strategyMemoryWritesRequireConfirmation: true,
  campaignIntelligenceUsesSharedAuthentication: true,
  campaignIntelligenceWritesRequireConfirmation: true,
  campaignIntelligenceReadLimitsBounded: true,
  blackboardUsesSharedAuthentication: true,
  blackboardWritesRequireConfirmation: true,
  blackboardReadLimitsBounded: true,
  growthFallbackUsesSharedAuthentication: true,
  growthFallbackUsesBoundedJson: true,
  growthFallbackRequiresExactBooleanConfirmation: true,
  growthFallbackRejectsSensitiveInputKeys: true,
  growthFallbackExposesRawErrors: false,
  growthFallbackExposesAuditSnapshots: false,
  growthBriefExposesAuditSnapshots: false,
  externalStateChangeAllowed: false,
  callsAI: false,
  callsNetwork: false,
  canSendEmail: false,
  canPostSocial: false,
  canSubmitForms: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
