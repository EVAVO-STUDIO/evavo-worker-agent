import assert from "node:assert/strict";
import test from "node:test";

import { DESIRED_EVAVO_MAILBOXES } from "../src/core/businessMailboxRegistry";
import { reconcileAuthorizedCommunicationExecution } from "../src/core/businessCommunicationExecutionReceipt";
import { buildCommunicationLifecycleReceipt } from "../src/core/businessCommunicationLifecycleReceipt";
import type { OperatorCommunicationApprovalReceipt } from "../src/core/businessCommunicationOperatorApproval";
import {
  bindRelationshipManagerApprovalCandidatePersistence,
  finalizeRelationshipManagerCommunicationApproval,
  prepareRelationshipManagerCommunicationForApproval,
} from "../src/core/businessRelationshipManagerApprovalRuntime";
import { authorizeRelationshipManagerCommunicationExecution } from "../src/core/businessRelationshipManagerExecutionRuntime";
import { persistRelationshipManagerCycleMemory } from "../src/core/businessRelationshipManagerMemoryPersistence";
import { runRelationshipManagerCommunicationCycle } from "../src/core/businessRelationshipManagerRuntime";
import {
  buildStaffApprovalCandidateWriteRequest,
  reconcileStaffApprovalCandidateWriteReceipt,
} from "../src/core/businessStaffCommunicationApprovalCandidatePersistence";
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

test("synthetic Gmail thread reaches verified sent lifecycle through durable governed approval without performing an external send", async () => {
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
  assert.equal(cycle.projection.relationshipId, "relationship-client-dry-run");

  assert.equal(evaluateCommunicationScenario(scenario, {
    disposition: decision.disposition,
    channel: decision.recommendedChannel,
    meetingJustified: decision.meetingJustified,
    responseTargets: decision.liveResponseTargets,
    prohibitedImplications: decision.prohibitedImplications,
    blockers: [], warnings: [], detectedFailureModes: [],
  }).passed, true);

  const memoryPersistence = await persistRelationshipManagerCycleMemory({
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
  assert.equal(memoryPersistence.durable, true);

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
  const draftPackage = {
    schema: "evavo-writing/draft-package" as const,
    version: 1 as const,
    requestId: writingEnvelope.writingRequest.requestId,
    packageId: "writing-package-dry-run-1",
    status: "ready" as const,
    recommendedCandidateId: "draft-dry-run-1",
    candidates: [
      { id: "draft-dry-run-1", body: "Hi,\n\nThe delivery is currently awaiting your review.\n\nKind regards,\nGreg", warnings: [], unresolvedAssumptionIds: [] },
      { id: "draft-dry-run-2", body: "Hi,\n\nThanks for checking in. The delivery is awaiting your review.\n\nKind regards,\nGreg", warnings: [], unresolvedAssumptionIds: [] },
    ],
    missingInformation: [],
    warnings: [],
  };

  const unpersistedPreparation = prepareRelationshipManagerCommunicationForApproval({
    candidateId: "approval-candidate-dry-run-1",
    createdAt: "2026-09-04T00:34:00Z",
    cycle,
    memoryPersistence,
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
  assert.equal(unpersistedPreparation.readyForCandidatePersistence, true);
  assert.equal(unpersistedPreparation.readyForHumanApproval, false);

  const candidateWriteRequest = buildStaffApprovalCandidateWriteRequest(unpersistedPreparation.approvalCandidate);
  const candidateDocumentId = "doc_approval_candidate_dry_run_1";
  const candidateVersionId = "ver_approval_candidate_dry_run_1";
  const candidateRecordId = `${candidateDocumentId}:${candidateVersionId}`;
  const candidatePersistence = reconcileStaffApprovalCandidateWriteReceipt({
    candidate: unpersistedPreparation.approvalCandidate,
    request: candidateWriteRequest,
    receipt: {
      protocol: "evavo-approval-candidate-write-receipt-v1",
      version: 1,
      requestId: candidateWriteRequest.requestId,
      idempotencyKey: candidateWriteRequest.idempotencyKey,
      candidateId: candidateWriteRequest.candidateId,
      candidateSha256: candidateWriteRequest.candidateSha256,
      status: "appended",
      durable: true,
      recordId: candidateRecordId,
      journalPosition: "receipt_approval_candidate_dry_run_1",
      recordedAt: "2026-09-04T00:34:10Z",
      storageAuthority: { system: "evavo-storage", instanceId: "local-primary" },
      storage: {
        model: "immutable_document_version",
        vaultId: "internal",
        logicalPath: `RelationshipManager/ApprovalCandidates/${candidateWriteRequest.candidateId}/${candidateWriteRequest.candidateSha256}.json`,
        documentId: candidateDocumentId,
        versionId: candidateVersionId,
        sha256: candidateWriteRequest.candidateSha256,
        sizeBytes: 4096,
        idempotentReplay: false,
        receiptId: "receipt_approval_candidate_dry_run_1",
      },
    },
  });
  const preparation = bindRelationshipManagerApprovalCandidatePersistence({
    preparation: unpersistedPreparation,
    persistence: candidatePersistence,
  });
  assert.equal(preparation.readyForHumanApproval, true);
  assert.ok(preparation.candidatePersistence.approvalEvidenceRef);

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
    evidenceRefs: [preparation.candidatePersistence.approvalEvidenceRef!],
    sourceSystem: "operator_approval",
  };
  const finalization = finalizeRelationshipManagerCommunicationApproval({
    envelopeId: "approval-dry-run-1",
    preparation,
    operatorApprovalReceipt: operatorApproval,
  });
  assert.equal(finalization.humanApprovalRecorded, true);
  assert.equal(finalization.externalExecutionAllowed, false);
  assert.equal(finalization.approvalCandidateRecordId, candidateRecordId);

  const executionAuthorization = authorizeRelationshipManagerCommunicationExecution({
    cycle,
    memoryPersistence,
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
  assert.equal(executionRequest.authorization.writingProvenance?.writingRequestId, writingEnvelope.writingRequest.requestId);
  assert.equal(executionRequest.authorization.approvalCandidate?.recordId, finalization.approvalCandidateRecordId);
  assert.equal(executionRequest.authorization.approvalCandidate?.candidateSha256, finalization.approvalCandidateSha256);

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

  const approval = finalization.approval;
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
      writingProvenance: approval.approvalBinding!.writingProvenance,
      approvalCandidate: executionRequest.authorization.approvalCandidate ?? undefined,
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
      writingProvenance: executionReceipt.authorization.writingProvenance ?? undefined,
      approvalCandidate: executionReceipt.authorization.approvalCandidate ?? undefined,
      memoryCheckpointCycleId: executionReceipt.authorization.memoryCheckpoint?.cycleId ?? null,
      memoryCheckpointRecordIds: executionReceipt.authorization.memoryCheckpoint?.recordIds ?? [],
    },
  });

  assert.equal(lifecycle.contract, "business_communication_lifecycle_receipt_v4");
  assert.equal(lifecycle.stage, "sent");
  assert.equal(lifecycle.executionVerified, true);
  assert.equal(lifecycle.approval?.approvalCandidate?.recordId, finalization.approvalCandidateRecordId);
  assert.equal(lifecycle.execution?.approvalCandidate?.candidateSha256, finalization.approvalCandidateSha256);
  assert.equal(lifecycle.communicationId, "gmail-message-synthetic-sent-1");
  assert.equal(lifecycle.blockers.length, 0);
});
