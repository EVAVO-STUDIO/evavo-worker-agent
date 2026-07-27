#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

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

function containsGlobalFetchCall(source, fileName) {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  let found = false;
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "fetch"
    ) {
      found = true;
      return;
    }
    if (!found) ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return found;
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const helper = read("src/core/publicResearchFetch.ts");
const sourceExpansion = read("src/core/sourceExpansionEngine.ts");
const relationshipGraph = read("src/core/sourceExpansionGraphDiscovery.ts");
const sitemapExpansion = read("src/core/sourceExpansionSitemap.ts");
const opportunityRunner = read("src/opportunityAutonomy.ts");
const opportunityRuns = read("src/core/opportunityRuns.ts");
const opportunityDiscovery = read("src/routes/opportunityDiscoveryAdmin.ts");
const sourcesAdmin = read("src/routes/sourcesAdmin.ts");
const sourceBatch = read("src/routes/sourceBatchAdmin.ts");
const queryResolver = read("src/core/sourceExpansionQueryResolver.ts");
const tests = read("tests/publicResearchFetch.test.ts");
const wrangler = read("wrangler.toml");
const workflow = read(".github/workflows/worker-contract.yml");
const readme = read("README.md");
const boundaryDoc = read("docs/public-research-fetch-boundary.md");
const packageJson = JSON.parse(read("package.json") || "{}");
const safetyGate = read("scripts/check-safety-gate-completeness.mjs");
const cryptoBufferSource = read("src/core/cryptoBufferSource.ts");

requireTokens("public research fetch helper", helper, [
  'PUBLIC_RESEARCH_FETCH_CONTRACT = "public_research_fetch_v2"',
  "DEFAULT_PUBLIC_RESEARCH_MAX_BYTES = 1_048_576",
  "DEFAULT_PUBLIC_RESEARCH_MAX_REDIRECTS = 4",
  "DEFAULT_PUBLIC_RESEARCH_TIMEOUT_MS = 12_000",
  'url.protocol !== "https:" && url.protocol !== "http:"',
  "url.username || url.password",
  'error: "non_public_research_host"',
  'error: "non_standard_port_not_allowed"',
  'error: "sensitive_query_parameter_not_allowed"',
  '"metadata.google.internal"',
  '".localhost"',
  '".internal"',
  '".onion"',
  "SENSITIVE_QUERY_KEYS",
  '"x-amz-signature"',
  '"x-goog-signature"',
  "isBlockedIpv4",
  "isBlockedIpv6",
  'redirect: "manual"',
  "validatePublicResearchUrl(location, currentUrl)",
  '"redirect_loop"',
  '"too_many_redirects"',
  "redirectChain.push",
  "new AbortController()",
  '"research_fetch_timeout"',
  '"response_too_large"',
  '"binary_response_rejected"',
  "readBodyBounded",
  "isProbablyBinary",
  "bodySha256",
  "copyBytesToArrayBuffer(bytes)",
  '"EVAVO-Growth-Research-Worker/2.0 (+https://evavo.com.au)"',
  "fetchPublicResearchHtml",
  "fetchPublicResearchText",
  "const deadlineAt = startedAt + timeoutMs",
  "const remainingMs = deadlineAt - Date.now()",
  'let phase: "headers" | "body" = "headers"',
  'phase = "body"',
  'timeoutScope: "full_operation"',
  "controller.signal.aborted",
  "finally {",
  "clearTimeout(timeout)",
  "contentLength",
  "etag",
  "lastModified",
  "contentLanguage",
  "transport?: PublicResearchTransport",
]);


requireTokens("crypto BufferSource copy", cryptoBufferSource, [
  "copyBytesToArrayBuffer",
  "const copy = new Uint8Array(bytes.byteLength)",
  "copy.set(bytes)",
  "return copy.buffer",
]);
forbidTokens("crypto BufferSource copy", cryptoBufferSource, [
  "fetch(",
  "process.env",
  "child_process",
]);

const boundedReadPosition = helper.indexOf("const bounded = await readBodyBounded(response, maxBytes)");
const timeoutClearPosition = helper.lastIndexOf("clearTimeout(timeout)");
if (boundedReadPosition < 0 || timeoutClearPosition < 0 || timeoutClearPosition <= boundedReadPosition) {
  errors.push("Public research timeout must remain active until after the bounded response body is read");
}

forbidTokens("public research fetch helper", helper, [
  'redirect: "follow"',
  "EVAVO-Outbound-Agent",
  "EVAVO-Opportunity-Agent",
  "Opportunity Intelligence Source Discovery",
]);

const guardedFetchFiles = [
  ["src/core/sourceExpansionGraphDiscovery.ts", relationshipGraph],
  ["src/core/sourceExpansionEngine.ts", sourceExpansion],
  ["src/core/sourceExpansionSitemap.ts", sitemapExpansion],
  ["src/opportunityAutonomy.ts", opportunityRunner],
  ["src/routes/opportunityDiscoveryAdmin.ts", opportunityDiscovery],
  ["src/routes/sourceBatchAdmin.ts", sourceBatch],
  ["src/routes/sourcesAdmin.ts", sourcesAdmin],
];

for (const [relativePath, source] of guardedFetchFiles) {
  requireTokens(relativePath, source, ["publicResearchFetch"]);
  if (containsGlobalFetchCall(source, relativePath)) errors.push(`${relativePath} must not call global fetch directly`);
  forbidTokens(relativePath, source, [
    'redirect: "follow"',
    "EVAVO-Outbound-Agent",
    "EVAVO-Opportunity-Agent",
    "Opportunity Intelligence Source Discovery",
  ]);
}

const sourceRoot = path.join(root, "src");
if (fs.existsSync(sourceRoot)) {
  for (const absolute of walk(sourceRoot).filter((file) => /\.(ts|tsx)$/.test(file))) {
    const source = fs.readFileSync(absolute, "utf8");
    if (source.includes("public_research_fetch_v1")) {
      errors.push(`${path.relative(root, absolute).replaceAll("\\", "/")} contains stale active fetch contract public_research_fetch_v1`);
    }
  }
}

requireTokens("source expansion run truthfulness", sourceExpansion, [
  "PUBLIC_RESEARCH_FETCH_CONTRACT",
  "normalizeExpansionFailure",
  "ALLOWED_EXPANSION_FAILURES",
  '"sensitive_query_parameter_not_allowed"',
  '"binary_response_rejected"',
  "let fetchAttempts = 0",
  "fetchAttempts += 1",
  "pagesFetched += 1",
  'const runStatus = fetchAttempts === 0 ? "skipped"',
  '? "partial" : "completed"',
  '`partial_source_failures:${failed}`',
  "error: runError",
  "fetchAttempts,",
  "redirectChain: fetched.redirectChain",
  "timeoutScope: fetched.timeoutScope",
  "fullOperationTimeout: true",
  "reviewOnly: true",
  "externalExecutionAllowed: false",
]);
const fetchFailurePosition = sourceExpansion.indexOf('if (!fetched.ok) throw new Error(fetched.error || "research_fetch_failed")');
const successfulPagePosition = sourceExpansion.indexOf("pagesFetched += 1", fetchFailurePosition);
if (fetchFailurePosition < 0 || successfulPagePosition < 0 || successfulPagePosition <= fetchFailurePosition) {
  errors.push("Source expansion pagesFetched must count only successful bounded fetches");
}

requireTokens("relationship graph run truthfulness", relationshipGraph, [
  "PUBLIC_RESEARCH_FETCH_CONTRACT",
  "let fetchAttempts = 0",
  "fetchAttempts += 1",
  "pagesFetched += 1",
  'const runStatus = fetchAttempts === 0 ? "skipped"',
  '? "partial" : "completed"',
  '`partial_source_failures:${failed}`',
  "redirectChain: fetched.redirectChain",
  "timeoutScope: fetched.timeoutScope",
  "fullOperationTimeout: true",
  "ok: runStatus !== \"failed\"",
]);

requireTokens("sitemap run truthfulness and index traversal", sitemapExpansion, [
  "PUBLIC_RESEARCH_FETCH_CONTRACT",
  "SitemapQueueItem",
  "function isSitemapIndex",
  "const sitemapQueue: SitemapQueueItem[] = []",
  "childSitemapsQueued",
  "sitemapDocumentsFetched",
  "next.depth < 2",
  "maxSitemapDepth: 2",
  "let successfulFetches = 0",
  "successfulFetches += 1",
  'const runStatus = seeds.length === 0',
  '? "partial"',
  '`partial_source_failures:${failures}`',
  "redirectChain: result.redirectChain",
  "timeoutScope: result.timeoutScope",
  "fullOperationTimeout: true",
  "ok: runStatus !== \"failed\"",
]);

requireTokens("manual opportunity run truthfulness and source exclusion", opportunityRunner, [
  "PUBLIC_RESEARCH_FETCH_CONTRACT",
  'startOpportunityRun(env, "manual_confirmed"',
  'discoveredBy: "manual-confirmed-run-due"',
  'runType: "manual_confirmed"',
  "let successfulSources = 0",
  "let sourceLeaseConflicts = 0",
  "successfulSources += 1",
  "sourceLeaseConflicts += 1",
  'const sourceActionKey = `opportunity-source:${source.id}`',
  "const sourceLease = await acquireManualResearchLease(env, sourceActionKey, 600)",
  "releaseManualResearchLease(env, sourceLease)",
  "successfulSources === 0 && summary.failed === 0",
  '"all_selected_sources_busy"',
  '`partial_source_outcomes:failed:${summary.failed}:busy:${sourceLeaseConflicts}:budget:${budget.policyDeniedSourceClaims + budget.raceDeniedSourceClaims}`',
  "sourceFetch: sourceReceipt",
  "redirectChain: fetched.redirectChain",
  "timeoutScope: fetched.timeoutScope",
  "fullOperationTimeout: true",
  "sourceHealthAndAuditAtomic: true",
  "overlappingPerSourceActionAllowed: false",
]);
forbidTokens("manual opportunity runner", opportunityRunner, [
  'startOpportunityRun(env, "scheduled"',
  'discoveredBy: "scheduled"',
  '`partial_source_failures:${summary.failed}`',
]);

requireTokens("opportunity audit transaction support", opportunityRuns, [
  'OpportunityRunStatus = "running" | "completed" | "partial" | "failed" | "skipped"',
  "prepareSourceRunResult",
]);

requireTokens("source admin provenance and atomicity", sourcesAdmin, [
  "validatePublicResearchUrl(rawUrl)",
  "sourceRunId = uuid()",
  "const sourceFetch = fetchReceipt(sourceResult)",
  "profileFetch: profileReceipt",
  "source_run_id",
  "bodySha256",
  "redirectChain: result.redirectChain",
  "timeoutScope: result.timeoutScope",
  "inputRedacted: true",
  'fetchContract: "public_research_fetch_v2"',
  "env.DB.batch([runInsert, sourceUpdate])",
  "auditAndSourceUpdateAtomic: true",
]);
forbidTokens("source admin input redaction", sourcesAdmin, [
  'input: String(rawUrl || "")',
  "rejected.push(result)",
]);

requireTokens("opportunity discovery receipts", opportunityDiscovery, [
  "fetchPublicResearchHtml(source.url)",
  "contract: fetched.contract",
  "finalUrl: fetched.finalUrl",
  "bodySha256: fetched.bodySha256",
  "redirectChain: fetched.redirectChain",
  "etag: fetched.etag",
  "lastModified: fetched.lastModified",
  "timeoutScope: fetched.timeoutScope",
  "sourceFetch,",
  "fullOperationTimeout: true",
  "boundedResponse: true",
  "publicWebOnly: true",
]);

requireTokens("tiny source batch receipts, atomicity, and source exclusion", sourceBatch, [
  "redirectChain: result.redirectChain",
  "timeoutScope: result.timeoutScope",
  "fullOperationTimeout: true",
  'fetchContract: "public_research_fetch_v2"',
  "env.DB.batch([runInsert, sourceUpdate])",
  "auditAndSourceUpdateAtomic: true",
  'runStatus = results.length === 0 ? "skipped"',
  'const sourceActionKey = `legacy-source:${source.id}`',
  "const sourceLease = await acquireManualResearchLease(env, sourceActionKey, 600)",
  'reason: "source_action_in_progress"',
  "releaseManualResearchLease(env, sourceLease)",
  "overlappingPerSourceActionAllowed: false",
]);

requireTokens("query hint URL resolver", queryResolver, [
  "PUBLIC_RESEARCH_FETCH_CONTRACT",
  "validatePublicResearchUrl(rawUrl)",
  'reason: decision.error || "invalid_research_url"',
  "inputRedacted: true",
  "env.DB.batch(statements)",
  "candidateAndHintUpdateAtomic: true",
  "externalExecutionAllowed: false",
]);
forbidTokens("query hint input redaction", queryResolver, [
  "results.push({ url: rawUrl",
]);

requireTokens("public research behavioral tests", tests, [
  'from "../src/core/publicResearchFetch.ts"',
  'test("public URL validation rejects non-public and credential-bearing targets"',
  'test("manual redirects are validated and recorded before the next request"',
  'test("an unsafe redirect is rejected before a second transport call"',
  'test("bounded reads reject oversized and binary responses"',
  'test("HTML research rejects a non-HTML declared media type"',
  '"sensitive_query_parameter_not_allowed"',
  '"binary_response_rejected"',
  '"public_research_fetch_v2"',
]);

requireTokens("Cloudflare runtime configuration", wrangler, [
  'compatibility_flags = ["global_fetch_strictly_public"]',
  "Enforce public-only subrequests at the Cloudflare runtime boundary.",
]);

requireTokens("Worker contract workflow", workflow, [
  "Verify public research fetch boundary",
  "npm run research:public-fetch-safety:check",
  "Run deterministic core tests",
  "npm run test:core",
  "npm run check:local",
]);
if (workflow.includes("wrangler deploy")) errors.push("Worker contract workflow must not deploy while validating public research safety");

requireTokens("README public research boundary", readme, [
  "Public research URLs and every redirect are validated against the shared public-only network policy.",
  "Public response bodies are full-operation-timeout-bounded, byte-bounded and hashed for evidence receipts.",
  "Unsafe rejected URL inputs are redacted rather than reflected in route responses or audit metadata.",
  "Research runs distinguish attempts from successful fetches and report skipped, failed, partial and completed outcomes truthfully.",
  "public_research_fetch_v2",
  "redirect chain",
  "sitemap indexes",
  "npm run research:public-fetch-safety:check",
  "npm run test:core",
]);

requireTokens("public research boundary document", boundaryDoc, [
  "# Public research fetch boundary",
  "public_research_fetch_v2",
  "sensitive query parameter",
  "binary",
  "redirectChain",
  "ETag",
  "Last-Modified",
  "Sitemap indexes",
  "Rejected unsafe URL input is not echoed back",
  "Automatic redirect following is disabled.",
  "maximum full operation time: 12,000 milliseconds",
  "The timeout covers the complete redirect chain, response headers and streamed body read.",
  "Bodies are read as streams.",
  'compatibility_flags = ["global_fetch_strictly_public"]',
  "timeoutScope",
  "## Run truthfulness",
  "Raw runtime or database exception text must not become route output",
  "Confirmation authorises only the bounded manual research action",
]);

const expectedCommand = "node scripts/check-public-research-fetch-safety.mjs";
if (packageJson.scripts?.["research:public-fetch-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose research:public-fetch-safety:check as ${expectedCommand}`);
}
const coreTestCommand = String(packageJson.scripts?.["test:core"] || "");
for (const token of [
  "--experimental-loader ./scripts/typescript-test-loader.mjs",
  "--test",
]) {
  if (!coreTestCommand.includes(token)) {
    errors.push(`package.json test:core must retain the guarded TypeScript loader token: ${token}`);
  }
}
const checkLocal = String(packageJson.scripts?.["check:local"] || "");
for (const command of ["npm run research:public-fetch-safety:check", "npm run test:core"]) {
  if (!checkLocal.includes(command)) errors.push(`check:local must include ${command}`);
}

requireTokens("safety gate completeness", safetyGate, [
  '"research:public-fetch-safety:check": "node scripts/check-public-research-fetch-safety.mjs"',
  '"scripts/check-public-research-fetch-safety.mjs"',
  "publicResearchFetchSafetyRequired: true",
]);

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "public-research-fetch-safety-v7-hierarchical-source-exclusion",
  activeFetchContract: "public_research_fetch_v2",
  publicHttpOnly: true,
  privateAndReservedHostsRejected: true,
  urlCredentialsRejected: true,
  sensitiveQueryParametersRejected: true,
  nonStandardPortsRejected: true,
  redirectsValidatedManually: true,
  redirectChainEvidenceRequired: true,
  redirectLoopsBlocked: true,
  responseBytesBounded: true,
  binaryResponsesRejected: true,
  fetchTimeoutRequired: true,
  timeoutCoversRedirectsAndBody: true,
  responseHashRequired: true,
  cacheValidatorEvidenceRequired: true,
  strictPublicCloudflareFetchRequired: true,
  directResearchFetchCallsOutsideBoundaryAllowed: false,
  rejectedUnsafeInputsEchoed: false,
  sourceRunProvenanceRequired: true,
  sourceExpansionRunTruthfulnessRequired: true,
  relationshipGraphRunTruthfulnessRequired: true,
  sitemapIndexTraversalRequired: true,
  manualOpportunityRunTruthfulnessRequired: true,
  broadOpportunityPerSourceLeaseRequired: true,
  tinyBatchPerSourceLeaseRequired: true,
  overlappingBroadAndPerSourceActionsAllowed: false,
  sourceHealthAuditAtomicityRequired: true,
  queryHintResolutionAtomicityRequired: true,
  manualOpportunityRunsLabelledScheduled: false,
  boundaryDocumentationRequired: true,
  behavioralTestsRequired: true,
  focusedCiGateRequired: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
