export const BUSINESS_DOCUMENT_RELATIONSHIP_SNAPSHOT_PORT_CONTRACT =
  "business_document_relationship_snapshot_port_v2" as const;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const WORKSPACE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const EVIDENCE_PATTERN = /^operations:document-snapshot:[a-f0-9]{64}$/;
const PURPOSES = ["proposal", "estimate", "scope_of_work", "work_order", "invoice", "brief", "reverse_brief", "nda", "sla", "contract", "handoff", "status_update", "support_report", "change_request", "grant_application", "case_study_note"] as const;
const SOURCE_TYPES = ["lead", "brief", "proposal", "scope", "work_order", "invoice", "order", "support_ticket"] as const;
const OUTPUT_FORMATS = ["html", "pdf", "docx", "google_doc"] as const;
const REVIEW_STATES = ["draft", "internal_review", "approved", "superseded", "archived"] as const;

type DocumentPurpose = typeof PURPOSES[number];
type DocumentSourceEntityType = typeof SOURCE_TYPES[number];
type DocumentOutputFormat = typeof OUTPUT_FORMATS[number];
type DocumentReviewState = typeof REVIEW_STATES[number];

export type DocumentRelationshipSnapshotRequest = Readonly<{ workspaceId: string; documentId: string }>;
export type DocumentRelationshipSnapshot = Readonly<{
  contract: "evavo-relationship-manager-document-snapshot-v1";
  state: "verified" | "not_found" | "provider_unavailable";
  workspaceId: string;
  documentId: string;
  observedAt: string;
  evidenceRef: string;
  document: null | Readonly<{
    id: string;
    title: string;
    purpose: DocumentPurpose;
    reviewState: DocumentReviewState;
    clientName: string;
    sourceEntityType: DocumentSourceEntityType;
    sourceEntityId: string;
    commercialClientId: string | null;
    deliveryProjectId: string | null;
    versionCount: number;
    currentVersionNumber: number;
    payloadReady: boolean;
    outputFormats: readonly DocumentOutputFormat[];
    updatedAt: string;
  }>;
  currentVersion: null | Readonly<{
    id: string;
    versionNumber: number;
    reviewState: DocumentReviewState;
    changeSummary: string;
    sourceEvidenceCount: number;
    outputFormats: readonly DocumentOutputFormat[];
    payloadReady: boolean;
    createdAt: string;
  }>;
  reasons: readonly string[];
  providerReads: 0 | 2;
  providerWrites: 0;
  editorSessions: 0;
  rendersCompleted: 0;
  exportsCreated: 0;
  externalSends: 0;
  outsideEffects: 0;
}>;

export type DocumentRelationshipSnapshotPort = Readonly<{
  contract: typeof BUSINESS_DOCUMENT_RELATIONSHIP_SNAPSHOT_PORT_CONTRACT;
  read(input: DocumentRelationshipSnapshotRequest): Promise<DocumentRelationshipSnapshot>;
}>;

function object(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}
function text(value: unknown, code: string, max = 2000) {
  if (typeof value !== "string") throw new Error(code);
  const clean = value.trim();
  if (!clean || clean.length > max) throw new Error(code);
  return clean;
}
function bool(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") throw new Error(code);
  return value;
}
function iso(value: unknown, code: string) {
  const clean = text(value, code, 100);
  if (!Number.isFinite(Date.parse(clean))) throw new Error(code);
  return new Date(clean).toISOString();
}
function nonNegative(value: unknown, code: string, max = 100000) {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > max) throw new Error(code);
  return Number(value);
}
function enumValue<T extends string>(value: unknown, values: readonly T[], code: string): T {
  if (typeof value !== "string" || !(values as readonly string[]).includes(value)) throw new Error(code);
  return value as T;
}
function enumArray<T extends string>(value: unknown, values: readonly T[], code: string, max: number): readonly T[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > max) throw new Error(code);
  const parsed = value.map((item) => enumValue(item, values, code));
  if (new Set(parsed).size !== parsed.length) throw new Error(`${code}_DUPLICATE`);
  return Object.freeze(parsed);
}
function nullableUuid(value: unknown, code: string): string | null {
  if (value === null) return null;
  const clean = text(value, code, 100).toLowerCase();
  if (!UUID_PATTERN.test(clean)) throw new Error(code);
  return clean;
}
function uuid(value: unknown, code: string): string {
  const clean = text(value, code, 100).toLowerCase();
  if (!UUID_PATTERN.test(clean)) throw new Error(code);
  return clean;
}
function exactRequest(input: DocumentRelationshipSnapshotRequest) {
  const workspaceId = input.workspaceId.trim();
  const documentId = input.documentId.trim().toLowerCase();
  if (!WORKSPACE_PATTERN.test(workspaceId)) throw new Error("DOCUMENT_RELATIONSHIP_WORKSPACE_INVALID");
  if (!UUID_PATTERN.test(documentId)) throw new Error("DOCUMENT_RELATIONSHIP_ID_INVALID");
  return Object.freeze({ workspaceId, documentId });
}

function snapshot(value: unknown, expected: ReturnType<typeof exactRequest>): DocumentRelationshipSnapshot {
  const raw = object(value, "DOCUMENT_RELATIONSHIP_SNAPSHOT_INVALID");
  if (raw.contract !== "evavo-relationship-manager-document-snapshot-v1") throw new Error("DOCUMENT_RELATIONSHIP_CONTRACT_INVALID");
  if (raw.workspaceId !== expected.workspaceId || raw.documentId !== expected.documentId) throw new Error("DOCUMENT_RELATIONSHIP_IDENTITY_MISMATCH");
  const state = enumValue(raw.state, ["verified", "not_found", "provider_unavailable"] as const, "DOCUMENT_RELATIONSHIP_STATE_INVALID");
  const observedAt = iso(raw.observedAt, "DOCUMENT_RELATIONSHIP_OBSERVED_AT_INVALID");
  if (Date.parse(observedAt) > Date.now() + 60_000) throw new Error("DOCUMENT_RELATIONSHIP_OBSERVED_AT_FUTURE");
  const evidenceRef = text(raw.evidenceRef, "DOCUMENT_RELATIONSHIP_EVIDENCE_INVALID", 200);
  if (!EVIDENCE_PATTERN.test(evidenceRef)) throw new Error("DOCUMENT_RELATIONSHIP_EVIDENCE_INVALID");
  if (raw.providerWrites !== 0 || raw.editorSessions !== 0 || raw.rendersCompleted !== 0 || raw.exportsCreated !== 0 || raw.externalSends !== 0 || raw.outsideEffects !== 0) {
    throw new Error("DOCUMENT_RELATIONSHIP_EFFECT_COUNTER_INVALID");
  }
  if (raw.providerReads !== 0 && raw.providerReads !== 2) throw new Error("DOCUMENT_RELATIONSHIP_PROVIDER_READS_INVALID");
  if ((state === "verified" || state === "not_found") && raw.providerReads !== 2) throw new Error("DOCUMENT_RELATIONSHIP_SUCCESS_READ_COUNT_INVALID");
  if (!Array.isArray(raw.reasons) || raw.reasons.length < 1) throw new Error("DOCUMENT_RELATIONSHIP_REASONS_INVALID");
  const reasons = Object.freeze(raw.reasons.map((item) => text(item, "DOCUMENT_RELATIONSHIP_REASON_INVALID", 1000)));

  if (state !== "verified") {
    if (raw.document !== null || raw.currentVersion !== null) throw new Error("DOCUMENT_RELATIONSHIP_NONVERIFIED_WITH_RECORD");
    return Object.freeze({
      contract: "evavo-relationship-manager-document-snapshot-v1",
      state,
      workspaceId: expected.workspaceId,
      documentId: expected.documentId,
      observedAt,
      evidenceRef,
      document: null,
      currentVersion: null,
      reasons,
      providerReads: raw.providerReads as 0 | 2,
      providerWrites: 0,
      editorSessions: 0,
      rendersCompleted: 0,
      exportsCreated: 0,
      externalSends: 0,
      outsideEffects: 0,
    });
  }

  const record = object(raw.document, "DOCUMENT_RELATIONSHIP_DOCUMENT_REQUIRED");
  const id = uuid(record.id, "DOCUMENT_RELATIONSHIP_DOCUMENT_ID_INVALID");
  if (id !== expected.documentId) throw new Error("DOCUMENT_RELATIONSHIP_DOCUMENT_ID_MISMATCH");
  const versionCount = nonNegative(record.versionCount, "DOCUMENT_RELATIONSHIP_VERSION_COUNT_INVALID", 10000);
  const currentVersionNumber = nonNegative(record.currentVersionNumber, "DOCUMENT_RELATIONSHIP_CURRENT_VERSION_INVALID", 10000);
  if (currentVersionNumber > versionCount) throw new Error("DOCUMENT_RELATIONSHIP_VERSION_COUNT_MISMATCH");
  const updatedAt = iso(record.updatedAt, "DOCUMENT_RELATIONSHIP_DOCUMENT_UPDATED_AT_INVALID");
  if (Date.parse(updatedAt) > Date.parse(observedAt)) throw new Error("DOCUMENT_RELATIONSHIP_DOCUMENT_UPDATED_AFTER_SNAPSHOT");
  const document = Object.freeze({
    id,
    title: text(record.title, "DOCUMENT_RELATIONSHIP_TITLE_INVALID", 300),
    purpose: enumValue(record.purpose, PURPOSES, "DOCUMENT_RELATIONSHIP_PURPOSE_INVALID"),
    reviewState: enumValue(record.reviewState, REVIEW_STATES, "DOCUMENT_RELATIONSHIP_REVIEW_STATE_INVALID"),
    clientName: text(record.clientName, "DOCUMENT_RELATIONSHIP_CLIENT_NAME_INVALID", 300),
    sourceEntityType: enumValue(record.sourceEntityType, SOURCE_TYPES, "DOCUMENT_RELATIONSHIP_SOURCE_TYPE_INVALID"),
    sourceEntityId: text(record.sourceEntityId, "DOCUMENT_RELATIONSHIP_SOURCE_ID_INVALID", 300),
    commercialClientId: nullableUuid(record.commercialClientId, "DOCUMENT_RELATIONSHIP_CLIENT_ID_INVALID"),
    deliveryProjectId: nullableUuid(record.deliveryProjectId, "DOCUMENT_RELATIONSHIP_PROJECT_ID_INVALID"),
    versionCount,
    currentVersionNumber,
    payloadReady: bool(record.payloadReady, "DOCUMENT_RELATIONSHIP_PAYLOAD_READY_INVALID"),
    outputFormats: enumArray(record.outputFormats, OUTPUT_FORMATS, "DOCUMENT_RELATIONSHIP_OUTPUT_FORMAT_INVALID", 4),
    updatedAt,
  });

  let currentVersion: DocumentRelationshipSnapshot["currentVersion"] = null;
  if (raw.currentVersion !== null) {
    const v = object(raw.currentVersion, "DOCUMENT_RELATIONSHIP_VERSION_INVALID");
    const versionNumber = nonNegative(v.versionNumber, "DOCUMENT_RELATIONSHIP_VERSION_NUMBER_INVALID", 10000);
    if (versionNumber !== currentVersionNumber || versionNumber < 1) throw new Error("DOCUMENT_RELATIONSHIP_CURRENT_VERSION_MISMATCH");
    currentVersion = Object.freeze({
      id: uuid(v.id, "DOCUMENT_RELATIONSHIP_VERSION_ID_INVALID"),
      versionNumber,
      reviewState: enumValue(v.reviewState, REVIEW_STATES, "DOCUMENT_RELATIONSHIP_VERSION_REVIEW_INVALID"),
      changeSummary: text(v.changeSummary, "DOCUMENT_RELATIONSHIP_CHANGE_SUMMARY_INVALID", 2000),
      sourceEvidenceCount: nonNegative(v.sourceEvidenceCount, "DOCUMENT_RELATIONSHIP_SOURCE_EVIDENCE_COUNT_INVALID", 1000),
      outputFormats: enumArray(v.outputFormats, OUTPUT_FORMATS, "DOCUMENT_RELATIONSHIP_VERSION_OUTPUT_INVALID", 4),
      payloadReady: bool(v.payloadReady, "DOCUMENT_RELATIONSHIP_VERSION_PAYLOAD_READY_INVALID"),
      createdAt: iso(v.createdAt, "DOCUMENT_RELATIONSHIP_VERSION_CREATED_AT_INVALID"),
    });
    if (Date.parse(currentVersion.createdAt) > Date.parse(observedAt)) throw new Error("DOCUMENT_RELATIONSHIP_VERSION_AFTER_SNAPSHOT");
  } else if (currentVersionNumber > 0) {
    throw new Error("DOCUMENT_RELATIONSHIP_CURRENT_VERSION_REQUIRED");
  }

  return Object.freeze({
    contract: "evavo-relationship-manager-document-snapshot-v1",
    state,
    workspaceId: expected.workspaceId,
    documentId: expected.documentId,
    observedAt,
    evidenceRef,
    document,
    currentVersion,
    reasons,
    providerReads: raw.providerReads as 0 | 2,
    providerWrites: 0,
    editorSessions: 0,
    rendersCompleted: 0,
    exportsCreated: 0,
    externalSends: 0,
    outsideEffects: 0,
  });
}

export function createDocumentRelationshipSnapshotPort(config: Readonly<{
  baseUrl: string;
  readToken: string;
  timeoutMs?: number;
}>, fetchFn: typeof fetch = fetch): DocumentRelationshipSnapshotPort {
  const root = config.baseUrl.trim().replace(/\/+$/, "");
  let url: URL;
  try { url = new URL(root); } catch { throw new Error("DOCUMENT_RELATIONSHIP_BASE_URL_INVALID"); }
  if (!root || !["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw new Error("DOCUMENT_RELATIONSHIP_BASE_URL_INVALID");
  const token = config.readToken.trim();
  if (new TextEncoder().encode(token).byteLength < 32 || token.length > 4096) throw new Error("DOCUMENT_RELATIONSHIP_TOKEN_INVALID");
  const timeoutMs = config.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 60_000) throw new Error("DOCUMENT_RELATIONSHIP_TIMEOUT_INVALID");
  return Object.freeze({
    contract: BUSINESS_DOCUMENT_RELATIONSHIP_SNAPSHOT_PORT_CONTRACT,
    async read(input) {
      const expected = exactRequest(input);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetchFn(`${root}/api/v1/internal/relationship-manager/document-snapshot`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(expected),
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) throw new Error("DOCUMENT_RELATIONSHIP_READ_TIMEOUT");
        throw new Error("DOCUMENT_RELATIONSHIP_READ_UNAVAILABLE", { cause: error });
      } finally { clearTimeout(timer); }
      let envelope: unknown;
      try { envelope = await response.json(); } catch { throw new Error("DOCUMENT_RELATIONSHIP_RESPONSE_INVALID"); }
      if (!response.ok) throw new Error(`DOCUMENT_RELATIONSHIP_READ_FAILED:${response.status}`);
      const raw = object(envelope, "DOCUMENT_RELATIONSHIP_ENVELOPE_INVALID");
      if (raw.ok !== true || raw.data === undefined) throw new Error("DOCUMENT_RELATIONSHIP_ENVELOPE_INVALID");
      return snapshot(raw.data, expected);
    },
  });
}