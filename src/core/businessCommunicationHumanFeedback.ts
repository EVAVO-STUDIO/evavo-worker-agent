export const BUSINESS_COMMUNICATION_HUMAN_FEEDBACK_CONTRACT = "business_communication_human_feedback_v1" as const;

export type CommunicationFeedbackDimension =
  | "decision"
  | "channel"
  | "meeting"
  | "recipient"
  | "sender_identity"
  | "factuality"
  | "commitment"
  | "attachment"
  | "tone"
  | "warmth"
  | "directness"
  | "length"
  | "opening"
  | "closing"
  | "wording"
  | "other";

export type HumanCommunicationFeedback = Readonly<{
  decisionId: string;
  approved: boolean;
  originalDisposition: string;
  finalDisposition: string;
  editDistance?: number | null;
  reasons: readonly Readonly<{
    dimension: CommunicationFeedbackDimension;
    summary: string;
    generalisable: boolean;
  }>[];
  evidenceIds: readonly string[];
  recordedAt: string;
}>;

export type CommunicationLearningCandidate = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_HUMAN_FEEDBACK_CONTRACT;
  owner: "evavo-worker-agent" | "evavo-writing-studio";
  dimension: CommunicationFeedbackDimension;
  lesson: string;
  decisionId: string;
  evidenceIds: readonly string[];
  mayChangeVoiceProfile: boolean;
}>;

const WRITING_DIMENSIONS = new Set<CommunicationFeedbackDimension>([
  "tone", "warmth", "directness", "length", "opening", "closing", "wording",
]);

export function deriveCommunicationLearningCandidates(
  feedback: HumanCommunicationFeedback,
): readonly CommunicationLearningCandidate[] {
  if (!feedback.decisionId.trim()) throw new Error("COMMUNICATION_FEEDBACK_DECISION_ID_REQUIRED");
  if (!feedback.evidenceIds.length) throw new Error("COMMUNICATION_FEEDBACK_EVIDENCE_REQUIRED");
  if (Number.isNaN(Date.parse(feedback.recordedAt))) throw new Error("COMMUNICATION_FEEDBACK_RECORDED_AT_INVALID");

  const candidates = feedback.reasons
    .filter((reason) => reason.generalisable && reason.summary.trim())
    .map((reason) => {
      const writingOwned = WRITING_DIMENSIONS.has(reason.dimension);
      return Object.freeze({
        contract: BUSINESS_COMMUNICATION_HUMAN_FEEDBACK_CONTRACT,
        owner: writingOwned ? "evavo-writing-studio" as const : "evavo-worker-agent" as const,
        dimension: reason.dimension,
        lesson: reason.summary.trim(),
        decisionId: feedback.decisionId.trim(),
        evidenceIds: Object.freeze([...new Set(feedback.evidenceIds)]),
        mayChangeVoiceProfile: writingOwned,
      });
    });
  return Object.freeze(candidates);
}

export function relationshipDecisionCorrectionRequired(feedback: HumanCommunicationFeedback): boolean {
  if (feedback.originalDisposition !== feedback.finalDisposition) return true;
  return feedback.reasons.some((reason) => reason.generalisable && [
    "decision", "channel", "meeting", "recipient", "sender_identity", "factuality", "commitment", "attachment",
  ].includes(reason.dimension));
}
