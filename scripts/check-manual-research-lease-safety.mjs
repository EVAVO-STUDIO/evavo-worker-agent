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
const runDue = read("src/routes/opportunityRunDueAdmin.ts");
const expansion = read("src/routes/sourceExpansionAdmin.ts");
const relationshipGraph = read("src/routes/sourceExpansionPublicDirectoryScanAdmin.ts");
const queryHintResolver = read("src/routes/sourceExpansionQueryHintResolverAdmin.ts");
const sourceBatch = read("src/routes/sourceBatchAdmin.ts");
const opportunityDiscovery = read("src/routes/opportunityDiscoveryAdmin.ts");
const sourcesAdmin = read("src/routes/sourcesAdmin.ts");
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
    source: runDue,
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
    source: expansion,
    gateToken: "return withResearchLease(env, json, \"source-expansion-scan\"",
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
    source: relationshipGraph,
    gateToken: "const lease = await acquireManualResearchLease(env, actionKey, 900)",
    tokens: [
      'const actionKey = "source-expansion-relationship-graph"',
      "manualResearchLeaseConflict(actionKey)",
      "releaseManualResearchLease(env, lease)",
    ],
  },
  {
    label: "query hint resolver",
    source: queryHintResolver,
    gateToken: "const lease = await acquireManualResearchLease(env, actionKey, 300)",
    tokens: [
      'const actionKey = `query-hint-resolve:${hintId}`',
      "manualResearchLeaseConflict(actionKey)",
      "releaseManualResearchLease(env, lease)",
      "hintId,",
    ],
  },
  {
    label: "tiny source batch",
    source: sourceBatch,
    gateToken: "const lease = await acquireManualResearchLease(env, actionKey, 600)",
    tokens: [
      'const actionKey = "sources-run-tiny"',
      "manualResearchLeaseConflict(actionKey)",
      "releaseManualResearchLease(env, lease)",
      "concurrentDuplicateRunAllowed: false",
    ],
  },
  {
    label: "opportunity source actions",
    source: opportunityDiscovery,
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
    label: "legacy source actions",
    source: sourcesAdmin,
    gateToken: "return withSourceLease(env, json, sourceId",
    tokens: [
      "async function withSourceLease",
      'const actionKey = `legacy-source:${sourceId}`',
      "const lease = await acquireManualResearchLease(env, actionKey, 600)",
      "manualResearchLeaseConflict(actionKey)",
      "releaseManualResearchLease(env, lease)",
    ],
  },
];

for (const { label, source, gateToken, tokens } of routeContracts) {
  requireTokens(label, source, [
    'from "../core/manualResearchLease"',
    'from "../core/boundedJsonRequest"',
    "readBoundedJsonObject",
    "isExplicitJsonConfirmation",
    'error: "confirm_required"',
    "confirmationCoercionAllowed: false",
    "requestReceipt",
    "status: 409",
    "finally {",
    gateToken,
    ...tokens,
  ]);
  const confirmPosition = source.indexOf('error: "confirm_required"');
  const gatePosition = source.indexOf(gateToken);
  if (confirmPosition < 0 || gatePosition < 0 || confirmPosition >= gatePosition) {
    errors.push(`${label} must require exact bounded confirmation before entering the lease-protected action`);
  }
}

for (const { label, source } of routeContracts) {
  forbidTokens(label, source, [
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

requireTokens("manual research concurrency document", doc, [
  "# Manual research concurrency",
  "manual_research_lease_v1",
  "one SQLite `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE` statement",
  "There is no read-then-write acquisition path.",
  "An expired holder cannot delete a newer lease",
  "research_action_in_progress",
  "automaticRetryAllowed: false",
  "query-hint",
  "legacy source",
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
  contract: "manual-research-lease-safety-v2-complete-route-coverage",
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
  perLegacySourceLeaseRequired: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
