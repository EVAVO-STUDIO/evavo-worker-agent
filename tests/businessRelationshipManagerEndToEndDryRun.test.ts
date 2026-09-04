import assert from "node:assert/strict";
import test from "node:test";

import { DESIRED_EVAVO_MAILBOXES } from "../src/core/businessMailboxRegistry";
import { reconcileAuthorizedCommunicationExecution } from "../src/core/businessCommunicationExecutionReceipt";
import { buildCommunicationLifecycleReceipt } from "../src/core/businessCommunicationLifecycleReceipt";
import type { OperatorCommunicationApprovalReceipt } from "../src/core/businessCommunicationOperatorApproval";
import {
  finalizeRelationshipManagerCommunicationApproval,
  prepareRelationshipManagerCommunicationForApproval,
} from "../src/core/businessRelationshipManagerApprovalRuntime";
import { authorizeRelationshipManagerCommunicationExecution } from "../src/core/businessRelationshipManagerExecutionRuntime";
import { persistRelationshipManagerCycleMemory } from "../src/core/businessRelationshipManagerMemoryPersistence";
import { runRelationshipManagerCommunicationCycle } from "../src/core/businessRelationshipManagerRuntime";
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

test("synthetic Gmail thread reaches verified sent lifecycle through governed drafting, approval and durable execution without performing an external send", async () => {
  const cycle = runRelationshipManagerCommunicationCycle({
    cycleId: "dry-run-1",
    observedAt: "2026-09-04T00:31:00Z",
    decisionAt: "2026-09-04T00:32:00Z",
    scenario: "general",
    objective: "Answer the client's current delivery-status question using verified project evidence.",
    gmail: {
      threadId: "gmail-thread-dry-run",
      relationshipId: "relationship-client-dry-run",
      personId: "person-client-dry-run",
      projectId: "project-dry-run",
      messages: [{
        id: "gmail-message-inbound-1",
        threadId: "gmail-thread-dry-run",
        sentAt: "2026-09-04T00:30:00Z",
        from: { name: "Client", address: "client@example.com" },
        to: [{ name: "Greg", address: "greg@evavo.com.au" }],
        subject: "Delivery status",
        body: "Could you please confirm the current delivery status?",
      }],
    },
    identity: {
      contract: "business_relationship_identity_resolver_v1",
      status: "verified",
      selected: {
        personId: "person-client-dry-run",
        name: "Client",
        addresses: ["client@example.com"],
        evidence: [{ source: "gmail", ref: "gmail:message:gmail-message-inbound-1", confidence: 100 }],
      },
      confidence: 100,
      exactAddressMatch: true,
      reasons: ["Exact Gmail address match."],
      competingPersonIds: [],
    },
    channel: { currentChannel: "email", canResolveInWriting: true },
    evidenceConfidence: 96,
    additionalEvidenceIds: ["operations:project-dry-run:status"],
  });
  const decision = cycle.decision;
  assert.equal(decision.origin, "relationship_manager_cycle");
  assert.equal(decision.relationshipCycleId, cycle.cycleId);

  const scenarioResult = evaluateCommunicationScenario(scenario, {
    disposition: decision.disposition,
    channel: decision.recommendedChannel,
    meetingJustified: decision.meetingJustified,
    responseTargets: decision.liveResponseTargets,
    prohibitedImplications: decision.prohibitedImplications,
    blockers: [], warnings: [], detectedFailureModes: [],
  });
  assert.equal(scenarioResult.passed, true);

  const persistence = await persistRelationshipManagerCycleMemory({
    cycle,
    write: async (request) => ({
      contract: "evavo-memory-ingestion-receipt-v2",
      requestId: request.requestId,
      idempotencyKey: request.idempotencyKey,
      sourceRef: request.observation.sourceRef,
      status: "appended",
      durable: true,
      recordId: `memory:${request.requestId}`,
      reasons: [],
    }),
  });
  assert.equal(persistence.durable, true);

  const handoff = {
    schema: "evavo-writing/staff-communication-handoff-v2" as const,
    version: 2 as const,
    protocol: "evavo-staff-communication-handoff-v2" as const,
    handoff: {
      schema: "evavo-writing/staff-communication-handoff" as const,
      version: 1 as const,
      protocol: "evavo-staff-communication-handoff-v1" as const,
      relationshipId: "relationship-client-dry-run",
      handoffId: "handoff-dry-run-1",
    },
    staffContext: {
      relationshipId: "relationship-client-dry-run",
      generatedAt: "2026-09-04T00:33:00Z",
      decisionPackageId: decision.packageId,
      decisionOrigin: decision.origin,
      relationshipCycleId: cycle.cycleId,
      approvalGradeReady: true as const,
      blockingVerificationOutstanding: false as const,
      whatChanged: "The client asked for current delivery status.",
      materialChanges: ["New client delivery-status question."],
      priorities: ["Answer the current delivery-status question directly."],
      mustVerify: [],
      mustNotAssume: ["Do not invent delivery progress."],
      obligationsToRespect: [],
      priorDecisionsToRespect: ["Keep resolvable status matters asynchronous."],
      relationshipRisks: ["Do not overstate project progress."],
      staleDomains: [],
      nextContextSources: [],
      sourceRefs: [...decision.evidenceIds],
    },
  };
  const writingEnvelope = {
    contract: "evavo-writing/staff-communication-writing-envelope-v2" as const,
    writingRequest: { requestId: "writing-request-dry-run-1" },
    provenance: {
      relationshipId: handoff.staffContext.relationshipId,
      handoffId: handoff.handoff.handoffId,
      decisionPackageId: decision.packageId,
      decisionOrigin: decision.origin,
      relationshipCycleId: cycle.cycleId,
      staffContextGeneratedAt: handoff.staffContext.generatedAt,
      sourceRefs: handoff.staffContext.sourceRefs,
    },
  };
  const draftBody = "Hi,\n\nThe delivery is currently awaiting your review.\n\nKind regards,\nGreg";
  const draftPackage = {
    schema: "evavo-writing/draft-package" as const,
    version: 1 as const,
    requestId: writingEnvelope.writingRequest.requestId,
    packageId: "writing-package-dry-run-1",
    status: "ready" as const,
    recommendedCandidateId: "draft-dry-run-1",
    candidates: [
      { id: "draft-dry-run-1", body: draftBody, warnings: [], unresolvedAssumptionIds: [] },
      { id: "draft-dry-run-2", body: "Hi,\n\nThanks for checking in. The delivery is awaiting your review.\n\nKind regards,\nGreg", warnings: [], unresolvedAssumptionIds: [] },
    ],
    missingInformation: [],
    warnings: [],
  };

  const preparation = prepareRelationshipManagerCommunicationForApproval({
    candidateId: "approval-candidate-dry-run-1",
    createdAt: "2026-09-04T00:34:00Z",
    cycle,
    memoryPersistence: persistence,
    handoff,
    writingEnvelope,
    draftPackage,
    senderKey: "greg",
    mailboxKey: "greg",
    sender: "greg@evavo.com.au",
    to: ["client@example.com"],
    threadId: cycle.projection.threadId,
    replyMessageId: "gmail-message-inbound-1",
    canonicalSubject: "Re: Delivery status",
  });
  assert.equal(preparation.readyForHumanApproval, true);
  assert.equal(preparation.humanApprovalRecorded, false);
  assert.equal(preparation.externalExecutionAllowed, false);

  const operatorApproval: OperatorCommunicationApprovalReceipt = {
    contract: "business_communication_operator_approval_v1",
    approvalId: "operator-approval-dry-run-1",
    authority: "human_operator",
    approverId: "operator-dry-run",
    approvedAt: "2026-09-04T00:35:00Z",
    expiresAt: "2026-09-04T01:35:00Z",
    materialSha256: preparation.approvalCandidate.materialSha256,
    decisionPackageId: decision.packageId,
    senderKey: preparation.approvalCandidate.senderKey,
    mailboxKey: preparation.approvalCandidate.mailboxKey,
    evidenceRefs: ["operator-approval:dry-run-1"],
    sourceSystem: "operator_approval",
  };
  const finalization = finalizeRelationshipManagerCommunicationApproval({
    envelopeId: "approval-dry-run-1",
    preparation,
    operatorApprovalReceipt: operatorApproval,
  });
  const approval = finalization.approval;
  assert.equal(finalization.humanApprovalRecorded, true);
  assert.equal(finalization.externalExecutionAllowed, false);
  assert.equal(approval.approvalBinding?.writingProvenance?.writingRequestId, writingEnvelope.writingRequest.requestId);

  const executionAuthorization = authorizeRelationshipManagerCommunicationExecution({
    cycle,
    memoryPersistence: persistence,
    finalization,
    operatorApprovalReceipt: operatorApproval,
    mailbox: DESIRED_EVAVO_MAILBOXES.greg,
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
  const executionRequest = executionAuthorization.providerRequest;
  assert.ok(executionRequest);
  assert.equal(executionAuthorization.externalExecutionAllowed, true);
  assert.equal(executionAuthorization.externalEffectPerformed, false);
  assert.equal(executionRequest.authorization.relationshipCycleId, cycle.cycleId);
  assert.equal(executionRequest.authorization.memoryCheckpoint?.cycleId, cycle.cycleId);
  assert.ok((executionRequest.authorization.memoryCheckpoint?.recordIds.length ?? 0) > 0);

  // Synthetic provider observation only. No Gmail connector/send API is invoked by this test.
  const executionReceipt = reconcileAuthorizedCommunicationExecution({
    request: executionRequest,
    observed: {
      providerMessageId: "gmail-message-synthetic-sent-1",
      providerThreadId: cycle.projection.threadId,
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
    threadId: cycle.projection.threadId,
    decision: {
      packageId: decision.packageId,
      origin: decision.origin,
      relationshipCycleId: decision.relationshipCycleId,
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
      decisionOrigin: executionReceipt.authorization.decisionOrigin,
      relationshipCycleId: executionReceipt.authorization.relationshipCycleId,
      memoryCheckpointCycleId: executionReceipt.authorization.memoryCheckpoint?.cycleId ?? null,
      memoryCheckpointRecordIds: executionReceipt.authorization.memoryCheckpoint?.recordIds ?? [],
    },
  });

  assert.equal(executionRequest.authorization.operatorApprovalId, operatorApproval.approvalId);
  assert.equal(lifecycle.decision.origin, "relationship_manager_cycle");
  assert.equal(lifecycle.decision.relationshipCycleId, cycle.cycleId);
  assert.equal(lifecycle.stage, "sent");
  assert.equal(lifecycle.executionVerified, true);
  assert.equal(lifecycle.communicationId, "gmail-message-synthetic-sent-1");
  assert.equal(lifecycle.blockers.length, 0);
});
