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
const sourceBatch = read("src/routes/sourceBatchAdmin.ts");
const opportunityDiscovery = read("src/routes/opportunityDiscoveryAdmin.ts");
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
  ["manual opportunity run", runDue, [
    'MANUAL_OPPORTUNITY_RUN_LEASE = "opportunity-run-due"',
    "acquireManualResearchLease(env, MANUAL_OPPORTUNITY_RUN_LEASE, 900)",
    "manualResearchLeaseConflict(MANUAL_OPPORTUNITY_RUN_LEASE)",
    "status: 409",
    "finally {",
    "releaseManualResearchLease(env, lease)",
    "concurrentDuplicateRunAllowed: false",
  ]],
  ["source expansion routes", expansion, [
    "async function withResearchLease",
    '"source-expansion-scan"',
    '"source-expansion-sitemap-scan"',
    "acquireManualResearchLease(env, actionKey, 900)",
    "manualResearchLeaseConflict(actionKey)",
    "status: 409",
    "finally {",
    "releaseManualResearchLease(env, lease)",
  ]],
  ["relationship graph route", relationshipGraph, [
    'const actionKey = "source-expansion-relationship-graph"',
    "acquireManualResearchLease(env, actionKey, 900)",
    "manualResearchLeaseConflict(actionKey)",
    "status: 409",
    "finally {",
    "releaseManualResearchLease(env, lease)",
  ]],
  ["tiny source batch", sourceBatch, [
    'const actionKey = "sources-run-tiny"',
    "acquireManualResearchLease(env, actionKey, 600)",
    "manualResearchLeaseConflict(actionKey)",
    "status: 409",
    "finally {",
    "releaseManualResearchLease(env, lease)",
    "concurrentDuplicateRunAllowed: false",
  ]],
  ["opportunity source actions", opportunityDiscovery, [
    "async function withSourceLease",
    'const actionKey = `opportunity-source:${sourceId}`',
    "acquireManualResearchLease(env, actionKey, 600)",
    "manualResearchLeaseConflict(actionKey)",
    "status: 409",
    "finally {",
    "releaseManualResearchLease(env, lease)",
    "return withSourceLease(env, json, parsed.id",
  ]],
];

for (const [label, source, tokens] of routeContracts) {
  requireTokens(label, source, [
    'from "../core/manualResearchLease"',
    ...tokens,
  ]);
  const confirmPosition = source.indexOf('error: "confirm_required"');
  const acquirePosition = source.indexOf("acquireManualResearchLease");
  if (confirmPosition < 0 || acquirePosition < 0 || confirmPosition >= acquirePosition) {
    errors.push(`${label} must require confirmation before acquiring a research lease`);
  }
}

for (const [label, source] of routeContracts) {
  forbidTokens(label, source, [
    "setTimeout(",
    "waitUntil(",
    "automaticRetryAllowed: true",
    "scheduledFallbackAllowed: true",
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
  contract: "manual-research-lease-safety-v1",
  atomicSingleStatementAcquisitionRequired: true,
  readThenWriteAcquisitionAllowed: false,
  boundedLeaseTtlRequired: true,
  staleHolderCanReleaseNewLease: false,
  conflictStatus: 409,
  automaticRetryAllowed: false,
  scheduledFallbackAllowed: false,
  broadOpportunityRunLeaseRequired: true,
  sourceExpansionLeaseRequired: true,
  sitemapLeaseRequired: true,
  relationshipGraphLeaseRequired: true,
  tinySourceBatchLeaseRequired: true,
  perOpportunitySourceLeaseRequired: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
