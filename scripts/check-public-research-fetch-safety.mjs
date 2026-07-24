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
]);

forbidTokens("public research fetch helper", helper, [
  'redirect: "follow"',
  "EVAVO-Outbound-Agent",
  "EVAVO-Opportunity-Agent",
  "Opportunity Intelligence Source Discovery",
]);

const guardedFetchFiles = [
  "src/core/sourceExpansionGraphDiscovery.ts",
  "src/core/sourceExpansionEngine.ts",
  "src/core/sourceExpansionSitemap.ts",
  "src/opportunityAutonomy.ts",
  "src/routes/opportunityDiscoveryAdmin.ts",
  "src/routes/sourceBatchAdmin.ts",
  "src/routes/sourcesAdmin.ts",
];

for (const relativePath of guardedFetchFiles) {
  const source = read(relativePath);
  requireTokens(relativePath, source, ["publicResearchFetch"]);
  if (/\bfetch\s*\(/.test(source)) errors.push(`${relativePath} must not call global fetch directly`);
  forbidTokens(relativePath, source, [
    'redirect: "follow"',
    "EVAVO-Outbound-Agent",
    "EVAVO-Opportunity-Agent",
    "Opportunity Intelligence Source Discovery",
  ]);
}

const sourcesAdmin = read("src/routes/sourcesAdmin.ts");
requireTokens("source admin provenance", sourcesAdmin, [
  "validatePublicResearchUrl(rawUrl)",
  "sourceRunId = uuid()",
  "sourceFetch: fetchReceipt(sourceResult)",
  "profileFetch: profileReceipt",
  "source_run_id",
  "bodySha256",
  'fetchContract: "public_research_fetch_v1"',
]);

const opportunityDiscovery = read("src/routes/opportunityDiscoveryAdmin.ts");
requireTokens("opportunity discovery receipts", opportunityDiscovery, [
  "fetchPublicResearchHtml(source.url)",
  "contract: fetched.contract",
  "finalUrl: fetched.finalUrl",
  "bodySha256: fetched.bodySha256",
  "boundedResponse: true",
  "publicWebOnly: true",
]);

const opportunityRunner = read("src/opportunityAutonomy.ts");
requireTokens("manual opportunity runner", opportunityRunner, [
  'startOpportunityRun(env, "manual_confirmed"',
  'discoveredBy: "manual-confirmed-run-due"',
  'runType: "manual_confirmed"',
  "sourceFetch: sourceReceipt",
  'fetchContract: "public_research_fetch_v1"',
]);
forbidTokens("manual opportunity runner", opportunityRunner, [
  'startOpportunityRun(env, "scheduled"',
  'discoveredBy: "scheduled"',
]);

const queryResolver = read("src/core/sourceExpansionQueryResolver.ts");
requireTokens("query hint URL resolver", queryResolver, [
  'from "./publicResearchFetch"',
  "validatePublicResearchUrl(rawUrl)",
  'reason: decision.error || "invalid_research_url"',
  'urlPolicyContract: "public_research_fetch_v1"',
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
  "Public response bodies are timeout-bounded, byte-bounded and hashed for evidence receipts.",
  "global_fetch_strictly_public",
  "SHA-256 body hash",
  "docs/public-research-fetch-boundary.md",
  "npm run research:public-fetch-safety:check",
]);

requireTokens("public research boundary document", boundaryDoc, [
  "# Public research fetch boundary",
  "public_research_fetch_v1",
  "Automatic redirect following is disabled.",
  "Bodies are read as streams.",
  'compatibility_flags = ["global_fetch_strictly_public"]',
  "bodySha256",
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
  contract: "public-research-fetch-safety-v3-focused-ci",
  publicHttpOnly: true,
  privateAndReservedHostsRejected: true,
  urlCredentialsRejected: true,
  nonStandardPortsRejected: true,
  redirectsValidatedManually: true,
  redirectLoopsBlocked: true,
  responseBytesBounded: true,
  fetchTimeoutRequired: true,
  responseHashRequired: true,
  strictPublicCloudflareFetchRequired: true,
  directResearchFetchCallsOutsideBoundaryAllowed: false,
  sourceRunProvenanceRequired: true,
  manualOpportunityRunsLabelledScheduled: false,
  boundaryDocumentationRequired: true,
  focusedCiGateRequired: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
