import assert from "node:assert/strict";
import test from "node:test";

import { resolveRelationshipIdentity } from "../src/core/businessRelationshipIdentityResolver";

const ashley = {
  personId: "person_ashley_wong",
  name: "Ashley Wong",
  addresses: ["ashley@example.com"],
  organizationIds: ["org_example"],
  relationshipIds: ["rel_ashley_evavo"],
  evidence: [{ source: "gmail" as const, ref: "gmail:message:m1", confidence: 100 }],
};

test("exact email address verifies one identity", () => {
  const result = resolveRelationshipIdentity({ observedAddress: "Ashley@Example.com", observedName: "Ashley Wong", candidates: [ashley] });
  assert.equal(result.status, "verified");
  assert.equal(result.selected?.personId, ashley.personId);
  assert.equal(result.exactAddressMatch, true);
});

test("expected person mismatch fails closed", () => {
  const result = resolveRelationshipIdentity({ observedAddress: "ashley@example.com", expectedPersonId: "person_other", candidates: [ashley] });
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
