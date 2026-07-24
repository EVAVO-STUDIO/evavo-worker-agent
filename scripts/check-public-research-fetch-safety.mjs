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

const helper = read("src/core/publicResearchFetch.ts");
const sourceExpansion = read("src/core/sourceExpansionEngine.ts");
const relationshipGraph = read("src/core/sourceExpansionGraphDiscovery.ts");
const sitemapExpansion = read("src/core/sourceExpansionSitemap.ts");
const opportunityRunner = read("src/opportunityAutonomy.ts");
const opportunityDiscovery = read("src/routes/opportunityDiscoveryAdmin.ts");
const sourcesAdmin = read("src/routes/sourcesAdmin.ts");
const sourceBatch = read("src/routes/sourceBatchAdmin.ts");
const queryResolver = read("src/core/sourceExpansionQueryResolver.ts");
const wrangler = read("wrangler.toml");
const workflow = read(".github/workflows/worker-contract.yml");
const readme = read("README.md");
const boundaryDoc = read("docs/public-research-fetch-boundary.md");
const packageJson = JSON.parse(read("package.json") || "{}");
const safetyGate = read("scripts/check-safety-gate-completeness.mjs");

requireTokens("public research fetch helper", helper, [
  'PUBLIC_RESEARCH_FETCH_CONTRACT = "public_research_fetch_v1"',
  "DEFAULT_PUBLIC_RESEARCH_MAX_BYTES = 1_048_576",
  "DEFAULT_PUBLIC_RESEARCH_MAX_REDIRECTS = 4",
  "DEFAULT_PUBLIC_RESEARCH_TIMEOUT_MS = 12_000",
  'url.protocol !== "https:" && url.protocol !== "http:"',
  "url.username || url.password",
  'error: "non_public_research_host"',
  'error: "non_standard_port_not_allowed"',
  '"metadata.google.internal"',
  '".localhost"',
  '".internal"',
  '".onion"',
  "isBlockedIpv4",
  "isBlockedIpv6",
  'redirect: "manual"',
  "validatePublicResearchUrl(location, currentUrl)",
  '"redirect_loop"',
  '"too_many_redirects"',
  "new AbortController()",
  '"research_fetch_timeout"',
  '"response_too_large"',
  "readBodyBounded",
  "bodySha256",
  'crypto.subtle.digest("SHA-256", bytes)',
  '"EVAVO-Growth-Research-Worker/1.0 (+https://evavo.com.au)"',
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
  if (/\bfetch\s*\(/.test(source)) errors.push(`${relativePath} must not call global fetch directly`);
  forbidTokens(relativePath, source, [
    'redirect: "follow"',
    "EVAVO-Outbound-Agent",
    "EVAVO-Opportunity-Agent",
    "Opportunity Intelligence Source Discovery",
  ]);
}

requireTokens("source expansion run truthfulness", sourceExpansion, [
  "normalizeExpansionFailure",
  "ALLOWED_EXPANSION_FAILURES",
  "let fetchAttempts = 0",
  "fetchAttempts += 1",
  "pagesFetched += 1",
  'const runStatus = failed > 0 && pagesFetched === 0 ? "failed" : "completed"',
  '`partial_source_failures:${failed}`',
  "error: runError",
  "fetchAttempts,",
  "timeoutScope: fetched.timeoutScope",
  "fullOperationTimeout: true",
]);
const fetchFailurePosition = sourceExpansion.indexOf('if (!fetched.ok) throw new Error(fetched.error || "research_fetch_failed")');
const successfulPagePosition = sourceExpansion.indexOf("pagesFetched += 1", fetchFailurePosition);
if (fetchFailurePosition < 0 || successfulPagePosition < 0 || successfulPagePosition <= fetchFailurePosition) {
  errors.push("Source expansion pagesFetched must count only successful bounded fetches");
}

requireTokens("relationship graph run truthfulness", relationshipGraph, [
  "let fetchAttempts = 0",
  "fetchAttempts += 1",
  "pagesFetched += 1",
  'const runStatus = failed > 0 && pagesFetched === 0 ? "failed" : "completed"',
  '`partial_source_failures:${failed}`',
  "timeoutScope: fetched.timeoutScope",
  "fullOperationTimeout: true",
]);

requireTokens("sitemap run truthfulness", sitemapExpansion, [
  "let successfulFetches = 0",
  "successfulFetches += 1",
  'const runStatus = seeds.length === 0',
  '"skipped"',
  '"failed"',
  '`partial_source_failures:${failures}`',
  "timeoutScope: result.timeoutScope",
  "fullOperationTimeout: true",
]);

requireTokens("manual opportunity run truthfulness", opportunityRunner, [
  'startOpportunityRun(env, "manual_confirmed"',
  'discoveredBy: "manual-confirmed-run-due"',
  'runType: "manual_confirmed"',
  "let successfulSources = 0",
  "successfulSources += 1",
  'const runStatus = summary.failed > 0 && successfulSources === 0 ? "failed" : "completed"',
  '`partial_source_failures:${summary.failed}`',
  "sourceFetch: sourceReceipt",
  "timeoutScope: fetched.timeoutScope",
  "fullOperationTimeout: true",
  'fetchContract: "public_research_fetch_v1"',
]);
forbidTokens("manual opportunity runner", opportunityRunner, [
  'startOpportunityRun(env, "scheduled"',
  'discoveredBy: "scheduled"',
]);

requireTokens("source admin provenance and input redaction", sourcesAdmin, [
  "validatePublicResearchUrl(rawUrl)",
  "sourceRunId = uuid()",
  "sourceFetch: fetchReceipt(sourceResult)",
  "profileFetch: profileReceipt",
  "source_run_id",
  "bodySha256",
  "timeoutScope: result.timeoutScope",
  "inputRedacted: true",
  'fetchContract: "public_research_fetch_v1"',
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
  "timeoutScope: fetched.timeoutScope",
  "sourceFetch,",
  "sourceFetch: sourceFetch",
  "fullOperationTimeout: true",
  "boundedResponse: true",
  "publicWebOnly: true",
]);

requireTokens("tiny source batch receipts", sourceBatch, [
  "timeoutScope: result.timeoutScope",
  "fullOperationTimeout: true",
  'fetchContract: "public_research_fetch_v1"',
]);

requireTokens("query hint URL resolver", queryResolver, [
  'from "./publicResearchFetch"',
  "validatePublicResearchUrl(rawUrl)",
  'reason: decision.error || "invalid_research_url"',
  "inputRedacted: true",
  'urlPolicyContract: "public_research_fetch_v1"',
]);
forbidTokens("query hint input redaction", queryResolver, [
  "results.push({ url: rawUrl",
]);

requireTokens("Cloudflare runtime configuration", wrangler, [
  'compatibility_flags = ["global_fetch_strictly_public"]',
  "Enforce public-only subrequests at the Cloudflare runtime boundary.",
]);

requireTokens("Worker contract workflow", workflow, [
  "Verify public research fetch boundary",
  "npm run research:public-fetch-safety:check",
  "npm run check:local",
]);
if (workflow.includes("wrangler deploy")) errors.push("Worker contract workflow must not deploy while validating public research safety");

requireTokens("README public research boundary", readme, [
  "Public research URLs and every redirect are validated against the shared public-only network policy.",
  "Public response bodies are full-operation-timeout-bounded, byte-bounded and hashed for evidence receipts.",
  "Unsafe rejected URL inputs are redacted rather than reflected in route responses or audit metadata.",
  "Research runs distinguish attempts from successful fetches and report skipped, failed, partial and completed outcomes truthfully.",
  "default full-operation timeout is 12 seconds",
  "timeoutScope: full_operation",
  "global_fetch_strictly_public",
  "SHA-256 body hash",
  "docs/public-research-fetch-boundary.md",
  "npm run research:public-fetch-safety:check",
]);

requireTokens("public research boundary document", boundaryDoc, [
  "# Public research fetch boundary",
  "public_research_fetch_v1",
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
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run research:public-fetch-safety:check")) {
  errors.push("check:local must include research:public-fetch-safety:check");
}

requireTokens("safety gate completeness", safetyGate, [
  '"research:public-fetch-safety:check": "node scripts/check-public-research-fetch-safety.mjs"',
  '"scripts/check-public-research-fetch-safety.mjs"',
  "publicResearchFetchSafetyRequired: true",
]);

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "public-research-fetch-safety-v5-truthful-redacted-evidence",
  publicHttpOnly: true,
  privateAndReservedHostsRejected: true,
  urlCredentialsRejected: true,
  nonStandardPortsRejected: true,
  redirectsValidatedManually: true,
  redirectLoopsBlocked: true,
  responseBytesBounded: true,
  fetchTimeoutRequired: true,
  timeoutCoversRedirectsAndBody: true,
  responseHashRequired: true,
  strictPublicCloudflareFetchRequired: true,
  directResearchFetchCallsOutsideBoundaryAllowed: false,
  rejectedUnsafeInputsEchoed: false,
  sourceRunProvenanceRequired: true,
  sourceExpansionRunTruthfulnessRequired: true,
  relationshipGraphRunTruthfulnessRequired: true,
  sitemapRunTruthfulnessRequired: true,
  manualOpportunityRunTruthfulnessRequired: true,
  manualOpportunityRunsLabelledScheduled: false,
  boundaryDocumentationRequired: true,
  focusedCiGateRequired: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
