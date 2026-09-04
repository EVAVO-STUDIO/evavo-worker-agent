import assert from "node:assert/strict";
import test from "node:test";

import { prepareCanonicalRelationshipManagerCommunicationForApproval } from "../src/core/businessRelationshipManagerCanonicalApprovalRuntime";

function candidateCanonicalCycle() {
  const careersRef = `operations:careers-snapshot:${"d".repeat(64)}`;
  return {
    contract: "business_relationship_manager_canonical_runtime_v2",
    approvalGradeReady: true,
    decisionContext: {
      approvalGradeReady: true,
      relationshipId: "relationship-candidate-binding-1",
      evidenceRefs: [careersRef],
      staffBrief: {
        relationshipId: "relationship-candidate-binding-1",
      },
      resolutionPlan: { ready: true },
      sourceReadiness: { ready: true },
    },
    cycle: {
      cycleId: "candidate-binding-cycle-1",
      projection: { relationshipId: "relationship-candidate-binding-1" },
      decision: {
        approvalGradeReady: true,
        relationshipCycleId: "candidate-binding-cycle-1",
        scenario: "graduate_or_candidate",
      },
    },
  } as any;
}

test("generic canonical approval refuses a candidate cycle without careers policy binding", () => {
  assert.throws(
    () => prepareCanonicalRelationshipManagerCommunicationForApproval({
      canonicalCycle: candidateCanonicalCycle(),
    } as any),
    /CANONICAL_APPROVAL_CANDIDATE_POLICY_BINDING_REQUIRED/,
  );
});

test("generic canonical approval rejects an unbound careers evidence token", () => {
  assert.throws(
    () => prepareCanonicalRelationshipManagerCommunicationForApproval({
      canonicalCycle: candidateCanonicalCycle(),
      candidatePolicyBinding: {
        contract: "business_candidate_policy_approval_binding_v1",
        careersEvidenceRef: `operations:careers-snapshot:${"e".repeat(64)}`,
        careersDisposition: "reply",
        roleTruthStatus: "no_confirmed_open_role",
        maySayRoleExists: false,
        meetingRecommended: false,
        suggestedNextStep: "email_reply",
      },
    } as any),
    /CANDIDATE_CAREERS_EVIDENCE_NOT_BOUND/,
  );
});

test("candidate referral or meeting authority must be backed by role truth", () => {
  const canonicalCycle = candidateCanonicalCycle();
  const careersEvidenceRef = canonicalCycle.decisionContext.evidenceRefs[0];
  for (const binding of [
    {
      contract: "business_candidate_policy_approval_binding_v1",
      careersEvidenceRef,
      careersDisposition: "reply",
      roleTruthStatus: "no_confirmed_open_role",
      maySayRoleExists: false,
      meetingRecommended: false,
      suggestedNextStep: "refer_to_role",
    },
    {
      contract: "business_candidate_policy_approval_binding_v1",
      careersEvidenceRef,
      careersDisposition: "reply",
      roleTruthStatus: "no_confirmed_open_role",
      maySayRoleExists: false,
      meetingRecommended: true,
      suggestedNextStep: "email_reply",
    },
  ]) {
    assert.throws(
      () => prepareCanonicalRelationshipManagerCommunicationForApproval({
        canonicalCycle,
        candidatePolicyBinding: binding,
      } as any),
      /CANDIDATE_ROLE_AUTHORITY_REQUIRED/,
    );
  }
});
