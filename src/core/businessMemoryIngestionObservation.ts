import type { GmailRelationshipStateProjection } from "./businessGmailRelationshipStateProjection";
import type { CommunicationDecisionMemoryCandidate } from "./businessCommunicationDecisionMemory";

export const BUSINESS_MEMORY_INGESTION_OBSERVATION_CONTRACT = "evavo-memory-ingestion-observation-v2" as const;

export type BusinessMemoryEntityRef = Readonly<{
  kind:
    | "person"
    | "organization"
    | "relationship"
    | "project"
    | "work_item"
    | "communication_thread"
    | "message"
    | "document"
    | "mailbox"
    | "agent"
    | "conversation"
    | "connector"
    | "deployment"
    | "repository"
    | "other";
  id: string;
  label?: string;
}>;

export type BusinessMemoryIngestionObservation = Readonly<{
  contract: typeof BUSINESS_MEMORY_INGESTION_OBSERVATION_CONTRACT;
  sourceSystem: string;
  sourceRef: string;
  observedAt: string;
  occurredAt: string;
  kind: "message" | "decision" | "obligation" | "fact" | "status_change" | "agent_action" | "conversation_checkpoint";
  summary: string;
  details?: string;
  entities: readonly BusinessMemoryEntityRef[];
  tags: readonly string[];
  authority: "canonical" | "authoritative" | "supporting" | "observational";
  confidence: "verified" | "supported" | "inferred" | "uncertain";
  classification: "public" | "internal" | "confidential" | "restricted";
  material: boolean;
  priorMemoryIds?: readonly string[];
  actorId?: string;
}>;

function iso(value: string, field: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(`BUSINESS_MEMORY_INGESTION_${field.toUpperCase()}_INVALID`);
  return parsed.toISOString();
}

function text(value: string, field: string, max = 1600): string {
  const clean = value.trim();
  if (!clean || clean.length > max) throw new Error(`BUSINESS_MEMORY_INGESTION_${field.toUpperCase()}_INVALID`);
  return clean;
}

function entities(values: readonly BusinessMemoryEntityRef[]): readonly BusinessMemoryEntityRef[] {
  const cleaned = values.map((entity) => Object.freeze({ ...entity, id: text(entity.id, "entity_id", 240) }));
  if (!cleaned.length) throw new Error("BUSINESS_MEMORY_INGESTION_ENTITY_REQUIRED");
  const byKey = new Map(cleaned.map((entity) => [`${entity.kind}:${entity.id}`, entity]));
  return Object.freeze([...byKey.values()]);
}

export function gmailRelationshipProjectionToMemoryObservations(
  projection: GmailRelationshipStateProjection,
): readonly BusinessMemoryIngestionObservation[] {
  const observedAt = iso(projection.observedAt, "observed_at");
  return Object.freeze(projection.memoryCandidates.map((candidate) => Object.freeze({
    contract: BUSINESS_MEMORY_INGESTION_OBSERVATION_CONTRACT,
    sourceSystem: candidate.sourceSystem,
    sourceRef: text(candidate.sourceRef, "source_ref", 1000),
    observedAt,
    occurredAt: iso(candidate.occurredAt, "occurred_at"),
    kind: candidate.kind,
    summary: text(candidate.summary, "summary"),
    entities: entities(candidate.entityRefs),
    tags: Object.freeze([
      "relationship",
      "communication",
      candidate.kind === "message" ? "message" : "commitment",
      "gmail",
    ]),
    authority: candidate.kind === "message" ? "authoritative" as const : "supporting" as const,
    confidence: candidate.kind === "message" ? "verified" as const : "supported" as const,
    classification: "internal" as const,
    material: candidate.material,
    actorId: "evavo-worker-agent",
  })));
}

export function communicationDecisionCandidateToMemoryObservation(
  candidate: CommunicationDecisionMemoryCandidate,
): BusinessMemoryIngestionObservation {
  const provenanceTags = [
    `decision-origin:${candidate.origin}`,
    ...(candidate.relationshipCycleId ? [`relationship-cycle:${candidate.relationshipCycleId}`] : []),
  ];
  return Object.freeze({
    contract: BUSINESS_MEMORY_INGESTION_OBSERVATION_CONTRACT,
    sourceSystem: candidate.sourceSystem,
    sourceRef: text(candidate.sourceRef, "source_ref", 1000),
    observedAt: iso(candidate.occurredAt, "observed_at"),
    occurredAt: iso(candidate.occurredAt, "occurred_at"),
    kind: "decision",
    summary: text(candidate.summary, "summary"),
    details: candidate.details,
    entities: entities(candidate.entityRefs),
    tags: Object.freeze(["relationship", "communication", "decision", "evavo-worker-agent", ...provenanceTags]),
    authority: "canonical",
    confidence: candidate.confidence,
    classification: "internal",
    material: true,
    actorId: "evavo-worker-agent",
  });
}
