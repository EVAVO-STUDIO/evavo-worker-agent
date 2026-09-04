import assert from "node:assert/strict";
import test from "node:test";

import {
  bindStaffWritingProvenanceForApproval,
  EVAVO_STAFF_WRITING_ENVELOPE_V2_CONTRACT,
} from "../src/core/businessStaffWritingProvenanceBinding";
import type { StaffCommunicationHandoffV2Like } from "../src/core/businessStaffCommunicationHandoffV2";

const handoff: StaffCommunicationHandoffV2Like = {
  schema: "evavo-writing/staff-communication-handoff-v2",
  version: 2,
  protocol: "evavo-staff-communication-handoff-v2",
  handoff: {
    schema: "evavo-writing/staff-communication-handoff",
    version: 1,
    protocol: "evavo-staff-communication-handoff-v1",
    relationshipId: "rel-1",
    handoffId: "handoff-1",
  },
  staffContext: {
    relationshipId: "rel-1",
    generatedAt: "2026-09-04T02:50:00.000Z",
    decisionPackageId: "decision-1",
    decisionOrigin: "relationship_manager_cycle",
    relationshipCycleId: "cycle-1",
    approvalGradeReady: true,
    blockingVerificationOutstanding: false,
    whatChanged: "A new message arrived.",
    materialChanges: ["new message"],
    priorities: ["answer current question"],
    mustVerify: [],
    mustNotAssume: [],
    obligationsToRespect: [],
    priorDecisionsToRespect: [],
    relationshipRisks: [],
    staleDomains: [],
    nextContextSources: [],
    sourceRefs: ["gmail:m1", "decision:1"],
  },
};

function envelope() {
  return {
    contract: EVAVO_STAFF_WRITING_ENVELOPE_V2_CONTRACT,
    writingRequest: { requestId: "writing-request-1" },
    provenance: {
      relationshipId: "rel-1",
      handoffId: "handoff-1",
      decisionPackageId: "decision-1",
      decisionOrigin: "relationship_manager_cycle" as const,
      relationshipCycleId: "cycle-1",
      staffContextGeneratedAt: "2026-09-04T02:50:00.000Z",
      sourceRefs: ["decision:1", "gmail:m1"],
    },
  };
}

test("matching Writing Studio provenance becomes the exact send-approval writing binding", () => {
  const result = bindStaffWritingProvenanceForApproval({ handoff, writingEnvelope: envelope() });
  assert.deepEqual(result.approvalBinding, {
    handoffId: "handoff-1",
    writingRequestId: "writing-request-1",
    decisionOrigin: "relationship_manager_cycle",
    relationshipCycleId: "cycle-1",
  });
  assert.equal(result.decisionPackageId, "decision-1");
  assert.deepEqual(result.sourceRefs, ["decision:1", "gmail:m1"]);
});

test("draft from another decision package is refused before approval", () => {
  const wrong = envelope();
  wrong.provenance.decisionPackageId = "decision-other";
  assert.throws(
    () => bindStaffWritingProvenanceForApproval({ handoff, writingEnvelope: wrong }),
    /STAFF_WRITING_PROVENANCE_DECISION_MISMATCH/,
  );
});

test("draft from another Relationship Manager cycle is refused before approval", () => {
  const wrong = envelope();
  wrong.provenance.relationshipCycleId = "cycle-other";
  assert.throws(
    () => bindStaffWritingProvenanceForApproval({ handoff, writingEnvelope: wrong }),
    /STAFF_WRITING_PROVENANCE_RELATIONSHIP_CYCLE_MISMATCH/,
  );
});

test("changed evidence provenance is refused even when decision and cycle ids match", () => {
  const wrong = envelope();
  wrong.provenance.sourceRefs = ["gmail:m1"];
  assert.throws(
    () => bindStaffWritingProvenanceForApproval({ handoff, writingEnvelope: wrong }),
    /STAFF_WRITING_PROVENANCE_SOURCE_REFS_MISMATCH/,
  );
});
