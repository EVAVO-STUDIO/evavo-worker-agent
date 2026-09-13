import assert from "node:assert/strict";
import test from "node:test";

import { bindStaffWritingOutputForApproval } from "../src/core/businessStaffWritingOutputBinding";
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

const writingEnvelope = {
  contract: "evavo-writing/staff-communication-writing-envelope-v2" as const,
  writingRequest: { requestId: "request-1" },
  provenance: {
    relationshipId: "rel-1",
    handoffId: "handoff-1",
    decisionPackageId: "decision-1",
    decisionOrigin: "relationship_manager_cycle" as const,
    relationshipCycleId: "cycle-1",
    staffContextGeneratedAt: "2026-09-04T02:50:00.000Z",
    sourceRefs: ["gmail:m1", "decision:1"],
  },
};

function packageFor(requestId = "request-1") {
  return {
    schema: "evavo-writing/draft-package" as const,
    version: 1 as const,
    protocol: "evavo-writing-operations-v1",
    requestId,
    operationId: "operation-1",
    createdAt: "2026-09-04T02:51:00.000Z",
    packageId: "draft-package-1",
    planId: "plan-1",
    status: "ready" as const,
    recommendedCandidateId: "candidate-1",
    candidates: [{
      id: "candidate-1",
      label: "Direct",
      strategy: "Answer directly and kindly.",
      subject: "Re: Status",
      body: "Hi,\n\nThanks for checking in. The current verified status is unchanged.\n\nKind regards,\nGreg",
      usedFactIds: [],
      usedSourceIds: [],
      unresolvedAssumptionIds: [],
      warnings: [],
    }],
    missingInformation: [],
    warnings: [],
  };
}

test("ready selected draft is bound to the same writing request and decision provenance", () => {
  const result = bindStaffWritingOutputForApproval({
    handoff,
    writingEnvelope,
    draftPackage: packageFor(),
  });
  assert.equal(result.writingRequestId, "request-1");
  assert.equal(result.writingPackageId, "draft-package-1");
  assert.equal(result.candidateId, "candidate-1");
  assert.equal(result.decisionPackageId, "decision-1");
  assert.deepEqual(result.writingProvenance, {
    handoffId: "handoff-1",
    writingRequestId: "request-1",
    decisionOrigin: "relationship_manager_cycle",
    relationshipCycleId: "cycle-1",
  });
});

test("draft package from another writing request is rejected", () => {
  assert.throws(
    () => bindStaffWritingOutputForApproval({ handoff, writingEnvelope, draftPackage: packageFor("request-other") }),
    /STAFF_WRITING_OUTPUT_REQUEST_MISMATCH/,
  );
});

test("blocked or incomplete writing output cannot reach approval", () => {
  assert.throws(
    () => bindStaffWritingOutputForApproval({
      handoff,
      writingEnvelope,
      draftPackage: { ...packageFor(), status: "needs_input" as const, missingInformation: ["Current project status"] },
    }),
    /STAFF_WRITING_OUTPUT_NOT_READY:needs_input/,
  );
});

test("candidate with unresolved assumptions or warnings cannot reach approval", () => {
  const unresolved = packageFor();
  unresolved.candidates[0]!.unresolvedAssumptionIds = ["assumption-1"];
  assert.throws(
    () => bindStaffWritingOutputForApproval({ handoff, writingEnvelope, draftPackage: unresolved }),
    /STAFF_WRITING_OUTPUT_UNRESOLVED_ASSUMPTIONS/,
  );

  const warned = packageFor();
  warned.candidates[0]!.warnings = ["Unsupported claim risk"];
  assert.throws(
    () => bindStaffWritingOutputForApproval({ handoff, writingEnvelope, draftPackage: warned }),
    /STAFF_WRITING_OUTPUT_CANDIDATE_WARNINGS_REQUIRE_REVIEW/,
  );
});
