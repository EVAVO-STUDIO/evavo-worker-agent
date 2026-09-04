import type { CommunicationOutcomeAssessment } from "./businessCommunicationOutcome";

export const BUSINESS_COMMUNICATION_OUTCOME_MEMORY_CONTRACT = "business_communication_outcome_memory_v1" as const;

export type CommunicationOutcomeMemoryRecord = Readonly<{
  kind: "outcome";
  occurredAt: string;
  summary: string;
  details: string;
  entities: readonly Readonly<{ kind: "relationship" | "message"; id: string }>[];
  tags: readonly string[];
  confidence: "verified" | "supported";
  classification: "internal";
  sources: readonly Readonly<{
    system: string;
    ref: string;
    authority: "authoritative" | "supporting";
    observedAt: string;
  }>[];
  lineage: Readonly<{ derivedFrom: readonly string[] }>;
  canonicalOwner: "evavo-worker-agent";
  sourceSystem: "evavo-worker-agent";
}>;

function sourceSystem(ref: string): string {
  const prefix = ref.split(":", 1)[0]?.trim().toLowerCase();
  return prefix || "other";
}

export function communicationOutcomeToMemoryRecord(
  assessment: CommunicationOutcomeAssessment,
): CommunicationOutcomeMemoryRecord | null {
  if (!assessment.learningEligible) return null;
  if (!assessment.evidenceRefs.length) return null;
  const details = [
    `Outcome: ${assessment.outcome}`,
    `Relationship effect: ${assessment.relationshipEffect}`,
    `Communication worked: ${assessment.communicationWorked === null ? "not yet known" : String(assessment.communicationWorked)}`,
    ...(assessment.obligationsSatisfied.length ? [`Satisfied obligations: ${assessment.obligationsSatisfied.join(", ")}`] : []),
    ...(assessment.newObligations.length ? [`New obligations: ${assessment.newObligations.join(", ")}`] : []),
    ...assessment.reasons,
  ].join("\n");
  const summary = assessment.outcome === "positive"
    ? "Communication produced evidence-backed positive relationship or work progress."
    : assessment.outcome === "negative"
      ? "Communication was followed by evidence-backed negative relationship signals."
      : "Communication produced mixed evidence-backed outcomes that should be retained without collapsing them to a simple success score.";
  const confidence = assessment.materialSignals.every((signal) => signal.confidence >= 85) ? "verified" as const : "supported" as const;
  return Object.freeze({
    kind: "outcome",
    occurredAt: assessment.assessedAt,
    summary,
    details,
    entities: Object.freeze([
      { kind: "relationship" as const, id: assessment.relationshipId },
      { kind: "message" as const, id: assessment.communicationId },
    ]),
    tags: Object.freeze(["communication", "outcome", assessment.outcome, `relationship-${assessment.relationshipEffect}`]),
    confidence,
    classification: "internal",
    sources: Object.freeze(assessment.evidenceRefs.map((ref) => ({
      system: sourceSystem(ref),
      ref,
      authority: "supporting" as const,
      observedAt: assessment.assessedAt,
    }))),
    lineage: Object.freeze({ derivedFrom: Object.freeze([assessment.communicationId]) }),
    canonicalOwner: "evavo-worker-agent",
    sourceSystem: "evavo-worker-agent",
  });
}
