import { assertMailboxUsable, type BusinessMailboxRecord } from "./businessMailboxRegistry";
import { reviewBusinessCommunicationBeforeSend, type CommunicationDraftReviewInput } from "./businessCommunicationPreSendReview";
import {
  verifyCommunicationSendEnvelope,
  type CommunicationSendEnvelope,
  type CommunicationSendMaterial,
} from "./businessCommunicationSendEnvelope";

export const BUSINESS_COMMUNICATION_EXECUTION_GATE_CONTRACT = "business_communication_execution_gate_v1" as const;

export type CommunicationExecutionGateResult = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_EXECUTION_GATE_CONTRACT;
  allowed: boolean;
  reasons: readonly string[];
  preSend: ReturnType<typeof reviewBusinessCommunicationBeforeSend>;
  approvalValid: boolean;
  mailboxValid: boolean;
}>;

export function evaluateCommunicationExecutionGate(input: Readonly<{
  mailbox: BusinessMailboxRecord;
  material: CommunicationSendMaterial;
  approval: CommunicationSendEnvelope;
  review: Omit<CommunicationDraftReviewInput, "sendingEnabled" | "subject" | "body" | "recipients" | "attachments">;
  runtimeSendingEnabled: boolean;
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

  const approval = verifyCommunicationSendEnvelope(input.approval, input.material, input.now ?? new Date());
  if (!approval.ok) reasons.push(...approval.reasons);

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
    allowed: mailboxValid && approval.ok && preSend.sendAllowed && input.runtimeSendingEnabled,
    reasons: Object.freeze([...new Set(reasons)]),
    preSend,
    approvalValid: approval.ok,
    mailboxValid,
  });
}

export function assertCommunicationExecutionAllowed(input: Parameters<typeof evaluateCommunicationExecutionGate>[0]): void {
  const result = evaluateCommunicationExecutionGate(input);
  if (!result.allowed) throw new Error(`COMMUNICATION_EXECUTION_BLOCKED:${result.reasons.join(",")}`);
}
