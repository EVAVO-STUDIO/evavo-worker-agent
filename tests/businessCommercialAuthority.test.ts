import assert from "node:assert/strict";
import test from "node:test";

import { decideCommercialAuthority, prohibitedCommercialCommitmentInstruction } from "../src/core/businessCommercialAuthority";

const grant = {
  kind: "discount" as const,
  relationshipId: "rel-client",
  projectId: "project-1",
  maximumAud: 5_000,
  validFrom: "2026-09-01T00:00:00Z",
  validThrough: "2026-09-30T23:59:59Z",
  evidenceIds: ["ops:authority:discount-1"],
  grantedBy: "greg",
};

test("allows only commitments covered by one explicit evidence-backed grant", () => {
  const request = {
    kind: "discount" as const,
    relationshipId: "rel-client",
    projectId: "project-1",
    amountAud: 2_500,
    statement: "Apply a $2,500 discount.",
    requestedAt: "2026-09-04T00:00:00Z",
  };
  const result = decideCommercialAuthority(request, [grant]);
  assert.equal(result.authorised, true);
  assert.equal(prohibitedCommercialCommitmentInstruction(result, request), null);
});

test("fails closed when requested amount exceeds authority", () => {
  const request = {
    kind: "discount" as const,
    relationshipId: "rel-client",
    projectId: "project-1",
    amountAud: 7_500,
    statement: "Apply a $7,500 discount.",
    requestedAt: "2026-09-04T00:00:00Z",
  };
  const result = decideCommercialAuthority(request, [grant]);
  assert.equal(result.authorised, false);
  assert.match(prohibitedCommercialCommitmentInstruction(result, request) ?? "", /Do not commit/);
});

test("ambiguous overlapping grants do not silently authorise a commitment", () => {
  const request = {
    kind: "discount" as const,
    relationshipId: "rel-client",
    projectId: "project-1",
    amountAud: 1_000,
    statement: "Apply a $1,000 discount.",
    requestedAt: "2026-09-04T00:00:00Z",
  };
  const result = decideCommercialAuthority(request, [grant, { ...grant, evidenceIds: ["ops:authority:discount-2"] }]);
  assert.equal(result.authorised, false);
  assert.ok(result.reasons.some((item) => /Multiple authority grants/i.test(item)));
});
