import assert from "node:assert/strict";
import test from "node:test";

import { prepareCanonicalCandidateCommunicationForApproval } from "../src/core/businessRelationshipManagerCanonicalCandidateApprovalRuntime";

function candidateRuntimeInput() {
  return {
    sourceHydration: {
      env: {},
      operationsRequired: false,
      operationsIdentity: null,
      careersIdentity: { workspaceId: "evavo", targetRoleKey: "graduate-designer" },
      cycle: {
        cycleId: "candidate-approval-cycle-1",
        observedAt: "2026-09-05T00:00:30.000Z",
        decisionAt: "2026-09-05T00:01:00.000Z",
        scenario: "graduate_or_candidate" as const,
        objective: "Respond accurately to the graduate enquiry.",
        gmail: {
          threadId: "candidate-approval-thread-1",
          relationshipId: "candidate-approval-relationship-1",
          personId: "candidate-approval-person-1",
          messages: [{
            id: "candidate-approval-message-1",
            threadId: "candidate-approval-thread-1",
            sentAt: "2026-09-05T00:00:00.000Z",
            from: { name: "Candidate", address: "candidate@example.com" },
            to: [{ name: "Greg", address: "greg@evavo.com.au" }],
            subject: "Graduate opportunity",
            body: "Are there any graduate roles available?",
          }],
        },
        identity: {
          contract: "business_relationship_identity_resolver_v2" as const,
          status: "verified" as const,
          selected: {
            personId: "candidate-approval-person-1",
            name: "Candidate",
            addresses: ["candidate@example.com"],
            evidence: [{ source: "gmail" as const, ref: "gmail:message:candidate-approval-message-1", confidence: 100 }],
          },
          confidence: 100,
          exactAddressMatch: true,
          reasons: ["Exact evidence-backed email match."],
          competingPersonIds: [],
        },
        channel: { currentChannel: "email" as const, canResolveInWriting: true },
        candidate: {
          relationshipId: "candidate-approval-relationship-1",
          personId: "candidate-approval-person-1",
          explicitRoleOpen: true,
          activeRecruitmentProcess: true,
          materialsSupplied: false,
          materialsActuallyReviewed: false,
          relevantSkillsEvidence: false,
          futureRelevanceEvidence: false,
          personalizedEffort: true,
          clearFitEvidence: false,
        },
        evidenceConfidence: 98,
      },
      context: {
        identitySummary: "Candidate identity verified.",
        communicationSummary: "Candidate asks about a graduate opportunity.",
        evidenceItems: [
          {
            id: "candidate-approval-identity",
            domain: "identity" as const,
            summary: "Exact candidate identity verified.",
            status: "current" as const,
            authority: "authoritative" as const,
            observedAt: "2026-09-05T00:00:30.000Z",
            sourceRefs: ["gmail:message:candidate-approval-message-1"],
          },
          {
            id: "candidate-approval-gmail",
            domain: "gmail" as const,
            summary: "Current Gmail thread read.",
            status: "current" as const,
            authority: "canonical" as const,
            observedAt: "2026-09-05T00:00:30.000Z",
            sourceRefs: ["gmail:thread:candidate-approval-thread-1"],
          },
        ],
      },
    },
    candidate: {
      sincereIndividualEnquiry: true,
      asksForJobOrInternship: true,
      asksForMeeting: true,
      relevantRoleConfirmed: true,
    },
  };
}

test("specialized candidate approval rehydrates sources and blocks before approval when careers or Brain are unavailable", async () => {
  await assert.rejects(
    () => prepareCanonicalCandidateCommunicationForApproval({
      candidateRuntimeInput: candidateRuntimeInput(),
      approval: {} as never,
    }),
    /CANDIDATE_APPROVAL_NOT_READY/,
  );
});

test("specialized candidate approval does not accept a caller-supplied candidate result surface", async () => {
  await assert.rejects(
    () => prepareCanonicalCandidateCommunicationForApproval({
      candidateRuntimeInput: candidateRuntimeInput(),
      approval: {} as never,
      candidateResult: { approvalGradeReady: true },
    } as never),
    /CANDIDATE_APPROVAL_NOT_READY/,
  );
});
