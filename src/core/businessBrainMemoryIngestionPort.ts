import { businessHmacSha256, businessSha256 } from "./businessSha256";
import type {
  RelationshipManagerMemoryIngestionReceipt,
  RelationshipManagerMemoryIngestionRequest,
  RelationshipManagerMemoryWriter,
} from "./businessRelationshipManagerMemoryPersistence";

export const BUSINESS_BRAIN_MEMORY_INGESTION_PORT_CONTRACT =
  "business_brain_memory_ingestion_port_v2" as const;

export type BrainMemoryIngestionPortConfig = Readonly<{
  baseUrl: string;
  apiToken: string;
  scopedWriteToken: string;
  timeoutMs?: number;
}>;

export type BrainMemoryIngestionFetch = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

export type BrainMemoryIngestionPort = Readonly<{
  contract: typeof BUSINESS_BRAIN_MEMORY_INGESTION_PORT_CONTRACT;
  write: RelationshipManagerMemoryWriter;
}>;

type BrainToolCallResponse = Readonly<{
  name?: unknown;
  ok?: unknown;
  output?: unknown;
  error?: unknown;
  approvalRequired?: unknown;
}>;

function baseUrl(value: string): string {
  const clean = value.trim().replace(/\/+$/, "");
  if (!clean) throw new Error("BRAIN_MEMORY_INGESTION_BASE_URL_REQUIRED");
  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    throw new Error("BRAIN_MEMORY_INGESTION_BASE_URL_INVALID");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("BRAIN_MEMORY_INGESTION_BASE_URL_PROTOCOL_INVALID");
  if (parsed.username || parsed.password) throw new Error("BRAIN_MEMORY_INGESTION_BASE_URL_CREDENTIALS_FORBIDDEN");
  return clean;
}

function secret(value: string, field: "api_token" | "scoped_write_token"): string {
  const clean = value.trim();
  if (new TextEncoder().encode(clean).byteLength < 32 || clean.length > 4096) {
    throw new Error(`BRAIN_MEMORY_INGESTION_${field.toUpperCase()}_INVALID`);
  }
  return clean;
}

function timeout(value: number | undefined): number {
  const result = value ?? 10_000;
  if (!Number.isFinite(result) || result < 250 || result > 60_000) throw new Error("BRAIN_MEMORY_INGESTION_TIMEOUT_INVALID");
  return Math.floor(result);
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("BRAIN_MEMORY_INGESTION_RECEIPT_INVALID");
  return value as Record<string, unknown>;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const input = value as Record<string, unknown>;
  return `{${Object.keys(input).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(input[key])}`).join(",")}}`;
}

export function brainMemoryIngestionProofPayload(request: RelationshipManagerMemoryIngestionRequest): string {
  return JSON.stringify({
    requestId: request.requestId,
    idempotencyKey: request.idempotencyKey,
    requestedAt: request.requestedAt,
    cycleId: request.cycleId,
    observationSha256: businessSha256(canonicalJson(request.observation)),
  });
}

function receipt(value: unknown, request: RelationshipManagerMemoryIngestionRequest): RelationshipManagerMemoryIngestionReceipt {
  const raw = object(value);
  if (raw.contract !== "evavo-memory-ingestion-receipt-v2") throw new Error("BRAIN_MEMORY_INGESTION_RECEIPT_CONTRACT_INVALID");
  if (raw.requestId !== request.requestId || raw.idempotencyKey !== request.idempotencyKey || raw.sourceRef !== request.observation.sourceRef) {
    throw new Error("BRAIN_MEMORY_INGESTION_RECEIPT_IDENTITY_MISMATCH");
  }
  const statuses = ["appended", "idempotent_replay", "skipped", "rejected"] as const;
  if (typeof raw.status !== "string" || !(statuses as readonly string[]).includes(raw.status)) throw new Error("BRAIN_MEMORY_INGESTION_RECEIPT_STATUS_INVALID");
  if (typeof raw.durable !== "boolean" || !Array.isArray(raw.reasons) || raw.reasons.some((item) => typeof item !== "string")) {
    throw new Error("BRAIN_MEMORY_INGESTION_RECEIPT_SHAPE_INVALID");
  }
  const recordId = typeof raw.recordId === "string" && raw.recordId.trim() ? raw.recordId.trim() : null;
  if ((raw.status === "appended" || raw.status === "idempotent_replay") && (!raw.durable || !recordId)) {
    throw new Error("BRAIN_MEMORY_INGESTION_RECEIPT_DURABILITY_INVALID");
  }
  if ((raw.status === "skipped" || raw.status === "rejected") && raw.durable) throw new Error("BRAIN_MEMORY_INGESTION_RECEIPT_NONPERSISTED_DURABLE");
  return Object.freeze({
    contract: "evavo-memory-ingestion-receipt-v2",
    requestId: request.requestId,
    idempotencyKey: request.idempotencyKey,
    sourceRef: request.observation.sourceRef,
    status: raw.status as (typeof statuses)[number],
    durable: raw.durable,
    ...(recordId ? { recordId } : {}),
    reasons: Object.freeze((raw.reasons as string[]).map((item) => item.trim()).filter(Boolean)),
  });
}

export function createBrainMemoryIngestionPort(
  config: BrainMemoryIngestionPortConfig,
  fetchFn: BrainMemoryIngestionFetch = fetch,
): BrainMemoryIngestionPort {
  const root = baseUrl(config.baseUrl);
  const apiToken = secret(config.apiToken, "api_token");
  const scopedWriteToken = secret(config.scopedWriteToken, "scoped_write_token");
  const timeoutMs = timeout(config.timeoutMs);
  const endpoint = `${root}/v1/tools/call`;

  const write: RelationshipManagerMemoryWriter = async (request) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const writerProof = businessHmacSha256(scopedWriteToken, brainMemoryIngestionProofPayload(request));
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
          name: "brain_memory_ingest_v2",
          input: { ...request, writerProof },
          autonomy: "auto_low_risk",
        }),
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted) throw new Error("BRAIN_MEMORY_INGESTION_WRITE_TIMEOUT");
      throw new Error("BRAIN_MEMORY_INGESTION_WRITE_UNAVAILABLE", { cause: error });
    } finally {
      clearTimeout(timer);
    }

    let payload: BrainToolCallResponse;
    try {
      payload = await response.json() as BrainToolCallResponse;
    } catch {
      throw new Error("BRAIN_MEMORY_INGESTION_RESPONSE_INVALID");
    }
    if (!response.ok) throw new Error(`BRAIN_MEMORY_INGESTION_WRITE_FAILED:${response.status}`);
    if (payload.approvalRequired) throw new Error("BRAIN_MEMORY_INGESTION_UNEXPECTED_APPROVAL_REQUIRED");
    if (payload.name !== "brain_memory_ingest_v2" || payload.ok !== true || payload.output === undefined) {
      throw new Error("BRAIN_MEMORY_INGESTION_TOOL_RESULT_INVALID");
    }
    return receipt(payload.output, request);
  };

  return Object.freeze({
    contract: BUSINESS_BRAIN_MEMORY_INGESTION_PORT_CONTRACT,
    write,
  });
}
