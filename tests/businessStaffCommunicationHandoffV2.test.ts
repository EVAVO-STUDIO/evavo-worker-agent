import assert from "node:assert/strict";
import test from "node:test";

import { buildStaffCommunicationHandoffV2 } from "../src/core/businessStaffCommunicationHandoffV2";

function readyContext() {
  return {
    contract: "business_relationship_decision_context_v1" as const,
    relationshipId: "rel-ashley",
    generatedAt: "2026-09-04T02:50:00.000Z",
    context360: {} as never,
    freshness: {} as never,
    changes: null,
    staffBrief: {
      contract: "business_relationship_staff_brief_v3" as const,
      relationshipId: "rel-ashley",
      objective: "Reply respectfully.",
      situation: "Ashley sent a graduate enquiry.",
      whatChanged: "Ashley sent a new graduate enquiry.",
      materialChanges: ["communication: new graduate enquiry"],
      priorities: ["Answer the current enquiry directly."],
      mustVerify: [],
      mustNotAssume: ["Do not assume a role exists."],
      obligationsToRespect: ["Reply respectfully."],
      priorDecisionsToRespect: ["Prefer email over unnecessary meetings."],
      relationshipRisks: ["Do not create false hiring expectations."],
      staleDomains: [],
      sourceRefs: ["gmail:m1"],
      approvalGradeReady: true,
    },
    resolutionPlan: {
      contract: "business_relationship_context_resolution_plan_v1" as const,
      relationshipId: "rel-ashley",
      ready: true,
      items: [],
      orderedSources: [],
      blockingIssues: [],
    },
    approvalGradeReady: true,
    evidenceRefs: ["gmail:m1"],
  };
}

function readyDecision() {
  return {
    contract: "business_communication_decision_package_v3" as const,
    packageId: "pkg-1",
    scenario: "graduate_or_candidate" as const,
    objective: "Reply respectfully.",
    decisionAt: "2026-09-04T02:50:00.000Z",
    replayDeterministic: true,
    disposition: "reply" as const,
    recommendedChannel: "email" as const,
    meetingJustified: false,
    conductInstructions: ["Be kind and truthful."],
    liveResponseTargets: ["Respond to the graduate enquiry."],
    activeEvavoObligations: [],
    candidateStage: "new_enquiry" as const,
    prohibitedImplications: ["Do not imply a role exists."],
    evidenceIds: ["gmail:m1"],
    evidenceConfidence: 95,
    approvalGradeReady: true,
    nextContextSources: [],
    staffPriorities: ["Answer directly."],
    mustVerify: [],
    mustNotAssume: ["Do not assume a role exists."],
    reasons: ["Email resolves the matter."],
  };
}

const handoffV1 = {
  schema: "evavo-writing/staff-communication-handoff" as const,
  version: 1 as const,
  protocol: "evavo-staff-communication-handoff-v1" as const,
  relationshipId: "rel-ashley",
  handoffId: "handoff-1",
};

test("wraps a ready v1 handoff with canonical staff context", () => {
  const result = buildStaffCommunicationHandoffV2({
    handoffV1,
    relationshipContext: readyContext(),
    communicationDecision: readyDecision(),
  });
  assert.equal(result.staffContext.relationshipId, "rel-ashley");
  assert.equal(result.staffContext.approvalGradeReady, true);
  assert.ok(result.staffContext.sourceRefs.includes("gmail:m1"));
  assert.ok(result.staffContext.mustNotAssume.some((item) => /role exists/i.test(item)));
});

test("refuses a handoff when the relationship context is not ready", () => {
  const context = { ...readyContext(), approvalGradeReady: false };
  assert.throws(
    () => buildStaffCommunicationHandoffV2({ handoffV1, relationshipContext: context, communicationDecision: readyDecision() }),
    /RELATIONSHIP_CONTEXT_NOT_READY/,
  );
});

test("refuses non-draftable dispositions", () => {
  const decision = { ...readyDecision(), disposition: "escalate" as const };
  assert.throws(
    () => buildStaffCommunicationHandoffV2({ handoffV1, relationshipContext: readyContext(), communicationDecision: decision }),
    /DISPOSITION_NOT_DRAFTABLE:escalate/,
  );
});

test("refuses relationship mismatch between embedded handoff and staff context", () => {
  assert.throws(
    () => buildStaffCommunicationHandoffV2({
      handoffV1: { ...handoffV1, relationshipId: "rel-other" },
      relationshipContext: readyContext(),
      communicationDecision: readyDecision(),
    }),
    /RELATIONSHIP_MISMATCH/,
  );
});
