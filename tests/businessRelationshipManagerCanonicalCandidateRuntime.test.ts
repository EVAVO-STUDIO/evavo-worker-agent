import assert from "node:assert/strict";
import test from "node:test";

import { runCanonicalRelationshipManagerCandidateResponse } from "../src/core/businessRelationshipManagerCanonicalCandidateRuntime";

function sourceHydration() {
  return {
    env: {},
    operationsRequired: false,
    operationsIdentity: null,
    careersIdentity: { workspaceId: "evavo", targetRoleKey: "graduate-designer" },
    cycle: {
      cycleId: "candidate-cycle-1",
      observedAt: "2026-09-05T00:00:30.000Z",
      decisionAt: "2026-09-05T00:01:00.000Z",
      scenario: "graduate_or_candidate" as const,
      objective: "Respond accurately to a graduate enquiry.",
      gmail: {
        threadId: "candidate-thread-1",
        relationshipId: "candidate-relationship-1",
        personId: "candidate-person-1",
        messages: [{
          id: "candidate-message-1",
          threadId: "candidate-thread-1",
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
          personId: "candidate-person-1",
          name: "Candidate",
          addresses: ["candidate@example.com"],
          evidence: [{ source: "gmail" as const, ref: "gmail:message:candidate-message-1", confidence: 100 }],
        },
        confidence: 100,
        exactAddressMatch: true,
        reasons: ["Exact evidence-backed email match."],
        competingPersonIds: [],
      },
      channel: { currentChannel: "email" as const, canResolveInWriting: true },
      candidate: {
        relationshipId: "candidate-relationship-1",
        personId: "candidate-person-1",
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
          id: "candidate-identity",
          domain: "identity" as const,
          summary: "Exact candidate identity verified.",
          status: "current" as const,
          authority: "authoritative" as const,
          observedAt: "2026-09-05T00:00:30.000Z",
          sourceRefs: ["gmail:message:candidate-message-1"],
        },
        {
          id: "candidate-gmail",
          domain: "gmail" as const,
          summary: "Current Gmail thread read.",
          status: "current" as const,
          authority: "canonical" as const,
          observedAt: "2026-09-05T00:00:30.000Z",
          sourceRefs: ["gmail:thread:candidate-thread-1"],
        },
      ],
    },
  };
}

test("caller role and recruitment flags cannot bypass unavailable canonical careers truth", async () => {
  const result = await runCanonicalRelationshipManagerCandidateResponse({
    sourceHydration: sourceHydration(),
    candidate: {
      sincereIndividualEnquiry: true,
      asksForJobOrInternship: true,
      asksForMeeting: true,
    },
  });

  assert.equal(result.contract, "business_relationship_manager_canonical_candidate_runtime_v5");
  assert.equal(result.callerOpportunityAuthoritySuppressed, true);
  assert.equal(result.careersRoleAuthorityDerived, true);
  assert.equal(result.referralPathDerivedFromCareers, false);
  assert.notEqual(result.sources.cycle.canonical.brain.canonicalCycle.cycle.decision.candidateStage, "active_process");
  assert.equal(result.sources.cycle.careersState, "provider_unavailable");
  assert.equal(result.sources.cycle.roleTruth, null);
  assert.equal(result.careersDecision.disposition, "defer");
  assert.equal(result.careersDecision.meetingRecommended, false);
  assert.equal(result.careersDecision.suggestedNextStep, "request_missing_context");
  assert.equal(result.approvalGradeReady, false);
  assert.equal(result.externalEffectPerformed, false);
});

test("candidate runtime requires the graduate_or_candidate scenario", async () => {
  const source = sourceHydration();
  await assert.rejects(
    () => runCanonicalRelationshipManagerCandidateResponse({
      sourceHydration: {
        ...source,
        cycle: { ...source.cycle, scenario: "general" as const },
      },
      candidate: { sincereIndividualEnquiry: true },
    }),
    /CANDIDATE_SCENARIO_REQUIRED/,
  );
});

test("candidate runtime requires exact careers lookup identity", async () => {
  const source = sourceHydration();
  await assert.rejects(
    () => runCanonicalRelationshipManagerCandidateResponse({
      sourceHydration: { ...source, careersIdentity: null },
      candidate: { sincereIndividualEnquiry: true },
    }),
    /CANDIDATE_CAREERS_IDENTITY_REQUIRED/,
  );
});

test("suppression never turns missing source truth into outreach", async () => {
  const result = await runCanonicalRelationshipManagerCandidateResponse({
    sourceHydration: sourceHydration(),
    candidate: {
      sincereIndividualEnquiry: true,
      asksForJobOrInternship: true,
      suppressionActive: true,
    },
  });
  assert.equal(result.careersDecision.disposition, "do_not_reply");
  assert.equal(result.approvalGradeReady, false);
});
