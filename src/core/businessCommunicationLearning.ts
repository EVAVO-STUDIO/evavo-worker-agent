export const BUSINESS_COMMUNICATION_LEARNING_CONTRACT = "business_communication_learning_v1" as const;

export type CommunicationEditReason =
  | "too_formal"
  | "too_long"
  | "too_salesy"
  | "too_vague"
  | "wrong_assumption"
  | "missed_question"
  | "wrong_tone"
  | "unnecessary_reply"
  | "bad_opening"
  | "bad_closing"
  | "incorrect_commitment"
  | "missing_context"
  | "recipient_issue"
  | "factual_correction"
  | "other";

export type CommunicationLearningEvent = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_LEARNING_CONTRACT;
  id: string;
  threadId: string;
  relationshipId?: string | null;
  channel: "email" | "chat" | "social_dm" | "contact_form";
  reasons: readonly CommunicationEditReason[];
  originalLength: number;
  finalLength: number;
  changedLengthRatio: number;
  originalOpening: string | null;
  finalOpening: string | null;
  originalClosing: string | null;
  finalClosing: string | null;
  operatorNote?: string | null;
  createdAt: string;
  authoritativeFor: "relationship_decision_feedback";
  writingStyleLearningOwner: "evavo-writing-studio";
  mayMutateVoiceProfile: false;
}>;

function text(value: string): string {
  return value.replace(/\r\n/g, "\n").trim();
}

function firstLine(value: string): string | null {
  const result = text(value).split("\n").map((line) => line.trim()).find(Boolean);
  return result ? result.slice(0, 300) : null;
}

function lastLine(value: string): string | null {
  const lines = text(value).split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines.at(-1)!.slice(0, 300) : null;
}

export function buildBusinessCommunicationLearningEvent(input: Readonly<{
  id: string;
  threadId: string;
  relationshipId?: string | null;
  channel: CommunicationLearningEvent["channel"];
  originalDraft: string;
  finalDraft: string;
  reasons: readonly CommunicationEditReason[];
  operatorNote?: string | null;
  createdAt?: string;
}>): CommunicationLearningEvent {
  const original = text(input.originalDraft);
  const final = text(input.finalDraft);
  const originalLength = original.length;
  const finalLength = final.length;
  const changedLengthRatio = originalLength === 0
    ? (finalLength === 0 ? 0 : 1)
    : Math.min(10, Number(Math.abs(finalLength - originalLength) / originalLength).valueOf());

  return {
    contract: BUSINESS_COMMUNICATION_LEARNING_CONTRACT,
    id: input.id,
    threadId: input.threadId,
    relationshipId: input.relationshipId ?? null,
    channel: input.channel,
    reasons: [...new Set(input.reasons)].slice(0, 12),
    originalLength,
    finalLength,
    changedLengthRatio,
    originalOpening: firstLine(original),
    finalOpening: firstLine(final),
    originalClosing: lastLine(original),
    finalClosing: lastLine(final),
    operatorNote: input.operatorNote?.trim().slice(0, 1000) || null,
    createdAt: input.createdAt ?? new Date().toISOString(),
    authoritativeFor: "relationship_decision_feedback",
    writingStyleLearningOwner: "evavo-writing-studio",
    mayMutateVoiceProfile: false,
  };
}
