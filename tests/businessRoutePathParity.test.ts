import assert from "node:assert/strict";
import test from "node:test";

import {
  BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN,
  BUSINESS_FALLBACK_COLLECTION_PATHS,
  BUSINESS_HISTORICAL_PATHS,
  BUSINESS_PEOPLE_PATH,
  BUSINESS_READ_QUERY_GUARDED_PATHS,
  BUSINESS_RELATIONSHIP_MANAGER_CYCLE_PATH,
  BUSINESS_ROUTE_PREFIX,
  BUSINESS_WEBSITE_AUDIT_PATHS,
  isBusinessRoutePath,
} from "../src/core/businessRoutePaths";
import {
  parseBusinessMetadataReadRouteQuery,
  preflightBusinessMetadataReadQuery,
} from "../src/core/businessMetadataReadBoundary";
import { BUSINESS_ROUTE_POLICIES, resolveBusinessRouteHandlerId } from "../src/routes/businessRoutePolicy";

test("Business query-guard paths equal the canonical collection path union", () => {
  const expected = [
    ...BUSINESS_FALLBACK_COLLECTION_PATHS,
    ...BUSINESS_WEBSITE_AUDIT_PATHS,
    ...BUSINESS_HISTORICAL_PATHS,
  ].sort();
  assert.deepEqual([...BUSINESS_READ_QUERY_GUARDED_PATHS].sort(), expected);
  assert.equal(new Set(BUSINESS_READ_QUERY_GUARDED_PATHS).size, expected.length);
});

test("every canonical collection path resolves to its intended handler and both read guards", () => {
  for (const pathname of BUSINESS_FALLBACK_COLLECTION_PATHS) {
    assert.equal(resolveBusinessRouteHandlerId(pathname), "business-fallback", pathname);
    assert.notEqual(parseBusinessMetadataReadRouteQuery(new URL(`https://worker.example${pathname}`), pathname, "GET"), null);
    assert.equal(preflightBusinessMetadataReadQuery(new URL(`https://worker.example${pathname}`), pathname, "GET")?.ok, true);
  }
  for (const pathname of BUSINESS_WEBSITE_AUDIT_PATHS) {
    assert.equal(resolveBusinessRouteHandlerId(pathname), "website-audit", pathname);
    assert.notEqual(parseBusinessMetadataReadRouteQuery(new URL(`https://worker.example${pathname}`), pathname, "GET"), null);
    assert.equal(preflightBusinessMetadataReadQuery(new URL(`https://worker.example${pathname}`), pathname, "GET")?.ok, true);
  }
  for (const pathname of BUSINESS_HISTORICAL_PATHS) {
    assert.equal(resolveBusinessRouteHandlerId(pathname), "business-historical", pathname);
    assert.notEqual(parseBusinessMetadataReadRouteQuery(new URL(`https://worker.example${pathname}`), pathname, "GET"), null);
    assert.equal(preflightBusinessMetadataReadQuery(new URL(`https://worker.example${pathname}`), pathname, "GET")?.ok, true);
  }
});

test("specialised Business parsers remain outside the collection guard but inside family preflight", () => {
  const accountPath = BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN.replace(":organizationId", "org-1");
  assert.equal(resolveBusinessRouteHandlerId(accountPath), "account-intelligence");
  assert.equal(parseBusinessMetadataReadRouteQuery(new URL(`https://worker.example${accountPath}?limit=25`), accountPath, "GET"), null);
  assert.equal(preflightBusinessMetadataReadQuery(new URL(`https://worker.example${accountPath}?limit=25`), accountPath, "GET")?.ok, true);

  assert.equal(resolveBusinessRouteHandlerId(BUSINESS_PEOPLE_PATH), "people");
  assert.equal(parseBusinessMetadataReadRouteQuery(new URL(`https://worker.example${BUSINESS_PEOPLE_PATH}?limit=25`), BUSINESS_PEOPLE_PATH, "GET"), null);
  assert.equal(preflightBusinessMetadataReadQuery(new URL(`https://worker.example${BUSINESS_PEOPLE_PATH}?limit=25`), BUSINESS_PEOPLE_PATH, "GET")?.ok, true);
});

test("Relationship Manager communication cycle is a POST-only internal preview before fallback", () => {
  assert.equal(resolveBusinessRouteHandlerId(BUSINESS_RELATIONSHIP_MANAGER_CYCLE_PATH), "relationship-manager");
  const policy = BUSINESS_ROUTE_POLICIES.find((item) => item.id === "relationship-manager");
  assert.ok(policy);
  assert.equal(policy?.mutationPosture, "internal-preview");
  assert.deepEqual(policy?.readMethods, []);
  assert.deepEqual(policy?.writeMethods, ["POST"]);
  assert.equal(policy?.writeConfirmation, "not-applicable");
  assert.equal(policy?.callsExternalNetwork, false);
  assert.equal(policy?.callsAI, false);
  assert.equal(policy?.canSendEmail, false);
  assert.equal(policy?.canPostSocial, false);
  assert.equal(policy?.canSubmitForms, false);
  assert.equal(policy?.historicalOnly, false);
  assert.equal(policy?.retiredWritesFailClosed, false);
  const fallback = BUSINESS_ROUTE_POLICIES.find((item) => item.id === "business-fallback");
  assert.ok((policy?.priority ?? 999) < (fallback?.priority ?? 0));
});

test("Business family detection is exact and does not bleed into adjacent route prefixes", () => {
  assert.equal(BUSINESS_ROUTE_PREFIX, "/admin/business");
  assert.equal(isBusinessRoutePath("/admin/business"), true);
  assert.equal(isBusinessRoutePath("/admin/business/unknown"), true);
  assert.equal(isBusinessRoutePath("/admin/businesses"), false);
  assert.equal(isBusinessRoutePath("/admin/business-like"), false);
  assert.equal(preflightBusinessMetadataReadQuery(
    new URL("https://worker.example/admin/businesses?limit=10&limit=20"),
    "/admin/businesses",
    "GET",
  ), null);
});
