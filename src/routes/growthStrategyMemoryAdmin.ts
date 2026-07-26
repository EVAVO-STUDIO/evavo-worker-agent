import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import {
  listGrowthKeyResults,
  listGrowthObjectives,
  listGrowthOfferProfiles,
  listGrowthPositioningProfiles,
  listGrowthRuntimeConstraints,
  listGrowthTargetSegments,
  loadGrowthStrategyMemory,
  upsertGrowthKeyResult,
  upsertGrowthObjective,
  upsertGrowthOfferProfile,
  upsertGrowthPositioningProfile,
  upsertGrowthRuntimeConstraint,
  upsertGrowthTargetSegment,
} from "../core/growthStrategyMemory";
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

const OBJECTIVE_INPUT_KEYS = new Set([
  "id",
  "name",
  "description",
  "status",
  "priority",
  "successMetric",
  "success_metric",
  "targetDate",
  "target_date",
]);
const OBJECTIVE_BODY_KEYS = new Set(["objective", "id"]);
const KEY_RESULT_INPUT_KEYS = new Set([
  "id",
  "objectiveId",
  "objective_id",
  "name",
  "metricName",
  "metric_name",
  "targetValue",
  "target_value",
  "currentValue",
  "current_value",
  "unit",
  "status",
]);
const KEY_RESULT_BODY_KEYS = new Set(["keyResult", "id"]);
const SEGMENT_INPUT_KEYS = new Set([
  "id",
  "name",
  "description",
  "geography",
  "industry",
  "companySize",
  "company_size",
  "buyerRoles",
  "buyer_roles",
  "painPoints",
  "pain_points_json",
  "priority",
  "status",
]);
const SEGMENT_BODY_KEYS = new Set(["segment", "id"]);
const OFFER_INPUT_KEYS = new Set([
  "id",
  "name",
  "description",
  "offerType",
  "offer_type",
  "proofPoints",
  "proof_points_json",
  "bestForSegments",
  "best_for_segments_json",
  "riskNotes",
  "risk_notes",
  "priority",
  "status",
]);
const OFFER_BODY_KEYS = new Set(["offer", "id"]);
const POSITIONING_INPUT_KEYS = new Set([
  "id",
  "name",
  "voiceNotes",
  "voice_notes",
  "valueProp",
  "value_prop",
  "avoidPhrases",
  "avoid_phrases_json",
  "preferredAngles",
  "preferred_angles_json",
  "proofAssets",
  "proof_assets_json",
  "status",
]);
const POSITIONING_BODY_KEYS = new Set(["positioning", "id"]);
const CONSTRAINT_INPUT_KEYS = new Set([
  "id",
  "name",
  "constraintType",
  "constraint_type",
  "description",
  "severity",
  "rule",
  "rule_json",
  "status",
]);
const CONSTRAINT_BODY_KEYS = new Set(["constraint", "id"]);

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
  const missingStrategyTable = /no such table: growth_(objectives|key_results|target_segments|offer_profiles|positioning_profiles|runtime_constraints)/i.test(message);
  const inputFailure =
    /^GROWTH_STRATEGY_/.test(message) ||
    /^growth_(objective|key_result|target_segment|offer_profile|positioning_profile|runtime_constraint)_/.test(message);
  return Object.freeze({
    status: inputFailure ? 400 : 503,
    payload: Object.freeze({
      ok: false,
      mode: "growth_strategy_memory_error",
      error: missingStrategyTable
        ? "growth_strategy_memory_schema_missing"
        : inputFailure
          ? "growth_strategy_memory_invalid_request"
          : "growth_strategy_memory_failed",
      requiredMigration: missingStrategyTable ? "0016_growth_strategy_memory.sql" : null,
      rawErrorExposed: false,
      safety: inputFailure ? WRITE_SAFETY : READ_SAFETY,
    }),
  });
}

export async function handleGrowthStrategyMemoryAdmin(
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
    if (request.method === "GET" && pathname === "/admin/growth/strategy-memory") {
      return json({
        ok: true,
        mode: "growth_strategy_memory",
        strategyMemory: await loadGrowthStrategyMemory(env),
        safety: READ_SAFETY,
      });
    }

    if (request.method === "GET" && pathname === "/admin/growth/objectives") {
      const objectives = await listGrowthObjectives(
        env,
        intParam(url, "limit", 25, 1, 100),
        url.searchParams.get("status") || undefined,
      );
      return json({ ok: true, mode: "growth_objectives", objectives, count: objectives.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/key-results") {
      const keyResults = await listGrowthKeyResults(
        env,
        intParam(url, "limit", 50, 1, 100),
        url.searchParams.get("objectiveId") || undefined,
      );
      return json({ ok: true, mode: "growth_key_results", keyResults, count: keyResults.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/segments") {
      const segments = await listGrowthTargetSegments(
        env,
        intParam(url, "limit", 25, 1, 100),
        url.searchParams.get("status") || undefined,
      );
      return json({ ok: true, mode: "growth_target_segments", segments, count: segments.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/offers") {
      const offers = await listGrowthOfferProfiles(
        env,
        intParam(url, "limit", 25, 1, 100),
        url.searchParams.get("status") || undefined,
      );
      return json({ ok: true, mode: "growth_offer_profiles", offers, count: offers.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/positioning") {
      const positioning = await listGrowthPositioningProfiles(
        env,
        intParam(url, "limit", 25, 1, 100),
        url.searchParams.get("status") || undefined,
      );
      return json({ ok: true, mode: "growth_positioning_profiles", positioning, count: positioning.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/runtime-constraints") {
      const constraints = await listGrowthRuntimeConstraints(
        env,
        intParam(url, "limit", 50, 1, 100),
        url.searchParams.get("status") || undefined,
      );
      return json({ ok: true, mode: "growth_runtime_constraints", constraints, count: constraints.length, safety: READ_SAFETY });
    }

    if (request.method === "POST" && pathname === "/admin/growth/objectives") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "objective",
        OBJECTIVE_BODY_KEYS,
        OBJECTIVE_INPUT_KEYS,
        "GROWTH_STRATEGY_OBJECTIVE",
      );
      const objective = await upsertGrowthObjective(env, input, id);
      return json({
        ok: true,
        mode: "growth_objective_saved",
        objective,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/key-results") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "keyResult",
        KEY_RESULT_BODY_KEYS,
        KEY_RESULT_INPUT_KEYS,
        "GROWTH_STRATEGY_KEY_RESULT",
      );
      const keyResult = await upsertGrowthKeyResult(env, input, id);
      return json({
        ok: true,
        mode: "growth_key_result_saved",
        keyResult,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/segments") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "segment",
        SEGMENT_BODY_KEYS,
        SEGMENT_INPUT_KEYS,
        "GROWTH_STRATEGY_SEGMENT",
      );
      const segment = await upsertGrowthTargetSegment(env, input, id);
      return json({
        ok: true,
        mode: "growth_target_segment_saved",
        segment,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/offers") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "offer",
        OFFER_BODY_KEYS,
        OFFER_INPUT_KEYS,
        "GROWTH_STRATEGY_OFFER",
      );
      const offer = await upsertGrowthOfferProfile(env, input, id);
      return json({
        ok: true,
        mode: "growth_offer_profile_saved",
        offer,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/positioning") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "positioning",
        POSITIONING_BODY_KEYS,
        POSITIONING_INPUT_KEYS,
        "GROWTH_STRATEGY_POSITIONING",
      );
      const positioning = await upsertGrowthPositioningProfile(env, input, id);
      return json({
        ok: true,
        mode: "growth_positioning_profile_saved",
        positioning,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/runtime-constraints") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "constraint",
        CONSTRAINT_BODY_KEYS,
        CONSTRAINT_INPUT_KEYS,
        "GROWTH_STRATEGY_CONSTRAINT",
      );
      const constraint = await upsertGrowthRuntimeConstraint(env, input, id);
      return json({
        ok: true,
        mode: "growth_runtime_constraint_saved",
        constraint,
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
