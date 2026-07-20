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
  externalStateChangeAllowed: false,
  callsAI: false,
  callsNetwork: false,
  canSendEmail: false,
  canPostSocial: false,
  canSubmitForms: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
