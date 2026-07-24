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
const sourceHealthActions = read("src/routes/opportunitySourceHealthActionsAdmin.ts");
const learning = read("src/routes/opportunityLearningAdmin.ts");
const discovery = read("src/routes/opportunityDiscoveryAdmin.ts");
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
  const bodyPosition = sourceExpansion.indexOf("const body = await bodyJson(request)", routeStart);
  const confirmPosition = sourceExpansion.indexOf("if (body?.confirm !== true)", routeStart);
  if (routeStart < 0 || bodyPosition < 0 || confirmPosition < 0 || !(routeStart < bodyPosition && bodyPosition < confirmPosition && confirmPosition < callPosition)) {
    errors.push(`Source expansion confirmation must precede execution call: ${call}`);
  }
}

for (const token of [
  "limitSeeds: boundedInteger(body?.limitSeeds, 3, 1, 10)",
  "maxFetches: boundedInteger(body?.maxFetches, 3, 1, 10)",
  "maxLinksPerSeed: boundedInteger(body?.maxLinksPerSeed, 40, 5, 80)",
  "maxCandidates: boundedInteger(body?.maxCandidates, 40, 5, 100)",
  "maxSitemapUrls: boundedInteger(body?.maxSitemapUrls, 50, 5, 100)",
  "limit: boundedInteger(body?.limit, 80, 1, 150)",
]) {
  if (!sourceExpansion.includes(token)) errors.push(`Source expansion execution bound is missing: ${token}`);
}

const runDueBodyPosition = runDue.indexOf("const body = await request.json().catch(() => ({}))");
const runDueConfirmPosition = runDue.indexOf("if (body?.confirm !== true)");
const runDueSettingsPosition = runDue.indexOf("const settings = await readAutonomySettings(env)");
const runDueExecutionPosition = runDue.indexOf("const summary = await runOpportunityAutonomy(env, settings)");
if (
  runDueBodyPosition < 0 ||
  runDueConfirmPosition < 0 ||
  runDueSettingsPosition < 0 ||
  runDueExecutionPosition < 0 ||
  !(runDueBodyPosition < runDueConfirmPosition && runDueConfirmPosition < runDueSettingsPosition && runDueSettingsPosition < runDueExecutionPosition)
) {
  errors.push("Opportunity run-due confirmation must precede settings reads and bounded autonomy execution");
}
for (const token of [
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

const discoveryBodyPosition = discovery.indexOf("const body = await request.json().catch(() => ({}))");
const discoveryConfirmPosition = discovery.indexOf("if (!confirmed(body))");
const discoveryTestPosition = discovery.indexOf("return json(await testSource(env, parsed.id))");
const discoveryPreviewPosition = discovery.indexOf("return json(await previewSource(env, parsed.id, requestUrl))");
const discoveryCommitPosition = discovery.indexOf("return json(await commitPreview(env, parsed.id, body))");
for (const [label, executionPosition] of [
  ["source test", discoveryTestPosition],
  ["source preview", discoveryPreviewPosition],
  ["preview commit", discoveryCommitPosition],
]) {
  if (
    discoveryBodyPosition < 0 ||
    discoveryConfirmPosition < 0 ||
    executionPosition < 0 ||
    !(discoveryBodyPosition < discoveryConfirmPosition && discoveryConfirmPosition < executionPosition)
  ) {
    errors.push(`Opportunity discovery confirmation must precede ${label} execution`);
  }
}
for (const token of [
  'reason: "Opportunity source tests, previews and preview commits require explicit confirmation before bounded public-network access or internal state changes."',
  'from "../core/publicResearchFetch"',
  "fetchPublicResearchHtml(source.url)",
  "bodySha256: fetched.bodySha256",
  "boundedResponse: true",
  "publicWebOnly: true",
  "const limit = Math.max(1, Math.min(100",
  "const minScore = Math.max(1, Math.min(100",
  "callsAI: false",
  "sendsEmail: false",
  "autoApplies: false",
]) {
  if (!discovery.includes(token)) errors.push(`Opportunity discovery safety token is missing: ${token}`);
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
  contract: "opportunity-execution-boundary-safety-v2-public-fetch",
  sourceExpansionUsesSharedAuthentication: true,
  sourceExpansionRequiresConfirmation: true,
  sourceExpansionExecutionIsBounded: true,
  opportunityRunDueUsesSharedAuthentication: true,
  opportunityRunDueRequiresConfirmation: true,
  opportunityRunDueRespectsDiscoverySetting: true,
  sourceHealthActionsUseSharedAuthentication: true,
  sourceHealthActionsRequireConfirmation: true,
  opportunityLearningUsesSharedAuthentication: true,
  opportunityLearningIsReadOnly: true,
  opportunityDiscoveryUsesSharedAuthentication: true,
  opportunityDiscoveryRequiresConfirmation: true,
  opportunityDiscoveryUsesPublicFetchBoundary: true,
  callsAI: false,
  sendsEmail: false,
  postsExternally: false,
  autoApplies: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
