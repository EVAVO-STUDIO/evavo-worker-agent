export const BUSINESS_COMMUNICATION_HUMAN_FEEDBACK_CONTRACT = "business_communication_human_feedback_v2" as const;

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

export type CommunicationFeedbackScope = "thread" | "relationship" | "segment" | "global";
export type CommunicationFeedbackStrength = "correction" | "repeated_pattern" | "explicit_rule";

export type HumanCommunicationFeedback = Readonly<{
  decisionId: string;
  approved: boolean;
  originalDisposition: string;
  finalDisposition: string;
  editDistance?: number | null;
  scope?: CommunicationFeedbackScope;
  strength?: CommunicationFeedbackStrength;
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
  scope: CommunicationFeedbackScope;
  strength: CommunicationFeedbackStrength;
  approvedSourceDraft: boolean;
  eligibleForGlobalPromotion: boolean;
}>;

const WRITING_DIMENSIONS = new Set<CommunicationFeedbackDimension>([
  "tone", "warmth", "directness", "length", "opening", "closing", "wording",
]);

function validateFeedback(feedback: HumanCommunicationFeedback): Readonly<{
  decisionId: string;
  evidenceIds: readonly string[];
  recordedAt: string;
  scope: CommunicationFeedbackScope;
  strength: CommunicationFeedbackStrength;
}> {
  const decisionId = feedback.decisionId.trim();
  if (!decisionId) throw new Error("COMMUNICATION_FEEDBACK_DECISION_ID_REQUIRED");
  const evidenceIds = Object.freeze([...new Set(feedback.evidenceIds.map((item) => item.trim()).filter(Boolean))]);
  if (!evidenceIds.length) throw new Error("COMMUNICATION_FEEDBACK_EVIDENCE_REQUIRED");
  const parsed = new Date(feedback.recordedAt);
  if (!feedback.recordedAt || Number.isNaN(parsed.getTime())) throw new Error("COMMUNICATION_FEEDBACK_RECORDED_AT_INVALID");
  if (feedback.editDistance !== undefined && feedback.editDistance !== null) {
    if (!Number.isFinite(feedback.editDistance) || feedback.editDistance < 0 || feedback.editDistance > 1) {
      throw new Error("COMMUNICATION_FEEDBACK_EDIT_DISTANCE_INVALID");
    }
  }
  const scope = feedback.scope ?? "relationship";
  const strength = feedback.strength ?? "correction";
  if ((scope === "segment" || scope === "global") && strength === "correction") {
    throw new Error("COMMUNICATION_FEEDBACK_BROAD_SCOPE_REQUIRES_STRONGER_EVIDENCE");
  }
  return Object.freeze({ decisionId, evidenceIds, recordedAt: parsed.toISOString(), scope, strength });
}

export function deriveCommunicationLearningCandidates(
  feedback: HumanCommunicationFeedback,
): readonly CommunicationLearningCandidate[] {
  const validated = validateFeedback(feedback);
  const candidates = feedback.reasons
    .filter((reason) => reason.generalisable && reason.summary.trim())
    .map((reason) => {
      const writingOwned = WRITING_DIMENSIONS.has(reason.dimension);
      const eligibleForGlobalPromotion = validated.strength === "explicit_rule"
        || (validated.strength === "repeated_pattern" && validated.scope === "global");
      return Object.freeze({
        contract: BUSINESS_COMMUNICATION_HUMAN_FEEDBACK_CONTRACT,
        owner: writingOwned ? "evavo-writing-studio" as const : "evavo-worker-agent" as const,
        dimension: reason.dimension,
        lesson: reason.summary.trim(),
        decisionId: validated.decisionId,
        evidenceIds: validated.evidenceIds,
        mayChangeVoiceProfile: writingOwned,
        scope: validated.scope,
        strength: validated.strength,
        approvedSourceDraft: feedback.approved,
        eligibleForGlobalPromotion,
      });
    });
  return Object.freeze(candidates);
}

export function relationshipDecisionCorrectionRequired(feedback: HumanCommunicationFeedback): boolean {
  validateFeedback(feedback);
  if (feedback.originalDisposition !== feedback.finalDisposition) return true;
  return feedback.reasons.some((reason) => reason.generalisable && [
    "decision", "channel", "meeting", "recipient", "sender_identity", "factuality", "commitment", "attachment",
  ].includes(reason.dimension));
}
