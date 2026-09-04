import {
  applyObligationTransition,
  type BusinessObligation,
  type ObligationTransition,
} from "./businessObligationLedger";
import type {
  CommunicationOutcomeAssessment,
  CommunicationOutcomeSignal,
} from "./businessCommunicationOutcome";

export const BUSINESS_COMMUNICATION_OUTCOME_RECONCILER_CONTRACT = "business_communication_outcome_reconciler_v1" as const;

export type ObligationSatisfactionObservation = Readonly<{
  obligationId: string;
  evidenceIds: readonly string[];
  occurredAt: string;
  confidence: number;
}>;

export type NewObligationObservation = Readonly<{
  obligation: BusinessObligation;
  evidenceIds: readonly string[];
  confidence: number;
}>;

export type CommunicationOutcomeReconciliation = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_OUTCOME_RECONCILER_CONTRACT;
  communicationId: string;
  relationshipId: string;
  reconciledAt: string;
  obligations: readonly BusinessObligation[];
  transitions: readonly ObligationTransition[];
  newObligations: readonly BusinessObligation[];
  unresolvedSatisfactionClaims: readonly string[];
  evidenceRefs: readonly string[];
}>;

function unique(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))]);
}

function validTimestamp(value: string, field: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`COMMUNICATION_RECONCILER_${field.toUpperCase()}_INVALID`);
  return new Date(parsed).toISOString();
}

function assertConfidence(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 100) {
    throw new Error("COMMUNICATION_RECONCILER_CONFIDENCE_INVALID");
  }
}

export function reconcileCommunicationOutcome(input: Readonly<{
  assessment: CommunicationOutcomeAssessment;
  currentObligations: readonly BusinessObligation[];
  satisfactionObservations?: readonly ObligationSatisfactionObservation[];
  newObligationObservations?: readonly NewObligationObservation[];
  minimumStateChangeConfidence?: number;
}>): CommunicationOutcomeReconciliation {
  const threshold = input.minimumStateChangeConfidence ?? 80;
  assertConfidence(threshold);
  const reconciledAt = validTimestamp(input.assessment.assessedAt, "reconciled_at");
  const obligations = new Map(input.currentObligations.map((item) => [item.id, item]));
  const transitions: ObligationTransition[] = [];
  const unresolvedSatisfactionClaims: string[] = [];
  const evidenceRefs = new Set(input.assessment.evidenceRefs);

  for (const observation of input.satisfactionObservations ?? []) {
    assertConfidence(observation.confidence);
    const evidenceIds = unique(observation.evidenceIds);
    if (!evidenceIds.length || observation.confidence < threshold) continue;
    evidenceIds.forEach((id) => evidenceRefs.add(id));
    const current = obligations.get(observation.obligationId);
    if (!current) {
      unresolvedSatisfactionClaims.push(observation.obligationId);
      continue;
    }
    if (current.relationshipId && current.relationshipId !== input.assessment.relationshipId) {
      throw new Error("COMMUNICATION_RECONCILER_RELATIONSHIP_MISMATCH");
    }
    if (current.status === "satisfied") continue;
    if (current.status === "superseded" || current.status === "cancelled") {
      unresolvedSatisfactionClaims.push(observation.obligationId);
      continue;
    }
    const transition: ObligationTransition = Object.freeze({
      kind: "satisfy",
      obligationId: current.id,
      evidenceIds,
      occurredAt: validTimestamp(observation.occurredAt, "satisfaction_at"),
    });
    obligations.set(current.id, applyObligationTransition(current, transition));
    transitions.push(transition);
  }

  const newObligations: BusinessObligation[] = [];
  for (const observation of input.newObligationObservations ?? []) {
    assertConfidence(observation.confidence);
    const evidenceIds = unique(observation.evidenceIds);
    if (!evidenceIds.length || observation.confidence < threshold) continue;
    evidenceIds.forEach((id) => evidenceRefs.add(id));
    const candidate = observation.obligation;
    if (candidate.relationshipId && candidate.relationshipId !== input.assessment.relationshipId) {
      throw new Error("COMMUNICATION_RECONCILER_NEW_OBLIGATION_RELATIONSHIP_MISMATCH");
    }
    if (!candidate.sourceEvidenceIds.some((id) => evidenceIds.includes(id))) {
      throw new Error("COMMUNICATION_RECONCILER_NEW_OBLIGATION_EVIDENCE_MISMATCH");
    }
    if (obligations.has(candidate.id)) continue;
    obligations.set(candidate.id, candidate);
    newObligations.push(candidate);
  }

  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_OUTCOME_RECONCILER_CONTRACT,
    communicationId: input.assessment.communicationId,
    relationshipId: input.assessment.relationshipId,
    reconciledAt,
    obligations: Object.freeze([...obligations.values()]),
    transitions: Object.freeze(transitions),
    newObligations: Object.freeze(newObligations),
    unresolvedSatisfactionClaims: Object.freeze(unresolvedSatisfactionClaims),
    evidenceRefs: Object.freeze([...evidenceRefs]),
  });
}

export function outcomeSignalsFromReconciliation(
  reconciliation: CommunicationOutcomeReconciliation,
): readonly CommunicationOutcomeSignal[] {
  const signals: CommunicationOutcomeSignal[] = [];
  for (const transition of reconciliation.transitions) {
    signals.push(Object.freeze({
      id: `outcome:${transition.obligationId}:satisfied`,
      kind: "obligation_satisfied",
      occurredAt: transition.occurredAt,
      summary: `Obligation ${transition.obligationId} was satisfied with evidence.`,
      sourceRefs: transition.evidenceIds,
      confidence: 100,
    }));
  }
  for (const obligation of reconciliation.newObligations) {
    signals.push(Object.freeze({
      id: `outcome:${obligation.id}:created`,
      kind: "obligation_created",
      occurredAt: obligation.createdAt,
      summary: `New obligation ${obligation.id} was created from post-communication evidence.`,
      sourceRefs: obligation.sourceEvidenceIds,
      confidence: 100,
    }));
  }
  return Object.freeze(signals);
}
