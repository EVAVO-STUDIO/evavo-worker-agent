import assert from "node:assert/strict";
import test from "node:test";

import {
  BUSINESS_METADATA_READ_QUERY_CONTRACT,
  parseBusinessMetadataReadQuery,
  parseBusinessMetadataReadRouteQuery,
} from "../src/core/businessMetadataReadBoundary";

function parse(query = "") {
  return parseBusinessMetadataReadQuery(
    new URL(`https://worker.example/admin/business/test${query}`),
    {
      textFields: {
        status: { maxLength: 64 },
        category: { maxLength: 128 },
      },
      booleanFields: new Set(["active"]),
    },
  );
}

test("parses default and explicit bounded read queries", () => {
  const defaultResult = parse();
  assert.equal(defaultResult.ok, true);
  if (!defaultResult.ok) return;
  assert.equal(defaultResult.contract, BUSINESS_METADATA_READ_QUERY_CONTRACT);
  assert.equal(defaultResult.limit, 25);
  assert.equal(defaultResult.text.status, undefined);
  assert.equal(defaultResult.booleans.active, undefined);

  const explicit = parse("?limit=100&status=needs_review&active=0");
  assert.equal(explicit.ok, true);
  if (!explicit.ok) return;
  assert.equal(explicit.limit, 100);
  assert.equal(explicit.text.status, "needs_review");
  assert.equal(explicit.booleans.active, false);
});

test("rejects unknown and duplicate query parameters without echoing values", () => {
  const unknown = parse("?debug=must-not-leak");
  assert.equal(unknown.ok, false);
  if (!unknown.ok) {
    assert.equal(unknown.payload.error, "query_not_supported");
    assert.deepEqual(unknown.payload.fields, ["debug"]);
    assert.equal(JSON.stringify(unknown.payload).includes("must-not-leak"), false);
  }

  const duplicate = parse("?limit=10&limit=20&status=new&status=active");
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) {
    assert.equal(duplicate.payload.error, "duplicate_query_parameter");
    assert.deepEqual(duplicate.payload.fields, ["limit", "status"]);
  }
});

test("rejects noncanonical or out-of-range limits", () => {
  for (const value of ["0", "101", "01", "1.5", "1e2", " 5", "5 ", "NaN"]) {
    const result = parse(`?limit=${encodeURIComponent(value)}`);
    assert.equal(result.ok, false, value);
    if (!result.ok) {
      assert.equal(result.payload.error, "invalid_limit");
      assert.equal(result.payload.rawInputExposed, false);
    }
  }
});

test("rejects invalid text and boolean filters", () => {
  for (const query of ["?status=", "?status=%20active", `?status=${"x".repeat(65)}`]) {
    const result = parse(query);
    assert.equal(result.ok, false, query);
    if (!result.ok) assert.equal(result.payload.error, "invalid_text_query");
  }

  for (const value of ["true", "false", "2", "-1", ""]) {
    const result = parse(`?active=${encodeURIComponent(value)}`);
    assert.equal(result.ok, false, value);
    if (!result.ok) {
      assert.equal(result.payload.error, "invalid_boolean_query");
      assert.deepEqual(result.payload.acceptedValues, ["0", "1"]);
    }
  }
});

test("route guard covers Business collection reads and preserves specialised routes", () => {
  const organizations = parseBusinessMetadataReadRouteQuery(
    new URL("https://worker.example/admin/business/organizations?limit=10&status=active"),
    "/admin/business/organizations",
    "GET",
  );
  assert.equal(organizations?.ok, true);

  const candidates = parseBusinessMetadataReadRouteQuery(
    new URL("https://worker.example/admin/business/audit-observation-candidates?limit=51"),
    "/admin/business/audit-observation-candidates",
    "GET",
  );
  assert.equal(candidates?.ok, false);
  if (candidates && !candidates.ok) assert.equal(candidates.payload.error, "invalid_limit");

  assert.equal(parseBusinessMetadataReadRouteQuery(
    new URL("https://worker.example/admin/business/organizations?limit=10"),
    "/admin/business/organizations",
    "POST",
  ), null);
  assert.equal(parseBusinessMetadataReadRouteQuery(
    new URL("https://worker.example/admin/business/organizations/org-1/account-360?limit=25"),
    "/admin/business/organizations/org-1/account-360",
    "GET",
  ), null);
  assert.equal(parseBusinessMetadataReadRouteQuery(
    new URL("https://worker.example/admin/business/people?limit=25"),
    "/admin/business/people",
    "GET",
  ), null);
});
