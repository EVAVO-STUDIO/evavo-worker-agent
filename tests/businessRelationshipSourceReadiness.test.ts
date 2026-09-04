import assert from "node:assert/strict";
import test from "node:test";

import { assessRelationshipSourceReadiness } from "../src/core/businessRelationshipSourceReadiness";

const now = "2026-09-04T12:00:00Z";

test("verified source resolves required context only with evidence", () => {
  const result = assessRelationshipSourceReadiness({
    now,
    sources: [{
      domain: "gmail",
      state: "verified",
      required: true,
      observedAt: "2026-09-04T11:59:00Z",
      sourceRefs: ["gmail:thread:1"],
    }],
  });
  assert.equal(result.contract, "business_relationship_source_readiness_v1");
  assert.equal(result.ready, true);
  assert.equal(result.findings[0]?.resolved, true);
});

test("provider unavailable is unknown rather than evidence of absence", () => {
  const result = assessRelationshipSourceReadiness({
    now,
    sources: [{
      domain: "operations",
      state: "provider_unavailable",
      required: true,
      detail: "Operations Core could not be reached.",
    }],
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockingDomains, ["operations"]);
  assert.ok(result.issues.some((issue) => /current truth is unknown/i.test(issue)));
});

test("authoritative not-found can resolve when absence is an acceptable outcome", () => {
  const result = assessRelationshipSourceReadiness({
    now,
    sources: [{
      domain: "operations",
      state: "not_found",
      required: true,
      absenceAcceptable: true,
      observedAt: "2026-09-04T11:58:00Z",
      sourceRefs: ["operations:query:no-open-role:1"],
    }],
  });
  assert.equal(result.ready, true);
  assert.equal(result.findings[0]?.resolved, true);
  assert.ok(result.evidenceRefs.includes("operations:query:no-open-role:1"));
});

test("not-found remains blocking when the decision requires an existing record", () => {
  const result = assessRelationshipSourceReadiness({
    now,
    sources: [{
      domain: "document",
      state: "not_found",
      required: true,
      absenceAcceptable: false,
      observedAt: "2026-09-04T11:58:00Z",
      sourceRefs: ["docs:query:proposal:1"],
    }],
  });
  assert.equal(result.ready, false);
  assert.ok(result.issues.some((issue) => /absence is not an acceptable outcome/i.test(issue)));
});

test("not-found and verified states require concrete query evidence", () => {
  assert.throws(() => assessRelationshipSourceReadiness({
    now,
    sources: [{ domain: "gmail", state: "not_found", required: false, absenceAcceptable: true }],
  }), /EVIDENCE_REQUIRED/);
  assert.throws(() => assessRelationshipSourceReadiness({
    now,
    sources: [{ domain: "identity", state: "verified", required: true, observedAt: now, sourceRefs: [] }],
  }), /EVIDENCE_REQUIRED/);
});

test("duplicate source domains fail closed", () => {
  assert.throws(() => assessRelationshipSourceReadiness({
    now,
    sources: [
      { domain: "gmail", state: "not_queried", required: true },
      { domain: "gmail", state: "provider_unavailable", required: true },
    ],
  }), /DUPLICATE_DOMAIN/);
});
