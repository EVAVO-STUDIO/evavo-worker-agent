import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHECK_NAME = "check-growth-blackboard";
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
  "migrations/0017_growth_blackboard.sql",
  "src/core/growthBlackboard.ts",
  "src/core/growthInternalWriteRequest.ts",
  "src/routes/growthBlackboardAdmin.ts",
  "tests/growthBlackboardWriteBoundary.test.ts",
  "scripts/apply-growth-operator-route-wiring.mjs",
  "docs/growth-blackboard.md",
  "package.json",
]) {
  if (!fs.existsSync(path.join(root, relativePath))) errors.push(`Missing required file: ${relativePath}`);
}

const migration = read("migrations/0017_growth_blackboard.sql");
requireTokens("Growth blackboard migration", migration, [
  "growth_blackboard_facts",
  "growth_entities",
  "growth_entity_relationships",
  "growth_market_signals",
  "growth_asset_inventory",
]);

const core = read("src/core/growthBlackboard.ts");
requireTokens("Growth blackboard core", core, [
  "upsertGrowthBlackboardFact",
  "upsertGrowthEntity",
  "upsertGrowthEntityRelationship",
  "upsertGrowthMarketSignal",
  "upsertGrowthAsset",
  "loadGrowthBlackboard",
]);

const sharedBoundary = read("src/core/growthInternalWriteRequest.ts");
requireTokens("Shared Growth write boundary", sharedBoundary, [
  'GROWTH_INTERNAL_WRITE_REQUEST_VERSION =\n  "growth_internal_write_request_v1"',
  "readBoundedJsonObject",
  "isExplicitJsonConfirmation",
  "containsSensitiveGrowthInputKey",
  "growthInternalWriteFailurePayload",
]);

const route = read("src/routes/growthBlackboardAdmin.ts");
requireTokens("Growth blackboard route", route, [
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
  "FACT_INPUT_KEYS",
  "ENTITY_INPUT_KEYS",
  "RELATIONSHIP_INPUT_KEYS",
  "SIGNAL_INPUT_KEYS",
  "ASSET_INPUT_KEYS",
  "function wrappedInput(",
  "outerId && innerId && outerId !== innerId",
  "readGrowthInternalWriteRequest(request)",
  "growthInternalWriteFailurePayload(parsed)",
  'request.method === "POST" && [...url.searchParams.keys()].length !== 0',
  'error: "query_not_supported"',
  "growth_blackboard_invalid_request",
  "/admin/growth/blackboard",
  "/admin/growth/blackboard/facts",
  "/admin/growth/blackboard/entities",
  "/admin/growth/blackboard/relationships",
  "/admin/growth/blackboard/signals",
  "/admin/growth/blackboard/assets",
  "growth_blackboard",
  "growth_blackboard_fact_saved",
  "growth_entity_saved",
  "growth_entity_relationship_saved",
  "growth_market_signal_saved",
  "growth_asset_saved",
  "requestReceipt: requestReceipt(parsed)",
  "externalStateChange: false",
]);
forbidTokens("Growth blackboard route", route, [
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

const wiring = read("scripts/apply-growth-operator-route-wiring.mjs");
requireTokens("Growth operator route wiring", wiring, [
  "handleGrowthBlackboardAdmin",
  "/admin/growth/blackboard",
  "/admin/growth/blackboard/facts",
  "/admin/growth/blackboard/assets",
]);

const tests = read("tests/growthBlackboardWriteBoundary.test.ts");
requireTokens("Growth blackboard write tests", tests, [
  "blackboard list routes retain their documented 50-record default",
  "blackboard query and coerced confirmation fail before D1 access",
  "blackboard sensitive, unknown and conflicting fields fail closed",
  "valid blackboard writes return a reduced confirmation receipt",
  "blackboard database failures never expose raw details",
  '"growth_internal_write_request_v1"',
  '"growth_blackboard_invalid_request"',
  'assert(!("message" in result))',
]);

const documentation = read("docs/growth-blackboard.md");
requireTokens("Growth blackboard documentation", documentation, [
  "Growth Blackboard",
  "growth_internal_write_request_v1",
  "exact Boolean",
  "POST query parameters are rejected",
  "raw database",
  "50-record fallback",
  "External execution remains blocked",
]);
forbidTokens("Growth blackboard documentation", documentation, [
  "?confirm=1",
  "confirm=1",
  '{"confirm":1}',
  '{"confirm":"1"}',
]);

const packageJson = JSON.parse(read("package.json"));
const focusedScript = String(packageJson.scripts?.["growth:blackboard:check"] ?? "");
const localScript = String(packageJson.scripts?.["check:local"] ?? "");
if (!focusedScript.includes("node scripts/check-growth-blackboard.mjs")) {
  errors.push("growth:blackboard:check does not run the blackboard guard");
}
if (!localScript.includes("npm run growth:blackboard:check")) {
  errors.push("check:local does not run growth:blackboard:check");
}
if (!localScript.includes("npm run test:core")) {
  errors.push("check:local does not run the behavioral test suite");
}

if (errors.length) {
  console.error(`${CHECK_NAME} failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Growth blackboard check passed.");
console.log("- blackboard writes share the bounded exact-confirmation contract and reject query or coerced confirmation");
console.log("- route-specific key sets, recursive credential-key rejection and conflicting identifier checks run before D1 access");
console.log("- absent list limits retain the documented 50-record fallback");
console.log("- database and migration failures are reduced without raw error messages");
console.log("- blackboard knowledge remains internal metadata only with AI and external execution disabled");
