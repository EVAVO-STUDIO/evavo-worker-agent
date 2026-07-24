export const GROWTH_PROPOSAL_CONTRACT_VERSION = "growth_worker_proposal_v1" as const;
export const GROWTH_PROPOSAL_SOURCE_SYSTEM = "evavo-worker-agent" as const;
export const GROWTH_PROPOSAL_MODE = "proposal_only" as const;

export const GROWTH_PROPOSAL_ROUTE_FAMILIES = Object.freeze([
  "growth",
  "business",
  "opportunity",
  "operations",
] as const);

export const GROWTH_PROPOSAL_KINDS = Object.freeze([
  "account_candidate",
  "opportunity_signal",
  "evidence_packet",
  "analysis_recommendation",
  "next_action_proposal",
] as const);

export const GROWTH_PROPOSAL_EVIDENCE_KINDS = Object.freeze([
  "public_source",
  "worker_observation",
  "strategy_memory",
  "source_health",
  "operator_note",
] as const);

export const GROWTH_PROPOSAL_LIMITS = Object.freeze({
  packetBytes: 48_000,
  evidenceItems: 12,
  sourceRecordId: 160,
  sourceFingerprint: 160,
  candidateTitle: 180,
  candidateSummary: 2_000,
  evidenceTitle: 180,
  evidenceSummary: 1_500,
  sourceLabel: 200,
  sourceUrl: 2_048,
  proposedAction: 600,
  doNothingRationale: 1_000,
  riskNotes: 1_000,
  idempotencyKey: 160,
  maximumAgeMs: 30 * 24 * 60 * 60 * 1_000,
  maximumFutureSkewMs: 5 * 60 * 1_000,
} as const);

export type GrowthProposalRouteFamily = (typeof GROWTH_PROPOSAL_ROUTE_FAMILIES)[number];
export type GrowthProposalKind = (typeof GROWTH_PROPOSAL_KINDS)[number];
export type GrowthProposalEvidenceKind = (typeof GROWTH_PROPOSAL_EVIDENCE_KINDS)[number];

export type GrowthProposalEvidenceInput = Readonly<{
  evidenceKind: GrowthProposalEvidenceKind;
  title: string;
  summary: string;
  sourceUrl: string | null;
  sourceLabel: string | null;
  capturedAt: string;
  confidence: number;
}>;

export type GrowthProposalPacketInput = Readonly<{
  sourceRouteFamily: GrowthProposalRouteFamily;
  sourceRecordId: string | null;
  sourceFingerprint: string;
  organisationId: string;
  workspaceId: string;
  candidateKind: GrowthProposalKind;
  candidateTitle: string;
  candidateSummary: string;
  evidenceItems: readonly GrowthProposalEvidenceInput[];
  confidence: number;
  proposedAction: string;
  doNothingRationale: string;
  riskNotes: string;
  idempotencyKey: string;
  createdAt: string;
}>;

export type GrowthProposalPacket = Readonly<{
  contractVersion: typeof GROWTH_PROPOSAL_CONTRACT_VERSION;
  sourceSystem: typeof GROWTH_PROPOSAL_SOURCE_SYSTEM;
  sourceRouteFamily: GrowthProposalRouteFamily;
  sourceRecordId: string | null;
  sourceFingerprint: string;
  organisationId: string;
  workspaceId: string;
  candidateKind: GrowthProposalKind;
  candidateTitle: string;
  candidateSummary: string;
  evidenceItems: readonly GrowthProposalEvidenceInput[];
  confidence: number;
  proposedAction: string;
  doNothingRationale: string;
  riskNotes: string;
  idempotencyKey: string;
  createdAt: string;
  proposalMode: typeof GROWTH_PROPOSAL_MODE;
  externalExecutionRequested: false;
  canonicalPromotionRequested: false;
}>;

type UnknownRecord = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_IDENTIFIER_PATTERN = /^[a-z0-9](?:[a-z0-9:._-]{14,158}[a-z0-9])$/i;
const UTC_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;
const LOCAL_HTTP_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const SAFE_ACTION_PREFIXES = Object.freeze([
  "review ",
  "investigate ",
  "research ",
  "prepare ",
  "draft ",
  "validate ",
  "compare ",
  "assess ",
  "request approval",
  "create an internal ",
  "record an internal ",
  "defer ",
  "wait ",
] as const);
const EXTERNAL_ACTION_PATTERNS = Object.freeze([
  /\bsend\s+(?:an?|the|this|that)\b/i,
  /\b(?:and|then)\s+send\b/i,
  /\bpost\s+(?:to|on)\b/i,
  /\bpublish\b/i,
  /\bsubmit\s+(?:an?|the|this|that)\b/i,
  /\b(?:buy|purchase)\s+(?:ads?|media|placement)\b/i,
  /\bdelete\b/i,
  /\bexport\b/i,
  /\bwrite\s*back\b/i,
  /\bpush\s+(?:to|into)\b/i,
  /\bupdate\s+(?:hubspot|salesforce|pipedrive|zoho|provider)\b/i,
  /\blaunch\s+(?:an?|the)?\s*campaign\b/i,
  /\bcharge\s+(?:an?|the|this|that|customer|client)\b/i,
] as const);

function fail(code: string, field: string): never {
  throw new Error(`${code}:${field}`);
}

function objectValue(value: unknown, field: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("GROWTH_PROPOSAL_OBJECT_REQUIRED", field);
  return value as UnknownRecord;
}

function boundedText(value: unknown, field: string, maximum: number): string {
  if (typeof value !== "string") fail("GROWTH_PROPOSAL_TEXT_REQUIRED", field);
  const text = value.trim();
  if (!text) fail("GROWTH_PROPOSAL_TEXT_REQUIRED", field);
  if (text.length > maximum) fail("GROWTH_PROPOSAL_TEXT_TOO_LONG", field);
  if (/\p{Cc}/u.test(text)) fail("GROWTH_PROPOSAL_CONTROL_CHARACTER_INVALID", field);
  return text;
}

function nullableText(value: unknown, field: string, maximum: number): string | null {
  if (value === null) return null;
  return boundedText(value, field, maximum);
}

function enumValue<T extends string>(value: unknown, field: string, allowed: readonly T[]): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) fail("GROWTH_PROPOSAL_ENUM_INVALID", field);
  return value as T;
}

function uuidValue(value: unknown, field: string): string {
  const text = boundedText(value, field, 80);
  if (!UUID_PATTERN.test(text)) fail("GROWTH_PROPOSAL_UUID_INVALID", field);
  return text.toLowerCase();
}

function identifierValue(value: unknown, field: string, maximum: number): string {
  const text = boundedText(value, field, maximum);
  if (!SAFE_IDENTIFIER_PATTERN.test(text) || text.includes("..")) fail("GROWTH_PROPOSAL_IDENTIFIER_INVALID", field);
  return text;
}

function confidenceValue(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    fail("GROWTH_PROPOSAL_CONFIDENCE_INVALID", field);
  }
  return value;
}

function timestampValue(value: unknown, field: string): Readonly<{ iso: string; milliseconds: number }> {
  const text = boundedText(value, field, 40);
  if (!UTC_TIMESTAMP_PATTERN.test(text)) fail("GROWTH_PROPOSAL_TIMESTAMP_INVALID", field);
  const milliseconds = Date.parse(text);
  if (!Number.isFinite(milliseconds)) fail("GROWTH_PROPOSAL_TIMESTAMP_INVALID", field);
  return Object.freeze({ iso: new Date(milliseconds).toISOString(), milliseconds });
}

function sourceUrlValue(value: unknown, field: string): string | null {
  if (value === null) return null;
  const text = boundedText(value, field, GROWTH_PROPOSAL_LIMITS.sourceUrl);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    fail("GROWTH_PROPOSAL_URL_INVALID", field);
  }
  const protocolAllowed = parsed.protocol === "https:" || (parsed.protocol === "http:" && LOCAL_HTTP_HOSTS.has(parsed.hostname));
  if (!protocolAllowed || parsed.username || parsed.password || parsed.hash) fail("GROWTH_PROPOSAL_URL_INVALID", field);
  return parsed.toString();
}

function proposedActionValue(value: unknown): string {
  const action = boundedText(value, "proposedAction", GROWTH_PROPOSAL_LIMITS.proposedAction);
  const lower = action.toLowerCase();
  if (!SAFE_ACTION_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    fail("GROWTH_PROPOSAL_ACTION_PREFIX_INVALID", "proposedAction");
  }
  if (EXTERNAL_ACTION_PATTERNS.some((pattern) => pattern.test(action))) {
    fail("GROWTH_PROPOSAL_EXTERNAL_ACTION_INVALID", "proposedAction");
  }
  return action;
}

function evidenceValue(value: unknown, index: number, packetCreatedAt: number, now: number): GrowthProposalEvidenceInput {
  const field = `evidenceItems[${index}]`;
  const record = objectValue(value, field);
  const sourceUrl = sourceUrlValue(record.sourceUrl, "sourceUrl");
  const sourceLabel = nullableText(record.sourceLabel, "sourceLabel", GROWTH_PROPOSAL_LIMITS.sourceLabel);
  if (!sourceUrl && !sourceLabel) fail("GROWTH_PROPOSAL_EVIDENCE_SOURCE_REQUIRED", field);
  const capturedAt = timestampValue(record.capturedAt, "capturedAt");
  const latestAllowed = Math.min(
    packetCreatedAt + GROWTH_PROPOSAL_LIMITS.maximumFutureSkewMs,
    now + GROWTH_PROPOSAL_LIMITS.maximumFutureSkewMs,
  );
  if (capturedAt.milliseconds > latestAllowed) fail("GROWTH_PROPOSAL_EVIDENCE_FUTURE_INVALID", "capturedAt");

  return Object.freeze({
    evidenceKind: enumValue(record.evidenceKind, "evidenceKind", GROWTH_PROPOSAL_EVIDENCE_KINDS),
    title: boundedText(record.title, "title", GROWTH_PROPOSAL_LIMITS.evidenceTitle),
    summary: boundedText(record.summary, "summary", GROWTH_PROPOSAL_LIMITS.evidenceSummary),
    sourceUrl,
    sourceLabel,
    capturedAt: capturedAt.iso,
    confidence: confidenceValue(record.confidence, "confidence"),
  });
}

export function buildGrowthProposalPacket(
  input: GrowthProposalPacketInput,
  options: Readonly<{ now?: Date }> = {},
): GrowthProposalPacket {
  const nowDate = options.now ?? new Date();
  const now = nowDate.getTime();
  if (!Number.isFinite(now)) fail("GROWTH_PROPOSAL_NOW_INVALID", "now");
  const createdAt = timestampValue(input.createdAt, "createdAt");
  if (createdAt.milliseconds > now + GROWTH_PROPOSAL_LIMITS.maximumFutureSkewMs) {
    fail("GROWTH_PROPOSAL_CREATED_AT_FUTURE", "createdAt");
  }
  if (createdAt.milliseconds < now - GROWTH_PROPOSAL_LIMITS.maximumAgeMs) {
    fail("GROWTH_PROPOSAL_CREATED_AT_STALE", "createdAt");
  }
  if (!Array.isArray(input.evidenceItems) || input.evidenceItems.length < 1 || input.evidenceItems.length > GROWTH_PROPOSAL_LIMITS.evidenceItems) {
    fail("GROWTH_PROPOSAL_EVIDENCE_COUNT_INVALID", "evidenceItems");
  }
  const evidenceItems = Object.freeze(
    input.evidenceItems.map((item, index) => evidenceValue(item, index, createdAt.milliseconds, now)),
  );

  const packet = Object.freeze({
    contractVersion: GROWTH_PROPOSAL_CONTRACT_VERSION,
    sourceSystem: GROWTH_PROPOSAL_SOURCE_SYSTEM,
    sourceRouteFamily: enumValue(input.sourceRouteFamily, "sourceRouteFamily", GROWTH_PROPOSAL_ROUTE_FAMILIES),
    sourceRecordId: nullableText(input.sourceRecordId, "sourceRecordId", GROWTH_PROPOSAL_LIMITS.sourceRecordId),
    sourceFingerprint: identifierValue(input.sourceFingerprint, "sourceFingerprint", GROWTH_PROPOSAL_LIMITS.sourceFingerprint),
    organisationId: uuidValue(input.organisationId, "organisationId"),
    workspaceId: uuidValue(input.workspaceId, "workspaceId"),
    candidateKind: enumValue(input.candidateKind, "candidateKind", GROWTH_PROPOSAL_KINDS),
    candidateTitle: boundedText(input.candidateTitle, "candidateTitle", GROWTH_PROPOSAL_LIMITS.candidateTitle),
    candidateSummary: boundedText(input.candidateSummary, "candidateSummary", GROWTH_PROPOSAL_LIMITS.candidateSummary),
    evidenceItems,
    confidence: confidenceValue(input.confidence, "confidence"),
    proposedAction: proposedActionValue(input.proposedAction),
    doNothingRationale: boundedText(input.doNothingRationale, "doNothingRationale", GROWTH_PROPOSAL_LIMITS.doNothingRationale),
    riskNotes: boundedText(input.riskNotes, "riskNotes", GROWTH_PROPOSAL_LIMITS.riskNotes),
    idempotencyKey: identifierValue(input.idempotencyKey, "idempotencyKey", GROWTH_PROPOSAL_LIMITS.idempotencyKey),
    createdAt: createdAt.iso,
    proposalMode: GROWTH_PROPOSAL_MODE,
    externalExecutionRequested: false as const,
    canonicalPromotionRequested: false as const,
  });

  const bytes = new TextEncoder().encode(JSON.stringify(packet)).byteLength;
  if (bytes > GROWTH_PROPOSAL_LIMITS.packetBytes) fail("GROWTH_PROPOSAL_PACKET_TOO_LARGE", "packet");
  return packet;
}

export function serialiseGrowthProposalPacket(packet: GrowthProposalPacket): string {
  return `${JSON.stringify(packet, null, 2)}\n`;
}
