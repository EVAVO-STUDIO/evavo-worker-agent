import { createHash } from "node:crypto";

import type { CommunicationMessage } from "./businessCommunicationIntelligence";
import {
  ingestGmailThreadForRelationship,
  type GmailProviderMessage,
} from "./businessGmailThreadIngestion";
import {
  buildBusinessThreadDelta,
  type ThreadDelta,
  type ThreadStateItem,
} from "./businessThreadDelta";
import {
  buildObligationLedgerSnapshot,
  mergeBusinessObligations,
  type BusinessObligation,
  type ObligationLedgerSnapshot,
  type ObligationOwner,
} from "./businessObligationLedger";

export const BUSINESS_GMAIL_RELATIONSHIP_STATE_PROJECTION_CONTRACT = "business_gmail_relationship_state_projection_v1" as const;

export type GmailRelationshipStateProjection = Readonly<{
  contract: typeof BUSINESS_GMAIL_RELATIONSHIP_STATE_PROJECTION_CONTRACT;
  threadId: string;
  observedAt: string;
  normalizedMessageIds: readonly string[];
  latestObservedThreadState: readonly ThreadStateItem[];
  threadDelta: ThreadDelta;
  obligations: readonly BusinessObligation[];
  obligationLedger: ObligationLedgerSnapshot;
  memoryCandidates: ReturnType<typeof ingestGmailThreadForRelationship>["memoryCandidates"];
  sourceEvidenceIds: readonly string[];
}>;

function stableId(prefix: string, parts: readonly string[]): string {
  const hash = createHash("sha256").update(parts.join("\n"), "utf8").digest("hex").slice(0, 24);
  return `${prefix}_${hash}`;
}

function statement(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function obligationOwner(owner: "evavo" | "external" | "shared" | "unknown"): ObligationOwner {
  if (owner === "external") return "counterparty";
  return owner;
}

function projectQuestions(input: Readonly<{
  latestMessageId: string | null;
  latestMessageAt: string | null;
  questions: readonly string[];
}>): readonly ThreadStateItem[] {
  if (!input.latestMessageId) return Object.freeze([]);
  return Object.freeze(input.questions.map((question) => {
    const clean = statement(question);
    const evidenceId = `gmail:message:${input.latestMessageId}`;
    return Object.freeze({
      id: stableId("thread_question", [input.latestMessageId!, clean]),
      kind: "question" as const,
      statement: clean,
      status: "open" as const,
      owner: "evavo" as const,
      sourceEvidenceIds: Object.freeze([evidenceId]),
      ...(input.latestMessageAt ? { lastObservedAt: input.latestMessageAt } : {}),
    });
  }));
}

function projectObligations(input: Readonly<{
  relationshipId?: string | null;
  personId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  messages: readonly CommunicationMessage[];
  analysis: ReturnType<typeof ingestGmailThreadForRelationship>["analysis"];
}>): readonly BusinessObligation[] {
  return Object.freeze(input.analysis.obligations.map((obligation) => {
    const clean = statement(obligation.description);
    const sourceEvidenceId = `gmail:message:${obligation.evidenceMessageId}`;
    const message = input.messages.find((item) => item.id === obligation.evidenceMessageId);
    if (!message) throw new Error("GMAIL_RELATIONSHIP_OBLIGATION_MESSAGE_MISSING");
    return Object.freeze({
      id: stableId("obl_gmail", [obligation.evidenceMessageId, obligation.owner, clean]),
      ...(input.relationshipId ? { relationshipId: input.relationshipId } : {}),
      ...(input.personId ? { personId: input.personId } : {}),
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.projectId ? { projectId: input.projectId } : {}),
      owner: obligationOwner(obligation.owner),
      statement: clean,
      status: "open" as const,
      importance: input.analysis.replyUrgency === "high" ? "high" as const : "normal" as const,
      createdAt: message.sentAt,
      dueAt: obligation.dueAt,
      dueAtEvidenceId: obligation.dueAt ? sourceEvidenceId : null,
      sourceEvidenceIds: Object.freeze([sourceEvidenceId]),
      satisfactionEvidenceIds: Object.freeze([]),
      stateEvidenceIds: Object.freeze([]),
    });
  }));
}

export function projectGmailThreadToCanonicalRelationshipState(input: Readonly<{
  threadId: string;
  messages: readonly GmailProviderMessage[];
  previousThreadState?: readonly ThreadStateItem[];
  previousObligations?: readonly BusinessObligation[];
  relationshipId?: string | null;
  personId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  knownRelationshipSensitive?: boolean;
  senderSuppressed?: boolean;
  observedAt: string;
}>): GmailRelationshipStateProjection {
  const observedAt = new Date(input.observedAt);
  if (Number.isNaN(observedAt.getTime())) throw new Error("GMAIL_RELATIONSHIP_OBSERVED_AT_INVALID");

  const ingestion = ingestGmailThreadForRelationship({
    threadId: input.threadId,
    messages: input.messages,
    relationshipId: input.relationshipId,
    personId: input.personId,
    knownRelationshipSensitive: input.knownRelationshipSensitive,
    senderSuppressed: input.senderSuppressed,
  });
  const latestMessage = ingestion.normalizedMessages.at(-1) ?? null;
  const latestObservedThreadState = projectQuestions({
    latestMessageId: ingestion.analysis.latestMessageId,
    latestMessageAt: latestMessage?.sentAt ?? null,
    questions: ingestion.analysis.unansweredQuestions,
  });
  const threadDelta = buildBusinessThreadDelta({
    threadId: input.threadId,
    previousState: input.previousThreadState ?? [],
    latestObservedState: latestObservedThreadState,
  });

  const observedObligations = projectObligations({
    relationshipId: input.relationshipId,
    personId: input.personId,
    organizationId: input.organizationId,
    projectId: input.projectId,
    messages: ingestion.normalizedMessages,
    analysis: ingestion.analysis,
  });
  const obligations = mergeBusinessObligations(input.previousObligations ?? [], observedObligations);
  const obligationLedger = buildObligationLedgerSnapshot(obligations, observedAt);
  const sourceEvidenceIds = Object.freeze([...new Set([
    ...ingestion.normalizedMessages.map((message) => `gmail:message:${message.id}`),
    ...obligations.flatMap((obligation) => obligation.sourceEvidenceIds),
  ])].sort());

  return Object.freeze({
    contract: BUSINESS_GMAIL_RELATIONSHIP_STATE_PROJECTION_CONTRACT,
    threadId: input.threadId.trim(),
    observedAt: observedAt.toISOString(),
    normalizedMessageIds: Object.freeze(ingestion.normalizedMessages.map((message) => message.id)),
    latestObservedThreadState,
    threadDelta,
    obligations,
    obligationLedger,
    memoryCandidates: ingestion.memoryCandidates,
    sourceEvidenceIds,
  });
}
