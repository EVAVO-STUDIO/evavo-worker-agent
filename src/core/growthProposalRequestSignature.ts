import {
  buildGrowthProposalPacket,
  type GrowthProposalPacket,
} from "./growthProposalPacket";
import { copyBytesToArrayBuffer } from "./cryptoBufferSource";

export const GROWTH_PROPOSAL_REQUEST_CONTRACT_VERSION = "growth_worker_request_v1" as const;
export const GROWTH_PROPOSAL_REQUEST_PATH = "/api/private/growth/worker-proposals" as const;
export const GROWTH_PROPOSAL_REQUEST_CONTENT_TYPE = "application/json" as const;
export const GROWTH_PROPOSAL_REQUEST_MAX_BODY_BYTES = 48_000;
export const GROWTH_PROPOSAL_REQUEST_NONCE_BYTES = 32;
export const GROWTH_PROPOSAL_REQUEST_SIGNING_SKEW_SECONDS = 30;

export const GROWTH_PROPOSAL_REQUEST_HEADERS = Object.freeze({
  contractVersion: "x-evavo-growth-contract-version",
  keyId: "x-evavo-growth-key-id",
  requestId: "x-evavo-growth-request-id",
  timestamp: "x-evavo-growth-timestamp",
  nonce: "x-evavo-growth-nonce",
  bodySha256: "x-evavo-growth-content-sha256",
  signature: "x-evavo-growth-signature",
} as const);

const KEY_ID_PATTERN = /^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/;
const REQUEST_ID_PATTERN = /^[a-z0-9](?:[a-z0-9:._-]{14,158}[a-z0-9])$/i;
const NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const PACKET_KEYS = Object.freeze([
  "contractVersion",
  "sourceSystem",
  "sourceRouteFamily",
  "sourceRecordId",
  "sourceFingerprint",
  "organisationId",
  "workspaceId",
  "candidateKind",
  "candidateTitle",
  "candidateSummary",
  "evidenceItems",
  "confidence",
  "proposedAction",
  "doNothingRationale",
  "riskNotes",
  "idempotencyKey",
  "createdAt",
  "proposalMode",
  "externalExecutionRequested",
  "canonicalPromotionRequested",
] as const);
const EVIDENCE_KEYS = Object.freeze([
  "evidenceKind",
  "title",
  "summary",
  "sourceUrl",
  "sourceLabel",
  "capturedAt",
  "confidence",
] as const);
const encoder = new TextEncoder();

export type GrowthProposalRequestCanonicalInput = Readonly<{
  keyId: string;
  requestId: string;
  timestamp: number;
  nonce: string;
  bodySha256: string;
}>;

export type SignGrowthProposalRequestInput = Readonly<{
  packet: GrowthProposalPacket;
  keyId: string;
  secret: string;
  requestId: string;
  timestamp?: number;
  nonce?: string;
  now?: Date;
}>;

export type SignedGrowthProposalRequest = Readonly<{
  contractVersion: typeof GROWTH_PROPOSAL_REQUEST_CONTRACT_VERSION;
  method: "POST";
  pathname: typeof GROWTH_PROPOSAL_REQUEST_PATH;
  contentType: typeof GROWTH_PROPOSAL_REQUEST_CONTENT_TYPE;
  keyId: string;
  requestId: string;
  timestamp: number;
  signedAt: string;
  nonce: string;
  body: string;
  bodySha256: string;
  headers: Readonly<Record<string, string>>;
}>;

type UnknownRecord = Record<string, unknown>;

function fail(code: string): never {
  throw new Error(code);
}

function objectValue(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail(code);
  return value as UnknownRecord;
}

function requireExactKeys(record: UnknownRecord, expected: readonly string[], code: string): void {
  const actual = Object.keys(record).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) fail(code);
}

function requireKeyId(value: unknown): string {
  if (typeof value !== "string" || !KEY_ID_PATTERN.test(value) || value.includes("..")) {
    fail("GROWTH_PROPOSAL_REQUEST_KEY_ID_INVALID");
  }
  return value;
}

function requireRequestId(value: unknown): string {
  if (typeof value !== "string" || !REQUEST_ID_PATTERN.test(value) || value.includes("..")) {
    fail("GROWTH_PROPOSAL_REQUEST_ID_INVALID");
  }
  return value;
}

function requireSecret(value: unknown): string {
  if (typeof value !== "string" || value.trim() !== value || /\p{Cc}/u.test(value)) {
    fail("GROWTH_PROPOSAL_REQUEST_SECRET_INVALID");
  }
  const bytes = encoder.encode(value).byteLength;
  if (bytes < 32 || bytes > 512) fail("GROWTH_PROPOSAL_REQUEST_SECRET_INVALID");
  return value;
}

function resolveNowSeconds(value: Date | undefined): number {
  const now = value ?? new Date();
  if (!(now instanceof Date)) fail("GROWTH_PROPOSAL_REQUEST_TIME_INVALID");
  const milliseconds = now.getTime();
  if (!Number.isFinite(milliseconds)) fail("GROWTH_PROPOSAL_REQUEST_TIME_INVALID");
  const seconds = Math.floor(milliseconds / 1_000);
  if (!Number.isSafeInteger(seconds)) fail("GROWTH_PROPOSAL_REQUEST_TIME_INVALID");
  return seconds;
}

function requireTimestamp(value: unknown, nowSeconds: number): number {
  if (!Number.isSafeInteger(value)) fail("GROWTH_PROPOSAL_REQUEST_TIMESTAMP_INVALID");
  const timestamp = value as number;
  if (
    timestamp < nowSeconds - GROWTH_PROPOSAL_REQUEST_SIGNING_SKEW_SECONDS ||
    timestamp > nowSeconds + GROWTH_PROPOSAL_REQUEST_SIGNING_SKEW_SECONDS
  ) fail("GROWTH_PROPOSAL_REQUEST_TIMESTAMP_INVALID");
  return timestamp;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string): Uint8Array {
  if (!NONCE_PATTERN.test(value)) fail("GROWTH_PROPOSAL_REQUEST_NONCE_INVALID");
  let binary: string;
  try {
    binary = atob(value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "="));
  } catch {
    fail("GROWTH_PROPOSAL_REQUEST_NONCE_INVALID");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  if (bytes.byteLength !== GROWTH_PROPOSAL_REQUEST_NONCE_BYTES || toBase64Url(bytes) !== value) {
    fail("GROWTH_PROPOSAL_REQUEST_NONCE_INVALID");
  }
  return bytes;
}

function requireNonce(value: unknown): string {
  if (typeof value !== "string") fail("GROWTH_PROPOSAL_REQUEST_NONCE_INVALID");
  fromBase64Url(value);
  return value;
}

function requireBodySha256(value: unknown): string {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) fail("GROWTH_PROPOSAL_REQUEST_BODY_HASH_INVALID");
  return value;
}

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", copyBytesToArrayBuffer(bytes)));
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(value)));
}

function canonicalPacketForSigning(value: GrowthProposalPacket, now: Date): GrowthProposalPacket {
  const record = objectValue(value, "GROWTH_PROPOSAL_REQUEST_PACKET_INVALID");
  requireExactKeys(record, PACKET_KEYS, "GROWTH_PROPOSAL_REQUEST_PACKET_FIELDS_INVALID");
  if (!Array.isArray(record.evidenceItems)) fail("GROWTH_PROPOSAL_REQUEST_PACKET_INVALID");
  for (const item of record.evidenceItems) {
    requireExactKeys(
      objectValue(item, "GROWTH_PROPOSAL_REQUEST_EVIDENCE_INVALID"),
      EVIDENCE_KEYS,
      "GROWTH_PROPOSAL_REQUEST_EVIDENCE_FIELDS_INVALID",
    );
  }

  const canonical = buildGrowthProposalPacket({
    sourceRouteFamily: value.sourceRouteFamily,
    sourceRecordId: value.sourceRecordId,
    sourceFingerprint: value.sourceFingerprint,
    organisationId: value.organisationId,
    workspaceId: value.workspaceId,
    candidateKind: value.candidateKind,
    candidateTitle: value.candidateTitle,
    candidateSummary: value.candidateSummary,
    evidenceItems: value.evidenceItems,
    confidence: value.confidence,
    proposedAction: value.proposedAction,
    doNothingRationale: value.doNothingRationale,
    riskNotes: value.riskNotes,
    idempotencyKey: value.idempotencyKey,
    createdAt: value.createdAt,
  }, { now });
  if (JSON.stringify(value) !== JSON.stringify(canonical)) {
    fail("GROWTH_PROPOSAL_REQUEST_PACKET_NOT_CANONICAL");
  }
  return canonical;
}

export function createGrowthProposalRequestNonce(): string {
  const bytes = new Uint8Array(GROWTH_PROPOSAL_REQUEST_NONCE_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

export function canonicalGrowthProposalRequest(input: GrowthProposalRequestCanonicalInput): string {
  const keyId = requireKeyId(input.keyId);
  const requestId = requireRequestId(input.requestId);
  if (!Number.isSafeInteger(input.timestamp)) fail("GROWTH_PROPOSAL_REQUEST_TIMESTAMP_INVALID");
  const nonce = requireNonce(input.nonce);
  const bodySha256 = requireBodySha256(input.bodySha256);
  return [
    `version:${GROWTH_PROPOSAL_REQUEST_CONTRACT_VERSION}`,
    "method:POST",
    `path:${GROWTH_PROPOSAL_REQUEST_PATH}`,
    `content-type:${GROWTH_PROPOSAL_REQUEST_CONTENT_TYPE}`,
    `key-id:${keyId}`,
    `request-id:${requestId}`,
    `timestamp:${input.timestamp}`,
    `nonce:${nonce}`,
    `content-sha256:${bodySha256}`,
  ].join("\n");
}

export async function signGrowthProposalRequest(
  input: SignGrowthProposalRequestInput,
): Promise<SignedGrowthProposalRequest> {
  const now = input.now ?? new Date();
  const nowSeconds = resolveNowSeconds(now);
  const keyId = requireKeyId(input.keyId);
  const requestId = requireRequestId(input.requestId);
  const secret = requireSecret(input.secret);
  const timestamp = requireTimestamp(input.timestamp ?? nowSeconds, nowSeconds);
  const nonce = requireNonce(input.nonce ?? createGrowthProposalRequestNonce());
  const packet = canonicalPacketForSigning(input.packet, now);
  const body = JSON.stringify(packet);
  const bodyBytes = encoder.encode(body);
  if (bodyBytes.byteLength < 1 || bodyBytes.byteLength > GROWTH_PROPOSAL_REQUEST_MAX_BODY_BYTES) {
    fail("GROWTH_PROPOSAL_REQUEST_BODY_SIZE_INVALID");
  }
  const bodySha256 = await sha256Hex(bodyBytes);
  const canonical = canonicalGrowthProposalRequest({ keyId, requestId, timestamp, nonce, bodySha256 });
  const signature = await hmacSha256Hex(secret, canonical);
  const headers = Object.freeze({
    "content-type": GROWTH_PROPOSAL_REQUEST_CONTENT_TYPE,
    [GROWTH_PROPOSAL_REQUEST_HEADERS.contractVersion]: GROWTH_PROPOSAL_REQUEST_CONTRACT_VERSION,
    [GROWTH_PROPOSAL_REQUEST_HEADERS.keyId]: keyId,
    [GROWTH_PROPOSAL_REQUEST_HEADERS.requestId]: requestId,
    [GROWTH_PROPOSAL_REQUEST_HEADERS.timestamp]: String(timestamp),
    [GROWTH_PROPOSAL_REQUEST_HEADERS.nonce]: nonce,
    [GROWTH_PROPOSAL_REQUEST_HEADERS.bodySha256]: bodySha256,
    [GROWTH_PROPOSAL_REQUEST_HEADERS.signature]: `sha256=${signature}`,
  });

  return Object.freeze({
    contractVersion: GROWTH_PROPOSAL_REQUEST_CONTRACT_VERSION,
    method: "POST",
    pathname: GROWTH_PROPOSAL_REQUEST_PATH,
    contentType: GROWTH_PROPOSAL_REQUEST_CONTENT_TYPE,
    keyId,
    requestId,
    timestamp,
    signedAt: new Date(timestamp * 1_000).toISOString(),
    nonce,
    body,
    bodySha256,
    headers,
  });
}
