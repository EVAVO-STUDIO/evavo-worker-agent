export const BUSINESS_COMMUNICATION_LIFECYCLE_RECEIPT_CONTRACT = "business_communication_lifecycle_receipt_v4" as const;

export type CommunicationLifecycleStage =
  | "decided"
  | "approved"
  | "sent"
  | "outcome_observed"
  | "learned"
  | "blocked";

type LifecycleWritingProvenance = Readonly<{
  handoffId: string;
  writingRequestId: string;
  decisionOrigin: "direct" | "relationship_manager_cycle";
  relationshipCycleId?: string;
}>;

type LifecycleApprovalCandidate = Readonly<{
  candidateId: string;
  candidateSha256: string;
  recordId: string;
  evidenceRef: string;
}>;

export type CommunicationLifecycleReceipt = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_LIFECYCLE_RECEIPT_CONTRACT;
  lifecycleId: string;
  relationshipId: string;
  threadId: string;
  communicationId: string | null;
  stage: CommunicationLifecycleStage;
  executionVerified: boolean;
  decision: Readonly<{
    packageId: string;
    origin: "direct" | "relationship_manager_cycle";
    relationshipCycleId: string | null;
    decisionAt: string;
    disposition: string;
    evidenceIds: readonly string[];
  }>;
  approval: Readonly<{
    envelopeId: string;
    approvedAt: string;
    materialSha256: string;
    approvalBindingSha256?: string;
    decisionPackageId?: string;
    approvalEvidenceIds?: readonly string[];
    writingProvenance?: LifecycleWritingProvenance;
    approvalCandidate?: LifecycleApprovalCandidate;
  }> | null;
  execution: Readonly<{
    provider: string;
    providerMessageId: string;
    providerThreadId?: string;
    requestId?: string;
    sentAt: string;
    sender: string;
    recipientAddresses: readonly string[];
    sourceEvidenceRefs?: readonly string[];
    materialSha256?: string;
    approvalBindingSha256?: string;
    decisionPackageId?: string;
    decisionOrigin?: "direct" | "relationship_manager_cycle";
    relationshipCycleId?: string | null;
    writingProvenance?: LifecycleWritingProvenance;
    approvalCandidate?: LifecycleApprovalCandidate;
    memoryCheckpointCycleId?: string | null;
    memoryCheckpointRecordIds?: readonly string[];
  }> | null;
  outcome: Readonly<{
    assessedAt: string;
    result: "positive" | "neutral" | "negative" | "pending" | "mixed";
    evidenceRefs: readonly string[];
  }> | null;
  memory: Readonly<{
    recordId: string;
    receiptStatus: "appended" | "idempotent_replay";
    storageInstanceId: string;
    recordedAt: string;
  }> | null;
  blockers: readonly string[];
}>;

function text(value: string, field: string): string {
  const clean = value.trim();
  if (!clean) throw new Error(`COMMUNICATION_LIFECYCLE_${field.toUpperCase()}_REQUIRED`);
  return clean;
}

function optionalText(value: string | null | undefined, field: string): string | undefined {
  return value === undefined || value === null ? undefined : text(value, field);
}

function iso(value: string, field: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`COMMUNICATION_LIFECYCLE_${field.toUpperCase()}_INVALID`);
  return new Date(parsed).toISOString();
}

function uniqueEvidence(values: readonly string[] | undefined): readonly string[] {
  return Object.freeze([...new Set((values ?? []).map((item) => item.trim()).filter(Boolean))]);
}

function writingProvenance(value: LifecycleWritingProvenance | undefined, prefix: string): LifecycleWritingProvenance | undefined {
  if (!value) return undefined;
  const relationshipCycleId = optionalText(value.relationshipCycleId, `${prefix}_writing_relationship_cycle_id`);
  if (value.decisionOrigin === "relationship_manager_cycle" && !relationshipCycleId) {
    throw new Error(`COMMUNICATION_LIFECYCLE_${prefix.toUpperCase()}_WRITING_RELATIONSHIP_CYCLE_REQUIRED`);
  }
  if (value.decisionOrigin === "direct" && relationshipCycleId) {
    throw new Error(`COMMUNICATION_LIFECYCLE_${prefix.toUpperCase()}_WRITING_DIRECT_CYCLE_FORBIDDEN`);
  }
  return Object.freeze({
    handoffId: text(value.handoffId, `${prefix}_writing_handoff_id`),
    writingRequestId: text(value.writingRequestId, `${prefix}_writing_request_id`),
    decisionOrigin: value.decisionOrigin,
    ...(relationshipCycleId ? { relationshipCycleId } : {}),
  });
}

function approvalCandidate(value: LifecycleApprovalCandidate | undefined, prefix: string): LifecycleApprovalCandidate | undefined {
  if (!value) return undefined;
  const candidateSha256 = text(value.candidateSha256, `${prefix}_approval_candidate_hash`).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(candidateSha256)) {
    throw new Error(`COMMUNICATION_LIFECYCLE_${prefix.toUpperCase()}_APPROVAL_CANDIDATE_HASH_INVALID`);
  }
  const evidenceRef = text(value.evidenceRef, `${prefix}_approval_candidate_evidence_ref`);
  if (!/^approval-candidate:[a-f0-9]{64}$/.test(evidenceRef)) {
    throw new Error(`COMMUNICATION_LIFECYCLE_${prefix.toUpperCase()}_APPROVAL_CANDIDATE_EVIDENCE_INVALID`);
  }
  return Object.freeze({
    candidateId: text(value.candidateId, `${prefix}_approval_candidate_id`),
    candidateSha256,
    recordId: text(value.recordId, `${prefix}_approval_candidate_record_id`),
    evidenceRef,
  });
}

function sameWritingProvenance(left: LifecycleWritingProvenance | undefined, right: LifecycleWritingProvenance | undefined): boolean {
  if (!left || !right) return false;
  return left.handoffId === right.handoffId
    && left.writingRequestId === right.writingRequestId
    && left.decisionOrigin === right.decisionOrigin
    && (left.relationshipCycleId ?? null) === (right.relationshipCycleId ?? null);
}

function sameApprovalCandidate(left: LifecycleApprovalCandidate | undefined, right: LifecycleApprovalCandidate | undefined): boolean {
  if (!left || !right) return false;
  return left.candidateId === right.candidateId
    && left.candidateSha256 === right.candidateSha256
    && left.recordId === right.recordId
    && left.evidenceRef === right.evidenceRef;
}

export function buildCommunicationLifecycleReceipt(input: Readonly<{
  lifecycleId: string;
  relationshipId: string;
  threadId: string;
  decision: Readonly<{
    packageId: string;
    origin?: "direct" | "relationship_manager_cycle";
    relationshipCycleId?: string | null;
    decisionAt: string;
    disposition: string;
    evidenceIds: readonly string[];
  }>;
  approval?: CommunicationLifecycleReceipt["approval"];
  execution?: CommunicationLifecycleReceipt["execution"];
  outcome?: CommunicationLifecycleReceipt["outcome"];
  memory?: CommunicationLifecycleReceipt["memory"];
  blockers?: readonly string[];
}>): CommunicationLifecycleReceipt {
  const blockers = [...new Set((input.blockers ?? []).map((item) => item.trim()).filter(Boolean))];
  const decisionAt = iso(input.decision.decisionAt, "decision_at");
  const decisionEvidenceIds = uniqueEvidence(input.decision.evidenceIds);
  if (!decisionEvidenceIds.length) throw new Error("COMMUNICATION_LIFECYCLE_DECISION_EVIDENCE_REQUIRED");
  const decisionOrigin = input.decision.origin ?? "direct";
  const relationshipCycleId = optionalText(input.decision.relationshipCycleId, "relationship_cycle_id") ?? null;
  if (decisionOrigin === "relationship_manager_cycle" && !relationshipCycleId) {
    throw new Error("COMMUNICATION_LIFECYCLE_RELATIONSHIP_CYCLE_ID_REQUIRED");
  }
  if (decisionOrigin === "direct" && relationshipCycleId) {
    throw new Error("COMMUNICATION_LIFECYCLE_DIRECT_DECISION_CANNOT_BIND_CYCLE");
  }

  const approval = input.approval ? Object.freeze({
    envelopeId: text(input.approval.envelopeId, "approval_envelope_id"),
    approvedAt: iso(input.approval.approvedAt, "approved_at"),
    materialSha256: text(input.approval.materialSha256, "material_hash").toLowerCase(),
    ...(optionalText(input.approval.approvalBindingSha256, "approval_binding_hash") ? { approvalBindingSha256: optionalText(input.approval.approvalBindingSha256, "approval_binding_hash")!.toLowerCase() } : {}),
    ...(optionalText(input.approval.decisionPackageId, "approval_decision_package_id") ? { decisionPackageId: optionalText(input.approval.decisionPackageId, "approval_decision_package_id") } : {}),
    ...(input.approval.approvalEvidenceIds ? { approvalEvidenceIds: uniqueEvidence(input.approval.approvalEvidenceIds) } : {}),
    ...(input.approval.writingProvenance ? { writingProvenance: writingProvenance(input.approval.writingProvenance, "approval") } : {}),
    ...(input.approval.approvalCandidate ? { approvalCandidate: approvalCandidate(input.approval.approvalCandidate, "approval") } : {}),
  }) : null;
  if (approval && approval.approvedAt < decisionAt) throw new Error("COMMUNICATION_LIFECYCLE_APPROVAL_BEFORE_DECISION");
  if (approval?.decisionPackageId && approval.decisionPackageId !== input.decision.packageId) throw new Error("COMMUNICATION_LIFECYCLE_APPROVAL_DECISION_MISMATCH");
  if (approval?.approvalCandidate && !approval.approvalEvidenceIds?.includes(approval.approvalCandidate.evidenceRef)) {
    throw new Error("COMMUNICATION_LIFECYCLE_APPROVAL_CANDIDATE_EVIDENCE_NOT_BOUND");
  }

  const execution = input.execution ? Object.freeze({
    provider: text(input.execution.provider, "execution_provider"),
    providerMessageId: text(input.execution.providerMessageId, "provider_message_id"),
    ...(optionalText(input.execution.providerThreadId, "provider_thread_id") ? { providerThreadId: optionalText(input.execution.providerThreadId, "provider_thread_id") } : {}),
    ...(optionalText(input.execution.requestId, "execution_request_id") ? { requestId: optionalText(input.execution.requestId, "execution_request_id") } : {}),
    sentAt: iso(input.execution.sentAt, "sent_at"),
    sender: text(input.execution.sender, "sender").toLowerCase(),
    recipientAddresses: Object.freeze([...new Set(input.execution.recipientAddresses.map((item) => item.trim().toLowerCase()).filter(Boolean))]),
    ...(input.execution.sourceEvidenceRefs ? { sourceEvidenceRefs: uniqueEvidence(input.execution.sourceEvidenceRefs) } : {}),
    ...(optionalText(input.execution.materialSha256, "execution_material_hash") ? { materialSha256: optionalText(input.execution.materialSha256, "execution_material_hash")!.toLowerCase() } : {}),
    ...(optionalText(input.execution.approvalBindingSha256, "execution_approval_binding_hash") ? { approvalBindingSha256: optionalText(input.execution.approvalBindingSha256, "execution_approval_binding_hash")!.toLowerCase() } : {}),
    ...(optionalText(input.execution.decisionPackageId, "execution_decision_package_id") ? { decisionPackageId: optionalText(input.execution.decisionPackageId, "execution_decision_package_id") } : {}),
    ...(input.execution.decisionOrigin ? { decisionOrigin: input.execution.decisionOrigin } : {}),
    ...(input.execution.relationshipCycleId !== undefined ? { relationshipCycleId: input.execution.relationshipCycleId } : {}),
    ...(input.execution.writingProvenance ? { writingProvenance: writingProvenance(input.execution.writingProvenance, "execution") } : {}),
    ...(input.execution.approvalCandidate ? { approvalCandidate: approvalCandidate(input.execution.approvalCandidate, "execution") } : {}),
    ...(input.execution.memoryCheckpointCycleId !== undefined ? { memoryCheckpointCycleId: input.execution.memoryCheckpointCycleId } : {}),
    ...(input.execution.memoryCheckpointRecordIds ? { memoryCheckpointRecordIds: uniqueEvidence(input.execution.memoryCheckpointRecordIds) } : {}),
  }) : null;
  if (execution && !approval) throw new Error("COMMUNICATION_LIFECYCLE_SEND_WITHOUT_APPROVAL");
  if (execution && execution.sentAt < approval!.approvedAt) throw new Error("COMMUNICATION_LIFECYCLE_SEND_BEFORE_APPROVAL");
  if (execution && !execution.recipientAddresses.length) throw new Error("COMMUNICATION_LIFECYCLE_RECIPIENT_REQUIRED");

  const commonExecutionVerified = Boolean(execution
    && approval
    && execution.requestId
    && execution.providerThreadId
    && execution.sourceEvidenceRefs?.length
    && execution.materialSha256 === approval.materialSha256
    && execution.approvalBindingSha256
    && execution.approvalBindingSha256 === approval.approvalBindingSha256
    && execution.decisionPackageId === input.decision.packageId
    && approval.decisionPackageId === input.decision.packageId
    && approval.approvalEvidenceIds?.length);

  let provenanceVerified = false;
  if (commonExecutionVerified && execution) {
    if (decisionOrigin === "direct") {
      provenanceVerified = (execution.decisionOrigin ?? "direct") === "direct"
        && !execution.relationshipCycleId
        && !execution.memoryCheckpointCycleId;
    } else {
      provenanceVerified = execution.decisionOrigin === "relationship_manager_cycle"
        && execution.relationshipCycleId === relationshipCycleId
        && execution.memoryCheckpointCycleId === relationshipCycleId
        && Boolean(execution.memoryCheckpointRecordIds?.length);
    }
  }

  let writingVerified = false;
  if (commonExecutionVerified && approval && execution) {
    if (decisionOrigin === "relationship_manager_cycle") {
      writingVerified = sameWritingProvenance(approval.writingProvenance, execution.writingProvenance)
        && approval.writingProvenance?.decisionOrigin === "relationship_manager_cycle"
        && approval.writingProvenance.relationshipCycleId === relationshipCycleId;
    } else if (!approval.writingProvenance && !execution.writingProvenance) {
      writingVerified = true;
    } else {
      writingVerified = sameWritingProvenance(approval.writingProvenance, execution.writingProvenance)
        && approval.writingProvenance?.decisionOrigin === "direct"
        && !approval.writingProvenance.relationshipCycleId;
    }
  }

  let approvalCandidateVerified = false;
  if (commonExecutionVerified && approval && execution) {
    if (decisionOrigin === "relationship_manager_cycle") {
      approvalCandidateVerified = sameApprovalCandidate(approval.approvalCandidate, execution.approvalCandidate)
        && Boolean(approval.approvalCandidate?.evidenceRef)
        && Boolean(execution.approvalCandidate?.evidenceRef);
    } else if (!approval.approvalCandidate && !execution.approvalCandidate) {
      approvalCandidateVerified = true;
    } else {
      approvalCandidateVerified = sameApprovalCandidate(approval.approvalCandidate, execution.approvalCandidate);
    }
  }

  const executionVerified = commonExecutionVerified && provenanceVerified && writingVerified && approvalCandidateVerified;
  if (execution && !executionVerified) blockers.push("execution_not_reconciled_to_authorized_request");
  if (executionVerified && execution!.providerThreadId !== text(input.threadId, "thread_id")) blockers.push("execution_thread_mismatch");

  const outcome = input.outcome ? Object.freeze({
    assessedAt: iso(input.outcome.assessedAt, "outcome_at"),
    result: input.outcome.result,
    evidenceRefs: uniqueEvidence(input.outcome.evidenceRefs),
  }) : null;
  if (outcome && !execution) throw new Error("COMMUNICATION_LIFECYCLE_OUTCOME_WITHOUT_SEND");
  if (outcome && !executionVerified) throw new Error("COMMUNICATION_LIFECYCLE_OUTCOME_WITHOUT_VERIFIED_EXECUTION");
  if (outcome && outcome.assessedAt < execution!.sentAt) throw new Error("COMMUNICATION_LIFECYCLE_OUTCOME_BEFORE_SEND");
  if (outcome && !outcome.evidenceRefs.length) throw new Error("COMMUNICATION_LIFECYCLE_OUTCOME_EVIDENCE_REQUIRED");

  const memory = input.memory ? Object.freeze({
    recordId: text(input.memory.recordId, "memory_record_id"),
    receiptStatus: input.memory.receiptStatus,
    storageInstanceId: text(input.memory.storageInstanceId, "storage_instance_id"),
    recordedAt: iso(input.memory.recordedAt, "memory_recorded_at"),
  }) : null;
  if (memory && !outcome) throw new Error("COMMUNICATION_LIFECYCLE_MEMORY_WITHOUT_OUTCOME");
  if (memory && !executionVerified) throw new Error("COMMUNICATION_LIFECYCLE_MEMORY_WITHOUT_VERIFIED_EXECUTION");
  if (memory && outcome!.result === "pending") throw new Error("COMMUNICATION_LIFECYCLE_PENDING_OUTCOME_CANNOT_BE_LEARNED");

  const uniqueBlockers = [...new Set(blockers)];
  let stage: CommunicationLifecycleStage = "decided";
  if (uniqueBlockers.length) stage = "blocked";
  else if (memory) stage = "learned";
  else if (outcome) stage = "outcome_observed";
  else if (execution) stage = "sent";
  else if (approval) stage = "approved";

  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_LIFECYCLE_RECEIPT_CONTRACT,
    lifecycleId: text(input.lifecycleId, "lifecycle_id"),
    relationshipId: text(input.relationshipId, "relationship_id"),
    threadId: text(input.threadId, "thread_id"),
    communicationId: executionVerified ? execution?.providerMessageId ?? null : null,
    stage,
    executionVerified,
    decision: Object.freeze({
      packageId: text(input.decision.packageId, "decision_package_id"),
      origin: decisionOrigin,
      relationshipCycleId,
      decisionAt,
      disposition: text(input.decision.disposition, "decision_disposition"),
      evidenceIds: decisionEvidenceIds,
    }),
    approval,
    execution,
    outcome,
    memory,
    blockers: Object.freeze(uniqueBlockers),
  });
}
