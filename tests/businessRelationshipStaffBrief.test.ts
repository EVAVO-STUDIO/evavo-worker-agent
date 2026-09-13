import assert from "node:assert/strict";
import test from "node:test";

import { buildRelationshipStaffBrief } from "../src/core/businessRelationshipStaffBrief";

const baseContext = {
  contract: "business_relationship_360_context_v3" as const,
  relationshipId: "rel-1",
  generatedAt: "2026-09-04T02:50:00Z",
  identity: "Ashley Wong <ashley@example.com>",
  organization: null,
  project: null,
  commercial: null,
  careers: null,
  support: null,
  communications: "One live graduate enquiry asks whether EVAVO has opportunities.",
  documents: null,
  openEvavoObligations: ["Reply to the enquiry."],
  openCounterpartyObligations: [],
  priorDecisions: ["Keep this matter async unless a confirmed role/process makes a meeting useful."],
  currentEvidence: [],
  historicalEvidence: [],
  conflicts: [],
  missingCriticalContext: [],
  recommendedAttention: [],
  contextSummary: "Identity verified | One live graduate enquiry.",
  evidenceRefs: ["gmail:message:m1"],
};

test("creates an approval-grade brief while keeping careers truth separate from commercial authority", () => {
  const result = buildRelationshipStaffBrief({ objective: "Respond to the graduate enquiry", context: baseContext });
  assert.equal(result.approvalGradeReady, true);
  assert.ok(result.priorities.some((item) => /EVAVO-owned obligations/i.test(item)));
  assert.ok(result.mustNotAssume.some((item) => /pricing, scope, payment, contract/i.test(item)));
  assert.ok(result.mustNotAssume.some((item) => /open role|not-hiring/i.test(item)));
  assert.ok(!result.mustNotAssume.some((item) => /pricing, hiring/i.test(item)));
  assert.deepEqual(result.sourceRefs, ["gmail:message:m1"]);
});

test("dedicated careers context becomes a priority instead of a commercial inference", () => {
  const result = buildRelationshipStaffBrief({
    objective: "Respond to the graduate enquiry",
    context: {
      ...baseContext,
      careers: "Dedicated careers truth found no confirmed current opening.",
      evidenceRefs: ["gmail:message:m1", "operations:careers-snapshot:abc"],
    },
  });
  assert.ok(result.priorities.some((item) => /dedicated careers truth/i.test(item)));
  assert.ok(!result.mustNotAssume.some((item) => /open role|not-hiring/i.test(item)));
});

test("blocks approval-grade readiness when context conflicts remain", () => {
  const result = buildRelationshipStaffBrief({
    objective: "Reply safely",
    context: { ...baseContext, conflicts: ["identity: two people share the same address alias"], missingCriticalContext: ["Verified person identity is missing."] },
  });
  assert.equal(result.approvalGradeReady, false);
  assert.ok(result.mustVerify.some((item) => /Resolve conflict/i.test(item)));
});
