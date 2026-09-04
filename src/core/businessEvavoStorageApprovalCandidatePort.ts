import {
  buildStaffApprovalCandidateWriteRequest,
  reconcileStaffApprovalCandidateWriteReceipt,
  type StaffApprovalCandidatePersistenceResult,
  type StaffApprovalCandidateWriteReceipt,
} from "./businessStaffCommunicationApprovalCandidatePersistence";
import type { StaffCommunicationApprovalCandidate } from "./businessStaffCommunicationApprovalCandidate";

export const BUSINESS_EVAVO_STORAGE_APPROVAL_CANDIDATE_PORT_CONTRACT =
  "business_evavo_storage_approval_candidate_port_v1" as const;

export type EvavoStorageApprovalCandidatePortConfig = Readonly<{
  baseUrl: string;
  writeToken: string;
  timeoutMs?: number;
}>;

export type ApprovalCandidateFetch = (
  input: string,
  init: RequestInit,
) => Promise<Pick<Response, "ok" | "status" | "json">>;

export type EvavoStorageApprovalCandidatePort = Readonly<{
  contract: typeof BUSINESS_EVAVO_STORAGE_APPROVAL_CANDIDATE_PORT_CONTRACT;
  persist(candidate: StaffCommunicationApprovalCandidate): Promise<StaffApprovalCandidatePersistenceResult>;
}>;

type StorageActionResponse = Readonly<{
  schemaVersion?: number;
  ok?: boolean;
  result?: unknown;
  error?: Readonly<{ code?: unknown; message?: unknown }>;
}>;

function normaliseBaseUrl(value: string): string {
  const clean = value.trim().replace(/\/+$/, "");
  if (!clean) throw new Error("EVAVO_STORAGE_APPROVAL_CANDIDATE_BASE_URL_REQUIRED");
  let parsed: URL;
  try {
    parsed = new URL(clean);
  } catch {
    throw new Error("EVAVO_STORAGE_APPROVAL_CANDIDATE_BASE_URL_INVALID");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("EVAVO_STORAGE_APPROVAL_CANDIDATE_BASE_URL_PROTOCOL_INVALID");
  }
  if (parsed.username || parsed.password) {
    throw new Error("EVAVO_STORAGE_APPROVAL_CANDIDATE_BASE_URL_CREDENTIALS_FORBIDDEN");
  }
  return clean;
}

function normaliseWriteToken(value: string): string {
  const clean = value.trim();
  if (new TextEncoder().encode(clean).byteLength < 32 || clean.length > 4096) {
    throw new Error("EVAVO_STORAGE_APPROVAL_CANDIDATE_WRITE_TOKEN_INVALID");
  }
  return clean;
}

function normaliseTimeout(value: number | undefined): number {
  const timeout = value ?? 10_000;
  if (!Number.isFinite(timeout) || timeout < 250 || timeout > 60_000) {
    throw new Error("EVAVO_STORAGE_APPROVAL_CANDIDATE_TIMEOUT_INVALID");
  }
  return Math.floor(timeout);
}

function storageReceipt(value: unknown): StaffApprovalCandidateWriteReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("EVAVO_STORAGE_APPROVAL_CANDIDATE_RECEIPT_INVALID");
  }
  return value as StaffApprovalCandidateWriteReceipt;
}

function safeStorageError(response: StorageActionResponse, status: number): Error {
  const rawCode = response.error?.code;
  const code = typeof rawCode === "string" && rawCode.trim() ? rawCode.trim().slice(0, 120) : "EVAVO_STORAGE_ACTION_FAILED";
  return new Error(`EVAVO_STORAGE_APPROVAL_CANDIDATE_WRITE_FAILED:${status}:${code}`);
}

export function createEvavoStorageApprovalCandidatePort(
  config: EvavoStorageApprovalCandidatePortConfig,
  fetchFn: ApprovalCandidateFetch = fetch,
): EvavoStorageApprovalCandidatePort {
  const baseUrl = normaliseBaseUrl(config.baseUrl);
  const writeToken = normaliseWriteToken(config.writeToken);
  const timeoutMs = normaliseTimeout(config.timeoutMs);
  const endpoint = `${baseUrl}/v1/actions/persist_approval_candidate`;

  return Object.freeze({
    contract: BUSINESS_EVAVO_STORAGE_APPROVAL_CANDIDATE_PORT_CONTRACT,
    async persist(candidate: StaffCommunicationApprovalCandidate): Promise<StaffApprovalCandidatePersistenceResult> {
      const request = buildStaffApprovalCandidateWriteRequest(candidate);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Pick<Response, "ok" | "status" | "json">;
      try {
        response = await fetchFn(endpoint, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${writeToken}`,
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify(request),
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) {
          throw new Error("EVAVO_STORAGE_APPROVAL_CANDIDATE_WRITE_TIMEOUT");
        }
        throw new Error("EVAVO_STORAGE_APPROVAL_CANDIDATE_WRITE_UNAVAILABLE", { cause: error });
      } finally {
        clearTimeout(timer);
      }

      let payload: StorageActionResponse;
      try {
        payload = await response.json() as StorageActionResponse;
      } catch {
        throw new Error("EVAVO_STORAGE_APPROVAL_CANDIDATE_RESPONSE_INVALID");
      }
      if (!response.ok || payload.ok !== true || payload.schemaVersion !== 1 || payload.result === undefined) {
        throw safeStorageError(payload, response.status);
      }

      return reconcileStaffApprovalCandidateWriteReceipt({
        candidate,
        request,
        receipt: storageReceipt(payload.result),
      });
    },
  });
}
