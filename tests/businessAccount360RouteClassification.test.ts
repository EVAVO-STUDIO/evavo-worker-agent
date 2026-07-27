import assert from "node:assert/strict";
import test from "node:test";

import { listGrowthWorkerRouteInventory } from "../src/core/growthBusinessRouteInventory";
import {
  BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN,
  BUSINESS_ROUTE_POLICIES,
  resolveBusinessRouteHandlerId,
} from "../src/routes/businessRoutePolicy";
import { businessAutopilotRouteCatalogue } from "../src/routes/businessAutopilotRouteCatalogue";

const account360Path = "/admin/business/organizations/organization-1/account-360";

test("Account 360 resolves through the explicit read-only Business policy", () => {
  assert.equal(
    BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN,
    "/admin/business/organizations/:organizationId/account-360",
  );
  assert.equal(resolveBusinessRouteHandlerId(account360Path), "account-intelligence");
  assert.equal(
    resolveBusinessRouteHandlerId(`${account360Path}/extra`),
    "business-fallback",
  );

  const policy = BUSINESS_ROUTE_POLICIES.find(
    (item) => item.id === "account-intelligence",
  );
  assert.ok(policy);
  assert.deepEqual(policy.readMethods, ["GET"]);
  assert.deepEqual(policy.writeMethods, []);
  assert.equal(policy.mutationPosture, "read-only");
  assert.equal(policy.writeConfirmation, "not-applicable");
  assert.equal(policy.callsExternalNetwork, false);
  assert.equal(policy.callsAI, false);
  assert.equal(policy.canSendEmail, false);
  assert.equal(policy.canPostSocial, false);
  assert.equal(policy.canSubmitForms, false);
  assert.equal(policy.historicalOnly, false);
  assert.equal(policy.retiredWritesFailClosed, false);
});

test("Account 360 inventory cannot be classified as a POST-capable mutation", () => {
  const inventory = listGrowthWorkerRouteInventory();
  const entry = inventory.entries.find(
    (item) => item.routeFamily === "business" && item.handlerId === "account-intelligence",
  );
  assert.ok(entry);
  assert.deepEqual(entry.ownership, {
    kind: "pattern",
    pattern: BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN,
  });
  assert.deepEqual(entry.readMethods, ["GET"]);
  assert.deepEqual(entry.writeMethods, []);
  assert.equal(entry.postClassification, "not-supported");
  assert.equal(entry.confirmation, "not-applicable");
  assert.equal(entry.networkPosture, "none");
  assert.equal(entry.callsExternalNetwork, false);
  assert.equal(entry.callsAI, false);
  assert.equal(entry.canSendEmail, false);
  assert.equal(entry.canPostSocial, false);
  assert.equal(entry.canSubmitForms, false);
  assert.equal(entry.externalStateChange, false);
  assert.equal(entry.browserCallable, false);
  assert.equal(entry.canonicalGrowthPromotion, false);
});

test("Account 360 catalogue entry exposes only bounded noncanonical review", () => {
  const route = businessAutopilotRouteCatalogue.find(
    (item) => item.id === "business_account_360",
  );
  assert.ok(route);
  assert.equal(route.method, "GET");
  assert.equal(
    route.path,
    "/admin/business/organizations/:organizationId/account-360?limit=25",
  );
  assert.equal(route.safety, "read_only");
  assert.equal(route.readOnly, true);
  assert.equal(route.requiresConfirm, false);
  assert.deepEqual(route.writesTables, []);
  assert.equal(route.callsNetwork, false);
  assert.equal(route.callsAI, false);
  assert.equal(route.canSendEmail, false);
  assert.equal(route.canPostSocial, false);
  assert.equal(route.canSubmitForms, false);
  assert.equal(route.costRisk, "none");
  assert.equal(route.operationsHubRecommended, true);
  assert.match(route.description, /D1 remains noncanonical/);
  assert.match(route.description, /does not promote state to Supabase/);
  assert.match(route.description, /infer relationship or deal health/);
  assert.match(route.description, /expose contact details/);
  assert.match(route.description, /create meetings/);
  assert.match(route.description, /execute external actions/);
});
