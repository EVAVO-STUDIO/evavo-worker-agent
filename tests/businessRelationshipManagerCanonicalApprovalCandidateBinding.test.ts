import assert from "node:assert/strict";
import test from "node:test";

import { prepareCanonicalRelationshipManagerCommunicationForApproval } from "../src/core/businessRelationshipManagerCanonicalApprovalRuntime";

function candidateCanonicalCycle() {
  return {
    contract: "business_relationship_manager_canonical_runtime_v2",
    approvalGradeReady: true,
    decisionContext: {
      approvalGradeReady: true,
      relationshipId: "relationship-candidate-binding-1",
      evidenceRefs: [`operations:careers-snapshot:${"d".repeat(64)}`],
      staffBrief: { relationshipId: "relationship-candidate-binding-1" },
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

test("generic canonical approval refuses every candidate cycle and requires the specialized runtime", () => {
  assert.throws(
    () => prepareCanonicalRelationshipManagerCommunicationForApproval({
      canonicalCycle: candidateCanonicalCycle(),
    } as any),
    /CANDIDATE_SPECIALIZED_RUNTIME_REQUIRED/,
  );
});

test("legacy caller-injected candidate policy fields cannot reopen the generic candidate approval path", () => {
  assert.throws(
    () => prepareCanonicalRelationshipManagerCommunicationForApproval({
      canonicalCycle: candidateCanonicalCycle(),
      candidatePolicyBinding: {
        contract: "business_candidate_policy_approval_binding_v1",
        careersDisposition: "reply",
        careersEvidenceRef: `operations:careers-snapshot:${"d".repeat(64)}`,
        maySayRoleExists: true,
      },
    } as any),
    /CANDIDATE_SPECIALIZED_RUNTIME_REQUIRED/,
  );
});
