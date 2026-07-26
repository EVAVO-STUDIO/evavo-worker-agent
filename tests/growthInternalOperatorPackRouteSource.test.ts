import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (relativePath: string): string =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

function ordered(source: string, tokens: readonly string[]): void {
  let previous = -1;
  for (const token of tokens) {
    const index = source.indexOf(token);
    assert(index > previous, `expected ordered token: ${token}`);
    previous = index;
  }
}

test("operator artifact route admits persistent budget before reading review models", () => {
  const source = read("src/routes/growthInternalOperatorPackAdmin.ts");
  ordered(source, [
    "await isAdminRequestAuthorized(request, env)",
    'request.method !== "GET"',
    "claimGrowthActivityBudget(env, {",
    'action: "owner_brief_generate"',
    "listGrowthSignals(env, SIGNAL_LIMIT)",
    "listGrowthActions(env, ACTION_LIMIT)",
    "composeGrowthInternalOperatorPack({",
    "completeClaimSafely(",
    'mode: "growth_internal_operator_pack"',
  ]);
  assert(source.includes('GROWTH_INTERNAL_OPERATOR_PACK_ROUTE =\n  "/admin/growth/operator/artifacts"'));
  assert(source.includes("persistentBudgetAdmissionRequired: true"));
  assert(source.includes("internalBudgetAccountingWritesOnly: true"));
  assert(source.includes("readsSavedReviewModelsOnly: true"));
  assert(source.includes("externalExecutionRequested: false"));
  assert(source.includes("canonicalPromotionRequested: false"));
  assert(source.includes("automaticRetryAllowed: false"));
  assert(!source.includes("fetch("));
  assert(!source.includes("env.AI"));
  assert(!source.includes("sendEmail"));
  assert(!source.includes("postsExternally: true"));
  assert(!source.includes("createsCalendarEvent: true"));
  assert(!source.includes("writesProvider: true"));
  assert(!source.includes("promotesCanonicalRecord: true"));
});

test("route policy and dispatcher give the operator artifact route one exact owner", () => {
  const policy = read("src/routes/growthRoutePolicy.ts");
  const index = read("src/index.ts");
  assert.equal(policy.split('"/admin/growth/operator/artifacts"').length - 1, 1);
  assert.equal(policy.split('exact("operator-artifacts"').length - 1, 1);
  assert(policy.includes('exact("operator-artifacts", 15'));
  assert(policy.includes('], "mixed-internal", "not-required")'));
  assert.equal(index.split('case "operator-artifacts":').length - 1, 1);
  assert.equal(index.split("handleGrowthInternalOperatorPackAdmin(req, env, pathname, jsonResponse)").length - 1, 1);
  assert(!index.includes('pathname === "/admin/growth/operator/artifacts"'));
});

test("capability registry distinguishes deterministic artifacts from AI and delivery", () => {
  const registry = read("src/core/growthCapabilities.ts");
  assert(registry.includes('id: "generate_internal_operator_pack"'));
  assert(registry.includes("deterministicInternalOperatorPackEnabled: true"));
  assert(registry.includes("internalOperatorPackCallsAI: false"));
  assert(registry.includes("internalOperatorPackCallsNetwork: false"));
  assert(registry.includes('internalOperatorPackBudgetAction: "owner_brief_generate"'));
  assert(registry.includes("internalOperatorPackAdmissionIntegrated: true"));
  assert(registry.includes("draftingEnabled: false"));
  assert(registry.includes("externalDeliveryEnabled: false"));
  assert(!registry.includes("internalOperatorPackCallsAI: true"));
  assert(!registry.includes("internalOperatorPackCallsNetwork: true"));
});
