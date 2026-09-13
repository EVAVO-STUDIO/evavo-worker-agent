import assert from "node:assert/strict";
import test from "node:test";

import { buildStaffCommunicationApproval } from "../src/core/businessStaffCommunicationApprovalBuilder";
import type { BoundStaffDraftSelection } from "../src/core/businessStaffWritingOutputBinding";
import { verifyCommunicationApprovalBinding } from "../src/core/businessCommunicationSendEnvelope";

const boundDraft: BoundStaffDraftSelection = {
  contract: "business_staff_writing_output_binding_v1",
  writingProvenance: {
    handoffId: "handoff-1",
    writingRequestId: "request-1",
    decisionOrigin: "relationship_manager_cycle",
    relationshipCycleId: "cycle-1",
  },
  decisionPackageId: "decision-1",
  writingPackageId: "draft-package-1",
  writingRequestId: "request-1",
  candidateId: "candidate-1",
  subject: null,
  body: "Hi Ashley,\n\nThanks for getting in touch.\n\nKind regards,\nGreg",
  sourceRefs: ["gmail:m1", "decision:1"],
};

test("approval is built from the exact bound draft and preserves canonical subject fallback", () => {
  const result = buildStaffCommunicationApproval({
    envelopeId: "approval-1",
    approvedAt: "2026-09-04T03:00:00Z",
    expiresAt: "2026-09-04T04:00:00Z",
    approvedBy: "greg",
    senderKey: "greg",
    mailboxKey: "greg",
    sender: "greg@evavo.com.au",
    to: ["ashley@example.com"],
    threadId: "thread-1",
    replyMessageId: "m1",
    canonicalSubject: "Re: Graduate enquiry",
    boundDraft,
    evidenceIds: ["gmail:m1"],
    approvalEvidenceIds: ["operator-approval:1"],
  });

  assert.equal(result.approval.material.subject, "Re: Graduate enquiry");
  assert.equal(result.approval.material.body, boundDraft.body);
  assert.equal(result.approval.approvalBinding?.decisionPackageId, "decision-1");
  assert.deepEqual(result.approval.approvalBinding?.writingProvenance, boundDraft.writingProvenance);
  assert.equal(verifyCommunicationApprovalBinding(result.approval).ok, true);
  assert.ok(result.approval.approvalBinding?.evidenceIds.includes("decision:1"));
});

test("candidate subject wins when Writing Studio intentionally provides one", () => {
  const result = buildStaffCommunicationApproval({
    envelopeId: "approval-2",
    approvedAt: "2026-09-04T03:00:00Z",
    expiresAt: "2026-09-04T04:00:00Z",
    approvedBy: "greg",
    senderKey: "greg",
    mailboxKey: "greg",
    sender: "greg@evavo.com.au",
    to: ["ashley@example.com"],
    threadId: "thread-1",
    canonicalSubject: "Original subject",
    boundDraft: { ...boundDraft, subject: "Re: Graduate enquiry" },
    evidenceIds: ["gmail:m1"],
    approvalEvidenceIds: ["operator-approval:2"],
  });
  assert.equal(result.approval.material.subject, "Re: Graduate enquiry");
});

test("empty canonical subject is refused when the selected draft omitted a subject", () => {
  assert.throws(() => buildStaffCommunicationApproval({
    envelopeId: "approval-3",
    approvedAt: "2026-09-04T03:00:00Z",
    expiresAt: "2026-09-04T04:00:00Z",
    approvedBy: "greg",
    senderKey: "greg",
    mailboxKey: "greg",
    sender: "greg@evavo.com.au",
    to: ["ashley@example.com"],
    threadId: "thread-1",
    canonicalSubject: "   ",
    boundDraft,
    evidenceIds: ["gmail:m1"],
    approvalEvidenceIds: ["operator-approval:3"],
  }), /STAFF_COMMUNICATION_APPROVAL_SUBJECT_REQUIRED/);
});
