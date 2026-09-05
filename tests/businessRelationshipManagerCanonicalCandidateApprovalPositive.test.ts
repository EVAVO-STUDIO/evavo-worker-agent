import assert from "node:assert/strict";
import test from "node:test";

import { runCanonicalRelationshipManagerCandidateResponse } from "../src/core/businessRelationshipManagerCanonicalCandidateRuntime";
import { prepareCanonicalCandidateCommunicationForApproval } from "../src/core/businessRelationshipManagerCanonicalCandidateApprovalRuntime";
import { buildStaffCommunicationHandoffV2 } from "../src/core/businessStaffCommunicationHandoffV2";

const BRAIN_TOKEN = "b".repeat(32);
const CAREERS_TOKEN = "c".repeat(32);
const CAREERS_REF = `operations:careers-snapshot:${"d".repeat(64)}`;
const BRAIN_STATE_REF = `brain:memory-context-state:${"a".repeat(64)}`;

function runtimeInput() {
  return {
    sourceHydration: {
      env: {
        BRAIN_BASE_URL: "http://brain.local",
        BRAIN_API_TOKEN: BRAIN_TOKEN,
        OPERATIONS_CORE_BASE_URL: "http://operations.local",
        OPERATIONS_CAREERS_READ_TOKEN: CAREERS_TOKEN,
      },
      operationsRequired: false,
      operationsIdentity: null,
      careersIdentity: { workspaceId: "evavo", targetRoleKey: "graduate-designer" },
      cycle: {
        cycleId: "candidate-positive-cycle-1",
        observedAt: "2026-09-05T00:00:30.000Z",
        decisionAt: "2026-09-05T00:01:00.000Z",
        scenario: "graduate_or_candidate" as const,
        objective: "Respond accurately and kindly to the graduate enquiry.",
        gmail: {
          threadId: "candidate-positive-thread-1",
          relationshipId: "candidate-positive-relationship-1",
          personId: "candidate-positive-person-1",
          messages: [{
            id: "candidate-positive-message-1",
            threadId: "candidate-positive-thread-1",
            sentAt: "2026-09-05T00:00:00.000Z",
            from: { name: "Candidate", address: "candidate@example.com" },
            to: [{ name: "Greg", address: "greg@evavo.com.au" }],
            subject: "Graduate opportunity",
            body: "Are there any graduate opportunities at EVAVO?",
          }],
        },
        identity: {
          contract: "business_relationship_identity_resolver_v2" as const,
          status: "verified" as const,
          selected: {
            personId: "candidate-positive-person-1",
            name: "Candidate",
            addresses: ["candidate@example.com"],
            evidence: [{ source: "gmail" as const, ref: "gmail:message:candidate-positive-message-1", confidence: 100 }],
          },
          confidence: 100,
          exactAddressMatch: true,
          reasons: ["Exact evidence-backed email match."],
          competingPersonIds: [],
        },
        channel: { currentChannel: "email" as const, canResolveInWriting: true },
        candidate: {
          relationshipId: "candidate-positive-relationship-1",
          personId: "candidate-positive-person-1",
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
        communicationSummary: "Candidate asks whether EVAVO has a graduate opportunity.",
        evidenceItems: [
          {
            id: "candidate-positive-identity",
            domain: "identity" as const,
            summary: "Exact candidate identity verified.",
            status: "current" as const,
            authority: "authoritative" as const,
            observedAt: "2026-09-05T00:00:30.000Z",
            sourceRefs: ["gmail:message:candidate-positive-message-1"],
          },
          {
            id: "candidate-positive-gmail",
            domain: "gmail" as const,
            summary: "Current Gmail thread read.",
            status: "current" as const,
            authority: "canonical" as const,
            observedAt: "2026-09-05T00:00:30.000Z",
            sourceRefs: ["gmail:thread:candidate-positive-thread-1"],
          },
        ],
      },
    },
    candidate: {
      sincereIndividualEnquiry: true,
      asksForJobOrInternship: true,
      asksForMeeting: true,
      portfolioOrCvProvided: false,
    },
  };
}

function mockFetch(calls: string[]) {
  let brainReads = 0;
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push(url);
    if (url === "http://brain.local/v1/tools/call") {
      brainReads += 1;
      const body = JSON.parse(String(init?.body));
      return new Response(JSON.stringify({
        name: body.name,
        ok: true,
        output: {
          protocol: "evavo-memory-fabric-v2",
          generatedAt: brainReads === 1 ? "2026-09-05T00:00:45.000Z" : "2026-09-05T00:00:55.000Z",
          asOf: "2026-09-05T00:01:00.000Z",
          stateEvidenceRef: BRAIN_STATE_REF,
          queryEvidenceRef: `brain:memory-context-query:${String(brainReads).repeat(64)}`,
          summary: "No durable EVAVO memory matched this context request.",
          records: [],
          omittedRecordCount: 0,
          restrictedRecordsExcluded: 0,
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    if (url === "http://operations.local/api/v1/internal/relationship-manager/careers-snapshot") {
      return new Response(JSON.stringify({
        ok: true,
        data: {
          contract: "evavo-relationship-manager-careers-snapshot-v1",
          state: "not_found",
          workspaceId: "evavo",
          targetRoleId: null,
          targetRoleKey: "graduate-designer",
          observedAt: "2026-09-05T00:00:50.000Z",
          evidenceRef: CAREERS_REF,
          roles: [],
          reasons: ["Dedicated careers truth was queried successfully and returned no matching role record."],
          providerReads: 1,
          providerWrites: 0,
          externalPublications: 0,
          candidateMessages: 0,
          interviewCalendarChanges: 0,
          employmentCommitments: 0,
          outsideEffects: 0,
        },
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
}

test("no confirmed opening can reach only persistence-ready candidate approval after fresh source rehydration", async () => {
  const originalFetch = globalThis.fetch;
  const calls: string[] = [];
  globalThis.fetch = mockFetch(calls) as typeof fetch;
  try {
    const input = runtimeInput();
    const first = await runCanonicalRelationshipManagerCandidateResponse(input);
    assert.equal(first.contract, "business_relationship_manager_canonical_candidate_runtime_v4");
    assert.equal(first.approvalGradeReady, true);
    assert.equal(first.careersDecision.disposition, "reply");
    assert.equal(first.careersDecision.meetingRecommended, false);
    assert.equal(first.sources.cycle.roleTruth?.status, "no_confirmed_open_role");
    assert.equal(first.sources.cycle.roleTruth?.maySayNotHiring, false);
    assert.equal(first.sources.cycle.applicationUrl, null);
    assert.equal(first.referralPathDerivedFromCareers, false);
    assert.equal(first.callerOpportunityAuthoritySuppressed, true);
    assert.equal(first.sources.cycle.canonical.brain.stateEvidenceRef, BRAIN_STATE_REF);

    const canonical = first.sources.cycle.canonical.brain.canonicalCycle;
    const handoff = buildStaffCommunicationHandoffV2({
      handoffV1: {
        schema: "evavo-writing/staff-communication-handoff",
        version: 1,
        protocol: "evavo-staff-communication-handoff-v1",
        relationshipId: canonical.decisionContext.relationshipId,
        handoffId: "candidate-positive-handoff-1",
      },
      relationshipContext: canonical.decisionContext,
      communicationDecision: canonical.cycle.decision,
    });
    const writingRequestId = "candidate-positive-writing-request-1";
    const writingEnvelope = {
      contract: "evavo-writing/staff-communication-writing-envelope-v2" as const,
      writingRequest: { requestId: writingRequestId },
      provenance: {
        relationshipId: handoff.staffContext.relationshipId,
        handoffId: String(handoff.handoff.handoffId),
        decisionPackageId: handoff.staffContext.decisionPackageId,
        decisionOrigin: handoff.staffContext.decisionOrigin,
        relationshipCycleId: handoff.staffContext.relationshipCycleId,
        staffContextGeneratedAt: handoff.staffContext.generatedAt,
        sourceRefs: handoff.staffContext.sourceRefs,
      },
    };
    const draftPackage = {
      schema: "evavo-writing/draft-package" as const,
      version: 1 as const,
      requestId: writingRequestId,
      packageId: "candidate-positive-draft-package-1",
      status: "ready" as const,
      recommendedCandidateId: "candidate-positive-draft-1",
      candidates: [{
        id: "candidate-positive-draft-1",
        body: "Hi,\n\nThanks for getting in touch. I don't have a confirmed current opening I can accurately point you to.\n\nKind regards,\nGreg",
        warnings: [],
        unresolvedAssumptionIds: [],
      }],
      missingInformation: [],
      warnings: [],
    };
    const memoryPersistence = {
      contract: "business_relationship_manager_memory_persistence_v1" as const,
      cycleId: canonical.cycle.cycleId,
      durable: true,
      materialObservations: 2,
      durableObservations: 2,
      skippedObservations: 0,
      rejectedObservations: 0,
      recordIds: ["memory:candidate-message", "memory:candidate-decision"],
      receipts: [],
      blockers: [],
      externalEffectPerformed: false as const,
    };

    const result = await prepareCanonicalCandidateCommunicationForApproval({
      candidateRuntimeInput: input,
      approval: {
        candidateId: "candidate-positive-approval-1",
        createdAt: "2026-09-05T00:03:00.000Z",
        memoryPersistence,
        handoff,
        writingEnvelope,
        draftPackage,
        senderKey: "greg",
        mailboxKey: "greg",
        sender: "greg@evavo.com.au",
        to: ["candidate@example.com"],
        threadId: canonical.cycle.projection.threadId,
        replyMessageId: "candidate-positive-message-1",
        canonicalSubject: "Re: Graduate opportunity",
      },
    });

    assert.equal(result.contract, "business_relationship_manager_canonical_candidate_approval_runtime_v5");
    assert.equal(result.candidateRuntimeContract, "business_relationship_manager_canonical_candidate_runtime_v4");
    assert.equal(result.candidatePolicyBound, true);
    assert.equal(result.freshDraftContextBound, true);
    assert.equal(result.roleTruthStatus, "no_confirmed_open_role");
    assert.equal(result.verifiedApplicationUrl, null);
    assert.match(result.candidatePolicyEvidenceRef, /^candidate-policy:[a-f0-9]{64}$/);
    assert.ok(result.preparation.approvalCandidate.evidenceIds.includes(result.candidatePolicyEvidenceRef));
    assert.equal(result.draftPolicyReview.contract, "business_candidate_draft_policy_review_v2");
    assert.equal(result.draftPolicyReview.ready, true);
    assert.deepEqual(result.draftPolicyReview.blockers, []);
    assert.equal(result.preparation.readyForCandidatePersistence, true);
    assert.equal(result.preparation.readyForHumanApproval, false);
    assert.equal(result.preparation.humanApprovalRecorded, false);
    assert.equal(result.preparation.externalExecutionAllowed, false);
    assert.equal(result.externalEffectPerformed, false);
    assert.equal(calls.filter((url) => url.includes("brain.local")).length, 2);
    assert.equal(calls.filter((url) => url.includes("careers-snapshot")).length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
