import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHECK_NAME = "check-growth-autonomous-discovery";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const errors = [];

function requireFile(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) errors.push(`Missing required file: ${relativePath}`);
}

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

const files = [
  "migrations/0020_growth_autonomous_discovery.sql",
  "src/core/growthAutonomousDiscovery.ts",
  "src/core/growthAutonomousDiscoveryRecords.ts",
  "src/core/growthInternalWriteRequest.ts",
  "src/routes/growthAutonomousDiscoveryAdmin.ts",
  "src/routes/growthAutonomousDiscoveryRouteCatalogue.ts",
  "src/routes/routeCatalogueTypes.ts",
  "tests/growthAutonomousDiscoveryWriteBoundary.test.ts",
  "scripts/print-growth-route-contract-check.mjs",
  "scripts/check-migrations-present.mjs",
  "docs/growth-autonomous-discovery-architecture.md",
  "docs/growth-source-discovery-safety-policy.md",
  "docs/growth-zero-source-research-runbook.md",
  "migrations/README.md",
  "package.json",
];
files.forEach(requireFile);

const migration = read("migrations/0020_growth_autonomous_discovery.sql");
requireTokens("Growth autonomous discovery migration", migration, [
  "CREATE TABLE IF NOT EXISTS growth_research_runs",
  "CREATE TABLE IF NOT EXISTS growth_source_candidates",
  "CREATE TABLE IF NOT EXISTS growth_robots_cache",
  "CREATE TABLE IF NOT EXISTS growth_fetch_queue",
  "CREATE TABLE IF NOT EXISTS growth_discovered_pages",
  "CREATE TABLE IF NOT EXISTS growth_extracted_signals",
  "CREATE TABLE IF NOT EXISTS growth_opportunity_scores",
  "CREATE TABLE IF NOT EXISTS growth_agent_decisions",
  "CREATE TABLE IF NOT EXISTS growth_discovery_feedback",
  "blocked_actions_json",
  "safety_json",
  "crawl_allowed INTEGER NOT NULL DEFAULT 0",
  "confidence_score",
  "risk_flags_json",
]);

const model = read("src/core/growthAutonomousDiscovery.ts");
requireTokens("Growth autonomous discovery model", model, [
  "GrowthDiscoverySafety",
  "GrowthResearchRunInput",
  "GrowthSourceCandidateInput",
  "GrowthAgentDecisionInput",
  "GROWTH_DISCOVERY_BLOCKED_ACTIONS",
  "GROWTH_DISCOVERY_ALLOWED_DECISIONS",
  "growthDiscoverySafety",
  "assertGrowthDiscoverySafety",
  "buildGrowthResearchRun",
  "buildGrowthSourceCandidate",
  "buildGrowthAgentDecision",
  "send_email",
  "post_social",
  "submit_form",
  "mutate_external_system",
  "execute_page_instruction",
  "externalStateChange: false",
  "callsAI: false",
  "callsNetwork: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
  "canExecuteBrowserActions: false",
  "canSubmitThirdPartyForms: false",
]);

const records = read("src/core/growthAutonomousDiscoveryRecords.ts");
requireTokens("Growth autonomous discovery records", records, [
  "listGrowthResearchRuns",
  "saveGrowthResearchRun",
  "listGrowthSourceCandidates",
  "saveGrowthSourceCandidate",
  "enqueueGrowthFetchWork",
  "listGrowthExtractedSignals",
  "listGrowthOpportunityScores",
  "listGrowthAgentDecisions",
  "saveGrowthAgentDecision",
  "listGrowthDiscoveryFeedback",
  "saveGrowthDiscoveryFeedback",
  "growthDiscoverySafety",
  "GROWTH_DISCOVERY_BLOCKED_ACTIONS",
  "growth_research_runs",
  "growth_source_candidates",
  "growth_fetch_queue",
  "growth_agent_decisions",
  "growth_discovery_feedback",
]);

const sharedWrite = read("src/core/growthInternalWriteRequest.ts");
requireTokens("Shared Growth write boundary", sharedWrite, [
  'GROWTH_INTERNAL_WRITE_REQUEST_VERSION =\n  "growth_internal_write_request_v1"',
  "readBoundedJsonObject",
  "isExplicitJsonConfirmation",
  "containsSensitiveGrowthInputKey",
  "growthInternalWriteFailurePayload",
]);

const admin = read("src/routes/growthAutonomousDiscoveryAdmin.ts");
requireTokens("Growth autonomous discovery admin", admin, [
  'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
  'from "../core/growthInternalWriteRequest"',
  "handleGrowthAutonomousDiscoveryAdmin",
  "await isAdminRequestAuthorized(request, env)",
  'request.method === "OPTIONS"',
  'allow: "GET, POST"',
  "READ_SAFETY = Object.freeze({",
  "WRITE_SAFETY = Object.freeze({",
  "boundedJsonRequired: true",
  "exactBooleanConfirmationRequired: true",
  "confirmationCoercionAllowed: false",
  "queryConfirmationAllowed: false",
  "sensitiveInputKeysAllowed: false",
  "savesReviewItemsOnly: true",
  "rawErrorExposed: false",
  'const raw = url.searchParams.get(key)',
  'raw === null || raw === ""',
  "Number.isSafeInteger(value)",
  "RESEARCH_RUN_KEYS",
  "SOURCE_CANDIDATE_KEYS",
  "FETCH_QUEUE_KEYS",
  "AGENT_DECISION_KEYS",
  "FEEDBACK_KEYS",
  "function aliasedValue(",
  "function wrappedRecord(",
  "wrappers.length > 1",
  "function optionalPublicUrl(",
  "GROWTH_DISCOVERY_ALLOWED_DECISIONS",
  "readGrowthInternalWriteRequest(request)",
  "growthInternalWriteFailurePayload(parsed)",
  'request.method === "POST" && [...url.searchParams.keys()].length !== 0',
  'error: "query_not_supported"',
  "growth_autonomous_discovery_invalid_request",
  "growth_autonomous_discovery_failed",
  "/admin/growth/discovery/research-runs",
  "/admin/growth/discovery/source-candidates",
  "/admin/growth/discovery/signals",
  "/admin/growth/discovery/opportunity-scores",
  "/admin/growth/discovery/agent-decisions",
  "/admin/growth/discovery/feedback",
  "/admin/growth/discovery/fetch-queue",
  "growth_research_run_planned",
  "growth_source_candidate_saved",
  "growth_fetch_queue_enqueued_metadata_only",
  "growth_agent_decision_recorded",
  "growth_discovery_feedback_saved",
  "requestReceipt: requestReceipt(parsed.contractVersion)",
  "externalStateChange: false",
  "callsAI: false",
  "callsNetwork: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
]);
requireOrder("Growth discovery authentication order", admin, [
  "await isAdminRequestAuthorized(request, env)",
  'request.method === "OPTIONS"',
]);
for (const call of [
  "saveGrowthResearchRun(env,",
  "saveGrowthSourceCandidate(env,",
  "enqueueGrowthFetchWork(env,",
  "saveGrowthAgentDecision(env,",
  "saveGrowthDiscoveryFeedback(env,",
]) {
  const callPosition = admin.indexOf(call);
  const parsePosition = admin.lastIndexOf("const parsed = await confirmedBody(request, json)", callPosition);
  const acceptedPosition = admin.lastIndexOf("if (!parsed.ok) return parsed.response", callPosition);
  if (
    callPosition < 0 ||
    parsePosition < 0 ||
    acceptedPosition < 0 ||
    !(parsePosition < acceptedPosition && acceptedPosition < callPosition)
  ) errors.push(`Growth discovery must complete shared confirmation before persistence call: ${call}`);
}
forbidTokens("Growth autonomous discovery admin", admin, [
  "getAdminToken",
  "function authorized(",
  "authorization ===",
  "request.json()",
  'url.searchParams.get("confirm")',
  "body?.confirm",
  'body.confirm === "1"',
  "body.confirm === 1",
  'request.method === "OPTIONS") return json({ ok: true',
  "queryConfirmationAllowed: true",
  "confirmationCoercionAllowed: true",
  "sensitiveInputKeysAllowed: true",
  "rawErrorExposed: true",
  "message,",
]);

const tests = read("tests/growthAutonomousDiscoveryWriteBoundary.test.ts");
requireTokens("Growth discovery write tests", tests, [
  "discovery authentication precedes OPTIONS and database access",
  "discovery list routes retain their documented limits",
  "discovery query and coerced confirmation fail before D1 access",
  "discovery rejects credential keys, alias conflicts and invented candidate defaults",
  "valid fetch queue metadata requires exact fields and returns a reduced receipt",
  "discovery database failures are reduced without raw details",
  '"growth_internal_write_request_v1"',
  '"growth_autonomous_discovery_invalid_request"',
  'assert(!("message" in result))',
]);

const catalogue = read("src/routes/growthAutonomousDiscoveryRouteCatalogue.ts");
for (const token of [
  "growthAutonomousDiscoveryRouteCatalogue",
  "growthAutonomousDiscoveryReadRouteIds",
  "growthAutonomousDiscoveryConfirmRouteIds",
  "growth_research_runs",
  "growth_source_candidates",
  "growth_extracted_signals",
  "growth_opportunity_scores",
  "growth_agent_decisions",
  "growth_discovery_feedback",
  "growth_research_run_plan",
  "growth_source_candidate_save",
  "growth_fetch_queue_enqueue",
  "growth_agent_decision_record",
  "growth_discovery_feedback_save",
  'method: "GET"',
  'method: "POST"',
  'safety: "read_only"',
  'safety: "confirm_required"',
  "requiresConfirm: true",
  "callsNetwork: false",
  "callsAI: false",
  "canSendEmail: false",
  "must not be browser-proxied",
]) requireTokens("Growth discovery route catalogue", catalogue, [token]);

const routeTypes = read("src/routes/routeCatalogueTypes.ts");
requireTokens("Growth route catalogue types", routeTypes, [
  "canPostSocial: boolean",
  "canSubmitForms: boolean",
  'Partial<Pick<RouteCatalogueItem, "canPostSocial" | "canSubmitForms">>',
  "canPostSocial: false",
  "canSubmitForms: false",
]);

for (const [relativePath, tokens] of Object.entries({
  "docs/growth-autonomous-discovery-architecture.md": [
    "Growth autonomous discovery architecture",
    "Autonomous research, supervised action.",
    "source candidate registry",
    "fetch queue",
    "approval pack builder",
    "read-only Next dashboard",
    "send email",
    "post on social platforms",
    "submit web forms",
    "execute instructions found inside web pages",
  ],
  "docs/growth-source-discovery-safety-policy.md": [
    "Growth source discovery safety policy",
    "unknown robots policy = do not crawl yet",
    "callsNetwork: false",
    "callsAI: false",
    "canSendEmail: false",
    "canPostSocial: false",
    "canSubmitForms: false",
    "must not be browser-proxied",
  ],
  "docs/growth-zero-source-research-runbook.md": [
    "Growth zero-source research runbook",
    "without the operator supplying a source list",
    "Plan research",
    "Register source candidates",
    "Queue fetch work",
    "Record agent decision",
    "Prepare approval pack",
    "no crawler execution yet",
  ],
  "migrations/README.md": [
    "0020_growth_autonomous_discovery.sql",
    "zero-source autonomous discovery data model",
    "does not enable crawling, sending, posting, form submission, AI calls, or external execution",
  ],
})) requireTokens(relativePath, read(relativePath), tokens);

const migrationGuard = read("scripts/check-migrations-present.mjs");
requireTokens("Growth migration inventory", migrationGuard, ["0020_growth_autonomous_discovery.sql"]);

const packageJson = JSON.parse(read("package.json"));
const focusedScript = String(packageJson.scripts?.["growth:autonomous-discovery:check"] ?? "");
const localScript = String(packageJson.scripts?.["check:local"] ?? "");
if (!focusedScript.includes("node scripts/check-growth-autonomous-discovery.mjs")) {
  errors.push("growth:autonomous-discovery:check does not run this guard");
}
if (!localScript.includes("npm run growth:autonomous-discovery:check")) {
  errors.push("check:local does not run growth:autonomous-discovery:check");
}
if (!localScript.includes("npm run test:core")) {
  errors.push("check:local does not run core behavioral tests");
}

if (errors.length) {
  console.error(`${CHECK_NAME} failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Growth autonomous discovery check passed.");
console.log("- discovery metadata writes require shared bounded exact confirmation after shared authentication");
console.log("- query confirmation, coercion, credential fields, ambiguous aliases, missing URLs and unsafe URLs fail closed");
console.log("- documented read limits remain 25 or 50 rather than collapsing to one record");
console.log("- database failures are reduced without raw error details");
console.log("- fetch queue records remain internal metadata and do not crawl, call AI, send, post, submit forms or mutate external systems");
