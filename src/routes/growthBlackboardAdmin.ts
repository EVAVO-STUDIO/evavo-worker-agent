import { Env, getAdminToken } from "../db";
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

type JsonResponse = (data: any, init?: ResponseInit) => Response;

const readSafety = { readOnly: true, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false, canSendEmail: false, canPostSocial: false, canSubmitForms: false };
const writeSafety = { readOnly: false, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false, canSendEmail: false, canPostSocial: false, canSubmitForms: false };

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

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
    reason: "Growth blackboard writes require confirmation and only save internal knowledge metadata.",
    safety: writeSafety,
  }, { status: 400 });
}

function migrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const missingBlackboardTable = /no such table: growth_(blackboard_facts|entities|entity_relationships|market_signals|asset_inventory)/i.test(message);
  return {
    ok: false,
    mode: "growth_blackboard_error",
    error: missingBlackboardTable ? "growth_blackboard_schema_missing" : "growth_blackboard_failed",
    message,
    requiredMigration: missingBlackboardTable ? "0017_growth_blackboard.sql" : null,
    safety: readSafety,
  };
}

export async function handleGrowthBlackboardAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);

  try {
    if (request.method === "GET" && pathname === "/admin/growth/blackboard") {
      return json({ ok: true, mode: "growth_blackboard", blackboard: await loadGrowthBlackboard(env), safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/blackboard/facts") {
      const facts = await listGrowthBlackboardFacts(env, intParam(url, "limit", 50, 1, 100), url.searchParams.get("subjectId") || undefined);
      return json({ ok: true, mode: "growth_blackboard_facts", facts, count: facts.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/blackboard/entities") {
      const entities = await listGrowthEntities(env, intParam(url, "limit", 50, 1, 100), url.searchParams.get("entityType") || undefined);
      return json({ ok: true, mode: "growth_entities", entities, count: entities.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/blackboard/relationships") {
      const relationships = await listGrowthEntityRelationships(env, intParam(url, "limit", 50, 1, 100), url.searchParams.get("fromEntityId") || undefined);
      return json({ ok: true, mode: "growth_entity_relationships", relationships, count: relationships.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/blackboard/signals") {
      const signals = await listGrowthMarketSignals(env, intParam(url, "limit", 50, 1, 100), url.searchParams.get("segmentId") || undefined);
      return json({ ok: true, mode: "growth_market_signals", signals, count: signals.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/blackboard/assets") {
      const assets = await listGrowthAssets(env, intParam(url, "limit", 50, 1, 100), url.searchParams.get("assetType") || undefined);
      return json({ ok: true, mode: "growth_asset_inventory", assets, count: assets.length, safety: readSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/blackboard/facts") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const fact = await upsertGrowthBlackboardFact(env, body.fact || body, body.id || body.fact?.id);
      return json({ ok: true, mode: "growth_blackboard_fact_saved", fact, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/blackboard/entities") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const entity = await upsertGrowthEntity(env, body.entity || body, body.id || body.entity?.id);
      return json({ ok: true, mode: "growth_entity_saved", entity, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/blackboard/relationships") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const relationship = await upsertGrowthEntityRelationship(env, body.relationship || body, body.id || body.relationship?.id);
      return json({ ok: true, mode: "growth_entity_relationship_saved", relationship, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/blackboard/signals") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const signal = await upsertGrowthMarketSignal(env, body.signal || body, body.id || body.signal?.id);
      return json({ ok: true, mode: "growth_market_signal_saved", signal, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/blackboard/assets") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const asset = await upsertGrowthAsset(env, body.asset || body, body.id || body.asset?.id);
      return json({ ok: true, mode: "growth_asset_saved", asset, safety: writeSafety });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const normalized = migrationError(error);
    return json(normalized, { status: 500 });
  }
}
