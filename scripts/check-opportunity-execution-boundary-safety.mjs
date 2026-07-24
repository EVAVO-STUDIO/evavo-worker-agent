#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const sourceExpansion = read("src/routes/sourceExpansionAdmin.ts");
const runDue = read("src/routes/opportunityRunDueAdmin.ts");
const opportunityRunner = read("src/opportunityAutonomy.ts");
const opportunityRuns = read("src/core/opportunityRuns.ts");
const sourceHealthActions = read("src/routes/opportunitySourceHealthActionsAdmin.ts");
const learning = read("src/routes/opportunityLearningAdmin.ts");
const discovery = read("src/routes/opportunityDiscoveryAdmin.ts");
const boundedJson = read("src/core/boundedJsonRequest.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

for (const [label, content] of [
  ["source expansion handler", sourceExpansion],
  ["opportunity run-due handler", runDue],
  ["source-health actions handler", sourceHealthActions],
  ["opportunity learning handler", learning],
  ["opportunity discovery handler", discovery],
]) {
  if (!content) errors.push(`Missing ${label}`);
  for (const token of [
    'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
    "await isAdminRequestAuthorized(request, env)",
    'error: "Unauthorized"',
    'request.method === "OPTIONS"',
    "status: 405",
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
if (!opportunityRunner) errors.push("Missing confirmed manual opportunity runner");
if (!opportunityRuns) errors.push("Missing opportunity run audit support");
if (!boundedJson) errors.push("Missing bounded JSON request support");

for (const token of [
  'BOUNDED_JSON_REQUEST_CONTRACT = "bounded_admin_json_request_v1"',
  "readBoundedJsonObject",
  "isExplicitJsonConfirmation",
  '(value as JsonObject).confirm === true',
]) {
  if (!boundedJson.includes(token)) errors.push(`Bounded request contract is missing: ${token}`);
}

const sourceExecutionCalls = [
  "bootstrapSourceExpansionSeeds(env)",
  "runSourceExpansion(env,",
  "runSitemapSourceExpansion(env,",
  "saveQueryHints(env,",
  "learnSourceExpansionQuality(env)",
];
for (const call of sourceExecutionCalls) {
  const callPosition = sourceExpansion.indexOf(call);
  if (callPosition < 0) {
    errors.push(`Source expansion handler is missing execution call: ${call}`);
    continue;
  }
  const routeStart = sourceExpansion.lastIndexOf('if (pathname === "', callPosition);
  const bodyPosition = sourceExpansion.indexOf("const confirmed = await confirmedBody(request, json)", routeStart);
  const confirmPosition = sourceExpansion.indexOf("if (!confirmed.ok) return confirmed.response", routeStart);
  if (routeStart < 0 || bodyPosition < 0 || confirmPosition < 0 || !(routeStart < bodyPosition && bodyPosition < confirmPosition && confirmPosition < callPosition)) {
    errors.push(`Source expansion bounded confirmation must precede execution call: ${call}`);
  }
}

for (const token of [
  'from "../core/boundedJsonRequest"',
  "async function confirmedBody",
  "readBoundedJsonObject(request)",
  "boundedJsonFailurePayload(parsed)",
  "isExplicitJsonConfirmation(parsed.value)",
  "confirmationCoercionAllowed: false",
  "requestReceipt",
  "bodySha256",
  "strategy: boundedStrategy(body.strategy)",
  "limitSeeds: boundedInteger(body.limitSeeds, 3, 1, 10)",
  "maxFetches: boundedInteger(body.maxFetches, 3, 1, 10)",
  "maxLinksPerSeed: boundedInteger(body.maxLinksPerSeed, 40, 5, 80)",
  "maxCandidates: boundedInteger(body.maxCandidates, 40, 5, 100)",
  "maxSitemapUrls: boundedInteger(body.maxSitemapUrls, 50, 5, 100)",
  "limit: boundedInteger(confirmed.body.limit, 80, 1, 150)",
  "withResearchLease",
]) {
  if (!sourceExpansion.includes(token)) errors.push(`Source expansion bounded execution token is missing: ${token}`);
}
for (const forbidden of ["request.json()", 'body?.confirm !== true', 'searchParams.get("confirm")']) {
  if (sourceExpansion.includes(forbidden)) errors.push(`Source expansion contains unbounded or coercive token: ${forbidden}`);
}

const runDueBodyPosition = runDue.indexOf("const parsed = await readBoundedJsonObject(request)");
const runDueConfirmPosition = runDue.indexOf("if (!isExplicitJsonConfirmation(parsed.value))");
const runDueLeasePosition = runDue.indexOf("const lease = await acquireManualResearchLease");
const runDueSettingsPosition = runDue.indexOf("const settings = await readAutonomySettings(env)");
const runDueExecutionPosition = runDue.indexOf("const summary = await runOpportunityAutonomy(env, settings)");
if (
  runDueBodyPosition < 0 ||
  runDueConfirmPosition < 0 ||
  runDueLeasePosition < 0 ||
  runDueSettingsPosition < 0 ||
  runDueExecutionPosition < 0 ||
  !(runDueBodyPosition < runDueConfirmPosition && runDueConfirmPosition < runDueLeasePosition && runDueLeasePosition < runDueSettingsPosition && runDueSettingsPosition < runDueExecutionPosition)
) {
  errors.push("Opportunity run-due bounded confirmation and lease must precede settings reads and autonomy execution");
}
for (const token of [
  'from "../core/boundedJsonRequest"',
  "boundedJsonFailurePayload(parsed)",
  "requiredPayload: { confirm: true }",
  "confirmationCoercionAllowed: false",
  "requestReceipt",
  "bodySha256",
  "if (!settings.opportunityDiscoveryEnabled)",
  "dailySourceLimit: settings.dailySourceLimit",
  "maxNetworkCallsPerRun: settings.maxNetworkCallsPerRun",
  "callsAI: false",
  "sendsEmail: false",
  "postsExternally: false",
  "autoApplies: false",
  "savesReviewItemsOnly: true",
]) {
  if (!runDue.includes(token)) errors.push(`Opportunity run-due safety token is missing: ${token}`);
}
for (const forbidden of ["request.json()", 'body?.confirm !== true', 'body?.confirm === 1']) {
  if (runDue.includes(forbidden)) errors.push(`Opportunity run-due contains unbounded or coercive token: ${forbidden}`);
}

for (const token of [
  'from "./core/manualResearchLease"',
  'startOpportunityRun(env, "manual_confirmed"',
  'discoveredBy: "manual-confirmed-run-due"',
  "PUBLIC_RESEARCH_FETCH_CONTRACT",
  "let successfulSources = 0",
  "let sourceLeaseConflicts = 0",
  "successfulSources += 1",
  "sourceLeaseConflicts += 1",
  'const sourceActionKey = `opportunity-source:${source.id}`',
  "const sourceLease = await acquireManualResearchLease(env, sourceActionKey, 600)",
  "releaseManualResearchLease(env, sourceLease)",
  "successfulSources === 0 && summary.failed === 0",
  '"all_selected_sources_busy"',
  '`partial_source_outcomes:failed:${summary.failed}:busy:${sourceLeaseConflicts}`',
  "sourceFetch: sourceReceipt",
  "bodySha256: fetched.bodySha256",
  "redirectChain: fetched.redirectChain",
  "timeoutScope: fetched.timeoutScope",
  "fullOperationTimeout: true",
  "sourceHealthAndAuditAtomic: true",
  "overlappingPerSourceActionAllowed: false",
  "commitSourceOutcome",
  "env.DB.batch([sourceUpdate, prepareSourceRunResult(env, result)])",
  "finishOpportunityRun(env, runId, runStatus, summary, runError)",
  "reviewOnly: true",
  "externalExecutionAllowed: false",
]) {
  if (!opportunityRunner.includes(token)) errors.push(`Confirmed manual opportunity runner is missing: ${token}`);
}
for (const forbidden of [
  'startOpportunityRun(env, "scheduled"',
  'discoveredBy: "scheduled"',
  'finishOpportunityRun(env, runId, "completed", summary)',
  '`partial_source_failures:${summary.failed}`',
]) {
  if (opportunityRunner.includes(forbidden)) errors.push(`Confirmed manual opportunity runner contains stale posture: ${forbidden}`);
}

for (const token of [
  'OpportunityRunStatus = "running" | "completed" | "partial" | "failed" | "skipped"',
  "prepareSourceRunResult",
  "Exclude<OpportunityRunStatus, \"running\">",
]) {
  if (!opportunityRuns.includes(token)) errors.push(`Opportunity run audit support is missing: ${token}`);
}

const sourceHealthBodyPosition = sourceHealthActions.indexOf("const body = await request.json().catch(() => ({}))");
const sourceHealthConfirmPosition = sourceHealthActions.indexOf("if (body?.confirm !== true)");
const sourceHealthMutationPosition = sourceHealthActions.indexOf('UPDATE opportunity_sources SET status = ?');
if (
  sourceHealthBodyPosition < 0 ||
  sourceHealthConfirmPosition < 0 ||
  sourceHealthMutationPosition < 0 ||
  !(sourceHealthBodyPosition < sourceHealthConfirmPosition && sourceHealthConfirmPosition < sourceHealthMutationPosition)
) {
  errors.push("Source-health action confirmation must precede all source metadata mutations");
}
for (const token of [
  'type SourceHealthAction = "pause" | "activate" | "lower_priority" | "raise_priority" | "reset_error"',
  "writesOnlyD1SourceMetadata: true",
  "callsNetwork: false",
  "requiresConfirm: true",
]) {
  if (!sourceHealthActions.includes(token)) errors.push(`Source-health action safety token is missing: ${token}`);
}

for (const token of [
  'pathname !== "/admin/opportunities/learning"',
  'request.method !== "GET"',
  "readOnly: true",
  "writes: false",
]) {
  if (!learning.includes(token)) errors.push(`Opportunity learning read-only token is missing: ${token}`);
}

const discoveryBodyPosition = discovery.indexOf("const parsed = await readBoundedJsonObject(request)");
const discoveryConfirmPosition = discovery.indexOf("if (!isExplicitJsonConfirmation(parsed.value))");
const discoveryLeasePosition = discovery.indexOf("return withSourceLease(env, json, sourceAction.id");
if (
  discoveryBodyPosition < 0 ||
  discoveryConfirmPosition < 0 ||
  discoveryLeasePosition < 0 ||
  !(discoveryBodyPosition < discoveryConfirmPosition && discoveryConfirmPosition < discoveryLeasePosition)
) {
  errors.push("Opportunity discovery bounded confirmation must precede the per-source leased execution boundary");
}
for (const token of [
  'reason: "Opportunity source tests, previews and preview commits require exact JSON confirmation before bounded public-network access or internal state changes."',
  'from "../core/boundedJsonRequest"',
  'from "../core/publicResearchFetch"',
  "readBoundedJsonObject(request)",
  "boundedJsonFailurePayload(parsed)",
  "isExplicitJsonConfirmation(parsed.value)",
  "confirmationCoercionAllowed: false",
  "requestReceipt",
  "fetchPublicResearchHtml(source.url)",
  "bodySha256: fetched.bodySha256",
  "redirectChain: fetched.redirectChain",
  "etag: fetched.etag",
  "lastModified: fetched.lastModified",
  "timeoutScope: fetched.timeoutScope",
  "sourceFetch,",
  "fullOperationTimeout: true",
  "boundedResponse: true",
  "publicWebOnly: true",
  "boundedInteger(body.limit, 50, 1, 100)",
  "boundedInteger(body.minScore, 45, 1, 100)",
  "callsAI: false",
  "sendsEmail: false",
  "autoApplies: false",
  "result = await testSource",
  "result = await previewSource",
  "result = await commitPreview",
]) {
  if (!discovery.includes(token)) errors.push(`Opportunity discovery safety token is missing: ${token}`);
}
for (const forbidden of ["request.json()", "function confirmed(", 'body?.confirm === 1', 'searchParams.get("confirm")']) {
  if (discovery.includes(forbidden)) errors.push(`Opportunity discovery contains unbounded or coercive token: ${forbidden}`);
}
if (/\bfetch\s*\(/.test(discovery)) errors.push("Opportunity discovery must not call global fetch directly");

const expectedCommand = "node scripts/check-opportunity-execution-boundary-safety.mjs";
if (packageJson.scripts?.["opportunities:execution-boundary-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose opportunities:execution-boundary-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run opportunities:execution-boundary-safety:check")) {
  errors.push("check:local must include opportunities:execution-boundary-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "opportunity-execution-boundary-safety-v5-hierarchical-source-exclusion",
  sourceExpansionUsesSharedAuthentication: true,
  sourceExpansionRequiresExactBoundedConfirmation: true,
  sourceExpansionExecutionIsBounded: true,
  opportunityRunDueUsesSharedAuthentication: true,
  opportunityRunDueRequiresExactBoundedConfirmation: true,
  opportunityRunDueRespectsDiscoverySetting: true,
  opportunityRunAuditTypeManualConfirmed: true,
  opportunityRunAllFailedStatusFailed: true,
  opportunityRunPartialStatusExplicit: true,
  opportunityRunAllBusyStatusSkipped: true,
  broadOpportunityPerSourceLeaseRequired: true,
  overlappingBroadAndPerSourceOpportunityActionsAllowed: false,
  opportunitySourceHealthAndAuditAtomic: true,
  opportunityEvidenceReceiptsV2Required: true,
  sourceHealthActionsUseSharedAuthentication: true,
  sourceHealthActionsRequireConfirmation: true,
  opportunityLearningUsesSharedAuthentication: true,
  opportunityLearningIsReadOnly: true,
  opportunityDiscoveryUsesSharedAuthentication: true,
  opportunityDiscoveryRequiresExactBoundedConfirmation: true,
  opportunityDiscoveryUsesPublicFetchV2Boundary: true,
  queryStringConfirmationAllowed: false,
  confirmationCoercionAllowed: false,
  callsAI: false,
  sendsEmail: false,
  postsExternally: false,
  autoApplies: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
