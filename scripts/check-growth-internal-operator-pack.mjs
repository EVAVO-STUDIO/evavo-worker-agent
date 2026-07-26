import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHECK_NAME = "check-growth-internal-operator-pack";
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

const composer = read("src/core/growthInternalOperatorPack.ts");
const route = read("src/routes/growthInternalOperatorPackAdmin.ts");
const policy = read("src/routes/growthRoutePolicy.ts");
const inventory = read("src/core/growthBusinessRouteInventory.ts");
const index = read("src/index.ts");
const capabilities = read("src/core/growthCapabilities.ts");
const unitTest = read("tests/growthInternalOperatorPack.test.ts");
const routeTest = read("tests/growthInternalOperatorPackRouteSource.test.ts");
const documentation = read("docs/growth-internal-operator-pack.md");
const packageJson = JSON.parse(read("package.json"));
const checkScript = String(packageJson.scripts?.["growth:internal-operator-pack:check"] ?? "");
const localScript = String(packageJson.scripts?.["check:local"] ?? "");

requireTokens("Growth internal operator pack composer", composer, [
  'GROWTH_INTERNAL_OPERATOR_PACK_VERSION =\n  "growth_internal_operator_pack_v1"',
  "MAX_SIGNALS = 20",
  "MAX_ACTIONS = 20",
  "MAX_FOCUS = 8",
  "MAX_MARKDOWN_BYTES = 64_000",
  "GrowthInternalOperatorPackDto",
  "composeGrowthInternalOperatorPack",
  'source: "worker_d1_review_models"',
  "deterministic: true",
  "aiGenerated: false",
  "callsNetwork: false",
  "externalExecutionEnabled: false",
  "canonicalPromotionEnabled: false",
  "deliveryAllowed: false",
  "GROWTH_INTERNAL_OPERATOR_PACK_INPUT_INVALID",
  "GROWTH_INTERNAL_OPERATOR_PACK_SOURCE_URL_INVALID",
  "GROWTH_INTERNAL_OPERATOR_PACK_TIME_INVALID",
  "GROWTH_INTERNAL_OPERATOR_PACK_TOO_LARGE",
  "No AI, outbound network call, email, calendar event, social post, form submission, provider write or canonical promotion",
]);
forbidTokens("Growth internal operator pack composer", composer, [
  "fetch(",
  "env.AI",
  "process.env",
  "sendEmail(",
  "deliveryAllowed: true",
  "externalExecutionEnabled: true",
  "canonicalPromotionEnabled: true",
  "callsNetwork: true",
]);

requireTokens("Growth internal operator pack route", route, [
  'GROWTH_INTERNAL_OPERATOR_PACK_ROUTE =\n  "/admin/growth/operator/artifacts"',
  'GROWTH_INTERNAL_OPERATOR_PACK_ROUTE_VERSION =\n  "growth_internal_operator_pack_route_v1"',
  "handleGrowthInternalOperatorPackAdmin",
  "await isAdminRequestAuthorized(request, env)",
  'request.method !== "POST"',
  'headers: { allow: "POST" }',
  "[...url.searchParams.keys()].length !== 0",
  "readBoundedJsonObject<ConfirmationBody>(request, {",
  "maxBytes: CONFIRMATION_MAX_BYTES",
  "isExplicitJsonConfirmation(value)",
  "Object.keys(value).length === 1",
  "if (!exactConfirmation(parsed.value))",
  "requiredPayload: { confirm: true }",
  "confirmationCoercionAllowed: false",
  "claimGrowthActivityBudget(env, {",
  "requestBodySha256: parsed.bodySha256",
  'action: "owner_brief_generate"',
  'invocation: "manual"',
  "ownerApproved: true",
  "explicitlyConfirmed: true",
  "listGrowthSignals(env, SIGNAL_LIMIT)",
  "listGrowthActions(env, ACTION_LIMIT)",
  "composeGrowthInternalOperatorPack({",
  "externalExecutionRequested: false",
  "canonicalPromotionRequested: false",
  "completeGrowthActivityBudgetClaim",
  '"completed",\n      "operator_pack_generated"',
  '"failed",\n        "operator_pack_failed"',
  "exactConfirmationRequired: true",
  "requestBodyBounded: true",
  "persistentBudgetAdmissionRequired: true",
  "internalBudgetAccountingWritesOnly: true",
  "readsSavedReviewModelsOnly: true",
  "automaticRetryAllowed: false",
  "growth_activity_budget_denied",
  "growth_activity_budget_completion_failed",
]);
requireOrder("Growth internal operator pack route admission order", route, [
  "await isAdminRequestAuthorized(request, env)",
  'request.method !== "POST"',
  "readBoundedJsonObject<ConfirmationBody>(request, {",
  "if (!exactConfirmation(parsed.value))",
  "claimGrowthActivityBudget(env, {",
  "listGrowthSignals(env, SIGNAL_LIMIT)",
  "listGrowthActions(env, ACTION_LIMIT)",
  "composeGrowthInternalOperatorPack({",
  "completeClaimSafely(",
  'mode: "growth_internal_operator_pack"',
]);
forbidTokens("Growth internal operator pack route", route, [
  "fetch(",
  "env.AI",
  "sendEmail(",
  "callsNetwork: true",
  "callsAI: true",
  "sendsEmail: true",
  "createsCalendarEvent: true",
  "postsExternally: true",
  "submitsForms: true",
  "writesProvider: true",
  "promotesCanonicalRecord: true",
  "automaticRetryAllowed: true",
  "request.json()",
  'request.method !== "GET"',
]);

requireTokens("Growth route policy", policy, [
  '| "operator-artifacts"',
  "readMethods: readonly \"GET\"[]",
  "writeMethods: readonly \"POST\"[]",
  'exact("operator-artifacts", 15',
  '"/admin/growth/operator/artifacts"',
  '], NO_READS, POST_ONLY, "mixed-internal", "handler-enforced")',
  "callsExternalNetwork: false",
  "callsAI: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
]);
requireTokens("Growth route inventory", inventory, [
  "readMethods: Object.freeze([...policy.readMethods])",
  "writeMethods: Object.freeze([...policy.writeMethods])",
  'postClassification: writes ? "internal-mutation" : "not-supported"',
]);
requireTokens("Worker dispatcher", index, [
  'import { handleGrowthInternalOperatorPackAdmin } from "./routes/growthInternalOperatorPackAdmin"',
  'case "operator-artifacts":',
  "handleGrowthInternalOperatorPackAdmin(req, env, pathname, jsonResponse)",
]);
forbidTokens("Worker dispatcher", index, [
  'pathname === "/admin/growth/operator/artifacts"',
]);

requireTokens("Growth capability registry", capabilities, [
  'import { GROWTH_INTERNAL_OPERATOR_PACK_VERSION } from "./growthInternalOperatorPack"',
  'id: "generate_internal_operator_pack"',
  "deterministicInternalOperatorPackEnabled: true",
  "deterministicInternalOperatorPackVersion: GROWTH_INTERNAL_OPERATOR_PACK_VERSION",
  "internalOperatorPackCallsAI: false",
  "internalOperatorPackCallsNetwork: false",
  "internalOperatorPackContractVersion: GROWTH_INTERNAL_OPERATOR_PACK_VERSION",
  'internalOperatorPackBudgetAction: "owner_brief_generate"',
  "internalOperatorPackAdmissionIntegrated: true",
  "draftingEnabled: false",
  "externalDeliveryEnabled: false",
]);
forbidTokens("Growth capability registry", capabilities, [
  "internalOperatorPackCallsAI: true",
  "internalOperatorPackCallsNetwork: true",
  "externalDeliveryEnabled: true",
]);

requireTokens("Growth internal operator pack tests", `${unitTest}\n${routeTest}`, [
  "saved Worker review models produce a deterministic frozen operator pack",
  "missing evidence and risk metadata are surfaced rather than invented",
  "external execution and canonical promotion requests fail closed",
  "unsafe source URLs, malformed scores and noncanonical timestamps fail closed",
  "record and focus limits remain bounded",
  "operator artifact route confirms bounded POST before persistent budget and review-model reads",
  "route policy, inventory and dispatcher give the POST-only artifact route one exact owner",
  "capability registry distinguishes deterministic artifacts from AI and delivery",
]);

requireTokens("Growth internal operator pack documentation", documentation, [
  "growth_internal_operator_pack_v1",
  "POST /admin/growth/operator/artifacts",
  '{"confirm":true}',
  "deterministic internal operator pack",
  "owner_brief_generate",
  "Paused",
  "Light",
  "Balanced",
  "High",
  "writes only persistent Growth budget-accounting state",
  "Why this comes before autonomous outreach",
  "node scripts/check-growth-internal-operator-pack.mjs",
  "npm run growth:internal-operator-pack:check",
]);

requireTokens("Growth internal operator pack package script", checkScript, [
  "node scripts/check-growth-internal-operator-pack.mjs",
  "node --test tests/growthInternalOperatorPack.test.ts tests/growthInternalOperatorPackRouteSource.test.ts",
]);
if (!localScript.includes("npm run growth:internal-operator-pack:check")) {
  errors.push("Worker check:local does not run growth:internal-operator-pack:check");
}

if (errors.length) {
  console.error(`${CHECK_NAME} failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Growth internal operator pack check passed.");
console.log("- saved Worker review models produce deterministic bounded focus, signal, meeting, follow-up and Markdown artifacts");
console.log("- exact bounded confirmation and persistent Growth activity-budget admission occur before D1 review-model reads");
console.log("- completion accounting occurs before success and failures never trigger automatic retry");
console.log("- the typed route policy, inventory and dispatcher expose one exact confirmed POST owner");
console.log("- the capability registry distinguishes deterministic internal artifacts from AI drafting and external delivery");
console.log("- AI, network calls, email, calendar creation, posting, forms, provider writes, canonical promotion and automatic retry remain disabled");
