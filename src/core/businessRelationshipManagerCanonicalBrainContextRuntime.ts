import type { BrainMemoryContextPort, BrainMemoryContextReadResult } from "./businessBrainMemoryContextPort";
import { buildBusinessMemoryContextRequest } from "./businessMemoryContextBridge";
import {
  runCanonicalRelationshipManagerCommunicationCycle,
  type CanonicalRelationshipContextInput,
  type CanonicalRelationshipManagerCycle,
  type CanonicalRelationshipManagerCycleInput,
} from "./businessRelationshipManagerCanonicalRuntime";
import type { Relationship360EvidenceItem } from "./businessRelationship360Context";
import type { RelationshipSourceReadinessItem } from "./businessRelationshipSourceReadiness";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_BRAIN_CONTEXT_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_brain_context_runtime_v1" as const;

export type CanonicalBrainHydratedContextInput = Readonly<Omit<CanonicalRelationshipContextInput, "memory" | "sourceReadiness"> & {
  sourceReadiness?: readonly RelationshipSourceReadinessItem[] | null;
}>;

export type CanonicalRelationshipManagerBrainContextInput = Readonly<{
  cycle: CanonicalRelationshipManagerCycleInput["cycle"];
  context: CanonicalBrainHydratedContextInput;
  brain: BrainMemoryContextPort;
}>;

export type CanonicalRelationshipManagerBrainContextResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_BRAIN_CONTEXT_RUNTIME_CONTRACT;
  brainState: "verified" | "not_found" | "provider_unavailable";
  queryEvidenceRef: string | null;
  memoryRecordCount: number;
  canonicalCycle: CanonicalRelationshipManagerCycle;
  externalEffectPerformed: false;
}>;

function required(value: string | null | undefined, code: string): string {
  const clean = value?.trim() ?? "";
  if (!clean) throw new Error(code);
  return clean;
}

function availabilityFailure(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return error.message === "BRAIN_MEMORY_CONTEXT_READ_TIMEOUT"
    || error.message === "BRAIN_MEMORY_CONTEXT_READ_UNAVAILABLE"
    || /^BRAIN_MEMORY_CONTEXT_READ_FAILED:\d{3}$/.test(error.message);
}

function withoutMemoryDomain(
  values: readonly RelationshipSourceReadinessItem[] | null | undefined,
): readonly RelationshipSourceReadinessItem[] {
  const input = values ?? [];
  if (input.some((item) => item.domain === "memory")) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_BRAIN_CALLER_MEMORY_READINESS_FORBIDDEN");
  }
  return Object.freeze([...input]);
}

function memoryEvidenceItem(read: BrainMemoryContextReadResult): Relationship360EvidenceItem {
  const records = read.context.records;
  const sourceRefs = Object.freeze([...new Set([
    read.queryEvidenceRef,
    ...records.flatMap((record) => record.sourceRefs),
  ])]);
  return Object.freeze({
    id: `brain-memory-query-${read.queryEvidenceRef.slice(-24)}`,
    domain: "memory",
    summary: records.length
      ? `Brain durable memory query returned ${records.length} evidence-backed relationship record${records.length === 1 ? "" : "s"}.`
      : "Brain durable memory was queried successfully and no prior relationship records matched.",
    status: "current",
    authority: "observational",
    observedAt: read.context.generatedAt,
    sourceRefs,
  });
}

function successfulMemoryReadiness(read: BrainMemoryContextReadResult): RelationshipSourceReadinessItem {
  if (read.context.records.length) {
    return Object.freeze({
      domain: "memory",
      state: "verified",
      required: true,
      observedAt: read.context.generatedAt,
      sourceRefs: Object.freeze([read.queryEvidenceRef, ...read.context.records.flatMap((record) => record.sourceRefs)]),
      detail: `Brain returned ${read.context.records.length} durable relationship memory record${read.context.records.length === 1 ? "" : "s"}.`,
    });
  }
  return Object.freeze({
    domain: "memory",
    state: "not_found",
    required: true,
    absenceAcceptable: true,
    observedAt: read.context.generatedAt,
    sourceRefs: Object.freeze([read.queryEvidenceRef]),
    detail: "Brain was queried successfully and no prior durable relationship memory matched.",
  });
}

export async function runCanonicalRelationshipManagerCycleWithBrainContext(
  input: CanonicalRelationshipManagerBrainContextInput,
): Promise<CanonicalRelationshipManagerBrainContextResult> {
  if (input.brain.contract !== "business_brain_memory_context_port_v1") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_BRAIN_PORT_CONTRACT_INVALID");
  }
  const relationshipId = required(input.cycle.gmail.relationshipId, "RELATIONSHIP_MANAGER_CANONICAL_BRAIN_RELATIONSHIP_ID_REQUIRED");
  const personId = required(input.cycle.gmail.personId, "RELATIONSHIP_MANAGER_CANONICAL_BRAIN_PERSON_ID_REQUIRED");
  const baseSourceReadiness = withoutMemoryDomain(input.context.sourceReadiness);
  const memoryRequest = buildBusinessMemoryContextRequest({
    intent: "communication",
    relationshipId,
    personId,
    ...(input.cycle.gmail.organizationId ? { organizationId: input.cycle.gmail.organizationId } : {}),
    ...(input.cycle.gmail.projectId ? { projectId: input.cycle.gmail.projectId } : {}),
    threadId: input.cycle.gmail.threadId,
    asOf: input.cycle.decisionAt,
    maximumRecords: 40,
    maximumCharacters: 30_000,
    includeHistoricalConflict: true,
  }).request;

  let read: BrainMemoryContextReadResult | null = null;
  let brainState: CanonicalRelationshipManagerBrainContextResult["brainState"] = "provider_unavailable";
  let memorySourceReadiness: RelationshipSourceReadinessItem;
  let memoryEvidence: Relationship360EvidenceItem | null = null;

  try {
    read = await input.brain.read(memoryRequest);
    if (read.context.asOf !== new Date(input.cycle.decisionAt).toISOString()) {
      throw new Error("RELATIONSHIP_MANAGER_CANONICAL_BRAIN_AS_OF_MISMATCH");
    }
    brainState = read.context.records.length ? "verified" : "not_found";
    memorySourceReadiness = successfulMemoryReadiness(read);
    memoryEvidence = memoryEvidenceItem(read);
  } catch (error) {
    if (!availabilityFailure(error)) throw error;
    memorySourceReadiness = Object.freeze({
      domain: "memory",
      state: "provider_unavailable",
      required: true,
      detail: "Brain durable relationship memory could not be queried; prior decisions, obligations, outcomes and relationship history are unknown.",
    });
  }

  const context: CanonicalRelationshipContextInput = Object.freeze({
    ...input.context,
    evidenceItems: Object.freeze([
      ...input.context.evidenceItems,
      ...(memoryEvidence ? [memoryEvidence] : []),
    ]),
    ...(read && read.context.records.length ? { memory: read.context } : {}),
    sourceReadiness: Object.freeze([...baseSourceReadiness, memorySourceReadiness]),
  });
  const canonicalCycle = runCanonicalRelationshipManagerCommunicationCycle({
    cycle: input.cycle,
    context,
  });
  if (brainState === "provider_unavailable" && canonicalCycle.approvalGradeReady) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_BRAIN_UNAVAILABLE_READINESS_WIDENED");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_BRAIN_CONTEXT_RUNTIME_CONTRACT,
    brainState,
    queryEvidenceRef: read?.queryEvidenceRef ?? null,
    memoryRecordCount: read?.context.records.length ?? 0,
    canonicalCycle,
    externalEffectPerformed: false,
  });
}
