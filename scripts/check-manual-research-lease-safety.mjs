#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} missing ${token}`);
  }
}

function forbidTokens(label, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) errors.push(`${label} contains forbidden token ${token}`);
  }
}

const helper = read("src/core/manualResearchLease.ts");
const doc = read("docs/manual-research-concurrency.md");
const workflow = read(".github/workflows/worker-contract.yml");
const safetyGate = read("scripts/check-safety-gate-completeness.mjs");
const packageJson = JSON.parse(read("package.json") || "{}");

requireTokens("manual research lease helper", helper, [
  'MANUAL_RESEARCH_LEASE_CONTRACT = "manual_research_lease_v1"',
  'const LEASE_PREFIX = "manual-research-lease:"',
  "Math.max(30, Math.min(1800",
  "crypto.randomUUID()",
  "INSERT INTO settings (key, value)",
  "ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  "instr(settings.value, ':')",
  "CAST(substr(settings.value, 1, instr(settings.value, ':') - 1) AS INTEGER)",
  "END <= ?",
  "Number(result.meta?.changes || 0) !== 1",
  '"DELETE FROM settings WHERE key = ? AND value = ?"',
  'error: "research_action_in_progress"',
  "retryable: true",
  "automaticRetryAllowed: false",
  "scheduledFallbackAllowed: false",
  "externalExecutionAllowed: false",
]);
forbidTokens("manual research lease helper", helper, [
  "getSetting(",
  "setSetting(",
  "tryAcquireLock(",
  "setTimeout(",
  "waitUntil(",
  "queue",
  "webhook",
]);

const routeContracts = [
  {
    label: "manual opportunity run",
    path: "src/routes/opportunityRunDueAdmin.ts",
    gateToken: "const lease = await acquireManualResearchLease(env, MANUAL_OPPORTUNITY_RUN_LEASE, 900)",
    tokens: [
      'MANUAL_OPPORTUNITY_RUN_LEASE = "opportunity-run-due"',
      "manualResearchLeaseConflict(MANUAL_OPPORTUNITY_RUN_LEASE)",
      "releaseManualResearchLease(env, lease)",
      "concurrentDuplicateRunAllowed: false",
    ],
  },
  {
    label: "source expansion routes",
    path: "src/routes/sourceExpansionAdmin.ts",
    gateToken: 'return withResearchLease(env, json, "source-expansion-scan"',
    tokens: [
      "async function withResearchLease",
      '"source-expansion-scan"',
      '"source-expansion-sitemap-scan"',
      "const lease = await acquireManualResearchLease(env, actionKey, 900)",
      "manualResearchLeaseConflict(actionKey)",
      "releaseManualResearchLease(env, lease)",
    ],
  },
  {
    label: "relationship graph route",
    path: "src/routes/sourceExpansionPublicDirectoryScanAdmin.ts",
    gateToken: "const lease = await acquireManualResearchLease(env, actionKey, 900)",
    tokens: [
      'const actionKey = "source-expansion-relationship-graph"',
      "manualResearchLeaseConflict(actionKey)",
      "releaseManualResearchLease(env, lease)",
    ],
  },
  {
    label: "query hint resolver",
    path: "src/routes/sourceExpansionQueryHintResolverAdmin.ts",
    gateToken: "const lease = await acquireManualResearchLease(env, actionKey, 300)",
    tokens: [
      'const actionKey = `query-hint-resolve:${hintId}`',
      "manualResearchLeaseConflict(actionKey)",
      "releaseManualResearchLease(env, lease)",
    ],
  },
  {
    label: "tiny source batch",
    path: "src/routes/sourceBatchAdmin.ts",
    gateToken: "const lease = await acquireManualResearchLease(env, actionKey, 600)",
    tokens: [
      'const actionKey = "sources-run-tiny"',
      "manualResearchLeaseConflict(actionKey)",
      "releaseManualResearchLease(env, lease)",
      "concurrentDuplicateRunAllowed: false",
    ],
  },
  {
    label: "opportunity source research actions",
    path: "src/routes/opportunityDiscoveryAdmin.ts",
    gateToken: "return withSourceLease(env, json, sourceAction.id",
    tokens: [
      "async function withSourceLease",
      'const actionKey = `opportunity-source:${sourceId}`',
      "const lease = await acquireManualResearchLease(env, actionKey, 600)",
      "manualResearchLeaseConflict(actionKey)",
      "releaseManualResearchLease(env, lease)",
    ],
  },
  {
    label: "opportunity source health actions",
    path: "src/routes/opportunitySourceHealthActionsAdmin.ts",
    gateToken: "const lease = await acquireManualResearchLease(env, actionKey, 600)",
    tokens: [
      'const actionKey = `opportunity-source:${sourceId}`',
      "manualResearchLeaseConflict(actionKey)",
      "releaseManualResearchLease(env, lease)",
      "await env.DB.batch([mutation.statement, auditInsert])",
      "auditAndSourceUpdateAtomic: true",
      "overlappingPerSourceActionAllowed: false",
    ],
  },
  {
    label: "legacy source actions",
    path: "src/routes/sourcesAdmin.ts",
    gateToken: "return withSourceLease(env, json, sourceId",
    tokens: [
      "async function withSourceLease",
      'const actionKey = `legacy-source:${sourceId}`',
      "const lease = await acquireManualResearchLease(env, actionKey, 600)",
      "manualResearchLeaseConflict(actionKey)",
      "releaseManualResearchLease(env, lease)",
    ],
  },
  {
    label: "autonomy settings",
    path: "src/routes/autonomySettingsAdmin.ts",
    gateToken: "const lease = await acquireManualResearchLease(env, AUTONOMY_SETTINGS_LEASE, 600)",
    tokens: [
      'AUTONOMY_SETTINGS_LEASE = "autonomy-settings"',
      "manualResearchLeaseConflict(AUTONOMY_SETTINGS_LEASE)",
      "releaseManualResearchLease(env, lease)",
      "concurrentSettingsWriteAllowed: false",
      "settingsAndAuditAtomic: true",
    ],
  },
  {
    label: "legacy safe settings",
    path: "src/routes/legacyExecutionSafetyAdmin.ts",
    gateToken: "const lease = await acquireManualResearchLease(env, LEGACY_SETTINGS_LEASE, 600)",
    tokens: [
      'LEGACY_SETTINGS_LEASE = "legacy-safe-settings"',
      "manualResearchLeaseConflict(LEGACY_SETTINGS_LEASE)",
      "releaseManualResearchLease(env, lease)",
      "concurrentSettingsWriteAllowed: false",
      "settingsAndAuditAtomic: true",
    ],
  },
  {
    label: "draft review actions",
    path: "src/routes/draftReviewAdmin.ts",
    gateToken: "const draftLease = await acquireManualResearchLease(env, draftActionKey, 600)",
    tokens: [
      'const draftActionKey = `draft-review:${draftId}`',
      'reviewLeaseKey("draft-strategy", [strategyKey])',
      "strategyLease = await acquireManualResearchLease(env, strategyActionKey, 600)",
      "releaseManualResearchLease(env, strategyLease)",
      "releaseManualResearchLease(env, draftLease)",
      "concurrentDuplicateReviewAllowed: false",
      "concurrentStrategyScoreMutationAllowed: false",
    ],
  },
  {
    label: "legacy draft review action",
    path: "src/routes/legacyExecutionSafetyAdmin.ts",
    gateToken: "const lease = await acquireManualResearchLease(env, actionKey, 600)",
    tokens: [
      'const actionKey = `draft-review:${draftId}`',
      "manualResearchLeaseConflict(actionKey)",
      "releaseManualResearchLease(env, lease)",
      "concurrentDuplicateReviewAllowed: false",
      "reviewStateAndAuditAtomic: true",
    ],
  },
  {
    label: "opportunity review actions",
    path: "src/routes/opportunityReviewAdmin.ts",
    gateToken: "const opportunityLease = await acquireManualResearchLease(env, opportunityActionKey, 600)",
    tokens: [
      'const opportunityActionKey = `opportunity-review:${opportunityId}`',
      'reviewLeaseKey(\n      "opportunity-strategy"',
      "strategyLease = await acquireManualResearchLease(env, strategyActionKey, 600)",
      "releaseManualResearchLease(env, strategyLease)",
      "releaseManualResearchLease(env, opportunityLease)",
      "concurrentDuplicateReviewAllowed: false",
      "concurrentStrategyScoreMutationAllowed: false",
    ],
  },
  {
    label: "source candidate commit",
    path: "src/routes/opportunitySourceCandidatesAdmin.ts",
    gateToken: "const lease = await acquireManualResearchLease(env, SOURCE_CANDIDATE_COMMIT_LEASE, 600)",
    tokens: [
      'SOURCE_CANDIDATE_COMMIT_LEASE = "opportunity-source-candidates-commit"',
      "manualResearchLeaseConflict(SOURCE_CANDIDATE_COMMIT_LEASE)",
      "releaseManualResearchLease(env, lease)",
      "concurrentDuplicateCommitAllowed: false",
    ],
  },
];

for (const contract of routeContracts) {
  const source = read(contract.path);
  requireTokens(contract.label, source, [
    'from "../core/manualResearchLease"',
    'from "../core/boundedJsonRequest"',
    "readBoundedJsonObject",
    "isExplicitJsonConfirmation",
    'error: "confirm_required"',
    "confirmationCoercionAllowed: false",
    "requestReceipt",
    "status: 409",
    "finally {",
    contract.gateToken,
    ...contract.tokens,
  ]);
  const confirmPosition = source.indexOf("if (!isExplicitJsonConfirmation(parsed.value))");
  const gatePosition = source.indexOf(contract.gateToken);
  if (confirmPosition < 0 || gatePosition < 0 || confirmPosition >= gatePosition) {
    errors.push(`${contract.label} must require exact bounded confirmation before entering the lease-protected action`);
  }
  forbidTokens(contract.label, source, [
    "setTimeout(",
    "waitUntil(",
    "automaticRetryAllowed: true",
    "scheduledFallbackAllowed: true",
    "request.json()",
    'body?.confirm === 1',
    'body?.confirm === "1"',
    'searchParams.get("confirm")',
  ]);
}

const legacy = read("src/routes/legacyExecutionSafetyAdmin.ts");
const legacySettingsFunction = legacy.indexOf("async function updateSafeSettings");
const legacySettingsConfirm = legacy.indexOf("if (!isExplicitJsonConfirmation(parsed.value))", legacySettingsFunction);
const legacySettingsLease = legacy.indexOf("const lease = await acquireManualResearchLease(env, LEGACY_SETTINGS_LEASE, 600)", legacySettingsFunction);
const legacyDraftFunction = legacy.indexOf("async function updateDraftDecision");
const legacyDraftConfirm = legacy.indexOf("if (!isExplicitJsonConfirmation(parsed.value))", legacyDraftFunction);
const legacyDraftLease = legacy.indexOf("const lease = await acquireManualResearchLease(env, actionKey, 600)", legacyDraftFunction);
if (!(legacySettingsFunction < legacySettingsConfirm && legacySettingsConfirm < legacySettingsLease)) {
  errors.push("Legacy settings confirmation must precede legacy settings lease acquisition");
}
if (!(legacyDraftFunction < legacyDraftConfirm && legacyDraftConfirm < legacyDraftLease)) {
  errors.push("Legacy draft confirmation must precede shared draft lease acquisition");
}

requireTokens("manual research concurrency document", doc, [
  "# Manual research concurrency",
  "manual_research_lease_v1",
  "one SQLite `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE` statement",
  "There is no read-then-write acquisition path.",
  "An expired holder cannot delete a newer lease",
  "research_action_in_progress",
  "automaticRetryAllowed: false",
  "query-hint",
  "legacy-source:<source-id>",
  "opportunity-source-candidates-commit",
  "autonomy-settings",
  "legacy-safe-settings",
  "draft-review:<draft-id>",
  "legacy draft approve/reject compatibility route deliberately uses the same",
  "opportunity-review:<opportunity-id>",
  "hashed `draft-strategy:` lease",
  "hashed `opportunity-strategy:` lease",
  "It does not authorise an automatic retry executor.",
]);

const expectedCommand = "node scripts/check-manual-research-lease-safety.mjs";
if (packageJson.scripts?.["research:manual-lease-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose research:manual-lease-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run research:manual-lease-safety:check")) {
  errors.push("check:local must include research:manual-lease-safety:check");
}
requireTokens("safety gate completeness", safetyGate, [
  '"research:manual-lease-safety:check": "node scripts/check-manual-research-lease-safety.mjs"',
  '"scripts/check-manual-research-lease-safety.mjs"',
  "manualResearchLeaseSafetyRequired: true",
]);
requireTokens("Worker contract workflow", workflow, [
  "Verify manual research concurrency leases",
  "npm run research:manual-lease-safety:check",
]);
if (workflow.includes("wrangler deploy")) errors.push("Manual research lease validation must not deploy the Worker");

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "manual-research-lease-safety-v4-settings-and-legacy-review",
  previous_contract: "manual-research-lease-safety-v3-review-and-candidate-coverage",
  atomicSingleStatementAcquisitionRequired: true,
  readThenWriteAcquisitionAllowed: false,
  boundedLeaseTtlRequired: true,
  staleHolderCanReleaseNewLease: false,
  confirmationBeforeLeaseRequired: true,
  conflictStatus: 409,
  automaticRetryAllowed: false,
  scheduledFallbackAllowed: false,
  broadOpportunityRunLeaseRequired: true,
  sourceExpansionLeaseRequired: true,
  sitemapLeaseRequired: true,
  relationshipGraphLeaseRequired: true,
  queryHintResolutionLeaseRequired: true,
  tinySourceBatchLeaseRequired: true,
  perOpportunitySourceLeaseRequired: true,
  perOpportunitySourceHealthLeaseRequired: true,
  perLegacySourceLeaseRequired: true,
  sourceCandidateCommitLeaseRequired: true,
  autonomySettingsLeaseRequired: true,
  legacySettingsLeaseRequired: true,
  draftRecordAndStrategyLeasesRequired: true,
  legacyAndModernDraftReviewShareLease: true,
  opportunityRecordAndStrategyLeasesRequired: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
