import {
  analyseBusinessCommunicationThread,
  type CommunicationMessage,
  type CommunicationParticipant,
} from "./businessCommunicationIntelligence";

export const BUSINESS_GMAIL_THREAD_INGESTION_CONTRACT = "business_gmail_thread_ingestion_v1" as const;

export type GmailProviderMessage = Readonly<{
  id: string;
  threadId: string;
  sentAt: string;
  from: Readonly<{ name?: string | null; address: string }>;
  to: readonly Readonly<{ name?: string | null; address: string }>[];
  cc?: readonly Readonly<{ name?: string | null; address: string }>[];
  subject?: string | null;
  body: string;
  attachmentNames?: readonly string[];
}>;

export type GmailMemoryObservationCandidate = Readonly<{
  sourceSystem: "gmail";
  sourceRef: string;
  occurredAt: string;
  kind: "message" | "obligation";
  summary: string;
  material: boolean;
  entityRefs: readonly Readonly<{ kind: "communication_thread" | "message" | "person" | "relationship"; id: string }>[];
}>;

function participant(value: Readonly<{ name?: string | null; address: string }>): CommunicationParticipant {
  return Object.freeze({ ...(value.name?.trim() ? { name: value.name.trim() } : {}), address: value.address.trim().toLowerCase() });
}

function stripQuotedHistory(body: string): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const kept: string[] = [];
  for (const line of lines) {
    if (/^\s*>/.test(line)) continue;
    if (/^\s*On .+wrote:\s*$/i.test(line)) break;
    if (/^\s*-{2,}\s*Original Message\s*-{2,}\s*$/i.test(line)) break;
    kept.push(line);
  }
  return kept.join("\n").trim();
}

export function normalizeGmailProviderMessage(message: GmailProviderMessage): CommunicationMessage {
  if (!message.id.trim() || !message.threadId.trim()) throw new Error("GMAIL_INGESTION_ID_REQUIRED");
  const sent = new Date(message.sentAt);
  if (Number.isNaN(sent.getTime())) throw new Error("GMAIL_INGESTION_SENT_AT_INVALID");
  return Object.freeze({
    id: message.id.trim(),
    sentAt: sent.toISOString(),
    sender: participant(message.from),
    to: Object.freeze(message.to.map(participant)),
    cc: Object.freeze((message.cc ?? []).map(participant)),
    subject: message.subject?.trim() || null,
    body: stripQuotedHistory(message.body),
    attachments: Object.freeze([...(message.attachmentNames ?? [])]),
  });
}

export function ingestGmailThreadForRelationship(input: Readonly<{
  threadId: string;
  messages: readonly GmailProviderMessage[];
  relationshipId?: string | null;
  personId?: string | null;
  knownRelationshipSensitive?: boolean;
  senderSuppressed?: boolean;
}>): Readonly<{
  contract: typeof BUSINESS_GMAIL_THREAD_INGESTION_CONTRACT;
  normalizedMessages: readonly CommunicationMessage[];
  analysis: ReturnType<typeof analyseBusinessCommunicationThread>;
  memoryCandidates: readonly GmailMemoryObservationCandidate[];
}> {
  const normalizedMessages = Object.freeze(input.messages
    .filter((message) => message.threadId === input.threadId)
    .map(normalizeGmailProviderMessage)
    .sort((a, b) => a.sentAt.localeCompare(b.sentAt)));

  const analysis = analyseBusinessCommunicationThread({
    threadId: input.threadId,
    messages: normalizedMessages,
    knownRelationshipSensitive: input.knownRelationshipSensitive,
    senderSuppressed: input.senderSuppressed,
  });

  const latest = normalizedMessages.at(-1);
  const baseEntities = [
    { kind: "communication_thread" as const, id: input.threadId },
    ...(input.relationshipId ? [{ kind: "relationship" as const, id: input.relationshipId }] : []),
    ...(input.personId ? [{ kind: "person" as const, id: input.personId }] : []),
  ];
  const memoryCandidates: GmailMemoryObservationCandidate[] = [];

  if (latest) {
    const material = analysis.replyNeeded
      || analysis.obligations.length > 0
      || analysis.primaryIntent === "relationship_repair"
      || analysis.primaryIntent === "commercial"
      || analysis.primaryIntent === "support";
    memoryCandidates.push(Object.freeze({
      sourceSystem: "gmail",
      sourceRef: `gmail:message:${latest.id}`,
      occurredAt: latest.sentAt,
      kind: "message",
      summary: `${analysis.primaryIntent}: ${latest.subject || "(no subject)"}`,
      material,
      entityRefs: Object.freeze([...baseEntities, { kind: "message" as const, id: latest.id }]),
    }));
  }

  for (const obligation of analysis.obligations) {
    const evidenceMessage = normalizedMessages.find((message) => message.id === obligation.evidenceMessageId);
    if (!evidenceMessage) throw new Error("GMAIL_INGESTION_OBLIGATION_EVIDENCE_MESSAGE_MISSING");
    memoryCandidates.push(Object.freeze({
      sourceSystem: "gmail",
      sourceRef: `gmail:message:${obligation.evidenceMessageId}`,
      occurredAt: evidenceMessage.sentAt,
      kind: "obligation",
      summary: obligation.description,
      material: true,
      entityRefs: Object.freeze([...baseEntities, { kind: "message" as const, id: obligation.evidenceMessageId }]),
    }));
  }

  return Object.freeze({
    contract: BUSINESS_GMAIL_THREAD_INGESTION_CONTRACT,
    normalizedMessages,
    analysis,
    memoryCandidates: Object.freeze(memoryCandidates),
  });
}
