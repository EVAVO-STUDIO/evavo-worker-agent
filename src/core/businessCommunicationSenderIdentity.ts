export const BUSINESS_COMMUNICATION_SENDER_IDENTITY_CONTRACT = "business_communication_sender_identity_v1" as const;

export type CommunicationSenderKey = "greg" | "eva" | "hello";
export type CommunicationSenderRole = "founder" | "digital_relationship_manager" | "shared_front_door";

export type CommunicationSenderIdentity = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_SENDER_IDENTITY_CONTRACT;
  key: CommunicationSenderKey;
  role: CommunicationSenderRole;
  displayName: string;
  address: string;
  transparentDigitalIdentity: boolean;
  canCreateCommercialCommitment: boolean;
  canCreateLegalCommitment: boolean;
  useForExistingHighTrustThreads: boolean;
  useForGeneralInbound: boolean;
  signature: Readonly<{
    name: string;
    title: string;
    company: "EVAVO Studio";
    website: "evavo.com.au";
    transparencyLine?: string;
  }>;
}>;

export const EVAVO_COMMUNICATION_SENDERS: Readonly<Record<CommunicationSenderKey, CommunicationSenderIdentity>> = Object.freeze({
  greg: Object.freeze({
    contract: BUSINESS_COMMUNICATION_SENDER_IDENTITY_CONTRACT,
    key: "greg",
    role: "founder",
    displayName: "Greg Parker",
    address: "greg@evavo.com.au",
    transparentDigitalIdentity: false,
    canCreateCommercialCommitment: true,
    canCreateLegalCommitment: false,
    useForExistingHighTrustThreads: true,
    useForGeneralInbound: false,
    signature: Object.freeze({
      name: "Greg Parker",
      title: "Founder & Digital Project Director",
      company: "EVAVO Studio",
      website: "evavo.com.au",
    }),
  }),
  eva: Object.freeze({
    contract: BUSINESS_COMMUNICATION_SENDER_IDENTITY_CONTRACT,
    key: "eva",
    role: "digital_relationship_manager",
    displayName: "Eva at EVAVO",
    address: "eva@evavo.com.au",
    transparentDigitalIdentity: true,
    canCreateCommercialCommitment: false,
    canCreateLegalCommitment: false,
    useForExistingHighTrustThreads: false,
    useForGeneralInbound: true,
    signature: Object.freeze({
      name: "Eva",
      title: "Client Relationships",
      company: "EVAVO Studio",
      website: "evavo.com.au",
      transparencyLine: "EVAVO's digital relationship manager",
    }),
  }),
  hello: Object.freeze({
    contract: BUSINESS_COMMUNICATION_SENDER_IDENTITY_CONTRACT,
    key: "hello",
    role: "shared_front_door",
    displayName: "EVAVO Studio",
    address: "hello@evavo.com.au",
    transparentDigitalIdentity: false,
    canCreateCommercialCommitment: false,
    canCreateLegalCommitment: false,
    useForExistingHighTrustThreads: false,
    useForGeneralInbound: true,
    signature: Object.freeze({
      name: "EVAVO Studio",
      title: "Client Relationships",
      company: "EVAVO Studio",
      website: "evavo.com.au",
    }),
  }),
});

export type SenderSelectionInput = Readonly<{
  existingThreadSender?: CommunicationSenderKey | null;
  relationshipIsHighTrust?: boolean;
  communicationIsSensitive?: boolean;
  commercialCommitmentRequired?: boolean;
  legalOrContractualPosition?: boolean;
  generalInbound?: boolean;
  candidateOrGraduateEnquiry?: boolean;
  senderMailboxAvailable?: Partial<Record<CommunicationSenderKey, boolean>>;
}>;

export type SenderSelection = Readonly<{
  sender: CommunicationSenderIdentity;
  reasons: readonly string[];
  requiresHumanReview: boolean;
  fallbackUsed: boolean;
}>;

function available(input: SenderSelectionInput, key: CommunicationSenderKey): boolean {
  return input.senderMailboxAvailable?.[key] !== false;
}

export function selectCommunicationSender(input: SenderSelectionInput): SenderSelection {
  const reasons: string[] = [];

  if (input.existingThreadSender && available(input, input.existingThreadSender)) {
    const sender = EVAVO_COMMUNICATION_SENDERS[input.existingThreadSender];
    if (!input.legalOrContractualPosition || sender.key === "greg") {
      reasons.push("Preserve sender continuity on the existing relationship thread.");
      return { sender, reasons, requiresHumanReview: Boolean(input.commercialCommitmentRequired || input.legalOrContractualPosition), fallbackUsed: false };
    }
  }

  if (input.legalOrContractualPosition || input.commercialCommitmentRequired || input.communicationIsSensitive || input.relationshipIsHighTrust) {
    if (available(input, "greg")) {
      reasons.push("Use Greg for sensitive, high-trust or commitment-bearing communication.");
      return { sender: EVAVO_COMMUNICATION_SENDERS.greg, reasons, requiresHumanReview: true, fallbackUsed: false };
    }
  }

  if ((input.generalInbound || input.candidateOrGraduateEnquiry) && available(input, "eva")) {
    reasons.push("Use Eva for useful relationship handling without implying founder-level commitment authority.");
    return { sender: EVAVO_COMMUNICATION_SENDERS.eva, reasons, requiresHumanReview: true, fallbackUsed: false };
  }

  if (available(input, "hello")) {
    reasons.push("Use the shared EVAVO front door when a dedicated relationship sender is unavailable or unnecessary.");
    return { sender: EVAVO_COMMUNICATION_SENDERS.hello, reasons, requiresHumanReview: true, fallbackUsed: true };
  }

  reasons.push("No non-founder relationship mailbox is confirmed available; fall back to Greg rather than inventing a sender.");
  return { sender: EVAVO_COMMUNICATION_SENDERS.greg, reasons, requiresHumanReview: true, fallbackUsed: true };
}

export function renderSenderSignature(sender: CommunicationSenderIdentity): string {
  return [
    sender.signature.name,
    sender.signature.title,
    sender.signature.company,
    sender.signature.website,
    sender.signature.transparencyLine,
  ].filter(Boolean).join("\n");
}
