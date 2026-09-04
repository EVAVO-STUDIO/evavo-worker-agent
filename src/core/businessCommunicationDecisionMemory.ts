import type { CommunicationDecisionPackage } from "./businessCommunicationDecisionPackage";

export const BUSINESS_COMMUNICATION_DECISION_MEMORY_CONTRACT = "business_communication_decision_memory_v1" as const;

export type CommunicationDecisionMemoryCandidate = Readonly<{
  sourceSystem: "evavo-worker-agent";
  sourceRef: string;
  occurredAt: string;
  kind: "decision";
  summary: string;
  details: string;
  material: true;
  confidence: "verified" | "supported" | "uncertain";
  entityRefs: readonly Readonly<{ kind: "relationship" | "person" | "organization" | "project" | "communication_thread" | "agent"; id: string }>[];
  evidenceRefs: readonly string[];
}>;

export function communicationDecisionToMemoryCandidate(input: Readonly<{
  decision: CommunicationDecisionPackage;
  decidedAt: string;
  relationshipId?: string | null;
  personId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  threadId?: string | null;
}>): CommunicationDecisionMemoryCandidate {
  const decidedAt = new Date(input.decidedAt);
  if (Number.isNaN(decidedAt.getTime())) throw new Error("COMMUNICATION_DECISION_MEMORY_DECIDED_AT_INVALID");
  if (!input.decision.evidenceIds.length) throw new Error("COMMUNICATION_DECISION_MEMORY_EVIDENCE_REQUIRED");
  const entities = [
    { kind: "agent" as const, id: "evavo-worker-agent" },
    ...(input.relationshipId ? [{ kind: "relationship" as const, id: input.relationshipId }] : []),
    ...(input.personId ? [{ kind: "person" as const, id: input.personId }] : []),
    ...(input.organizationId ? [{ kind: "organization" as const, id: input.organizationId }] : []),
    ...(input.projectId ? [{ kind: "project" as const, id: input.projectId }] : []),
    ...(input.threadId ? [{ kind: "communication_thread" as const, id: input.threadId }] : []),
  ];
  const confidence = input.decision.evidenceConfidence >= 85
    ? "verified" as const
    : input.decision.evidenceConfidence >= 60
      ? "supported" as const
      : "uncertain" as const;
  const details = [
    `Objective: ${input.decision.objective}`,
    `Disposition: ${input.decision.disposition}`,
    `Channel: ${input.decision.recommendedChannel}`,
    `Meeting justified: ${input.decision.meetingJustified ? "yes" : "no"}`,
    ...(input.decision.candidateStage ? [`Candidate stage: ${input.decision.candidateStage}`] : []),
    ...(input.decision.liveResponseTargets.length ? [`Live response targets: ${input.decision.liveResponseTargets.join(" | ")}`] : []),
    ...(input.decision.activeEvavoObligations.length ? [`EVAVO obligations: ${input.decision.activeEvavoObligations.join(" | ")}`] : []),
    ...(input.decision.prohibitedImplications.length ? [`Prohibited implications: ${input.decision.prohibitedImplications.join(" | ")}`] : []),
    ...(input.decision.reasons.length ? [`Reasons: ${input.decision.reasons.join(" | ")}`] : []),
  ].join("\n");
  return Object.freeze({
    sourceSystem: "evavo-worker-agent",
    sourceRef: `relationship-decision:${input.decision.packageId}`,
    occurredAt: decidedAt.toISOString(),
    kind: "decision",
    summary: `Relationship Manager chose ${input.decision.disposition} via ${input.decision.recommendedChannel}.`,
    details,
    material: true,
    confidence,
    entityRefs: Object.freeze(entities),
    evidenceRefs: Object.freeze([...new Set(input.decision.evidenceIds)]),
  });
}
