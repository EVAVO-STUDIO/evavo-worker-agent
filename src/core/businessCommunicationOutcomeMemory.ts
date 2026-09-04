import type { CommunicationOutcomeAssessment } from "./businessCommunicationOutcome";

export const BUSINESS_COMMUNICATION_OUTCOME_MEMORY_CONTRACT = "business_communication_outcome_memory_v2" as const;

export type CommunicationOutcomeLearningProvenance = Readonly<{
  decisionPackageId: string;
  decisionOrigin: "direct" | "relationship_manager_cycle";
  relationshipCycleId?: string | null;
  handoffId?: string | null;
  writingRequestId?: string | null;
  providerMessageId?: string | null;
}>;

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
  lineage: Readonly<{
    derivedFrom: readonly string[];
    decisionPackageId?: string;
    decisionOrigin?: "direct" | "relationship_manager_cycle";
    relationshipCycleId?: string;
    handoffId?: string;
    writingRequestId?: string;
    providerMessageId?: string;
  }>;
  canonicalOwner: "evavo-worker-agent";
  sourceSystem: "evavo-worker-agent";
}>;

function sourceSystem(ref: string): string {
  const prefix = ref.split(":", 1)[0]?.trim().toLowerCase();
  return prefix || "other";
}

function optional(value: string | null | undefined): string | undefined {
  const clean = value?.trim() ?? "";
  return clean || undefined;
}

function validateProvenance(
  value: CommunicationOutcomeLearningProvenance | null | undefined,
): CommunicationOutcomeLearningProvenance | null {
  if (!value) return null;
  const decisionPackageId = optional(value.decisionPackageId);
  if (!decisionPackageId) throw new Error("COMMUNICATION_OUTCOME_MEMORY_DECISION_PACKAGE_REQUIRED");
  const relationshipCycleId = optional(value.relationshipCycleId);
  const handoffId = optional(value.handoffId);
  const writingRequestId = optional(value.writingRequestId);
  const providerMessageId = optional(value.providerMessageId);
  if (value.decisionOrigin === "relationship_manager_cycle") {
    if (!relationshipCycleId) throw new Error("COMMUNICATION_OUTCOME_MEMORY_RELATIONSHIP_CYCLE_REQUIRED");
    if (!handoffId || !writingRequestId) throw new Error("COMMUNICATION_OUTCOME_MEMORY_WRITING_PROVENANCE_REQUIRED");
  } else if (relationshipCycleId) {
    throw new Error("COMMUNICATION_OUTCOME_MEMORY_DIRECT_CYCLE_FORBIDDEN");
  }
  return Object.freeze({
    decisionPackageId,
    decisionOrigin: value.decisionOrigin,
    ...(relationshipCycleId ? { relationshipCycleId } : {}),
    ...(handoffId ? { handoffId } : {}),
    ...(writingRequestId ? { writingRequestId } : {}),
    ...(providerMessageId ? { providerMessageId } : {}),
  });
}

export function communicationOutcomeToMemoryRecord(
  assessment: CommunicationOutcomeAssessment,
  provenance?: CommunicationOutcomeLearningProvenance | null,
): CommunicationOutcomeMemoryRecord | null {
  if (!assessment.learningEligible) return null;
  if (!assessment.evidenceRefs.length) return null;
  const validatedProvenance = validateProvenance(provenance);
  if (validatedProvenance?.providerMessageId && validatedProvenance.providerMessageId !== assessment.communicationId) {
    throw new Error("COMMUNICATION_OUTCOME_MEMORY_PROVIDER_MESSAGE_MISMATCH");
  }
  const details = [
    `Outcome: ${assessment.outcome}`,
    `Relationship effect: ${assessment.relationshipEffect}`,
    `Communication worked: ${assessment.communicationWorked === null ? "not yet known" : String(assessment.communicationWorked)}`,
    ...(validatedProvenance ? [`Decision package: ${validatedProvenance.decisionPackageId}`] : []),
    ...(validatedProvenance?.relationshipCycleId ? [`Relationship cycle: ${validatedProvenance.relationshipCycleId}`] : []),
    ...(validatedProvenance?.writingRequestId ? [`Writing request: ${validatedProvenance.writingRequestId}`] : []),
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
  const tags = ["communication", "outcome", assessment.outcome, `relationship-${assessment.relationshipEffect}`];
  if (validatedProvenance) {
    tags.push(`decision-origin:${validatedProvenance.decisionOrigin}`);
    tags.push(`decision-package:${validatedProvenance.decisionPackageId}`);
    if (validatedProvenance.relationshipCycleId) tags.push(`relationship-cycle:${validatedProvenance.relationshipCycleId}`);
    if (validatedProvenance.writingRequestId) tags.push(`writing-request:${validatedProvenance.writingRequestId}`);
  }
  return Object.freeze({
    kind: "outcome",
    occurredAt: assessment.assessedAt,
    summary,
    details,
    entities: Object.freeze([
      { kind: "relationship" as const, id: assessment.relationshipId },
      { kind: "message" as const, id: assessment.communicationId },
    ]),
    tags: Object.freeze(tags),
    confidence,
    classification: "internal",
    sources: Object.freeze(assessment.evidenceRefs.map((ref) => ({
      system: sourceSystem(ref),
      ref,
      authority: "supporting" as const,
      observedAt: assessment.assessedAt,
    }))),
    lineage: Object.freeze({
      derivedFrom: Object.freeze([assessment.communicationId]),
      ...(validatedProvenance ? {
        decisionPackageId: validatedProvenance.decisionPackageId,
        decisionOrigin: validatedProvenance.decisionOrigin,
        ...(validatedProvenance.relationshipCycleId ? { relationshipCycleId: validatedProvenance.relationshipCycleId } : {}),
        ...(validatedProvenance.handoffId ? { handoffId: validatedProvenance.handoffId } : {}),
        ...(validatedProvenance.writingRequestId ? { writingRequestId: validatedProvenance.writingRequestId } : {}),
        ...(validatedProvenance.providerMessageId ? { providerMessageId: validatedProvenance.providerMessageId } : {}),
      } : {}),
    }),
    canonicalOwner: "evavo-worker-agent",
    sourceSystem: "evavo-worker-agent",
  });
}
