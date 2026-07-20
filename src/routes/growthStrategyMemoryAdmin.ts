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

type JsonResponse = (data: any, init?: ResponseInit) => Response;

const readSafety = { readOnly: true, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false, canSendEmail: false, canPostSocial: false, canSubmitForms: false };
const writeSafety = { readOnly: false, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false, canSendEmail: false, canPostSocial: false, canSubmitForms: false };

function intParam(url: URL, key: string, fallback: number, min: number, max: number): number {
  const value = Number(url.searchParams.get(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

async function parseBody(request: Request): Promise<any> {
  return request.json().catch(() => ({}));
}

function confirmed(url: URL, body: any): boolean {
  return url.searchParams.get("confirm") === "1" || body?.confirm === true || body?.confirm === 1 || body?.confirm === "1";
}

function blockedWrite(json: JsonResponse) {
  return json({
    ok: false,
    error: "confirm_required",
    reason: "Growth strategy memory writes require confirmation and only save internal strategic metadata.",
    safety: writeSafety,
  }, { status: 400 });
}

function migrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const missingStrategyTable = /no such table: growth_(objectives|key_results|target_segments|offer_profiles|positioning_profiles|runtime_constraints)/i.test(message);
  return {
    ok: false,
    mode: "growth_strategy_memory_error",
    error: missingStrategyTable ? "growth_strategy_memory_schema_missing" : "growth_strategy_memory_failed",
    message,
    requiredMigration: missingStrategyTable ? "0016_growth_strategy_memory.sql" : null,
    safety: readSafety,
  };
}

export async function handleGrowthStrategyMemoryAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET, POST" } });
  }
  const url = new URL(request.url);

  try {
    if (request.method === "GET" && pathname === "/admin/growth/strategy-memory") {
      return json({ ok: true, mode: "growth_strategy_memory", strategyMemory: await loadGrowthStrategyMemory(env), safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/objectives") {
      const objectives = await listGrowthObjectives(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ ok: true, mode: "growth_objectives", objectives, count: objectives.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/key-results") {
      const keyResults = await listGrowthKeyResults(env, intParam(url, "limit", 50, 1, 100), url.searchParams.get("objectiveId") || undefined);
      return json({ ok: true, mode: "growth_key_results", keyResults, count: keyResults.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/segments") {
      const segments = await listGrowthTargetSegments(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ ok: true, mode: "growth_target_segments", segments, count: segments.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/offers") {
      const offers = await listGrowthOfferProfiles(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ ok: true, mode: "growth_offer_profiles", offers, count: offers.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/positioning") {
      const positioning = await listGrowthPositioningProfiles(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ ok: true, mode: "growth_positioning_profiles", positioning, count: positioning.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/runtime-constraints") {
      const constraints = await listGrowthRuntimeConstraints(env, intParam(url, "limit", 50, 1, 100), url.searchParams.get("status") || undefined);
      return json({ ok: true, mode: "growth_runtime_constraints", constraints, count: constraints.length, safety: readSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/objectives") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const objective = await upsertGrowthObjective(env, body.objective || body, body.id || body.objective?.id);
      return json({ ok: true, mode: "growth_objective_saved", objective, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/key-results") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const keyResult = await upsertGrowthKeyResult(env, body.keyResult || body, body.id || body.keyResult?.id);
      return json({ ok: true, mode: "growth_key_result_saved", keyResult, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/segments") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const segment = await upsertGrowthTargetSegment(env, body.segment || body, body.id || body.segment?.id);
      return json({ ok: true, mode: "growth_target_segment_saved", segment, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/offers") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const offer = await upsertGrowthOfferProfile(env, body.offer || body, body.id || body.offer?.id);
      return json({ ok: true, mode: "growth_offer_profile_saved", offer, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/positioning") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const positioning = await upsertGrowthPositioningProfile(env, body.positioning || body, body.id || body.positioning?.id);
      return json({ ok: true, mode: "growth_positioning_profile_saved", positioning, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/runtime-constraints") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const constraint = await upsertGrowthRuntimeConstraint(env, body.constraint || body, body.id || body.constraint?.id);
      return json({ ok: true, mode: "growth_runtime_constraint_saved", constraint, safety: writeSafety });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const normalized = migrationError(error);
    return json(normalized, { status: 500 });
  }
}
