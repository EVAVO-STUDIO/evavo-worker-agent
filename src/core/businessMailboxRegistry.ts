export const BUSINESS_MAILBOX_REGISTRY_CONTRACT = "business_mailbox_registry_v1" as const;

export type MailboxKey = "greg" | "eva" | "hello";
export type MailboxProvisioningState = "desired" | "receiving_verified" | "send_as_verified" | "fully_verified" | "disabled";

export type MailboxVerification = Readonly<{
  receiveVerifiedAt?: string | null;
  sendAsVerifiedAt?: string | null;
  signatureVerifiedAt?: string | null;
  providerSettingsVerifiedAt?: string | null;
  evidenceRefs: readonly string[];
}>;

export type BusinessMailboxRecord = Readonly<{
  contract: typeof BUSINESS_MAILBOX_REGISTRY_CONTRACT;
  key: MailboxKey;
  address: string;
  purpose: string;
  desired: boolean;
  provisioningState: MailboxProvisioningState;
  inboundProvider: "cloudflare_email_routing" | "google_workspace" | "gmail" | "other" | "unknown";
  outboundProvider: "gmail_send_as" | "google_workspace" | "gmail" | "other" | "unknown";
  relationshipManagerMayUse: boolean;
  verification: MailboxVerification;
}>;

export const DESIRED_EVAVO_MAILBOXES: Readonly<Record<MailboxKey, BusinessMailboxRecord>> = Object.freeze({
  greg: Object.freeze({
    contract: BUSINESS_MAILBOX_REGISTRY_CONTRACT,
    key: "greg",
    address: "greg@evavo.com.au",
    purpose: "Founder-led, sensitive, high-trust and commitment-bearing communication.",
    desired: true,
    provisioningState: "fully_verified",
    inboundProvider: "unknown",
    outboundProvider: "gmail",
    relationshipManagerMayUse: true,
    verification: Object.freeze({
      receiveVerifiedAt: null,
      sendAsVerifiedAt: "2026-09-04T01:38:36.000Z",
      signatureVerifiedAt: "2026-09-04T01:38:36.000Z",
      providerSettingsVerifiedAt: null,
      evidenceRefs: Object.freeze(["gmail:sent:1a06a116dda4f657"]),
    }),
  }),
  eva: Object.freeze({
    contract: BUSINESS_MAILBOX_REGISTRY_CONTRACT,
    key: "eva",
    address: "eva@evavo.com.au",
    purpose: "Transparent digital relationship manager for general relationship handling and useful first-line replies.",
    desired: true,
    provisioningState: "desired",
    inboundProvider: "unknown",
    outboundProvider: "unknown",
    relationshipManagerMayUse: false,
    verification: Object.freeze({ evidenceRefs: Object.freeze([]) }),
  }),
  hello: Object.freeze({
    contract: BUSINESS_MAILBOX_REGISTRY_CONTRACT,
    key: "hello",
    address: "hello@evavo.com.au",
    purpose: "Shared EVAVO front door for general enquiries and triage.",
    desired: true,
    provisioningState: "desired",
    inboundProvider: "unknown",
    outboundProvider: "unknown",
    relationshipManagerMayUse: false,
    verification: Object.freeze({ evidenceRefs: Object.freeze([]) }),
  }),
});

function iso(value: string | null | undefined): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error("MAILBOX_VERIFICATION_TIMESTAMP_INVALID");
  return parsed.toISOString();
}

export function resolveMailboxProvisioningState(input: MailboxVerification): MailboxProvisioningState {
  const receive = Boolean(input.receiveVerifiedAt);
  const send = Boolean(input.sendAsVerifiedAt);
  const signature = Boolean(input.signatureVerifiedAt);
  if (receive && send && signature) return "fully_verified";
  if (send) return "send_as_verified";
  if (receive) return "receiving_verified";
  return "desired";
}

export function withMailboxVerification(
  current: BusinessMailboxRecord,
  verification: MailboxVerification,
  providers?: Readonly<{ inboundProvider?: BusinessMailboxRecord["inboundProvider"]; outboundProvider?: BusinessMailboxRecord["outboundProvider"] }>,
): BusinessMailboxRecord {
  const normalized: MailboxVerification = Object.freeze({
    receiveVerifiedAt: iso(verification.receiveVerifiedAt),
    sendAsVerifiedAt: iso(verification.sendAsVerifiedAt),
    signatureVerifiedAt: iso(verification.signatureVerifiedAt),
    providerSettingsVerifiedAt: iso(verification.providerSettingsVerifiedAt),
    evidenceRefs: Object.freeze([...new Set(verification.evidenceRefs.map((item) => item.trim()).filter(Boolean))]),
  });
  const provisioningState = resolveMailboxProvisioningState(normalized);
  return Object.freeze({
    ...current,
    provisioningState,
    inboundProvider: providers?.inboundProvider ?? current.inboundProvider,
    outboundProvider: providers?.outboundProvider ?? current.outboundProvider,
    relationshipManagerMayUse: provisioningState === "fully_verified",
    verification: normalized,
  });
}

export function assertMailboxUsable(record: BusinessMailboxRecord): void {
  if (!record.relationshipManagerMayUse || record.provisioningState !== "fully_verified") {
    throw new Error(`MAILBOX_NOT_FULLY_VERIFIED:${record.address}`);
  }
}
