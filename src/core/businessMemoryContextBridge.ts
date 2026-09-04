export const BUSINESS_MEMORY_CONTEXT_BRIDGE_CONTRACT = "business_memory_context_bridge_v1" as const;

export type BrainMemoryEntityRef = Readonly<{
  kind: "person" | "organization" | "relationship" | "project" | "work_item" | "communication_thread" | "message" | "document" | "mailbox" | "agent" | "conversation" | "connector" | "deployment" | "repository" | "other";
  id: string;
  label?: string;
}>;

export type BrainMemoryContextRequest = Readonly<{
  protocol: "evavo-memory-fabric-v2";
  intent: "relationship" | "communication" | "project_delivery" | "commercial" | "support" | "writing" | "research" | "operations" | "agent_execution" | "general";
  entityRefs: readonly BrainMemoryEntityRef[];
  text?: string;
  tags?: readonly string[];
  asOf?: string;
  maximumRecords: number;
  maximumCharacters: number;
  includeSuperseded: boolean;
  includeDisputed: boolean;
  includeInvalidated: boolean;
  includeInferred: boolean;
}>;

export type BrainMemoryContextRecord = Readonly<{
  id: string;
  kind: string;
  summary: string;
  occurredAt: string;
  confidence: string;
  status: string;
  canonicalOwner?: string;
  sourceRefs: readonly string[];
  score: number;
  whyIncluded: readonly string[];
}>;

export type BrainMemoryContextResponse = Readonly<{
  protocol: "evavo-memory-fabric-v2";
  generatedAt: string;
  asOf: string;
  summary: string;
  records: readonly BrainMemoryContextRecord[];
  omittedRecordCount: number;
}>;

export type BusinessMemoryContext = Readonly<{
  contract: typeof BUSINESS_MEMORY_CONTEXT_BRIDGE_CONTRACT;
  requestedAt: string;
  relationshipId?: string;
  personId?: string;
  organizationId?: string;
  projectId?: string;
  threadId?: string;
  request: BrainMemoryContextRequest;
}>;

export function buildBusinessMemoryContextRequest(input: Readonly<{
  intent: BrainMemoryContextRequest["intent"];
  relationshipId?: string;
  personId?: string;
  organizationId?: string;
  projectId?: string;
  threadId?: string;
  text?: string;
  tags?: readonly string[];
  asOf?: string;
  maximumRecords?: number;
  maximumCharacters?: number;
  includeHistoricalConflict?: boolean;
}>): BusinessMemoryContext {
  const entityRefs: BrainMemoryEntityRef[] = [];
  if (input.relationshipId) entityRefs.push({ kind: "relationship", id: input.relationshipId });
  if (input.personId) entityRefs.push({ kind: "person", id: input.personId });
  if (input.organizationId) entityRefs.push({ kind: "organization", id: input.organizationId });
  if (input.projectId) entityRefs.push({ kind: "project", id: input.projectId });
  if (input.threadId) entityRefs.push({ kind: "communication_thread", id: input.threadId });
  if (!entityRefs.length) throw new Error("BUSINESS_MEMORY_CONTEXT_ENTITY_REQUIRED");

  const maximumRecords = Math.min(Math.max(input.maximumRecords ?? 40, 1), 100);
  const maximumCharacters = Math.min(Math.max(input.maximumCharacters ?? 30_000, 2_000), 100_000);
  const request: BrainMemoryContextRequest = Object.freeze({
    protocol: "evavo-memory-fabric-v2",
    intent: input.intent,
    entityRefs: Object.freeze(entityRefs),
    ...(input.text?.trim() ? { text: input.text.trim() } : {}),
    ...(input.tags?.length ? { tags: Object.freeze([...new Set(input.tags.map((item) => item.trim()).filter(Boolean))]) } : {}),
    ...(input.asOf ? { asOf: new Date(input.asOf).toISOString() } : {}),
    maximumRecords,
    maximumCharacters,
    includeSuperseded: Boolean(input.includeHistoricalConflict),
    includeDisputed: Boolean(input.includeHistoricalConflict),
    includeInvalidated: Boolean(input.includeHistoricalConflict),
    includeInferred: false,
  });

  return Object.freeze({
    contract: BUSINESS_MEMORY_CONTEXT_BRIDGE_CONTRACT,
    requestedAt: new Date().toISOString(),
    ...(input.relationshipId ? { relationshipId: input.relationshipId } : {}),
    ...(input.personId ? { personId: input.personId } : {}),
    ...(input.organizationId ? { organizationId: input.organizationId } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.threadId ? { threadId: input.threadId } : {}),
    request,
  });
}

export function memoryContextEvidenceRefs(response: BrainMemoryContextResponse): readonly string[] {
  return Object.freeze([...new Set(response.records.flatMap((record) => record.sourceRefs))]);
}

export function assertMemoryContextUsable(response: BrainMemoryContextResponse): void {
  if (response.protocol !== "evavo-memory-fabric-v2") throw new Error("BUSINESS_MEMORY_CONTEXT_PROTOCOL_INVALID");
  if (!response.records.length) throw new Error("BUSINESS_MEMORY_CONTEXT_EMPTY");
  if (response.records.some((record) => !record.sourceRefs.length)) throw new Error("BUSINESS_MEMORY_CONTEXT_UNSOURCED_RECORD");
}
