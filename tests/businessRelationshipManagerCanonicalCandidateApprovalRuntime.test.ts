import assert from "node:assert/strict";
import test from "node:test";

import { prepareCanonicalCandidateCommunicationForApproval } from "../src/core/businessRelationshipManagerCanonicalCandidateApprovalRuntime";

function input(overrides: Record<string, unknown> = {}) {
  const careersRef = `operations:careers-snapshot:${"c".repeat(64)}`;
  const candidateResult = {
    contract: "business_relationship_manager_canonical_candidate_runtime_v1",
    approvalGradeReady: true,
    careersDecision: {
      contract: "business_careers_relationship_policy_v3",
      disposition: "reply",
      meetingRecommended: false,
      principles: [],
      mustCommunicate: [],
      mustNotCommunicate: [],
      suggestedNextStep: "email_reply",
    },
    sources: {
      cycle: {
        careersState: "not_found",
        careersEvidenceRef: careersRef,
        roleTruth: {
          contract: "business_role_opening_truth_v2",
          status: "no_confirmed_open_role",
          maySayRoleExists: false,
          maySayNotHiring: false,
          safeExternalWording: "I don't have a confirmed current opening I can accurately point you to.",
          evidenceIds: [],
          reasons: ["No authoritative careers evidence confirms a current opening."],
        },
        canonical: {
          brain: {
            canonicalCycle: {
              contract: "business_relationship_manager_canonical_runtime_v2",
              decisionContext: {
                evidenceRefs: [careersRef],
              },
              cycle: {
                cycleId: "candidate-approval-cycle-1",
              },
            },
          },
        },
      },
    },
    externalEffectPerformed: false,
    ...overrides,
  };
  return { candidateResult } as unknown as Parameters<typeof prepareCanonicalCandidateCommunicationForApproval>[0];
}

test("candidate policy not-ready state blocks before generic approval preparation", () => {
  assert.throws(
    () => prepareCanonicalCandidateCommunicationForApproval(input({ approvalGradeReady: false })),
    /CANDIDATE_APPROVAL_NOT_READY/,
  );
});

test("candidate policy defer blocks approval even if a canonical cycle object exists", () => {
  const value = input();
  const candidate = value.candidateResult as any;
  assert.throws(
    () => prepareCanonicalCandidateCommunicationForApproval(input({
      careersDecision: { ...candidate.careersDecision, disposition: "defer" },
    })),
    /CANDIDATE_APPROVAL_POLICY_NOT_REPLY/,
  );
});

test("unavailable careers truth cannot enter candidate approval", () => {
  assert.throws(
    () => prepareCanonicalCandidateCommunicationForApproval(input({
      sources: {
        cycle: {
          ...(input().candidateResult as any).sources.cycle,
          careersState: "provider_unavailable",
        },
      },
    })),
    /CANDIDATE_APPROVAL_CAREERS_UNAVAILABLE/,
  );
});

test("candidate approval requires the exact careers evidence receipt", () => {
  assert.throws(
    () => prepareCanonicalCandidateCommunicationForApproval(input({
      sources: {
        cycle: {
          ...(input().candidateResult as any).sources.cycle,
          careersEvidenceRef: null,
        },
      },
    })),
    /CANDIDATE_APPROVAL_CAREERS_EVIDENCE_REQUIRED/,
  );
});

test("candidate approval rejects a careers receipt not bound into Decision Context", () => {
  const base = (input().candidateResult as any);
  assert.throws(
    () => prepareCanonicalCandidateCommunicationForApproval(input({
      sources: {
        cycle: {
          ...base.sources.cycle,
          canonical: {
            brain: {
              canonicalCycle: {
                ...base.sources.cycle.canonical.brain.canonicalCycle,
                decisionContext: { evidenceRefs: [] },
              },
            },
          },
        },
      },
    })),
    /CANDIDATE_APPROVAL_CAREERS_EVIDENCE_NOT_BOUND/,
  );
});

test("candidate approval cannot refer or recommend a meeting without verified role truth", () => {
  const base = (input().candidateResult as any);
  assert.throws(
    () => prepareCanonicalCandidateCommunicationForApproval(input({
      careersDecision: { ...base.careersDecision, suggestedNextStep: "refer_to_role" },
    })),
    /CANDIDATE_APPROVAL_REFERRAL_WITHOUT_ROLE_TRUTH/,
  );
  assert.throws(
    () => prepareCanonicalCandidateCommunicationForApproval(input({
      careersDecision: { ...base.careersDecision, meetingRecommended: true },
    })),
    /CANDIDATE_APPROVAL_MEETING_WITHOUT_ROLE_TRUTH/,
  );
});
