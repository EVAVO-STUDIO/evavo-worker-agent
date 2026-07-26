#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const CHECK_NAME = "check-growth-subhandler-auth-safety";
const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolute, "utf8");
};

function requireTokens(label, content, tokens) {
  for (const token of tokens) {
    if (!content.includes(token)) errors.push(`${label} is missing: ${token}`);
  }
}

function forbidTokens(label, content, tokens) {
  for (const token of tokens) {
    if (content.includes(token)) errors.push(`${label} contains forbidden token: ${token}`);
  }
}

function requireOrder(label, content, tokens) {
  let previous = -1;
  for (const token of tokens) {
    const index = content.indexOf(token);
    if (index === -1 || index <= previous) {
      errors.push(`${label} is stale before: ${token}`);
      return;
    }
    previous = index;
  }
}

const sharedWrite = read("src/core/growthInternalWriteRequest.ts");
const approvalRequests = read("src/routes/growthApprovalRequestsAdmin.ts");
const strategyMemory = read("src/routes/growthStrategyMemoryAdmin.ts");
const campaignIntelligence = read("src/routes/growthCampaignIntelligenceAdmin.ts");
const blackboard = read("src/routes/growthBlackboardAdmin.ts");
const growthFallback = read("src/routes/growthAdmin.ts");
const growthFallbackWrapper = read("src/routes/growthAdminProtected.ts");
const growthAudit = read("src/core/growthAudit.ts");
const growthBrief = read("src/core/growthBrief.ts");
const approvalTest = read("tests/growthApprovalRequestBoundary.test.ts");
const fallbackTest = read("tests/growthAdminFallbackSafety.test.ts");
const fallbackShapeTest = read("tests/growthAdminRouteShapeSafety.test.ts");
const strategyTest = read("tests/growthStrategyMemoryWriteBoundary.test.ts");
const campaignTest = read("tests/growthCampaignIntelligenceWriteBoundary.test.ts");
const campaignClassificationTest = read("tests/growthCampaignIntelligenceErrorClassification.test.ts");
const blackboardTest = read("tests/growthBlackboardWriteBoundary.test.ts");
const auditSummaryTest = read("tests/growthAuditSummary.test.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

requireTokens("Shared Growth write request", sharedWrite, [
  'GROWTH_INTERNAL_WRITE_REQUEST_VERSION =\n  "growth_internal_write_request_v1"',
  "readBoundedJsonObject",
  "isExplicitJsonConfirmation",
  "containsSensitiveGrowthInputKey",
  "growthInternalWriteFailurePayload",
  "confirmationCoercionAllowed: false",
  "sensitiveInputKeysAllowed: false",
]);

const protectedHandlers = [
  {
    label: "Growth approval requests handler",
    content: approvalRequests,
    parseToken: "const parsed = await confirmedBody(request, json)",
    persistenceCalls: [
      "saveGrowthApprovalRequest(env,",
      "updateGrowthApprovalRequestStatus(",
    ],
  },
  {
    label: "Growth strategy memory handler",
    content: strategyMemory,
    parseToken: "const parsed = await confirmedWriteBody(request, json)",
    persistenceCalls: [
      "upsertGrowthObjective(env,",
      "upsertGrowthKeyResult(env,",
      "upsertGrowthTargetSegment(env,",
      "upsertGrowthOfferProfile(env,",
      "upsertGrowthPositioningProfile(env,",
      "upsertGrowthRuntimeConstraint(env,",
    ],
  },
  {
    label: "Growth campaign intelligence handler",
    content: campaignIntelligence,
    parseToken: "const parsed = await confirmedWriteBody(request, json)",
    persistenceCalls: [
      "saveGrowthOperatorCycleEvent(env,",
      "upsertGrowthCampaign(env,",
      "upsertGrowthExperiment(env,",
      "upsertGrowthCampaignMetric(env,",
      "createGrowthEvidenceItem(env,",
      "createGrowthLearningNote(env,",
      "saveGrowthDecision(env,",
    ],
  },
  {
    label: "Growth blackboard handler",
    content: blackboard,
    parseToken: "const parsed = await confirmedWriteBody(request, json)",
    persistenceCalls: [
      "upsertGrowthBlackboardFact(env,",
      "upsertGrowthEntity(env,",
      "upsertGrowthEntityRelationship(env,",
      "upsertGrowthMarketSignal(env,",
      "upsertGrowthAsset(env,",
    ],
  },
];

for (const handler of protectedHandlers) {
  requireTokens(handler.label, handler.content, [
    'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
    "await isAdminRequestAuthorized(request, env)",
    'error: "Unauthorized"',
    'request.method === "OPTIONS"',
    "status: 405",
    'allow: "GET, POST"',
    'from "../core/growthInternalWriteRequest"',
    "readGrowthInternalWriteRequest(request)",
    "growthInternalWriteFailurePayload(parsed)",
    "boundedJsonRequired: true",
    "exactBooleanConfirmationRequired: true",
    "confirmationCoercionAllowed: false",
    "queryConfirmationAllowed: false",
    "sensitiveInputKeysAllowed: false",
    "internalMetadataOnly: true",
    "externalStateChange: false",
    "callsAI: false",
    "callsNetwork: false",
    "canSendEmail: false",
    "canPostSocial: false",
    "canSubmitForms: false",
  ]);
  requireOrder(`${handler.label} authentication order`, handler.content, [
    "await isAdminRequestAuthorized(request, env)",
    'request.method === "OPTIONS"',
  ]);
  forbidTokens(handler.label, handler.content, [
    "getAdminToken",
    "function authorized(",
    "function authorised(",
    "authorization ===",
    "authorization ==",
    "`Bearer ${token}`",
    "request.json()",
    'url.searchParams.get("confirm")',
    "body?.confirm",
    'body.confirm === "1"',
    "body.confirm === 1",
    "confirmationCoercionAllowed: true",
    "queryConfirmationAllowed: true",
    "sensitiveInputKeysAllowed: true",
    "rawErrorExposed: true",
    'request.method === "OPTIONS") return json({ ok: true',
  ]);

  for (const call of handler.persistenceCalls) {
    const callPosition = handler.content.indexOf(call);
    const parsePosition = handler.content.lastIndexOf(handler.parseToken, callPosition);
    const acceptedPosition = handler.content.lastIndexOf("if (!parsed.ok) return parsed.response", callPosition);
    if (
      callPosition < 0 ||
      parsePosition < 0 ||
      acceptedPosition < 0 ||
      !(parsePosition < acceptedPosition && acceptedPosition < callPosition)
    ) {
      errors.push(`${handler.label} must complete shared bounded confirmation before persistence call: ${call}`);
    }
  }
}

requireTokens("Growth approval requests handler", approvalRequests, [
  'request.method === "POST" && [...url.searchParams.keys()].length !== 0',
  "CREATE_WRAPPER_KEYS",
  "CREATE_PACK_KEYS",
  "STATUS_KEYS",
  "hasApprovalPack && hasPack",
  "outerId && innerId && outerId !== innerId",
  "requiredIdentifierFromAliases",
  "growth_approval_request_invalid",
  "rawErrorExposed: false",
  'intParam(url, "limit", 25, 1, 100)',
]);
requireTokens("Growth strategy memory handler", strategyMemory, [
  'request.method === "POST" && [...url.searchParams.keys()].length !== 0',
  "OBJECTIVE_INPUT_KEYS",
  "KEY_RESULT_INPUT_KEYS",
  "SEGMENT_INPUT_KEYS",
  "OFFER_INPUT_KEYS",
  "POSITIONING_INPUT_KEYS",
  "CONSTRAINT_INPUT_KEYS",
  "growth_strategy_memory_invalid_request",
  "rawErrorExposed: false",
  'intParam(url, "limit", 25, 1, 100)',
  'intParam(url, "limit", 50, 1, 100)',
]);
requireTokens("Growth campaign intelligence handler", campaignIntelligence, [
  'request.method === "POST" && [...url.searchParams.keys()].length !== 0',
  "CAMPAIGN_INPUT_KEYS",
  "EXPERIMENT_INPUT_KEYS",
  "METRIC_INPUT_KEYS",
  "EVIDENCE_INPUT_KEYS",
  "LEARNING_INPUT_KEYS",
  "DECISION_PLAN_KEYS",
  "/^GROWTH_(CAMPAIGN|EXPERIMENT|METRIC|EVIDENCE|LEARNING)_/",
  "growth_campaign_intelligence_invalid_request",
  "rawErrorExposed: false",
  'intParam(url, "limit", 10, 1, 50)',
  'intParam(url, "experimentLimit", 10, 1, 50)',
  'intParam(url, "decisionLimit", 10, 1, 50)',
  'intParam(url, "metricLimit", 10, 1, 50)',
  'intParam(url, "evidenceLimit", 10, 1, 50)',
  'intParam(url, "learningLimit", 10, 1, 50)',
]);
requireTokens("Growth blackboard handler", blackboard, [
  'request.method === "POST" && [...url.searchParams.keys()].length !== 0',
  "FACT_INPUT_KEYS",
  "ENTITY_INPUT_KEYS",
  "RELATIONSHIP_INPUT_KEYS",
  "SIGNAL_INPUT_KEYS",
  "ASSET_INPUT_KEYS",
  "growth_blackboard_invalid_request",
  "rawErrorExposed: false",
  'intParam(url, "limit", 50, 1, 100)',
]);

requireTokens("Growth fallback wrapper", growthFallbackWrapper, [
  'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
  "await isAdminRequestAuthorized(request, env)",
  "return handleGrowthAdminImplementation(request, env, pathname, json)",
  'request.method === "OPTIONS"',
  'allow: "GET, POST"',
]);
requireOrder("Growth fallback wrapper order", growthFallbackWrapper, [
  "await isAdminRequestAuthorized(request, env)",
  'request.method === "OPTIONS"',
  "return handleGrowthAdminImplementation(request, env, pathname, json)",
]);

requireTokens("Growth fallback", growthFallback, [
  'import { Env, todayUTC } from "../db"',
  'from "../core/growthInternalWriteRequest"',
  "listGrowthAuditEventSummaries",
  "toGrowthAuditEventSummary",
  "readGrowthInternalWriteRequest(request)",
  "growthInternalWriteFailurePayload(parsed)",
  "GOAL_INPUT_KEYS",
  "CHANNEL_INPUT_KEYS",
  "SIGNAL_INPUT_KEYS",
  "ACTION_INPUT_KEYS",
  "ACTION_PLAN_KEYS",
  "SIGNAL_STATUS_KEYS",
  "ACTION_STATUS_KEYS",
  "function wrappedInput(",
  "function requiredIdentifierAliases(",
  "function validateGoal(",
  "function validateChannel(",
  "function validateSignal(",
  "function validateAction(",
  'const raw = url.searchParams.get(key)',
  'raw === null || raw === ""',
  "Number.isSafeInteger(value)",
  'request.method === "POST" && [...url.searchParams.keys()].length !== 0',
  'error: "query_not_supported"',
  "queryConfirmationAllowed: false",
  "confirmationCoercionAllowed: false",
  "boundedJsonRequired: true",
  "exactBooleanConfirmationRequired: true",
  "sensitiveInputKeysAllowed: false",
  "rawErrorsExposed: false",
  "auditSnapshotsExposed: false",
  "rawErrorExposed: false",
  "growth_admin_invalid_request",
  "inputSnapshot: auditInput(",
  "audit: toGrowthAuditEventSummary(audit)",
  "requestReceipt: requestReceipt(parsed.contractVersion)",
  "const blockedReason = boundedOptionalText(",
  "updateGrowthActionStatus(env, id, status, blockedReason)",
]);
forbidTokens("Growth fallback", growthFallback, [
  'from "../core/boundedJsonRequest"',
  "MAX_GROWTH_ADMIN_BODY_BYTES",
  "SENSITIVE_GROWTH_INPUT_KEYS",
  "SENSITIVE_GROWTH_INPUT_KEY_FRAGMENTS",
  "function isSensitiveInputKey(",
  "function containsSensitiveInputKey(",
  "readBoundedJsonObject<Record<string, any>>(request",
  "boundedJsonFailurePayload(parsed)",
  "isExplicitJsonConfirmation(parsed.value)",
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
  "String(body.status || \"reviewed\")",
  "String(body.signalId || body.id || \"\")",
  "updateGrowthActionStatus(\n        env,\n        String(body.id",
  "message,",
  "message: message",
  "events: await listGrowthAuditEvents",
  "audit,\n        safety:",
  "requestBodySha256: parsed.requestBodySha256,\n        safety:",
]);

for (const call of [
  "upsertGrowthGoal(env,",
  "upsertGrowthChannel(env,",
  "upsertGrowthSignal(env,",
  "upsertGrowthAction(env,",
  "planGrowthActionFromSignal(env,",
  "updateGrowthSignalStatus(env,",
  "updateGrowthActionStatus(env,",
]) {
  const callPosition = growthFallback.indexOf(call);
  const parsePosition = growthFallback.lastIndexOf("const parsed = await confirmedBody(request, json)", callPosition);
  const acceptedPosition = growthFallback.lastIndexOf("if (!parsed.ok) return parsed.response", callPosition);
  if (
    callPosition < 0 ||
    parsePosition < 0 ||
    acceptedPosition < 0 ||
    !(parsePosition < acceptedPosition && acceptedPosition < callPosition)
  ) {
    errors.push(`Growth fallback must complete shared bounded confirmation before persistence call: ${call}`);
  }
}

requireTokens("Growth audit summary boundary", growthAudit, [
  "GrowthAuditEventSummary",
  "toGrowthAuditEventSummary",
  "hasInputSnapshot",
  "hasOutputSnapshot",
  "hasSafetyResult",
  "hasBudgetResult",
  "listGrowthAuditEventSummaries",
]);
forbidTokens("Growth audit summary boundary", growthAudit, [
  "inputSnapshot: row.input_snapshot",
  "outputSnapshot: row.output_snapshot",
  "safetyResult: row.safety_result",
  "budgetResult: row.budget_result",
]);
requireTokens("Growth brief audit reduction", growthBrief, [
  "listGrowthAuditEventSummaries",
  "latestAuditEvents: auditEvents",
  "auditSnapshotsExposed: false",
]);
forbidTokens("Growth brief audit reduction", growthBrief, ["listGrowthAuditEvents"]);

requireTokens("Growth approval tests", approvalTest, [
  "approval list retains the documented 25-record default",
  "approval query and coerced confirmation fail before D1 access",
  "approval wrappers and identifiers cannot be ambiguous",
  "approval status is required and alias identifiers must agree",
  "valid approval creation returns only the reduced summary and receipt",
]);
requireTokens("Growth fallback tests", fallbackTest, [
  'test("Growth fallback uses shared authentication before request parsing or persistence"',
  'test("query confirmation and all POST query parameters fail before body parsing"',
  'test("coerced confirmation is rejected before persistence"',
  "oauthAccessToken",
  "providerApiKey",
  "serviceRoleSecret",
  'test("non-JSON fallback writes fail through the bounded request contract"',
  'test("unexpected database failures are reduced to finite unavailable diagnostics"',
  "forbidden_growth_input_key",
  "json_content_type_required",
  "queryConfirmationAllowed",
  "rawErrorExposed",
  "auditSnapshotsExposed",
  "database-secret-detail-must-not-reach-response",
]);
requireTokens("Growth fallback shape tests", fallbackShapeTest, [
  "Growth fallback list routes keep their documented default limits",
  "malformed list limits fail as input instead of silently becoming one record",
  "flat and wrapped fallback inputs cannot be mixed",
  "action planning requires one unambiguous signal identifier",
  "signal and action status updates require explicit statuses",
  "action status does not persist the safety object as a blocked reason",
  'assert.notEqual(update.values[1], "[object Object]")',
]);
requireTokens("Growth strategy tests", strategyTest, [
  "strategy list routes retain their documented default limits",
  "query and coerced confirmation are rejected before D1 access",
  "sensitive, unknown and conflicting strategy fields fail closed",
]);
requireTokens("Growth campaign tests", `${campaignTest}\n${campaignClassificationTest}`, [
  "campaign list uses the documented fallback limit when the query is absent",
  "query-string confirmation is rejected before body parsing or D1 access",
  "experiment route validation is classified as a finite client input failure",
  "learning route validation is classified as a finite client input failure",
]);
requireTokens("Growth blackboard tests", blackboardTest, [
  "blackboard list routes retain their documented 50-record default",
  "blackboard query and coerced confirmation fail before D1 access",
  "blackboard sensitive, unknown and conflicting fields fail closed",
]);
requireTokens("Growth audit summary tests", auditSummaryTest, [
  'test("Growth audit summaries preserve references while discarding snapshots"',
  'test("empty stored snapshot objects become false presence flags"',
  "input-secret-must-not-project",
  "output-secret-must-not-project",
  "requestBodySha256",
  "input_snapshot",
  "output_snapshot",
  "Object.isFrozen(summary)",
]);

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
  sharedBoundedWriteContract: "growth_internal_write_request_v1",
  approvalRequestWritesRequireConfirmation: true,
  approvalRequestReadLimitsBounded: true,
  strategyMemoryWritesRequireConfirmation: true,
  strategyMemoryReadLimitsBounded: true,
  campaignIntelligenceWritesRequireConfirmation: true,
  campaignIntelligenceReadLimitsBounded: true,
  campaignInputErrorsFinite: true,
  blackboardWritesRequireConfirmation: true,
  blackboardReadLimitsBounded: true,
  growthFallbackUsesSharedAuthentication: true,
  growthFallbackUsesSharedBoundedWriteContract: true,
  growthFallbackReadLimitsBounded: true,
  growthFallbackRequiresExplicitStatuses: true,
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
