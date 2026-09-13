import assert from "node:assert/strict";
import test from "node:test";

import { buildCommunicationDecisionPackage } from "../src/core/businessCommunicationDecisionPackage";

const NOW = "2026-09-04T11:39:00+10:00";

test("graduate enquiry stays async and does not invent future-interest status", () => {
  const result = buildCommunicationDecisionPackage({
    packageId: "pkg-1",
    scenario: "graduate_or_candidate",
    objective: "Respond respectfully to a graduate enquiry.",
    thread: {
      threadId: "thread-ashley",
      previousState: [],
      latestObservedState: [
        { id: "req-1", kind: "request", statement: "Consider my application and portfolio.", status: "open", owner: "evavo", sourceEvidenceIds: ["email-ashley"] },
      ],
    },
    obligations: [],
    channel: {
      currentChannel: "email",
      canResolveInWriting: true,
      explicitMeetingRequest: false,
      needsRealTimeBackAndForth: false,
    },
    candidate: {
      relationshipId: "rel-ashley",
      explicitRoleOpen: false,
      activeRecruitmentProcess: false,
      materialsSupplied: true,
      materialsActuallyReviewed: false,
      relevantSkillsEvidence: false,
      futureRelevanceEvidence: false,
      personalizedEffort: true,
      clearFitEvidence: false,
    },
    evidenceIds: ["email-ashley"],
    evidenceConfidence: 95,
    decisionAt: NOW,
  });

  assert.equal(result.disposition, "reply");
  assert.equal(result.recommendedChannel, "email");
  assert.equal(result.meetingJustified, false);
  assert.equal(result.candidateStage, "new_enquiry");
  assert.equal(result.replayDeterministic, true);
  assert.ok(result.prohibitedImplications.some((item) => item.includes("role exists")));
});

test("relevant supplied materials can require review before reply", () => {
  const result = buildCommunicationDecisionPackage({
    packageId: "pkg-2",
    scenario: "graduate_or_candidate",
    objective: "Handle a potentially relevant candidate enquiry.",
    thread: {
      threadId: "thread-2",
      previousState: [],
      latestObservedState: [
        { id: "req-1", kind: "request", statement: "Please consider my portfolio.", status: "open", owner: "evavo", sourceEvidenceIds: ["email-1"] },
      ],
    },
    obligations: [],
    channel: { currentChannel: "email", canResolveInWriting: true },
    candidate: {
      relationshipId: "rel-2",
      explicitRoleOpen: false,
      activeRecruitmentProcess: false,
      materialsSupplied: true,
      materialsActuallyReviewed: false,
      relevantSkillsEvidence: true,
      futureRelevanceEvidence: true,
      personalizedEffort: true,
      clearFitEvidence: false,
    },
    evidenceIds: ["email-1", "portfolio-metadata"],
    evidenceConfidence: 90,
    decisionAt: NOW,
  });

  assert.equal(result.disposition, "review_then_reply");
  assert.equal(result.candidateStage, "review_warranted");
});

test("low evidence confidence escalates instead of bluffing", () => {
  const result = buildCommunicationDecisionPackage({
    packageId: "pkg-3",
    scenario: "general",
    objective: "Answer safely.",
    thread: {
      threadId: "thread-3",
      previousState: [],
      latestObservedState: [
        { id: "q1", kind: "question", statement: "Can you confirm the rate?", status: "open", owner: "evavo", sourceEvidenceIds: ["email-1"] },
      ],
    },
    obligations: [],
    channel: { currentChannel: "email", canResolveInWriting: true },
    evidenceIds: ["email-1"],
    evidenceConfidence: 45,
    decisionAt: NOW,
  });

  assert.equal(result.disposition, "escalate");
});

test("blocked identity or attachment evidence overrides an otherwise valid reply decision", () => {
  const result = buildCommunicationDecisionPackage({
    packageId: "pkg-4",
    scenario: "general",
    objective: "Send the requested current document.",
    thread: {
      threadId: "thread-4",
      previousState: [],
      latestObservedState: [
        { id: "doc1", kind: "document", statement: "Please send the current contractor forecast.", status: "open", owner: "evavo", sourceEvidenceIds: ["email-4"] },
      ],
    },
    obligations: [],
    channel: { currentChannel: "email", canResolveInWriting: true },
    evidenceIds: ["email-4"],
    evidenceConfidence: 96,
    decisionAt: NOW,
    evidenceReadiness: {
      contract: "business_communication_evidence_readiness_v1",
      status: "blocked",
      identityReady: true,
      artifactsReady: false,
      calendarReady: true,
      blockers: ["A required attachment/document is not resolved to one verified current artifact."],
      warnings: [],
      evidenceIds: ["gmail:email-4"],
    },
  });

  assert.equal(result.disposition, "escalate");
  assert.equal(result.evidenceReadinessStatus, "blocked");
  assert.ok(result.reasons.some((item) => /attachment/i.test(item)));
});

test("safety escalation cannot be overwritten by the general no-live-target rule", () => {
  const result = buildCommunicationDecisionPackage({
    packageId: "pkg-5",
    scenario: "general",
    objective: "Do not guess when context is blocked.",
    thread: { threadId: "thread-5", previousState: [], latestObservedState: [] },
    obligations: [],
    channel: { currentChannel: "email", canResolveInWriting: true },
    evidenceIds: ["gmail:message:5"],
    evidenceConfidence: 95,
    decisionAt: NOW,
    evidenceReadiness: {
      contract: "business_communication_evidence_readiness_v1",
      status: "blocked",
      identityReady: false,
      artifactsReady: true,
      calendarReady: true,
      blockers: ["Recipient identity is ambiguous."],
      warnings: [],
      evidenceIds: ["gmail:message:5"],
    },
  });

  assert.equal(result.disposition, "escalate");
  assert.ok(result.reasons.some((item) => /ambiguous/i.test(item)));
});
