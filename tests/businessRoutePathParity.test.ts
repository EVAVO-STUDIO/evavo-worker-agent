import assert from "node:assert/strict";
import test from "node:test";

import {
  BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN,
  BUSINESS_FALLBACK_COLLECTION_PATHS,
  BUSINESS_HISTORICAL_PATHS,
  BUSINESS_PEOPLE_PATH,
  BUSINESS_READ_QUERY_GUARDED_PATHS,
  BUSINESS_WEBSITE_AUDIT_PATHS,
} from "../src/core/businessRoutePaths";
import { parseBusinessMetadataReadRouteQuery } from "../src/core/businessMetadataReadBoundary";
import { resolveBusinessRouteHandlerId } from "../src/routes/businessRoutePolicy";

test("Business query-guard paths equal the canonical collection path union", () => {
  const expected = [
    ...BUSINESS_FALLBACK_COLLECTION_PATHS,
    ...BUSINESS_WEBSITE_AUDIT_PATHS,
    ...BUSINESS_HISTORICAL_PATHS,
  ].sort();
  assert.deepEqual([...BUSINESS_READ_QUERY_GUARDED_PATHS].sort(), expected);
  assert.equal(new Set(BUSINESS_READ_QUERY_GUARDED_PATHS).size, expected.length);
});

test("every canonical collection path resolves to its intended handler and guard", () => {
  for (const pathname of BUSINESS_FALLBACK_COLLECTION_PATHS) {
    assert.equal(resolveBusinessRouteHandlerId(pathname), "business-fallback", pathname);
    assert.notEqual(parseBusinessMetadataReadRouteQuery(new URL(`https://worker.example${pathname}`), pathname, "GET"), null);
  }
  for (const pathname of BUSINESS_WEBSITE_AUDIT_PATHS) {
    assert.equal(resolveBusinessRouteHandlerId(pathname), "website-audit", pathname);
    assert.notEqual(parseBusinessMetadataReadRouteQuery(new URL(`https://worker.example${pathname}`), pathname, "GET"), null);
  }
  for (const pathname of BUSINESS_HISTORICAL_PATHS) {
    assert.equal(resolveBusinessRouteHandlerId(pathname), "business-historical", pathname);
    assert.notEqual(parseBusinessMetadataReadRouteQuery(new URL(`https://worker.example${pathname}`), pathname, "GET"), null);
  }
});

test("specialised Business parsers remain outside the collection guard", () => {
  const accountPath = BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN.replace(":organizationId", "org-1");
  assert.equal(resolveBusinessRouteHandlerId(accountPath), "account-intelligence");
  assert.equal(parseBusinessMetadataReadRouteQuery(new URL(`https://worker.example${accountPath}?limit=25`), accountPath, "GET"), null);

  assert.equal(resolveBusinessRouteHandlerId(BUSINESS_PEOPLE_PATH), "people");
  assert.equal(parseBusinessMetadataReadRouteQuery(new URL(`https://worker.example${BUSINESS_PEOPLE_PATH}?limit=25`), BUSINESS_PEOPLE_PATH, "GET"), null);
});
