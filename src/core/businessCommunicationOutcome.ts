export const BUSINESS_COMMUNICATION_OUTCOME_CONTRACT = "business_communication_outcome_v1" as const;

export type CommunicationOutcomeSignal = Readonly<{
  id: string;
  kind:
    | "sent"
    | "delivered"
    | "reply_received"
    | "positive_response"
    | "negative_response"
    | "obligation_satisfied"
    | "obligation_created"
    | "meeting_created"
    | "commercial_progress"
    | "relationship_repaired"
    | "relationship_risk_increased"
    | "no_response_observed"
    | "other";
  occurredAt: string;
  summary: string;
  sourceRefs: readonly string[];
  confidence: number;
}>;

export type CommunicationOutcomeAssessment = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_OUTCOME_CONTRACT;
  relationshipId: string;
  communicationId: string;
  assessedAt: string;
  outcome: "positive" | "neutral" | "negative" | "pending" | "mixed";
  relationshipEffect: "improved" | "unchanged" | "worsened" | "unknown";
  communicationWorked: boolean | null;
  obligationsSatisfied: readonly string[];
  newObligations: readonly string[];
  materialSignals: readonly CommunicationOutcomeSignal[];
  evidenceRefs: readonly string[];
  learningEligible: boolean;
  reasons: readonly string[];
}>;

function timestamp(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`COMMUNICATION_OUTCOME_${field.toUpperCase()}_INVALID`);
  return parsed;
}

function validSignal(signal: CommunicationOutcomeSignal): void {
  if (!signal.id.trim()) throw new Error("COMMUNICATION_OUTCOME_SIGNAL_ID_REQUIRED");
  timestamp(signal.occurredAt, "signal_occurred_at");
  if (!signal.summary.trim()) throw new Error("COMMUNICATION_OUTCOME_SIGNAL_SUMMARY_REQUIRED");
  if (!signal.sourceRefs.length) throw new Error("COMMUNICATION_OUTCOME_SIGNAL_EVIDENCE_REQUIRED");
  if (!Number.isFinite(signal.confidence) || signal.confidence < 0 || signal.confidence > 100) throw new Error("COMMUNICATION_OUTCOME_SIGNAL_CONFIDENCE_INVALID");
}

export function assessCommunicationOutcome(input: Readonly<{
  relationshipId: string;
  communicationId: string;
  assessedAt: string;
  signals: readonly CommunicationOutcomeSignal[];
  satisfiedObligationIds?: readonly string[];
  newObligationIds?: readonly string[];
}>): CommunicationOutcomeAssessment {
  const relationshipId = input.relationshipId.trim();
  const communicationId = input.communicationId.trim();
  if (!relationshipId) throw new Error("COMMUNICATION_OUTCOME_RELATIONSHIP_REQUIRED");
  if (!communicationId) throw new Error("COMMUNICATION_OUTCOME_COMMUNICATION_REQUIRED");
  const assessedAtMs = timestamp(input.assessedAt, "assessed_at");
  input.signals.forEach(validSignal);
  if (input.signals.some((signal) => timestamp(signal.occurredAt, "signal_occurred_at") > assessedAtMs + 60_000)) {
    throw new Error("COMMUNICATION_OUTCOME_FUTURE_SIGNAL");
  }

  const materialSignals = input.signals.filter((signal) => signal.confidence >= 60 && signal.kind !== "delivered" && signal.kind !== "sent");
  const positiveKinds = new Set(["positive_response", "obligation_satisfied", "commercial_progress", "relationship_repaired"]);
  const negativeKinds = new Set(["negative_response", "relationship_risk_increased"]);
  const positive = materialSignals.filter((signal) => positiveKinds.has(signal.kind)).length;
  const negative = materialSignals.filter((signal) => negativeKinds.has(signal.kind)).length;
  const replyReceived = materialSignals.some((signal) => signal.kind === "reply_received" || signal.kind === "positive_response" || signal.kind === "negative_response");
  const pendingOnly = materialSignals.length === 0 || materialSignals.every((signal) => signal.kind === "no_response_observed");

  let outcome: CommunicationOutcomeAssessment["outcome"] = "neutral";
  if (positive && negative) outcome = "mixed";
  else if (positive) outcome = "positive";
  else if (negative) outcome = "negative";
  else if (pendingOnly && !replyReceived) outcome = "pending";

  let relationshipEffect: CommunicationOutcomeAssessment["relationshipEffect"] = "unknown";
  if (materialSignals.some((signal) => signal.kind === "relationship_repaired" || signal.kind === "positive_response")) relationshipEffect = "improved";
  else if (materialSignals.some((signal) => signal.kind === "relationship_risk_increased" || signal.kind === "negative_response")) relationshipEffect = "worsened";
  else if (replyReceived || materialSignals.some((signal) => signal.kind === "obligation_satisfied")) relationshipEffect = "unchanged";

  let communicationWorked: boolean | null = null;
  if (negative > 0 && positive === 0) communicationWorked = false;
  else if (positive > 0) communicationWorked = true;
  else if (replyReceived) communicationWorked = true;

  const evidenceRefs = [...new Set(input.signals.flatMap((signal) => signal.sourceRefs))];
  const reasons: string[] = [];
  if (outcome === "positive") reasons.push("Evidence shows a positive or progress-producing outcome after the communication.");
  if (outcome === "negative") reasons.push("Evidence shows a negative response or increased relationship risk after the communication.");
  if (outcome === "mixed") reasons.push("The communication produced both positive and negative material signals; do not collapse this to a single success score.");
  if (outcome === "pending") reasons.push("There is not yet enough material post-send evidence to judge whether the communication worked.");
  if (!replyReceived && input.signals.some((signal) => signal.kind === "no_response_observed")) reasons.push("No response observed is not automatically a negative outcome.");

  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_OUTCOME_CONTRACT,
    relationshipId,
    communicationId,
    assessedAt: new Date(assessedAtMs).toISOString(),
    outcome,
    relationshipEffect,
    communicationWorked,
    obligationsSatisfied: Object.freeze([...new Set(input.satisfiedObligationIds ?? [])]),
    newObligations: Object.freeze([...new Set(input.newObligationIds ?? [])]),
    materialSignals: Object.freeze(materialSignals),
    evidenceRefs: Object.freeze(evidenceRefs),
    learningEligible: evidenceRefs.length > 0 && outcome !== "pending",
    reasons: Object.freeze(reasons),
  });
}
