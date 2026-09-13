export const BUSINESS_SUPPORT_RELATIONSHIP_SNAPSHOT_PORT_CONTRACT =
  "business_support_relationship_snapshot_port_v1" as const;

const ID_PATTERN = /^[A-Za-z0-9_-]{8,128}$/;
const EVIDENCE_PATTERN = /^support:relationship-snapshot:[a-f0-9]{64}$/;

export type SupportRelationshipSnapshotRequest = Readonly<{
  organisationId: string;
  ticketId: string;
}>;

export type SupportRelationshipSnapshot = Readonly<{
  contract: "evavo-relationship-manager-support-snapshot-v1";
  state: "verified" | "not_found" | "provider_unavailable";
  organisationId: string;
  ticketId: string;
  conversationId: string | null;
  observedAt: string;
  evidenceRef: string;
  ticket: null | Readonly<{
    status: string;
    priority: string;
    category: string;
    title: string | null;
    internalSummary: string | null;
    suggestedAction: string | null;
    dueAt: string | null;
    updatedAt: string;
  }>;
  latestCustomerMessage: string | null;
  latestCustomerMessageAt: string | null;
  emotionRisk: null | Readonly<{
    emotionState: "neutral" | "confused" | "frustrated" | "angry" | "anxious" | "grateful";
    urgency: "low" | "normal" | "high" | "critical";
    humanInterventionHint: "none" | "watch" | "soon" | "immediate";
    signals: readonly string[];
  }>;
  providerReads: 0 | 1;
  providerWrites: 0;
  outboundMessages: 0;
  ticketMutations: 0;
  outsideEffects: 0;
}>;

export type SupportRelationshipSnapshotPort = Readonly<{
  contract: typeof BUSINESS_SUPPORT_RELATIONSHIP_SNAPSHOT_PORT_CONTRACT;
  read(input: SupportRelationshipSnapshotRequest): Promise<SupportRelationshipSnapshot>;
}>;

function object(value: unknown, code: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}
function text(value: unknown, code: string, max = 2000): string {
  if (typeof value !== "string") throw new Error(code);
  const clean = value.replace(/\s+/g, " ").trim();
  if (!clean || clean.length > max) throw new Error(code);
  return clean;
}
function nullableText(value: unknown, code: string, max = 2000): string | null {
  return value === null ? null : text(value, code, max);
}
function iso(value: unknown, code: string): string {
  const clean = text(value, code, 100);
  if (!Number.isFinite(Date.parse(clean))) throw new Error(code);
  return new Date(clean).toISOString();
}
function nullableIso(value: unknown, code: string): string | null {
  return value === null ? null : iso(value, code);
}
function enumValue<T extends string>(value: unknown, allowed: readonly T[], code: string): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new Error(code);
  return value as T;
}
function exactRequest(input: SupportRelationshipSnapshotRequest) {
  const organisationId = input.organisationId.trim();
  const ticketId = input.ticketId.trim();
  if (!ID_PATTERN.test(organisationId)) throw new Error("SUPPORT_RELATIONSHIP_ORGANISATION_ID_INVALID");
  if (!ID_PATTERN.test(ticketId)) throw new Error("SUPPORT_RELATIONSHIP_TICKET_ID_INVALID");
  return Object.freeze({ organisationId, ticketId });
}

function parseSnapshot(value: unknown, expected: ReturnType<typeof exactRequest>): SupportRelationshipSnapshot {
  const raw = object(value, "SUPPORT_RELATIONSHIP_SNAPSHOT_INVALID");
  if (raw.contract !== "evavo-relationship-manager-support-snapshot-v1") throw new Error("SUPPORT_RELATIONSHIP_CONTRACT_INVALID");
  if (raw.organisationId !== expected.organisationId || raw.ticketId !== expected.ticketId) throw new Error("SUPPORT_RELATIONSHIP_IDENTITY_MISMATCH");
  const state = enumValue(raw.state, ["verified", "not_found", "provider_unavailable"] as const, "SUPPORT_RELATIONSHIP_STATE_INVALID");
  const observedAt = iso(raw.observedAt, "SUPPORT_RELATIONSHIP_OBSERVED_AT_INVALID");
  if (Date.parse(observedAt) > Date.now() + 60_000) throw new Error("SUPPORT_RELATIONSHIP_OBSERVED_AT_FUTURE");
  const evidenceRef = text(raw.evidenceRef, "SUPPORT_RELATIONSHIP_EVIDENCE_INVALID", 200);
  if (!EVIDENCE_PATTERN.test(evidenceRef)) throw new Error("SUPPORT_RELATIONSHIP_EVIDENCE_INVALID");
  if (raw.providerWrites !== 0 || raw.outboundMessages !== 0 || raw.ticketMutations !== 0 || raw.outsideEffects !== 0) {
    throw new Error("SUPPORT_RELATIONSHIP_EFFECT_COUNTER_INVALID");
  }
  if (raw.providerReads !== 0 && raw.providerReads !== 1) throw new Error("SUPPORT_RELATIONSHIP_PROVIDER_READS_INVALID");

  let ticket: SupportRelationshipSnapshot["ticket"] = null;
  let emotionRisk: SupportRelationshipSnapshot["emotionRisk"] = null;
  const conversationId = raw.conversationId === null ? null : text(raw.conversationId, "SUPPORT_RELATIONSHIP_CONVERSATION_ID_INVALID", 128);
  const latestCustomerMessage = nullableText(raw.latestCustomerMessage, "SUPPORT_RELATIONSHIP_CUSTOMER_MESSAGE_INVALID", 1200);
  const latestCustomerMessageAt = nullableIso(raw.latestCustomerMessageAt, "SUPPORT_RELATIONSHIP_CUSTOMER_MESSAGE_AT_INVALID");

  if (state === "verified") {
    const item = object(raw.ticket, "SUPPORT_RELATIONSHIP_TICKET_REQUIRED");
    const updatedAt = iso(item.updatedAt, "SUPPORT_RELATIONSHIP_TICKET_UPDATED_AT_INVALID");
    if (Date.parse(updatedAt) > Date.parse(observedAt)) throw new Error("SUPPORT_RELATIONSHIP_TICKET_UPDATED_AFTER_SNAPSHOT");
    if (latestCustomerMessageAt && Date.parse(latestCustomerMessageAt) > Date.parse(observedAt)) throw new Error("SUPPORT_RELATIONSHIP_MESSAGE_AFTER_SNAPSHOT");
    ticket = Object.freeze({
      status: text(item.status, "SUPPORT_RELATIONSHIP_TICKET_STATUS_INVALID", 100),
      priority: text(item.priority, "SUPPORT_RELATIONSHIP_TICKET_PRIORITY_INVALID", 100),
      category: text(item.category, "SUPPORT_RELATIONSHIP_TICKET_CATEGORY_INVALID", 100),
      title: nullableText(item.title, "SUPPORT_RELATIONSHIP_TICKET_TITLE_INVALID", 1200),
      internalSummary: nullableText(item.internalSummary, "SUPPORT_RELATIONSHIP_TICKET_SUMMARY_INVALID", 1200),
      suggestedAction: nullableText(item.suggestedAction, "SUPPORT_RELATIONSHIP_TICKET_ACTION_INVALID", 1200),
      dueAt: nullableIso(item.dueAt, "SUPPORT_RELATIONSHIP_TICKET_DUE_AT_INVALID"),
      updatedAt,
    });
    const risk = object(raw.emotionRisk, "SUPPORT_RELATIONSHIP_EMOTION_RISK_REQUIRED");
    if (!Array.isArray(risk.signals)) throw new Error("SUPPORT_RELATIONSHIP_EMOTION_SIGNALS_INVALID");
    emotionRisk = Object.freeze({
      emotionState: enumValue(risk.emotionState, ["neutral", "confused", "frustrated", "angry", "anxious", "grateful"] as const, "SUPPORT_RELATIONSHIP_EMOTION_INVALID"),
      urgency: enumValue(risk.urgency, ["low", "normal", "high", "critical"] as const, "SUPPORT_RELATIONSHIP_URGENCY_INVALID"),
      humanInterventionHint: enumValue(risk.humanInterventionHint, ["none", "watch", "soon", "immediate"] as const, "SUPPORT_RELATIONSHIP_INTERVENTION_INVALID"),
      signals: Object.freeze(risk.signals.map((item) => text(item, "SUPPORT_RELATIONSHIP_EMOTION_SIGNAL_INVALID", 200))),
    });
  } else if (raw.ticket !== null || raw.emotionRisk !== null || latestCustomerMessage !== null || latestCustomerMessageAt !== null) {
    throw new Error("SUPPORT_RELATIONSHIP_NONVERIFIED_WITH_RECORD");
  }

  return Object.freeze({
    contract: "evavo-relationship-manager-support-snapshot-v1",
    state,
    organisationId: expected.organisationId,
    ticketId: expected.ticketId,
    conversationId,
    observedAt,
    evidenceRef,
    ticket,
    latestCustomerMessage,
    latestCustomerMessageAt,
    emotionRisk,
    providerReads: raw.providerReads as 0 | 1,
    providerWrites: 0,
    outboundMessages: 0,
    ticketMutations: 0,
    outsideEffects: 0,
  });
}

export function createSupportRelationshipSnapshotPort(config: Readonly<{
  baseUrl: string;
  readToken: string;
  timeoutMs?: number;
}>, fetchFn: typeof fetch = fetch): SupportRelationshipSnapshotPort {
  const root = config.baseUrl.trim().replace(/\/+$/, "");
  let parsed: URL;
  try { parsed = new URL(root); } catch { throw new Error("SUPPORT_RELATIONSHIP_BASE_URL_INVALID"); }
  if (!root || !["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) throw new Error("SUPPORT_RELATIONSHIP_BASE_URL_INVALID");
  const token = config.readToken.trim();
  if (new TextEncoder().encode(token).byteLength < 32 || token.length > 4096) throw new Error("SUPPORT_RELATIONSHIP_TOKEN_INVALID");
  const timeoutMs = config.timeoutMs ?? 10_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 250 || timeoutMs > 60_000) throw new Error("SUPPORT_RELATIONSHIP_TIMEOUT_INVALID");

  return Object.freeze({
    contract: BUSINESS_SUPPORT_RELATIONSHIP_SNAPSHOT_PORT_CONTRACT,
    async read(input) {
      const expected = exactRequest(input);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetchFn(`${root}/api/internal/relationship-manager/support-snapshot`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify(expected),
          cache: "no-store",
          redirect: "error",
          signal: controller.signal,
        });
      } catch (error) {
        if (controller.signal.aborted) throw new Error("SUPPORT_RELATIONSHIP_READ_TIMEOUT");
        throw new Error("SUPPORT_RELATIONSHIP_READ_UNAVAILABLE", { cause: error });
      } finally {
        clearTimeout(timer);
      }
      let envelope: unknown;
      try { envelope = await response.json(); } catch { throw new Error("SUPPORT_RELATIONSHIP_RESPONSE_INVALID"); }
      if (!response.ok) throw new Error(`SUPPORT_RELATIONSHIP_READ_FAILED:${response.status}`);
      const raw = object(envelope, "SUPPORT_RELATIONSHIP_ENVELOPE_INVALID");
      if (raw.ok !== true || raw.data === undefined) throw new Error("SUPPORT_RELATIONSHIP_ENVELOPE_INVALID");
      return parseSnapshot(raw.data, expected);
    },
  });
}