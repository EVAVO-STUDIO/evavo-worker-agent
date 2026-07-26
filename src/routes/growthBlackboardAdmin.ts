import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import {
  listGrowthAssets,
  listGrowthBlackboardFacts,
  listGrowthEntities,
  listGrowthEntityRelationships,
  listGrowthMarketSignals,
  loadGrowthBlackboard,
  upsertGrowthAsset,
  upsertGrowthBlackboardFact,
  upsertGrowthEntity,
  upsertGrowthEntityRelationship,
  upsertGrowthMarketSignal,
} from "../core/growthBlackboard";
import {
  growthInternalWriteFailurePayload,
  readGrowthInternalWriteRequest,
} from "../core/growthInternalWriteRequest";

type JsonResponse = (data: any, init?: ResponseInit) => Response;
type UnknownRecord = Record<string, unknown>;

const READ_SAFETY = Object.freeze({
  readOnly: true,
  internalMetadataOnly: true,
  externalStateChange: false,
  callsAI: false,
  callsNetwork: false,
  canSendEmail: false,
  canPostSocial: false,
  canSubmitForms: false,
  rawErrorExposed: false,
});
const WRITE_SAFETY = Object.freeze({
  ...READ_SAFETY,
  readOnly: false,
  boundedJsonRequired: true,
  exactBooleanConfirmationRequired: true,
  confirmationCoercionAllowed: false,
  queryConfirmationAllowed: false,
  sensitiveInputKeysAllowed: false,
});

const FACT_INPUT_KEYS = new Set([
  "id",
  "factType",
  "fact_type",
  "subjectType",
  "subject_type",
  "subjectId",
  "subject_id",
  "subjectName",
  "subject_name",
  "predicate",
  "objectType",
  "object_type",
  "objectId",
  "object_id",
  "objectName",
  "object_name",
  "summary",
  "evidenceRefs",
  "evidence_refs_json",
  "confidenceScore",
  "confidence_score",
  "source",
  "status",
]);
const FACT_BODY_KEYS = new Set(["fact", "id"]);
const ENTITY_INPUT_KEYS = new Set([
  "id",
  "entityType",
  "entity_type",
  "name",
  "canonicalUrl",
  "canonical_url",
  "description",
  "attributes",
  "attributes_json",
  "status",
]);
const ENTITY_BODY_KEYS = new Set(["entity", "id"]);
const RELATIONSHIP_INPUT_KEYS = new Set([
  "id",
  "fromEntityId",
  "from_entity_id",
  "toEntityId",
  "to_entity_id",
  "relationshipType",
  "relationship_type",
  "summary",
  "confidenceScore",
  "confidence_score",
  "status",
]);
const RELATIONSHIP_BODY_KEYS = new Set(["relationship", "id"]);
const SIGNAL_INPUT_KEYS = new Set([
  "id",
  "signalType",
  "signal_type",
  "segmentId",
  "segment_id",
  "segmentName",
  "segment_name",
  "offerId",
  "offer_id",
  "offerName",
  "offer_name",
  "summary",
  "sourceUrl",
  "source_url",
  "evidenceRefs",
  "evidence_refs_json",
  "strengthScore",
  "strength_score",
  "freshnessScore",
  "freshness_score",
  "status",
]);
const SIGNAL_BODY_KEYS = new Set(["signal", "id"]);
const ASSET_INPUT_KEYS = new Set([
  "id",
  "assetType",
  "asset_type",
  "name",
  "url",
  "summary",
  "bestForSegments",
  "best_for_segments_json",
  "bestForOffers",
  "best_for_offers_json",
  "proofPoints",
  "proof_points_json",
  "status",
]);
const ASSET_BODY_KEYS = new Set(["asset", "id"]);

function intParam(url: URL, key: string, fallback: number, min: number, max: number): number {
  const raw = url.searchParams.get(key);
  if (raw === null || raw === "" || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function recordValue(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as UnknownRecord;
}

function exactKeys(record: UnknownRecord, allowed: ReadonlySet<string>, code: string): void {
  if (Object.keys(record).some((key) => !allowed.has(key))) throw new Error(code);
}

function optionalIdentifier(value: unknown, code: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length < 2 ||
    value.length > 160 ||
    /\p{Cc}/u.test(value) ||
    value.includes("..")
  ) throw new Error(code);
  return value;
}

function wrappedInput(
  body: UnknownRecord,
  wrapperKey: string,
  bodyKeys: ReadonlySet<string>,
  inputKeys: ReadonlySet<string>,
  code: string,
): Readonly<{ input: Readonly<UnknownRecord>; id: string | undefined }> {
  const wrapped = body[wrapperKey] !== undefined;
  exactKeys(body, wrapped ? bodyKeys : inputKeys, `${code}_KEYS_INVALID`);
  const candidate = wrapped
    ? recordValue(body[wrapperKey], `${code}_BODY_INVALID`)
    : body;
  exactKeys(candidate, inputKeys, `${code}_FIELDS_INVALID`);
  const outerId = optionalIdentifier(body.id, `${code}_ID_INVALID`);
  const innerId = optionalIdentifier(candidate.id, `${code}_ID_INVALID`);
  if (outerId && innerId && outerId !== innerId) throw new Error(`${code}_ID_CONFLICT`);
  const id = outerId ?? innerId;
  const { id: _id, ...input } = candidate;
  return Object.freeze({ input: Object.freeze(input), id });
}

async function confirmedWriteBody(request: Request, json: JsonResponse) {
  const parsed = await readGrowthInternalWriteRequest(request);
  if (parsed.ok) return parsed;
  return {
    ...parsed,
    response: json({
      ...growthInternalWriteFailurePayload(parsed),
      safety: WRITE_SAFETY,
    }, { status: parsed.status }),
  } as const;
}

function requestReceipt(parsed: Readonly<{ contractVersion: string }>) {
  return Object.freeze({
    contractVersion: parsed.contractVersion,
    bodySha256Available: true,
    exactBooleanConfirmation: true,
  });
}

function normalizedFailure(error: unknown): Readonly<{
  status: 400 | 503;
  payload: Readonly<Record<string, unknown>>;
}> {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const missingBlackboardTable = /no such table: growth_(blackboard_facts|entities|entity_relationships|market_signals|asset_inventory)/i.test(message);
  const inputFailure =
    /^GROWTH_BLACKBOARD_/.test(message) ||
    /^growth_(blackboard_fact|entity|relationship|market_signal|asset)_/.test(message);
  return Object.freeze({
    status: inputFailure ? 400 : 503,
    payload: Object.freeze({
      ok: false,
      mode: "growth_blackboard_error",
      error: missingBlackboardTable
        ? "growth_blackboard_schema_missing"
        : inputFailure
          ? "growth_blackboard_invalid_request"
          : "growth_blackboard_failed",
      requiredMigration: missingBlackboardTable ? "0017_growth_blackboard.sql" : null,
      rawErrorExposed: false,
      safety: inputFailure ? WRITE_SAFETY : READ_SAFETY,
    }),
  });
}

export async function handleGrowthBlackboardAdmin(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse,
): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (request.method === "OPTIONS") {
    return json(
      { ok: false, error: "method_not_allowed" },
      { status: 405, headers: { allow: "GET, POST" } },
    );
  }
  const url = new URL(request.url);
  if (request.method === "POST" && [...url.searchParams.keys()].length !== 0) {
    return json({
      ok: false,
      error: "query_not_supported",
      queryConfirmationAllowed: false,
      safety: WRITE_SAFETY,
    }, { status: 400 });
  }

  try {
    if (request.method === "GET" && pathname === "/admin/growth/blackboard") {
      return json({
        ok: true,
        mode: "growth_blackboard",
        blackboard: await loadGrowthBlackboard(env),
        safety: READ_SAFETY,
      });
    }

    if (request.method === "GET" && pathname === "/admin/growth/blackboard/facts") {
      const facts = await listGrowthBlackboardFacts(
        env,
        intParam(url, "limit", 50, 1, 100),
        url.searchParams.get("subjectId") || undefined,
      );
      return json({ ok: true, mode: "growth_blackboard_facts", facts, count: facts.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/blackboard/entities") {
      const entities = await listGrowthEntities(
        env,
        intParam(url, "limit", 50, 1, 100),
        url.searchParams.get("entityType") || undefined,
      );
      return json({ ok: true, mode: "growth_entities", entities, count: entities.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/blackboard/relationships") {
      const relationships = await listGrowthEntityRelationships(
        env,
        intParam(url, "limit", 50, 1, 100),
        url.searchParams.get("fromEntityId") || undefined,
      );
      return json({ ok: true, mode: "growth_entity_relationships", relationships, count: relationships.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/blackboard/signals") {
      const signals = await listGrowthMarketSignals(
        env,
        intParam(url, "limit", 50, 1, 100),
        url.searchParams.get("segmentId") || undefined,
      );
      return json({ ok: true, mode: "growth_market_signals", signals, count: signals.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/blackboard/assets") {
      const assets = await listGrowthAssets(
        env,
        intParam(url, "limit", 50, 1, 100),
        url.searchParams.get("assetType") || undefined,
      );
      return json({ ok: true, mode: "growth_asset_inventory", assets, count: assets.length, safety: READ_SAFETY });
    }

    if (request.method === "POST" && pathname === "/admin/growth/blackboard/facts") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "fact",
        FACT_BODY_KEYS,
        FACT_INPUT_KEYS,
        "GROWTH_BLACKBOARD_FACT",
      );
      const fact = await upsertGrowthBlackboardFact(env, input, id);
      return json({
        ok: true,
        mode: "growth_blackboard_fact_saved",
        fact,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/blackboard/entities") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "entity",
        ENTITY_BODY_KEYS,
        ENTITY_INPUT_KEYS,
        "GROWTH_BLACKBOARD_ENTITY",
      );
      const entity = await upsertGrowthEntity(env, input, id);
      return json({
        ok: true,
        mode: "growth_entity_saved",
        entity,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/blackboard/relationships") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "relationship",
        RELATIONSHIP_BODY_KEYS,
        RELATIONSHIP_INPUT_KEYS,
        "GROWTH_BLACKBOARD_RELATIONSHIP",
      );
      const relationship = await upsertGrowthEntityRelationship(env, input, id);
      return json({
        ok: true,
        mode: "growth_entity_relationship_saved",
        relationship,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/blackboard/signals") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "signal",
        SIGNAL_BODY_KEYS,
        SIGNAL_INPUT_KEYS,
        "GROWTH_BLACKBOARD_SIGNAL",
      );
      const signal = await upsertGrowthMarketSignal(env, input, id);
      return json({
        ok: true,
        mode: "growth_market_signal_saved",
        signal,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/blackboard/assets") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "asset",
        ASSET_BODY_KEYS,
        ASSET_INPUT_KEYS,
        "GROWTH_BLACKBOARD_ASSET",
      );
      const asset = await upsertGrowthAsset(env, input, id);
      return json({
        ok: true,
        mode: "growth_asset_saved",
        asset,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const failure = normalizedFailure(error);
    return json(failure.payload, { status: failure.status });
  }
}
