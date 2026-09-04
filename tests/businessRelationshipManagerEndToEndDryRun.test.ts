import assert from "node:assert/strict";
import test from "node:test";

import { DESIRED_EVAVO_MAILBOXES } from "../src/core/businessMailboxRegistry";
import { buildCommunicationDecisionPackage } from "../src/core/businessCommunicationDecisionPackage";
import { assertAuthorizedCommunicationExecutionRequest } from "../src/core/businessCommunicationExecutionRequest";
import { reconcileAuthorizedCommunicationExecution } from "../src/core/businessCommunicationExecutionReceipt";
import { buildCommunicationLifecycleReceipt } from "../src/core/businessCommunicationLifecycleReceipt";
import { createCommunicationSendEnvelope } from "../src/core/businessCommunicationSendEnvelope";
import { projectGmailThreadToCanonicalRelationshipState } from "../src/core/businessGmailRelationshipStateProjection";
import {
  evaluateCommunicationScenario,
  type CommunicationScenarioDefinition,
} from "../src/core/businessCommunicationScenarioHarness";

const scenario: CommunicationScenarioDefinition = {
  id: "client-delivery-status-dry-run",
  description: "Existing client asks for current delivery status and receives a verified asynchronous reply.",
  expectation: {
    disposition: "reply",
    channel: "email",
    meetingJustified: false,
    mustAnswer: ["delivery status"],
    requiredFailureModesAbsent: ["wrong_recipient", "missed_question", "unsupported_claim", "approval_drift", "unnecessary_meeting"],
  },
};

test("synthetic Gmail thread reaches verified sent lifecycle without performing an external send", () => {
  const gmail = projectGmailThreadToCanonicalRelationshipState({
    threadId: "gmail-thread-dry-run",
    messages: [{
      id: "gmail-message-inbound-1",
      threadId: "gmail-thread-dry-run",
      sentAt: "2026-09-04T00:30:00Z",
      from: { name: "Client", address: "client@example.com" },
      to: [{ name: "Greg", address: "greg@evavo.com.au" }],
      subject: "Delivery status",
      body: "Could you please confirm the current delivery status?",
    }],
    relationshipId: "relationship-client-dry-run",
    personId: "person-client-dry-run",
    projectId: "project-dry-run",
    observedAt: "2026-09-04T00:31:00Z",
  });

  const decision = buildCommunicationDecisionPackage({
    packageId: "decision-dry-run-1",
    scenario: "general",
    objective: "Answer the client's current delivery-status question using verified project evidence.",
    thread: {
      threadId: gmail.threadId,
      previousState: [],
      latestObservedState: gmail.latestObservedThreadState,
    },
    obligations: gmail.obligations,
    channel: { currentChannel: "email", canResolveInWriting: true },
    evidenceIds: [...gmail.sourceEvidenceIds, "operations:project-dry-run:status"],
    evidenceConfidence: 96,
    decisionAt: "2026-09-04T00:32:00Z",
  });

  const scenarioResult = evaluateCommunicationScenario(scenario, {
    disposition: decision.disposition,
    channel: decision.recommendedChannel,
    meetingJustified: decision.meetingJustified,
    responseTargets: decision.liveResponseTargets,
    prohibitedImplications: decision.prohibitedImplications,
    blockers: [],
    warnings: [],
    detectedFailureModes: [],
  });
  assert.equal(scenarioResult.passed, true);

  const material = {
    sender: "greg@evavo.com.au",
    to: ["client@example.com"],
    cc: [],
    bcc: [],
    threadId: gmail.threadId,
    replyMessageId: "gmail-message-inbound-1",
    subject: "Re: Delivery status",
    body: "Hi,\n\nThe delivery is currently awaiting your review.\n\nKind regards,\nGreg",
    attachments: [],
  } as const;

  const approval = createCommunicationSendEnvelope({
    envelopeId: "approval-dry-run-1",
    approvedAt: "2026-09-04T00:35:00Z",
    expiresAt: "2026-09-04T01:35:00Z",
    approvedBy: "operator-dry-run",
    material,
    senderKey: "greg",
    mailboxKey: "greg",
    decisionPackageId: decision.packageId,
    evidenceIds: decision.evidenceIds,
    approvalEvidenceIds: ["operator-approval:dry-run-1"],
  });

  const executionRequest = assertAuthorizedCommunicationExecutionRequest({
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
    material,
    approval,
    decisionPackage: decision,
    review: {
      expectedRecipientAddresses: ["client@example.com"],
      prohibitedClaims: [],
      requiredPoints: ["awaiting your review"],
      referencedAttachmentNames: [],
      suppressionActive: false,
    },
    runtimeSendingEnabled: true,
    now: new Date("2026-09-04T00:36:00Z"),
  });

  // Synthetic provider observation only. No Gmail connector/send API is invoked by this test.
  const executionReceipt = reconcileAuthorizedCommunicationExecution({
    request: executionRequest,
    observed: {
      providerMessageId: "gmail-message-synthetic-sent-1",
      providerThreadId: gmail.threadId,
      sentAt: "2026-09-04T00:36:01Z",
      sender: executionRequest.sender,
      to: executionRequest.to,
      cc: executionRequest.cc,
      bcc: executionRequest.bcc,
      sourceEvidenceRefs: ["gmail:message:gmail-message-synthetic-sent-1"],
    },
  });

  const lifecycle = buildCommunicationLifecycleReceipt({
    lifecycleId: "lifecycle-dry-run-1",
    relationshipId: "relationship-client-dry-run",
    threadId: gmail.threadId,
    decision: {
      packageId: decision.packageId,
      decisionAt: decision.decisionAt,
      disposition: decision.disposition,
      evidenceIds: decision.evidenceIds,
    },
    approval: {
      envelopeId: approval.envelopeId,
      approvedAt: approval.approvedAt,
      materialSha256: approval.materialSha256,
      approvalBindingSha256: approval.approvalBinding!.bindingSha256,
      decisionPackageId: approval.approvalBinding!.decisionPackageId,
      approvalEvidenceIds: approval.approvalBinding!.approvalEvidenceIds,
    },
    execution: {
      provider: executionReceipt.provider,
      providerMessageId: executionReceipt.providerMessageId,
      providerThreadId: executionReceipt.providerThreadId,
      requestId: executionReceipt.requestId,
      sentAt: executionReceipt.sentAt,
      sender: executionRequest.sender,
      recipientAddresses: executionRequest.to,
      sourceEvidenceRefs: executionReceipt.sourceEvidenceRefs,
      materialSha256: executionReceipt.authorization.materialSha256,
      approvalBindingSha256: executionReceipt.authorization.approvalBindingSha256,
      decisionPackageId: executionReceipt.authorization.decisionPackageId,
    },
  });

  assert.equal(lifecycle.stage, "sent");
  assert.equal(lifecycle.executionVerified, true);
  assert.equal(lifecycle.communicationId, "gmail-message-synthetic-sent-1");
  assert.equal(lifecycle.blockers.length, 0);
});
