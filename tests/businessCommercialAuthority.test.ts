import assert from "node:assert/strict";
import test from "node:test";

import { decideCommercialAuthority, prohibitedCommercialCommitmentInstruction } from "../src/core/businessCommercialAuthority";

const grant = {
  kind: "discount" as const,
  scope: "project" as const,
  relationshipId: "rel-client",
  projectId: "project-1",
  maximumAud: 5_000,
  validFrom: "2026-09-01T00:00:00Z",
  validThrough: "2026-09-30T23:59:59Z",
  evidenceIds: ["ops:authority:discount-1"],
  grantedBy: "greg",
};

const request = {
  kind: "discount" as const,
  relationshipId: "rel-client",
  projectId: "project-1",
  amountAud: 2_500,
  statement: "Apply a $2,500 discount.",
  requestedAt: "2026-09-04T00:00:00Z",
};

test("allows only commitments covered by one explicit evidence-backed grant", () => {
  const result = decideCommercialAuthority(request, [grant]);
  assert.equal(result.authorised, true);
  assert.equal(result.humanReviewRequired, false);
  assert.equal(prohibitedCommercialCommitmentInstruction(result, request), null);
});

test("fails closed when requested amount exceeds authority", () => {
  const over = { ...request, amountAud: 7_500, statement: "Apply a $7,500 discount." };
  const result = decideCommercialAuthority(over, [grant]);
  assert.equal(result.authorised, false);
  assert.match(prohibitedCommercialCommitmentInstruction(result, over) ?? "", /Do not commit/);
});

test("bounded monetary grant cannot authorise a request with no amount", () => {
  const result = decideCommercialAuthority({ ...request, amountAud: null }, [grant]);
  assert.equal(result.authorised, false);
  assert.equal(result.humanReviewRequired, true);
});

test("blank-only authority evidence never authorises", () => {
  const result = decideCommercialAuthority(request, [{ ...grant, evidenceIds: [" ", ""] }]);
  assert.equal(result.authorised, false);
});

test("accidental unscoped global grants fail closed", () => {
  const unscoped = { ...grant, scope: undefined, relationshipId: null, projectId: null };
  const result = decideCommercialAuthority(request, [unscoped]);
  assert.equal(result.authorised, false);
});

test("explicit global grant can authorise a delegable commitment", () => {
  const global = { ...grant, scope: "global" as const, relationshipId: null, projectId: null };
  const result = decideCommercialAuthority(request, [global]);
  assert.equal(result.authorised, true);
});

test("liability and contract terms remain nondelegable", () => {
  for (const kind of ["liability", "contract_term"] as const) {
    const result = decideCommercialAuthority(
      { ...request, kind, statement: `Accept ${kind}.` },
      [{ ...grant, kind, scope: "project" as const }],
    );
    assert.equal(result.authorised, false);
    assert.equal(result.humanReviewRequired, true);
    assert.ok(result.reasons.some((item) => /nondelegable/i.test(item)));
  }
});

test("ambiguous overlapping grants do not silently authorise a commitment", () => {
  const result = decideCommercialAuthority(request, [grant, { ...grant, evidenceIds: ["ops:authority:discount-2"] }]);
  assert.equal(result.authorised, false);
  assert.ok(result.reasons.some((item) => /Multiple authority grants/i.test(item)));
});
