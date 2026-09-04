import assert from "node:assert/strict";
import test from "node:test";

import { parseRelationshipManagerCommunicationCycleInput } from "../src/core/businessRelationshipManagerRuntimeInput";

function base() {
  return {
    cycleId: "cycle-1",
    observedAt: "2026-09-04T01:00:30Z",
    decisionAt: "2026-09-04T01:01:00Z",
    scenario: "general",
    objective: "Answer the current question.",
    gmail: {
      threadId: "thread-1",
      relationshipId: "relationship-1",
      personId: "person-1",
      messages: [{
        id: "m1",
        threadId: "thread-1",
        sentAt: "2026-09-04T01:00:00Z",
        from: { name: "Client", address: "client@example.com" },
        to: [{ name: "Greg", address: "greg@evavo.com.au" }],
        subject: "Question",
        body: "Could you confirm the current status?",
      }],
    },
    identity: {
      status: "verified",
      selected: {
        personId: "person-1",
        name: "Client",
        addresses: ["client@example.com"],
        evidence: [{ source: "gmail", ref: "gmail:message:m1", confidence: 100 }],
      },
      confidence: 100,
      exactAddressMatch: true,
      reasons: ["Exact email address match."],
      competingPersonIds: [],
    },
    channel: { currentChannel: "email", canResolveInWriting: true },
    evidenceConfidence: 96,
    additionalEvidenceIds: ["operations:project-1:status"],
  };
}

test("accepts a bounded general communication cycle without coercing evidence fields", () => {
  const result = parseRelationshipManagerCommunicationCycleInput(base());
  assert.equal(result.scenario, "general");
  assert.equal(result.identity.exactAddressMatch, true);
  assert.equal(result.channel.currentChannel, "email");
  assert.equal(result.gmail.messages[0]?.body, "Could you confirm the current status?");
});

test("does not coerce a string into exactAddressMatch boolean", () => {
  const input = base();
  (input.identity as Record<string, unknown>).exactAddressMatch = "false";
  assert.throws(() => parseRelationshipManagerCommunicationCycleInput(input), /IDENTITY_EXACT_ADDRESS_MATCH_BOOLEAN_REQUIRED/);
});

test("rejects arbitrary channel values instead of casting them into the channel union", () => {
  const input = base();
  (input.channel as Record<string, unknown>).currentChannel = "carrier_pigeon";
  assert.throws(() => parseRelationshipManagerCommunicationCycleInput(input), /CHANNEL_CURRENT_INVALID/);
});

test("graduate or candidate scenario requires explicit candidate context", () => {
  const input = base();
  input.scenario = "graduate_or_candidate";
  assert.throws(() => parseRelationshipManagerCommunicationCycleInput(input), /CANDIDATE_REQUIRED/);
});

test("valid candidate context is parsed explicitly", () => {
  const input = {
    ...base(),
    scenario: "graduate_or_candidate",
    candidate: {
      relationshipId: "relationship-1",
      personId: "person-1",
      explicitRoleOpen: false,
      activeRecruitmentProcess: false,
      materialsSupplied: true,
      materialsActuallyReviewed: false,
      relevantSkillsEvidence: false,
      futureRelevanceEvidence: false,
      personalizedEffort: true,
      clearFitEvidence: false,
      suppressionActive: false,
    },
  };
  const result = parseRelationshipManagerCommunicationCycleInput(input);
  assert.equal(result.candidate?.personalizedEffort, true);
  assert.equal(result.candidate?.explicitRoleOpen, false);
});

test("caller cannot inject precomposed trusted context into the preview route", () => {
  for (const field of ["artifactResolutions", "calendarCommitments", "staffBrief", "contextResolutionPlan", "memoryContext"] as const) {
    const input = { ...base(), [field]: [] };
    assert.throws(() => parseRelationshipManagerCommunicationCycleInput(input), /PRECOMPOSED_TRUSTED_CONTEXT_NOT_ACCEPTED/);
  }
});
