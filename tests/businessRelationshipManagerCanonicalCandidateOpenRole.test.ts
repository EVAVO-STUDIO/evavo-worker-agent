import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { runCanonicalRelationshipManagerCandidateResponse } from "../src/core/businessRelationshipManagerCanonicalCandidateRuntime";

const originalFetch = globalThis.fetch;
const ROLE_ID = "33333333-3333-4333-8333-333333333333";
const CAREERS_REF = `operations:careers-snapshot:${"c".repeat(64)}`;
const BRAIN_STATE_REF = `brain:memory-context-state:${"a".repeat(64)}`;
const BRAIN_QUERY_REF = `brain:memory-context-query:${"b".repeat(64)}`;
const APPLICATION_URL = "https://evavo.com.au/careers/graduate-designer";

function input() {
  return {
    sourceHydration: {
      env: {
        BRAIN_BASE_URL: "http://brain.local",
        BRAIN_API_TOKEN: "b".repeat(32),
        OPERATIONS_CORE_BASE_URL: "http://operations.local",
        OPERATIONS_CAREERS_READ_TOKEN: "c".repeat(32),
      },
      operationsRequired: false,
      operationsIdentity: null,
      careersIdentity: { workspaceId: "evavo", targetRoleId: ROLE_ID },
      cycle: {
        cycleId: "candidate-open-cycle-1",
        observedAt: "2026-09-05T00:00:30.000Z",
        decisionAt: "2026-09-05T00:01:00.000Z",
        scenario: "graduate_or_candidate" as const,
        objective: "Answer whether the verified graduate role is open.",
        gmail: {
          threadId: "candidate-open-thread-1",
          relationshipId: "candidate-open-relationship-1",
          personId: "candidate-open-person-1",
          messages: [{
            id: "candidate-open-message-1",
            threadId: "candidate-open-thread-1",
            sentAt: "2026-09-05T00:00:00.000Z",
            from: { name: "Candidate", address: "candidate@example.com" },
            to: [{ name: "Greg", address: "greg@evavo.com.au" }],
            subject: "Graduate Designer role",
            body: "Is the Graduate Designer role open?",
          }],
        },
        identity: {
          contract: "business_relationship_identity_resolver_v2" as const,
          status: "verified" as const,
          selected: {
            personId: "candidate-open-person-1",
            name: "Candidate",
            addresses: ["candidate@example.com"],
            evidence: [{ source: "gmail" as const, ref: "gmail:message:candidate-open-message-1", confidence: 100 }],
          },
          confidence: 100,
          exactAddressMatch: true,
          reasons: ["Exact evidence-backed email match."],
          competingPersonIds: [],
        },
        channel: { currentChannel: "email" as const, canResolveInWriting: true },
        candidate: {
          relationshipId: "candidate-open-relationship-1",
          personId: "candidate-open-person-1",
          explicitRoleOpen: false,
          activeRecruitmentProcess: false,
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
        communicationSummary: "Candidate asks whether a named graduate role is open.",
        evidenceItems: [
          {
            id: "candidate-open-identity",
            domain: "identity" as const,
            summary: "Exact candidate identity verified.",
            status: "current" as const,
            authority: "authoritative" as const,
            observedAt: "2026-09-05T00:00:30.000Z",
            sourceRefs: ["gmail:message:candidate-open-message-1"],
          },
          {
            id: "candidate-open-gmail",
            domain: "gmail" as const,
            summary: "Current Gmail thread read.",
            status: "current" as const,
            authority: "canonical" as const,
            observedAt: "2026-09-05T00:00:30.000Z",
            sourceRefs: ["gmail:thread:candidate-open-thread-1"],
          },
        ],
      },
    },
    candidate: {
      sincereIndividualEnquiry: true,
      asksForJobOrInternship: true,
      asksForMeeting: false,
    },
  };
}

function installFetch(t: TestContext, applicationUrl: string | null) {
  t.after(() => { globalThis.fetch = originalFetch; });
  globalThis.fetch = async (url, init) => {
    const href = String(url);
    if (href.endsWith("/v1/tools/call")) {
      return new Response(JSON.stringify({
        name: "brain_memory_context_v2",
        ok: true,
        output: {
          protocol: "evavo-memory-fabric-v2",
          generatedAt: "2026-09-05T00:00:45.000Z",
          asOf: "2026-09-05T00:01:00.000Z",
          stateEvidenceRef: BRAIN_STATE_REF,
          queryEvidenceRef: BRAIN_QUERY_REF,
          summary: "No durable EVAVO memory matched this context request.",
          records: [],
          omittedRecordCount: 0,
          restrictedRecordsExcluded: 0,
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (href.endsWith("/api/v1/internal/relationship-manager/careers-snapshot")) {
      const body = JSON.parse(String(init?.body));
      assert.equal(body.targetRoleId, ROLE_ID);
      return new Response(JSON.stringify({
        ok: true,
        data: {
          contract: "evavo-relationship-manager-careers-snapshot-v1",
          state: "verified",
          workspaceId: "evavo",
          targetRoleId: ROLE_ID,
          targetRoleKey: null,
          observedAt: "2026-09-05T00:00:50.000Z",
          evidenceRef: CAREERS_REF,
          roles: [{
            id: ROLE_ID,
            roleKey: "graduate-designer",
            title: "Graduate Designer",
            state: "open",
            authoritative: true,
            employmentType: "graduate",
            locationLabel: "Melbourne / remote",
            locationMode: "hybrid",
            summary: "Current Graduate Designer opening.",
            applicationUrl,
            openedAt: "2026-09-01T00:00:00.000Z",
            closesAt: null,
            roleOwnerLabel: "EVAVO",
            reviewRequired: false,
            updatedAt: "2026-09-05T00:00:40.000Z",
            stateReason: "stored_state",
          }],
          reasons: ["Dedicated careers truth returned one matching role."],
          providerReads: 1,
          providerWrites: 0,
          externalPublications: 0,
          candidateMessages: 0,
          interviewCalendarChanges: 0,
          employmentCommitments: 0,
          outsideEffects: 0,
        },
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`unexpected fetch ${href}`);
  };
}

test("verified careers opening derives active_process, role referral and application path authority", async (t) => {
  installFetch(t, APPLICATION_URL);
  const result = await runCanonicalRelationshipManagerCandidateResponse(input());
  assert.equal(result.contract, "business_relationship_manager_canonical_candidate_runtime_v6");
  assert.equal(result.sources.cycle.contract, "business_relationship_manager_canonical_careers_context_runtime_v4");
  assert.equal(result.sources.cycle.candidateRoleAuthorityDerived, true);
  assert.equal(result.careersRoleAuthorityDerived, true);
  assert.equal(result.sources.cycle.roleTruth?.maySayRoleExists, true);
  assert.equal(result.sources.cycle.applicationUrl, APPLICATION_URL);
  assert.equal(result.referralPathDerivedFromCareers, true);
  assert.equal(result.sources.cycle.canonical.brain.stateEvidenceRef, BRAIN_STATE_REF);
  assert.equal(result.sources.cycle.canonical.brain.canonicalCycle.cycle.decision.candidateStage, "active_process");
  assert.equal(result.careersDecision.disposition, "reply");
  assert.equal(result.careersDecision.suggestedNextStep, "refer_to_role");
  assert.ok(result.careersDecision.mustCommunicate.some((item) => /application or referral path/i.test(item)));
  assert.equal(result.careersDecision.meetingRecommended, false);
  assert.equal(result.approvalGradeReady, true);
  assert.ok(result.sources.cycle.canonical.brain.canonicalCycle.cycle.decision.evidenceIds.includes(CAREERS_REF));
  assert.ok(result.sources.cycle.canonical.brain.canonicalCycle.cycle.decision.evidenceIds.includes(BRAIN_STATE_REF));
  assert.equal(result.externalEffectPerformed, false);
});

test("verified open role without a verified application path degrades to safe email reply", async (t) => {
  installFetch(t, null);
  const result = await runCanonicalRelationshipManagerCandidateResponse(input());
  assert.equal(result.sources.cycle.roleTruth?.maySayRoleExists, true);
  assert.equal(result.sources.cycle.canonical.brain.canonicalCycle.cycle.decision.candidateStage, "active_process");
  assert.equal(result.referralPathDerivedFromCareers, false);
  assert.equal(result.careersDecision.disposition, "reply");
  assert.equal(result.careersDecision.suggestedNextStep, "email_reply");
  assert.equal(result.careersDecision.meetingRecommended, false);
  assert.ok(result.careersDecision.mustCommunicate.some((item) => /do not invent or guess/i.test(item)));
  assert.equal(result.approvalGradeReady, true);
});
