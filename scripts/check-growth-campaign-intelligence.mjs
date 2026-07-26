import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHECK_NAME = "check-growth-campaign-intelligence";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const errors = [];

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

const requiredFiles = [
  "migrations/0014_growth_campaign_intelligence.sql",
  "migrations/0015_growth_operator_cycle_events.sql",
  "migrations/0018_growth_cycle_memory_snapshots.sql",
  "src/core/growthCampaignAnalysis.ts",
  "src/core/growthOperatorLoop.ts",
  "src/core/growthOperatorCycle.ts",
  "src/core/growthOperatorCycleEvents.ts",
  "src/core/growthCampaignIntelligence.ts",
  "src/core/growthCampaignDecisions.ts",
  "src/core/growthCampaignRecords.ts",
  "src/core/growthInternalWriteRequest.ts",
  "src/routes/growthCampaignIntelligenceAdmin.ts",
  "tests/growthCampaignIntelligenceWriteBoundary.test.ts",
  "tests/growthCampaignIntelligenceErrorClassification.test.ts",
  "scripts/print-growth-campaign-intelligence-smoke-commands.mjs",
  "docs/growth-campaign-intelligence.md",
  "package.json",
];
for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) errors.push(`Missing required file: ${relativePath}`);
}

const migration = read("migrations/0014_growth_campaign_intelligence.sql");
requireTokens("Growth campaign migration", migration, [
  "growth_campaigns",
  "growth_experiments",
  "growth_campaign_metrics",
  "growth_decisions",
  "growth_candidate_actions",
  "growth_evidence_items",
  "growth_learning_notes",
]);

const cycleMigration = `${read("migrations/0015_growth_operator_cycle_events.sql")}\n${read("migrations/0018_growth_cycle_memory_snapshots.sql")}`;
requireTokens("Growth cycle migrations", cycleMigration, [
  "growth_operator_cycle_events",
  "selected_step",
  "target_campaign_id",
  "readiness_json",
  "loop_plan_json",
  "safety_json",
  "strategy_json",
  "blackboard_json",
]);

const core = [
  read("src/core/growthCampaignAnalysis.ts"),
  read("src/core/growthOperatorLoop.ts"),
  read("src/core/growthOperatorCycle.ts"),
  read("src/core/growthOperatorCycleEvents.ts"),
  read("src/core/growthCampaignIntelligence.ts"),
  read("src/core/growthCampaignDecisions.ts"),
  read("src/core/growthCampaignRecords.ts"),
].join("\n");
requireTokens("Growth campaign intelligence core", core, [
  "analyzeGrowthCampaign",
  "summarizeGrowthOperatorReadiness",
  "planGrowthOperatorLoop",
  "buildGrowthOperatorCycle",
  "saveGrowthOperatorCycleEvent",
  "upsertGrowthCampaign",
  "upsertGrowthExperiment",
  "planGrowthCampaignDecision",
  "saveGrowthDecision",
  "upsertGrowthCampaignMetric",
  "createGrowthEvidenceItem",
  "createGrowthLearningNote",
]);

const writeBoundary = read("src/core/growthInternalWriteRequest.ts");
requireTokens("Shared Growth write boundary", writeBoundary, [
  'GROWTH_INTERNAL_WRITE_REQUEST_VERSION =\n  "growth_internal_write_request_v1"',
  "readBoundedJsonObject",
  "isExplicitJsonConfirmation",
  "containsSensitiveGrowthInputKey",
  "growthInternalWriteFailurePayload",
  "confirmationCoercionAllowed: false",
  "sensitiveInputKeysAllowed: false",
]);

const route = read("src/routes/growthCampaignIntelligenceAdmin.ts");
requireTokens("Growth campaign intelligence route", route, [
  'from "../core/growthInternalWriteRequest"',
  "READ_SAFETY = Object.freeze({",
  "WRITE_SAFETY = Object.freeze({",
  "boundedJsonRequired: true",
  "exactBooleanConfirmationRequired: true",
  "confirmationCoercionAllowed: false",
  "queryConfirmationAllowed: false",
  "sensitiveInputKeysAllowed: false",
  "rawErrorExposed: false",
  "const raw = url.searchParams.get(key)",
  'raw === null || raw === ""',
  "Number.isSafeInteger(value)",
  "CAMPAIGN_INPUT_KEYS",
  "EXPERIMENT_INPUT_KEYS",
  "METRIC_INPUT_KEYS",
  "EVIDENCE_INPUT_KEYS",
  "LEARNING_INPUT_KEYS",
  "DECISION_PLAN_KEYS",
  "function exactKeys(",
  "function wrappedInput(",
  "outerId && innerId && outerId !== innerId",
  "GROWTH_CAMPAIGN_DECISION_CAMPAIGN_ID_CONFLICT",
  "readGrowthInternalWriteRequest(request)",
  "growthInternalWriteFailurePayload(parsed)",
  'request.method === "POST" && [...url.searchParams.keys()].length !== 0',
  'error: "query_not_supported"',
  "requestReceipt: requestReceipt(parsed)",
  "bodySha256Available: true",
  "/^GROWTH_(CAMPAIGN|EXPERIMENT|METRIC|EVIDENCE|LEARNING)_/",
  "growth_campaign_intelligence_invalid_request",
  "growth_campaign_intelligence_failed",
  "/admin/growth/cycle/record",
  "growth_operator_cycle_recorded",
  "growth_operator_intelligence",
  "growth_campaign_saved",
  "growth_experiment_saved",
  "growth_campaign_metric_saved",
  "growth_evidence_saved",
  "growth_learning_note_saved",
  "growth_decision_planned",
  "externalStateChange: false",
]);
forbidTokens("Growth campaign intelligence route", route, [
  "request.json()",
  'url.searchParams.get("confirm")',
  "body?.confirm",
  'body.confirm === "1"',
  "body.confirm === 1",
  'message.startsWith("GROWTH_CAMPAIGN_")',
  "queryConfirmationAllowed: true",
  "confirmationCoercionAllowed: true",
  "sensitiveInputKeysAllowed: true",
  "rawErrorExposed: true",
  "return json(normalized, { status: 500 })",
]);

const boundaryTests = read("tests/growthCampaignIntelligenceWriteBoundary.test.ts");
requireTokens("Growth campaign write boundary tests", boundaryTests, [
  "campaign list uses the documented fallback limit when the query is absent",
  "query-string confirmation is rejected before body parsing or D1 access",
  "coerced confirmation and sensitive input keys fail before D1 access",
  "mixed wrapper fields and conflicting identifiers fail closed",
  "valid campaign writes use exact confirmed JSON and return a reduced receipt",
  "database failures are reduced without exposing raw error text",
  'assert.deepEqual(calls[0]?.values, [25])',
  '"forbidden_growth_input_key"',
  '"growth_campaign_intelligence_invalid_request"',
  '"growth_internal_write_request_v1"',
  'assert(!("message" in payload))',
]);

const classificationTests = read("tests/growthCampaignIntelligenceErrorClassification.test.ts");
requireTokens("Growth campaign error classification tests", classificationTests, [
  "experiment route validation is classified as a finite client input failure",
  "metric route validation is classified as a finite client input failure",
  "evidence route validation is classified as a finite client input failure",
  "learning route validation is classified as a finite client input failure",
  'assert.equal(response.status, 400)',
  '"growth_campaign_intelligence_invalid_request"',
  'assert(!("message" in payload))',
  "D1 must not be reached for rejected route input",
]);

const smoke = read("scripts/print-growth-campaign-intelligence-smoke-commands.mjs");
requireTokens("Growth campaign smoke commands", smoke, [
  "0014 through 0018",
  "growth_operator_cycle_v3_strategy_blackboard_read_only",
  "strategy_json",
  "blackboard_json",
]);

const documentation = read("docs/growth-campaign-intelligence.md");
requireTokens("Growth campaign intelligence documentation", documentation, [
  "Growth Campaign Intelligence Brain",
  "metadata only",
  "/admin/growth/operator",
  "growth_operator_cycle_v3_strategy_blackboard_read_only",
  "growth_autonomous_runtime_v3_strategy_blackboard",
  "growth_internal_write_request_v1",
  "POST query parameters are rejected.",
  "Conflicting outer and inner identifiers fail closed.",
  "without raw database messages",
  "Absent list-limit query parameters use the documented route fallback",
]);

const packageJson = JSON.parse(read("package.json"));
const focusedScript = String(packageJson.scripts?.["growth:campaigns:check"] ?? "");
const localScript = String(packageJson.scripts?.["check:local"] ?? "");
if (!focusedScript.includes("node scripts/check-growth-campaign-intelligence.mjs")) {
  errors.push("growth:campaigns:check does not run the campaign intelligence guard");
}
if (!localScript.includes("npm run growth:campaigns:check")) {
  errors.push("check:local does not run growth:campaigns:check");
}
if (!localScript.includes("npm run test:core")) {
  errors.push("check:local does not run the core behavioral test suite");
}

if (errors.length) {
  console.error(`${CHECK_NAME} failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Growth campaign intelligence check passed.");
console.log("- campaign, experiment, metric, evidence, learning, cycle and decision writes use one bounded exact-confirmation contract");
console.log("- query confirmation, Boolean coercion, sensitive input keys, mixed wrappers and conflicting identifiers fail closed");
console.log("- uppercase route-validation families are classified as finite 400 input failures rather than false service outages");
console.log("- missing list limits use their documented fallbacks instead of collapsing to one record");
console.log("- database and migration failures are reduced without returning raw error messages");
console.log("- all campaign intelligence operations remain internal metadata only with AI and external execution disabled");
