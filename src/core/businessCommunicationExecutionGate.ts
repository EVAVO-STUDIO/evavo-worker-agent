import { assertMailboxUsable, type BusinessMailboxRecord } from "./businessMailboxRegistry";
import {
  assessCommunicationApprovalContext,
  type ApprovalContextChange,
} from "./businessCommunicationApprovalContext";
import type { CommunicationDecisionPackage } from "./businessCommunicationDecisionPackage";
import { reviewBusinessCommunicationBeforeSend, type CommunicationDraftReviewInput } from "./businessCommunicationPreSendReview";
import {
  verifyCommunicationApprovalBinding,
  verifyCommunicationSendEnvelope,
  type CommunicationSendEnvelope,
  type CommunicationSendMaterial,
} from "./businessCommunicationSendEnvelope";

export const BUSINESS_COMMUNICATION_EXECUTION_GATE_CONTRACT = "business_communication_execution_gate_v2" as const;

export type CommunicationExecutionGateResult = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_EXECUTION_GATE_CONTRACT;
  allowed: boolean;
  reasons: readonly string[];
  preSend: ReturnType<typeof reviewBusinessCommunicationBeforeSend>;
  approvalValid: boolean;
  approvalBindingValid: boolean;
  approvalContextValid: boolean;
  decisionValid: boolean;
  mailboxValid: boolean;
}>;

function assessBoundDecision(
  approval: CommunicationSendEnvelope,
  decision: CommunicationDecisionPackage | null | undefined,
): Readonly<{ valid: boolean; reasons: readonly string[] }> {
  const reasons: string[] = [];
  const binding = approval.approvalBinding;
  if (!decision) return Object.freeze({ valid: false, reasons: Object.freeze(["decision_package_missing"]) });
  if (!binding) return Object.freeze({ valid: false, reasons: Object.freeze(["decision_approval_binding_missing"]) });
  if (binding.decisionPackageId !== decision.packageId) reasons.push("decision_package_id_mismatch");
  if (!decision.approvalGradeReady) reasons.push("decision_not_approval_grade_ready");
  if (decision.disposition !== "reply") reasons.push("decision_disposition_not_executable");
  const boundEvidence = new Set(binding.evidenceIds);
  if (decision.evidenceIds.some((id) => !boundEvidence.has(id))) reasons.push("decision_evidence_not_fully_bound");
  const decisionAt = Date.parse(decision.decisionAt);
  const approvedAt = Date.parse(approval.approvedAt);
  if (!Number.isFinite(decisionAt) || !Number.isFinite(approvedAt) || decisionAt > approvedAt) reasons.push("decision_timestamp_invalid_for_approval");
  return Object.freeze({ valid: reasons.length === 0, reasons: Object.freeze(reasons) });
}

export function evaluateCommunicationExecutionGate(input: Readonly<{
  mailbox: BusinessMailboxRecord;
  material: CommunicationSendMaterial;
  approval: CommunicationSendEnvelope;
  decisionPackage?: CommunicationDecisionPackage | null;
  review: Omit<CommunicationDraftReviewInput, "sendingEnabled" | "subject" | "body" | "recipients" | "attachments">;
  runtimeSendingEnabled: boolean;
  contextChangesSinceDecision?: readonly ApprovalContextChange[];
  now?: Date;
}>): CommunicationExecutionGateResult {
  const reasons: string[] = [];
  let mailboxValid = true;
  try {
    assertMailboxUsable(input.mailbox);
  } catch {
    mailboxValid = false;
    reasons.push("mailbox_not_fully_verified");
  }
  if (input.mailbox.address.trim().toLowerCase() !== input.material.sender.trim().toLowerCase()) {
    mailboxValid = false;
    reasons.push("sender_does_not_match_verified_mailbox");
  }

  const binding = verifyCommunicationApprovalBinding(input.approval);
  if (!binding.ok) reasons.push(...binding.reasons);
  if (input.approval.approvalBinding) {
    if (input.approval.approvalBinding.mailboxKey !== input.mailbox.key) {
      mailboxValid = false;
      reasons.push("approval_mailbox_key_mismatch");
    }
    if (!input.mailbox.verification.evidenceRefs.length) {
      mailboxValid = false;
      reasons.push("mailbox_verification_evidence_missing");
    }
  }

  const decision = assessBoundDecision(input.approval, input.decisionPackage);
  if (!decision.valid) reasons.push(...decision.reasons);

  const approval = verifyCommunicationSendEnvelope(input.approval, input.material, input.now ?? new Date());
  if (!approval.ok) reasons.push(...approval.reasons);

  const approvalContext = assessCommunicationApprovalContext({
    approval: input.approval,
    changes: input.contextChangesSinceDecision ?? [],
  });
  if (!approvalContext.valid) reasons.push(...approvalContext.reasons);

  const recipients = [
    ...input.material.to.map((address) => ({ address, expected: true })),
    ...input.material.cc.map((address) => ({ address, expected: true })),
    ...input.material.bcc.map((address) => ({ address, expected: true })),
  ];
  const preSend = reviewBusinessCommunicationBeforeSend({
    ...input.review,
    channel: "email",
    subject: input.material.subject,
    body: input.material.body,
    recipients,
    attachments: input.material.attachments.map((attachment) => attachment.filename),
    sendingEnabled: input.runtimeSendingEnabled,
  });
  if (!preSend.sendAllowed) reasons.push("pre_send_review_failed");
  if (!input.runtimeSendingEnabled) reasons.push("runtime_sending_disabled");

  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_EXECUTION_GATE_CONTRACT,
    allowed: mailboxValid && binding.ok && decision.valid && approval.ok && approvalContext.valid && preSend.sendAllowed && input.runtimeSendingEnabled,
    reasons: Object.freeze([...new Set(reasons)]),
    preSend,
    approvalValid: approval.ok,
    approvalBindingValid: binding.ok,
    approvalContextValid: approvalContext.valid,
    decisionValid: decision.valid,
    mailboxValid,
  });
}

export function assertCommunicationExecutionAllowed(input: Parameters<typeof evaluateCommunicationExecutionGate>[0]): void {
  const result = evaluateCommunicationExecutionGate(input);
  if (!result.allowed) throw new Error(`COMMUNICATION_EXECUTION_BLOCKED:${result.reasons.join(",")}`);
}
