import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHECK_NAME = "check-growth-strategy-memory";
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

for (const relativePath of [
  "migrations/0016_growth_strategy_memory.sql",
  "src/core/growthStrategyMemory.ts",
  "src/core/growthInternalWriteRequest.ts",
  "src/routes/growthStrategyMemoryAdmin.ts",
  "src/core/growthAutonomousRuntime.ts",
  "src/core/growthOperatorCycle.ts",
  "src/routes/growthCampaignIntelligenceAdmin.ts",
  "tests/growthStrategyMemoryWriteBoundary.test.ts",
  "docs/growth-strategy-memory.md",
  "package.json",
]) {
  if (!fs.existsSync(path.join(root, relativePath))) errors.push(`Missing required file: ${relativePath}`);
}

const migration = read("migrations/0016_growth_strategy_memory.sql");
requireTokens("Growth strategy memory migration", migration, [
  "growth_objectives",
  "growth_key_results",
  "growth_target_segments",
  "growth_offer_profiles",
  "growth_positioning_profiles",
  "growth_runtime_constraints",
]);

const core = read("src/core/growthStrategyMemory.ts");
requireTokens("Growth strategy memory core", core, [
  "upsertGrowthObjective",
  "upsertGrowthKeyResult",
  "upsertGrowthTargetSegment",
  "upsertGrowthOfferProfile",
  "upsertGrowthPositioningProfile",
  "upsertGrowthRuntimeConstraint",
  "loadGrowthStrategyMemory",
]);

const sharedBoundary = read("src/core/growthInternalWriteRequest.ts");
requireTokens("Shared Growth write boundary", sharedBoundary, [
  'GROWTH_INTERNAL_WRITE_REQUEST_VERSION =\n  "growth_internal_write_request_v1"',
  "readBoundedJsonObject",
  "isExplicitJsonConfirmation",
  "containsSensitiveGrowthInputKey",
  "growthInternalWriteFailurePayload",
]);

const route = read("src/routes/growthStrategyMemoryAdmin.ts");
requireTokens("Growth strategy memory route", route, [
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
  "OBJECTIVE_INPUT_KEYS",
  "KEY_RESULT_INPUT_KEYS",
  "SEGMENT_INPUT_KEYS",
  "OFFER_INPUT_KEYS",
  "POSITIONING_INPUT_KEYS",
  "CONSTRAINT_INPUT_KEYS",
  "function wrappedInput(",
  "outerId && innerId && outerId !== innerId",
  "readGrowthInternalWriteRequest(request)",
  "growthInternalWriteFailurePayload(parsed)",
  'request.method === "POST" && [...url.searchParams.keys()].length !== 0',
  'error: "query_not_supported"',
  "growth_strategy_memory_invalid_request",
  "rawErrorExposed: false",
  "/admin/growth/strategy-memory",
  "/admin/growth/objectives",
  "/admin/growth/key-results",
  "/admin/growth/segments",
  "/admin/growth/offers",
  "/admin/growth/positioning",
  "/admin/growth/runtime-constraints",
  "growth_strategy_memory",
  "growth_objective_saved",
  "growth_key_result_saved",
  "growth_target_segment_saved",
  "growth_offer_profile_saved",
  "growth_positioning_profile_saved",
  "growth_runtime_constraint_saved",
  "requestReceipt: requestReceipt(parsed)",
  "externalStateChange: false",
]);
forbidTokens("Growth strategy memory route", route, [
  "request.json()",
  'url.searchParams.get("confirm")',
  "body?.confirm",
  'body.confirm === "1"',
  "body.confirm === 1",
  "queryConfirmationAllowed: true",
  "confirmationCoercionAllowed: true",
  "sensitiveInputKeysAllowed: true",
  "rawErrorExposed: true",
  "return json(normalized, { status: 500 })",
]);

const autonomousRuntime = read("src/core/growthAutonomousRuntime.ts");
requireTokens("Growth autonomous runtime compatibility", autonomousRuntime, [
  "strategicIntent",
  "knowledgeSubstrate",
  "missing_objectives",
  "missing_target_segments",
  "missing_offer_profiles",
  "missing_positioning_profiles",
  "missing_runtime_constraints",
  "missing_knowledge_substrate",
  "growth_autonomous_runtime_v3_strategy_blackboard",
]);

const operatorCycle = read("src/core/growthOperatorCycle.ts");
requireTokens("Growth operator cycle strategy memory", operatorCycle, [
  "strategyMemory",
  "strategySetup",
  "blackboardSetup",
  "growth_operator_cycle_v3_strategy_blackboard_read_only",
  "missing_objectives",
  "missing_blackboard_facts",
  "targetSegments",
  "runtimeConstraints",
]);

const campaignRoute = read("src/routes/growthCampaignIntelligenceAdmin.ts");
requireTokens("Growth campaign integration", campaignRoute, [
  "loadGrowthStrategyMemory",
  "loadGrowthBlackboard",
  "loadGrowthCycleState",
  "buildGrowthOperatorCycle(await loadGrowthCycleState(env, url))",
  "buildGrowthAutonomousRuntime({ operatorCycle: cycle, strategyMemory: cycleState.strategyMemory })",
]);

const tests = read("tests/growthStrategyMemoryWriteBoundary.test.ts");
requireTokens("Growth strategy write boundary tests", tests, [
  "strategy list routes retain their documented default limits",
  "query and coerced confirmation are rejected before D1 access",
  "sensitive, unknown and conflicting strategy fields fail closed",
  "valid strategy writes return a reduced confirmation receipt",
  "strategy database failures never expose raw details",
  '"growth_internal_write_request_v1"',
  '"growth_strategy_memory_invalid_request"',
  'assert(!("message" in result))',
]);

const documentation = read("docs/growth-strategy-memory.md");
requireTokens("Growth strategy memory documentation", documentation, [
  "Growth Strategy Memory",
  "growth_internal_write_request_v1",
  "exact Boolean",
  "POST query parameters are rejected",
  "raw database",
  "documented route fallback",
  "External execution remains blocked",
]);
forbidTokens("Growth strategy memory documentation", documentation, [
  "?confirm=1",
  "confirm=1",
  '{"confirm":1}',
  '{"confirm":"1"}',
]);

const packageJson = JSON.parse(read("package.json"));
const focusedScript = String(packageJson.scripts?.["growth:strategy:check"] ?? "");
const localScript = String(packageJson.scripts?.["check:local"] ?? "");
if (!focusedScript.includes("node scripts/check-growth-strategy-memory.mjs")) {
  errors.push("growth:strategy:check does not run the strategy-memory guard");
}
if (!localScript.includes("npm run growth:strategy:check")) {
  errors.push("check:local does not run growth:strategy:check");
}
if (!localScript.includes("npm run test:core")) {
  errors.push("check:local does not run the behavioral test suite");
}

if (errors.length) {
  console.error(`${CHECK_NAME} failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Growth strategy memory check passed.");
console.log("- strategy writes share the bounded exact-confirmation contract and reject query or coerced confirmation");
console.log("- route-specific key sets, recursive credential-key rejection and conflicting identifier checks run before D1 access");
console.log("- absent list limits retain their documented 25- or 50-record defaults");
console.log("- database and migration failures are reduced without raw error messages");
console.log("- strategy memory remains internal metadata only with AI and external execution disabled");
