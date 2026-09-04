import assert from "node:assert/strict";
import test from "node:test";

import { buildStaffCommunicationWritingHandoff } from "../src/core/businessStaffCommunicationWritingHandoff";

const relationshipContext = {
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
    obligationsToRespect: [],
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

const decision = {
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
  evidenceIds: ["email-thread", "email-identity"],
  evidenceConfidence: 95,
  approvalGradeReady: true,
  nextContextSources: [],
  staffPriorities: ["Answer directly."],
  mustVerify: [],
  mustNotAssume: ["Do not assume a role exists."],
  reasons: ["A normal email reply is appropriate."],
};

const evidenceBundle = {
  contract: "business_communication_evidence_bundle_v2" as const,
  relationshipId: "rel-ashley",
  organizationId: null,
  personId: "person-ashley",
  threadId: "thread-ashley",
  assembledAt: "2026-09-04T02:49:00.000Z",
  items: [
    {
      id: "email-thread",
      source: "gmail" as const,
      sourceRef: "gmail:thread:thread-ashley",
      kind: "thread",
      summary: "Ashley sent a sincere graduate enquiry.",
      observedAt: "2026-09-04T02:45:00.000Z",
      confidence: 98,
      authoritativeFor: ["thread"],
      approvedForWriting: true,
      conflicting: false,
      classification: "internal" as const,
    },
    {
      id: "email-identity",
      source: "gmail" as const,
      sourceRef: "gmail:message:m1",
      kind: "identity",
      summary: "Exact Ashley sender address verified.",
      observedAt: "2026-09-04T02:45:00.000Z",
      confidence: 99,
      authoritativeFor: ["identity"],
      approvedForWriting: true,
      conflicting: false,
      classification: "internal" as const,
    },
  ],
  coverage: { thread: true, identity: true, calendar: false, project: false, commercial: false, support: false, documents: false },
  writingEvidence: { approvedNonConflictingCount: 2, conflictingCount: 0, unapprovedCount: 0 },
  missingCriticalContext: [],
};

const replyBrief = {
  contract: "business_communication_reply_brief_v1" as const,
  threadId: "thread-ashley",
  shouldDraft: true,
  objective: "Respond usefully and proportionately.",
  openingApproach: "Start directly and naturally.",
  responsePoints: ["Answer the graduate enquiry directly."],
  commitmentsToAvoid: ["Do not promise a role or interview."],
  factsToVerify: [],
  attachmentChecks: [],
  toneRules: ["Kind, natural and concise."],
  closingApproach: "Close simply without creating an unnecessary meeting.",
  targetLength: "short" as const,
  escalationReason: null,
};

test("builds v1 and v2 Writing Studio handoffs in one canonical step", () => {
  const result = buildStaffCommunicationWritingHandoff({
    handoffId: "handoff-ashley",
    createdAt: "2026-09-04T02:50:00.000Z",
    communicationKind: "reply",
    participants: [
      { label: "Ashley", role: "sender", relationship: "candidate", identityVerified: true, addressVerified: true, address: "ashley@example.com" },
      { label: "Ashley", role: "to", relationship: "candidate", identityVerified: true, addressVerified: true, address: "ashley@example.com" },
    ],
    threadSummary: "Ashley sent a sincere graduate enquiry.",
    relationshipSummary: "New enquiry; no current role is established by this evidence.",
    relationshipId: "rel-ashley",
    personId: "person-ashley",
    threadId: "thread-ashley",
    communicationDecision: decision,
    relationshipContext,
    evidenceBundle,
    replyBrief,
  });
  assert.equal(result.readyForWritingStudio, true);
  assert.equal(result.v1.protocol, "evavo-staff-communication-handoff-v1");
  assert.equal(result.v2.protocol, "evavo-staff-communication-handoff-v2");
  assert.equal(result.v2.staffContext.relationshipId, "rel-ashley");
  assert.ok(result.v1.evidence.every((item) => item.approvedForWriting));
});

test("refuses writing when evidence exists but was not explicitly approved for prose", () => {
  const unsafeBundle = {
    ...evidenceBundle,
    items: evidenceBundle.items.map((item) => ({ ...item, approvedForWriting: false })),
    writingEvidence: { approvedNonConflictingCount: 0, conflictingCount: 0, unapprovedCount: 2 },
  };
  assert.throws(
    () => buildStaffCommunicationWritingHandoff({
      handoffId: "handoff-unsafe",
      createdAt: "2026-09-04T02:50:00.000Z",
      communicationKind: "reply",
      participants: [{ label: "Ashley", role: "to", relationship: "candidate", identityVerified: true, addressVerified: true, address: "ashley@example.com" }],
      threadSummary: "Graduate enquiry.",
      relationshipId: "rel-ashley",
      communicationDecision: decision,
      relationshipContext,
      evidenceBundle: unsafeBundle,
      replyBrief,
    }),
    /APPROVED_EVIDENCE_REQUIRED/,
  );
});
