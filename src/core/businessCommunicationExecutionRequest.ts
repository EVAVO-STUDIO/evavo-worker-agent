import type { BusinessMailboxRecord } from "./businessMailboxRegistry";
import type { ApprovalContextChange } from "./businessCommunicationApprovalContext";
import type { CommunicationDecisionPackage } from "./businessCommunicationDecisionPackage";
import {
  evaluateCommunicationExecutionGate,
  type CommunicationExecutionGateResult,
} from "./businessCommunicationExecutionGate";
import type { OperatorCommunicationApprovalReceipt } from "./businessCommunicationOperatorApproval";
import type { CommunicationDraftReviewInput } from "./businessCommunicationPreSendReview";
import type {
  CommunicationSendEnvelope,
  CommunicationSendMaterial,
} from "./businessCommunicationSendEnvelope";

export const BUSINESS_COMMUNICATION_EXECUTION_REQUEST_CONTRACT = "business_communication_execution_request_v1" as const;

export type AuthorizedCommunicationExecutionRequest = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_EXECUTION_REQUEST_CONTRACT;
  provider: "gmail";
  requestId: string;
  authorizedAt: string;
  sender: string;
  to: readonly string[];
  cc: readonly string[];
  bcc: readonly string[];
  threadId: string;
  replyMessageId: string | null;
  subject: string;
  body: string;
  attachments: CommunicationSendMaterial["attachments"];
  authorization: Readonly<{
    envelopeId: string;
    materialSha256: string;
    approvalBindingSha256: string;
    decisionPackageId: string;
    decisionEvidenceIds: readonly string[];
    approvalEvidenceIds: readonly string[];
    operatorApprovalId: string;
    operatorApprovalSource: OperatorCommunicationApprovalReceipt["sourceSystem"];
    approvedBy: string;
    approvedAt: string;
    expiresAt: string;
    mailboxKey: string;
  }>;
}>;

export type CommunicationExecutionAuthorizationResult = Readonly<{
  gate: CommunicationExecutionGateResult;
  request: AuthorizedCommunicationExecutionRequest | null;
}>;

function requestId(envelope: CommunicationSendEnvelope): string {
  return `gmail-send:${envelope.envelopeId}:${envelope.materialSha256.slice(0, 24)}`;
}

export function authorizeCommunicationExecutionRequest(input: Readonly<{
  mailbox: BusinessMailboxRecord;
  material: CommunicationSendMaterial;
  approval: CommunicationSendEnvelope;
  operatorApprovalReceipt: OperatorCommunicationApprovalReceipt;
  decisionPackage: CommunicationDecisionPackage;
  review: Omit<CommunicationDraftReviewInput, "sendingEnabled" | "subject" | "body" | "recipients" | "attachments">;
  runtimeSendingEnabled: boolean;
  contextChangesSinceDecision?: readonly ApprovalContextChange[];
  now: Date;
}>): CommunicationExecutionAuthorizationResult {
  const gate = evaluateCommunicationExecutionGate(input);
  if (!gate.allowed) return Object.freeze({ gate, request: null });
  const binding = input.approval.approvalBinding;
  if (!binding) throw new Error("COMMUNICATION_EXECUTION_REQUEST_BINDING_REQUIRED");
  if (!Number.isFinite(input.now.getTime())) throw new Error("COMMUNICATION_EXECUTION_REQUEST_NOW_INVALID");

  const request: AuthorizedCommunicationExecutionRequest = Object.freeze({
    contract: BUSINESS_COMMUNICATION_EXECUTION_REQUEST_CONTRACT,
    provider: "gmail",
    requestId: requestId(input.approval),
    authorizedAt: input.now.toISOString(),
    sender: input.approval.material.sender,
    to: input.approval.material.to,
    cc: input.approval.material.cc ?? Object.freeze([]),
    bcc: input.approval.material.bcc ?? Object.freeze([]),
    threadId: input.approval.material.threadId,
    replyMessageId: input.approval.material.replyMessageId ?? null,
    subject: input.approval.material.subject,
    body: input.approval.material.body,
    attachments: input.approval.material.attachments,
    authorization: Object.freeze({
      envelopeId: input.approval.envelopeId,
      materialSha256: input.approval.materialSha256,
      approvalBindingSha256: binding.bindingSha256,
      decisionPackageId: binding.decisionPackageId,
      decisionEvidenceIds: binding.evidenceIds,
      approvalEvidenceIds: binding.approvalEvidenceIds,
      operatorApprovalId: input.operatorApprovalReceipt.approvalId,
      operatorApprovalSource: input.operatorApprovalReceipt.sourceSystem,
      approvedBy: input.approval.approvedBy,
      approvedAt: input.approval.approvedAt,
      expiresAt: input.approval.expiresAt,
      mailboxKey: binding.mailboxKey,
    }),
  });
  return Object.freeze({ gate, request });
}

export function assertAuthorizedCommunicationExecutionRequest(input: Parameters<typeof authorizeCommunicationExecutionRequest>[0]): AuthorizedCommunicationExecutionRequest {
  const result = authorizeCommunicationExecutionRequest(input);
  if (!result.request) throw new Error(`COMMUNICATION_EXECUTION_REQUEST_BLOCKED:${result.gate.reasons.join(",")}`);
  return result.request;
}
