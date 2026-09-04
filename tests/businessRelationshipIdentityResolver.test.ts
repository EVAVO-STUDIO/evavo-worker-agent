import assert from "node:assert/strict";
import test from "node:test";

import { resolveRelationshipIdentity, type IdentityCandidate } from "../src/core/businessRelationshipIdentityResolver";

const ashley = {
  personId: "person_ashley_wong",
  name: "Ashley Wong",
  addresses: ["ashley@example.com"],
  organizationIds: ["org_example"],
  relationshipIds: ["rel_ashley_evavo"],
  evidence: [{ source: "gmail" as const, ref: "gmail:message:m1", confidence: 100 }],
};

test("exact email address verifies one evidence-backed identity", () => {
  const result = resolveRelationshipIdentity({ observedAddress: "Ashley@Example.com", observedName: "Ashley Wong", candidates: [ashley] });
  assert.equal(result.contract, "business_relationship_identity_resolver_v2");
  assert.equal(result.status, "verified");
  assert.equal(result.selected?.personId, ashley.personId);
  assert.equal(result.exactAddressMatch, true);
});

test("expected person mismatch fails closed", () => {
  const result = resolveRelationshipIdentity({ observedAddress: "ashley@example.com", expectedPersonId: " person_other ", candidates: [ashley] });
  assert.equal(result.status, "ambiguous");
  assert.equal(result.confidence, 0);
});

test("same name for multiple people is ambiguous", () => {
  const result = resolveRelationshipIdentity({
    observedName: "Ashley Wong",
    candidates: [ashley, { ...ashley, personId: "person_ashley_wong_2", addresses: ["other@example.com"] }],
  });
  assert.equal(result.status, "ambiguous");
});

test("unknown address stays unresolved instead of guessing by name", () => {
  const result = resolveRelationshipIdentity({ observedAddress: "unknown@example.com", observedName: "Ashley Wong", candidates: [ashley] });
  assert.equal(result.status, "unresolved");
});

test("exact address match without concrete identity provenance is not verified", () => {
  const result = resolveRelationshipIdentity({
    observedAddress: "ashley@example.com",
    candidates: [{ ...ashley, evidence: [] }],
  });
  assert.equal(result.status, "unresolved");
  assert.equal(result.exactAddressMatch, true);
  assert.equal(result.confidence, 0);
  assert.ok(result.reasons.some((reason) => /no concrete provenance/i.test(reason)));
});

test("blank evidence refs do not create provenance", () => {
  const result = resolveRelationshipIdentity({
    observedAddress: "ashley@example.com",
    candidates: [{ ...ashley, evidence: [{ source: "gmail" as const, ref: " ", confidence: 100 }] }],
  });
  assert.equal(result.status, "unresolved");
});

test("duplicate person identities fail closed before routing", () => {
  assert.throws(() => resolveRelationshipIdentity({
    observedAddress: "ashley@example.com",
    candidates: [ashley, { ...ashley, addresses: ["other@example.com"] }],
  }), /DUPLICATE_PERSON_ID/);
});

test("same exact address across distinct people remains ambiguous", () => {
  const result = resolveRelationshipIdentity({
    observedAddress: "ashley@example.com",
    candidates: [ashley, { ...ashley, personId: "person_other", name: "Different Person" }],
  });
  assert.equal(result.status, "ambiguous");
  assert.deepEqual(new Set(result.competingPersonIds), new Set(["person_ashley_wong", "person_other"]));
});

test("candidate addresses and relationship identifiers are normalized", () => {
  const result = resolveRelationshipIdentity({
    observedAddress: "ashley@example.com",
    candidates: [{
      ...ashley,
      addresses: [" Ashley@Example.com ", "ashley@example.com"],
      organizationIds: [" org_example ", "org_example"],
      relationshipIds: [" rel_ashley_evavo ", "rel_ashley_evavo"],
    }],
  });
  assert.equal(result.status, "verified");
  assert.deepEqual(result.selected?.addresses, ["ashley@example.com"]);
  assert.deepEqual(result.selected?.organizationIds, ["org_example"]);
  assert.deepEqual(result.selected?.relationshipIds, ["rel_ashley_evavo"]);
});

test("malformed runtime evidence confidence fails closed", () => {
  const hostile = {
    ...ashley,
    evidence: [{ source: "gmail", ref: "gmail:message:m1", confidence: Number.NaN }],
  } as unknown as IdentityCandidate;
  assert.throws(() => resolveRelationshipIdentity({ observedAddress: "ashley@example.com", candidates: [hostile] }), /EVIDENCE_CONFIDENCE_INVALID/);
});

test("malformed candidate email addresses fail closed", () => {
  assert.throws(() => resolveRelationshipIdentity({
    observedName: "Ashley Wong",
    candidates: [{ ...ashley, addresses: ["not-an-email"] }],
  }), /CANDIDATE_ADDRESS_INVALID/);
});
