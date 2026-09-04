import type {
  BrainMemoryContextRequest,
  BrainMemoryContextResponse,
  BrainMemoryContextRecord,
} from "./businessMemoryContextBridge";

export const BUSINESS_BRAIN_MEMORY_CONTEXT_PORT_CONTRACT =
  "business_brain_memory_context_port_v1" as const;

export type BrainMemoryContextPortConfig = Readonly<{
  baseUrl: string;
  apiToken: string;
  timeoutMs?: number;
}>;

export type BrainMemoryContextFetch = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

export type BrainMemoryContextReadResult = Readonly<{
  contract: typeof BUSINESS_BRAIN_MEMORY_CONTEXT_PORT_CONTRACT;
  context: BrainMemoryContextResponse;
  queryEvidenceRef: string;
  restrictedRecordsExcluded: number;
}>;

export type BrainMemoryContextPort = Readonly<{
  contract: typeof BUSINESS_BRAIN_MEMORY_CONTEXT_PORT_CONTRACT;
  read(request: BrainMemoryContextRequest): Promise<BrainMemoryContextReadResult>;
}>;

type BrainToolCallResponse = Readonly<{
  name?: unknown;
  ok?: unknown;
  output?: unknown;
  approvalRequired?: unknown;
}>;

function baseUrl(value: string): string {
  const clean = value.trim().replace(/\/+$/, "");
  if (!clean) throw new Error("BRAIN_MEMORY_CONTEXT_BASE_URL_REQUIRED");
  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    throw new Error("BRAIN_MEMORY_CONTEXT_BASE_URL_INVALID");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("BRAIN_MEMORY_CONTEXT_BASE_URL_PROTOCOL_INVALID");
  if (parsed.username || parsed.password) throw new Error("BRAIN_MEMORY_CONTEXT_BASE_URL_CREDENTIALS_FORBIDDEN");
  return clean;
}

function token(value: string): string {
  const clean = value.trim();
  if (new TextEncoder().encode(clean).byteLength < 32 || clean.length > 4096) throw new Error("BRAIN_MEMORY_CONTEXT_API_TOKEN_INVALID");
  return clean;
}

function timeout(value: number | undefined): number {
  const result = value ?? 10_000;
  if (!Number.isFinite(result) || result < 250 || result > 60_000) throw new Error("BRAIN_MEMORY_CONTEXT_TIMEOUT_INVALID");
  return Math.floor(result);
}

function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`BRAIN_MEMORY_CONTEXT_${field.toUpperCase()}_INVALID`);
  return value as Record<string, unknown>;
}

function text(value: unknown, field: string, maximum = 1600): string {
  if (typeof value !== "string") throw new Error(`BRAIN_MEMORY_CONTEXT_${field.toUpperCase()}_INVALID`);
  const clean = value.trim();
  if (!clean || clean.length > maximum) throw new Error(`BRAIN_MEMORY_CONTEXT_${field.toUpperCase()}_INVALID`);
  return clean;
}

function iso(value: unknown, field: string): string {
  const clean = text(value, field, 100);
  const parsed = new Date(clean);
  if (Number.isNaN(parsed.getTime())) throw new Error(`BRAIN_MEMORY_CONTEXT_${field.toUpperCase()}_INVALID`);
  return parsed.toISOString();
}

function stringArray(value: unknown, field: string, maximumItems = 500): readonly string[] {
  if (!Array.isArray(value) || value.length > maximumItems) throw new Error(`BRAIN_MEMORY_CONTEXT_${field.toUpperCase()}_INVALID`);
  return Object.freeze([...new Set(value.map((item, index) => text(item, `${field}_${index}`, 1000)))]);
}

function number(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`BRAIN_MEMORY_CONTEXT_${field.toUpperCase()}_INVALID`);
  return value;
}

function record(value: unknown, index: number): BrainMemoryContextRecord {
  const raw = object(value, `record_${index}`);
  const sourceRefs = stringArray(raw.sourceRefs, `record_${index}_source_refs`, 100);
  if (!sourceRefs.length) throw new Error("BRAIN_MEMORY_CONTEXT_UNSOURCED_RECORD");
  const whyIncluded = stringArray(raw.whyIncluded, `record_${index}_why_included`, 100);
  const canonicalOwner = typeof raw.canonicalOwner === "string" && raw.canonicalOwner.trim()
    ? raw.canonicalOwner.trim()
    : undefined;
  return Object.freeze({
    id: text(raw.id, `record_${index}_id`, 300),
    kind: text(raw.kind, `record_${index}_kind`, 80),
    summary: text(raw.summary, `record_${index}_summary`, 1600),
    occurredAt: iso(raw.occurredAt, `record_${index}_occurred_at`),
    confidence: text(raw.confidence, `record_${index}_confidence`, 40),
    status: text(raw.status, `record_${index}_status`, 40),
    ...(canonicalOwner ? { canonicalOwner } : {}),
    sourceRefs,
    score: number(raw.score, `record_${index}_score`),
    whyIncluded,
  });
}

function parseOutput(value: unknown): BrainMemoryContextReadResult {
  const raw = object(value, "output");
  if (raw.protocol !== "evavo-memory-fabric-v2") throw new Error("BRAIN_MEMORY_CONTEXT_PROTOCOL_INVALID");
  if (!Array.isArray(raw.records) || raw.records.length > 100) throw new Error("BRAIN_MEMORY_CONTEXT_RECORDS_INVALID");
  const records = Object.freeze(raw.records.map(record));
  const omittedRecordCount = number(raw.omittedRecordCount, "omitted_record_count");
  if (!Number.isInteger(omittedRecordCount) || omittedRecordCount < 0) throw new Error("BRAIN_MEMORY_CONTEXT_OMITTED_RECORD_COUNT_INVALID");
  const restrictedRecordsExcluded = number(raw.restrictedRecordsExcluded, "restricted_records_excluded");
  if (!Number.isInteger(restrictedRecordsExcluded) || restrictedRecordsExcluded < 0) throw new Error("BRAIN_MEMORY_CONTEXT_RESTRICTED_EXCLUDED_INVALID");
  const queryEvidenceRef = text(raw.queryEvidenceRef, "query_evidence_ref", 300);
  if (!/^brain:memory-context-query:[a-f0-9]{64}$/.test(queryEvidenceRef)) throw new Error("BRAIN_MEMORY_CONTEXT_QUERY_EVIDENCE_INVALID");
  const context: BrainMemoryContextResponse = Object.freeze({
    protocol: "evavo-memory-fabric-v2",
    generatedAt: iso(raw.generatedAt, "generated_at"),
    asOf: iso(raw.asOf, "as_of"),
    summary: text(raw.summary, "summary", 12_000),
    records,
    omittedRecordCount,
  });
  return Object.freeze({
    contract: BUSINESS_BRAIN_MEMORY_CONTEXT_PORT_CONTRACT,
    context,
    queryEvidenceRef,
    restrictedRecordsExcluded,
  });
}

function validateRequest(request: BrainMemoryContextRequest): void {
  if (request.protocol !== "evavo-memory-fabric-v2") throw new Error("BRAIN_MEMORY_CONTEXT_REQUEST_PROTOCOL_INVALID");
  if (!request.entityRefs.some((entity) => entity.kind === "relationship" && entity.id.trim())) {
    throw new Error("BRAIN_MEMORY_CONTEXT_RELATIONSHIP_ENTITY_REQUIRED");
  }
  if (request.maximumRecords < 1 || request.maximumRecords > 100) throw new Error("BRAIN_MEMORY_CONTEXT_MAXIMUM_RECORDS_INVALID");
  if (request.maximumCharacters < 2_000 || request.maximumCharacters > 100_000) throw new Error("BRAIN_MEMORY_CONTEXT_MAXIMUM_CHARACTERS_INVALID");
}

export function createBrainMemoryContextPort(
  config: BrainMemoryContextPortConfig,
  fetchFn: BrainMemoryContextFetch = fetch,
): BrainMemoryContextPort {
  const root = baseUrl(config.baseUrl);
  const apiToken = token(config.apiToken);
  const timeoutMs = timeout(config.timeoutMs);
  const endpoint = `${root}/v1/tools/call`;

  return Object.freeze({
    contract: BUSINESS_BRAIN_MEMORY_CONTEXT_PORT_CONTRACT,
    async read(request: BrainMemoryContextRequest): Promise<BrainMemoryContextReadResult> {
      validateRequest(request);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Pick<Response, "ok" | "status" | "json">;
      try {
        response = await fetchFn(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({
            name: "brain_memory_context_v2",
            input: request,
            autonomy: "auto_low_risk",
          }),
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) throw new Error("BRAIN_MEMORY_CONTEXT_READ_TIMEOUT");
        throw new Error("BRAIN_MEMORY_CONTEXT_READ_UNAVAILABLE", { cause: error });
      } finally {
        clearTimeout(timer);
      }

      let payload: BrainToolCallResponse;
      try {
        payload = await response.json() as BrainToolCallResponse;
      } catch {
        throw new Error("BRAIN_MEMORY_CONTEXT_RESPONSE_INVALID");
      }
      if (!response.ok) throw new Error(`BRAIN_MEMORY_CONTEXT_READ_FAILED:${response.status}`);
      if (payload.approvalRequired) throw new Error("BRAIN_MEMORY_CONTEXT_UNEXPECTED_APPROVAL_REQUIRED");
      if (payload.name !== "brain_memory_context_v2" || payload.ok !== true || payload.output === undefined) {
        throw new Error("BRAIN_MEMORY_CONTEXT_TOOL_RESULT_INVALID");
      }
      return parseOutput(payload.output);
    },
  });
}
