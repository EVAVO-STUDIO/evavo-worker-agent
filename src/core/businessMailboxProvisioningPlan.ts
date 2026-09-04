import type { BusinessMailboxRecord } from "./businessMailboxRegistry";

export const BUSINESS_MAILBOX_PROVISIONING_PLAN_CONTRACT = "business_mailbox_provisioning_plan_v1" as const;

export type MailboxProvisioningStepKind =
  | "discover_current_state"
  | "verify_existing_route"
  | "configure_inbound"
  | "verify_inbound"
  | "configure_send_as"
  | "verify_send_as"
  | "configure_signature"
  | "verify_signature"
  | "verify_spf"
  | "verify_dkim"
  | "verify_dmarc"
  | "round_trip_test"
  | "enable_relationship_manager";

export type MailboxProvisioningStep = Readonly<{
  order: number;
  kind: MailboxProvisioningStepKind;
  externalEffect: boolean;
  required: boolean;
  description: string;
  successEvidence: readonly string[];
}>;

export type MailboxProvisioningPlan = Readonly<{
  contract: typeof BUSINESS_MAILBOX_PROVISIONING_PLAN_CONTRACT;
  address: string;
  preserveAddresses: readonly string[];
  currentState: BusinessMailboxRecord["state"];
  targetState: "fully_verified";
  mayUseBeforeCompletion: false;
  steps: readonly MailboxProvisioningStep[];
  blockers: readonly string[];
}>;

function step(
  order: number,
  kind: MailboxProvisioningStepKind,
  externalEffect: boolean,
  description: string,
  successEvidence: readonly string[],
): MailboxProvisioningStep {
  return Object.freeze({ order, kind, externalEffect, required: true, description, successEvidence: Object.freeze(successEvidence) });
}

export function buildMailboxProvisioningPlan(input: Readonly<{
  mailbox: BusinessMailboxRecord;
  preserveMailboxes: readonly BusinessMailboxRecord[];
  authoritativeMailControlPathAvailable: boolean;
  authoritativeDnsControlPathAvailable: boolean;
}>): MailboxProvisioningPlan {
  const address = input.mailbox.address.trim().toLowerCase();
  if (!address) throw new Error("MAILBOX_PROVISIONING_ADDRESS_REQUIRED");
  const preserveAddresses = [...new Set(input.preserveMailboxes.map((item) => item.address.trim().toLowerCase()).filter(Boolean))];
  const blockers: string[] = [];
  if (!input.authoritativeMailControlPathAvailable) blockers.push("authoritative_mail_control_path_unavailable");
  if (!input.authoritativeDnsControlPathAvailable) blockers.push("authoritative_dns_control_path_unavailable");

  const steps = [
    step(1, "discover_current_state", false, "Read current mailbox, routing, send-as and signature state before changing anything.", ["provider state snapshot", "mail routing snapshot"]),
    step(2, "verify_existing_route", false, `Prove preserved addresses still receive before provisioning ${address}.`, preserveAddresses.map((item) => `verified inbound receipt for ${item}`)),
    step(3, "configure_inbound", true, `Configure inbound delivery for ${address} without modifying verified Greg routing.`, ["provider change receipt"]),
    step(4, "verify_inbound", false, `Send a controlled external test to ${address} and verify canonical receipt.`, ["received message id", "received timestamp"]),
    step(5, "configure_send_as", true, `Configure an authenticated outbound identity for ${address}; do not spoof the From header.`, ["send-as configuration receipt"]),
    step(6, "verify_send_as", false, `Send a controlled message from ${address} and verify the actual From identity at the recipient.`, ["sent message id", "received external copy"]),
    step(7, "configure_signature", true, `Configure the approved EVAVO signature for ${address}.`, ["signature configuration receipt"]),
    step(8, "verify_signature", false, "Verify text and HTML signature rendering independently from send-as success.", ["rendered signature evidence"]),
    step(9, "verify_spf", false, "Verify SPF authorises the actual outbound infrastructure without breaking existing senders.", ["authoritative DNS result", "message authentication result"]),
    step(10, "verify_dkim", false, "Verify DKIM signs outbound mail for the domain/identity where supported.", ["DKIM DNS result", "DKIM pass result"]),
    step(11, "verify_dmarc", false, "Verify DMARC alignment and policy using actual outbound test results.", ["DMARC DNS result", "DMARC pass/alignment result"]),
    step(12, "round_trip_test", false, `Complete inbound and outbound round-trip tests for ${address}, while re-checking preserved addresses.`, ["inbound receipt", "outbound receipt", "preserved-route receipt"]),
    step(13, "enable_relationship_manager", true, "Only after every independent verification succeeds, mark the mailbox usable by Relationship Manager.", ["fully_verified mailbox registry receipt"]),
  ];

  return Object.freeze({
    contract: BUSINESS_MAILBOX_PROVISIONING_PLAN_CONTRACT,
    address,
    preserveAddresses: Object.freeze(preserveAddresses),
    currentState: input.mailbox.state,
    targetState: "fully_verified",
    mayUseBeforeCompletion: false,
    steps: Object.freeze(steps),
    blockers: Object.freeze(blockers),
  });
}
