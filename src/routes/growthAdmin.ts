import { Env, getAdminToken, todayUTC } from "../db";
import {
  assessGrowthBudget,
  getGrowthOverview,
  getOrCreateGrowthBudgetLedger,
  growthAutomationModes,
  listGrowthChannels,
  listGrowthGoals,
  upsertGrowthChannel,
  upsertGrowthGoal,
} from "../core/growthAutonomy";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

type SafetyOverrides = Partial<ReturnType<typeof safetyBase>>;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

function intParam(url: URL, key: string, fallback: number, min: number, max: number): number {
  const value = Number(url.searchParams.get(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function safetyBase() {
  return {
    readOnly: true,
    writesGrowthStrategyOnly: false,
    callsAI: false,
    sendsEmail: false,
    postsPublicly: false,
    submitsForms: false,
    executesGrowthActions: false,
    requiresConfirmationForWrites: true,
  };
}

function safety(overrides: SafetyOverrides = {}) {
  return { ...safetyBase(), ...overrides };
}

function migrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const missingGrowthTable = /no such table: growth_/i.test(message);
  return {
    ok: false,
    mode: "growth_admin_error",
    error: missingGrowthTable ? "growth_schema_missing" : "growth_admin_failed",
    message,
    requiredMigration: missingGrowthTable ? "0012_growth_autonomy_core.sql" : null,
    safety: safety({ readOnly: true }),
  };
}

async function parseBody(request: Request): Promise<any> {
  return request.json().catch(() => ({}));
}

function confirmed(url: URL, body: any): boolean {
  return url.searchParams.get("confirm") === "1" || body?.confirm === true || body?.confirm === 1 || body?.confirm === "1";
}

function writeBlocked(json: JsonResponse) {
  return json({
    ok: false,
    error: "confirm_required",
    reason: "Growth Strategy writes require confirm=1 or { confirm: true }. No execution, AI, email, posting, or form submission is performed by this route.",
    safety: safety({ readOnly: false, writesGrowthStrategyOnly: true }),
  }, { status: 400 });
}

export async function handleGrowthAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);

  try {
    if (request.method === "GET") {
      if (pathname === "/admin/growth" || pathname === "/admin/growth/overview") {
        const overview = await getGrowthOverview(env);
        return json({
          ok: true,
          mode: "growth_overview",
          contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
          ...overview,
          allowedAutomationModes: growthAutomationModes,
          safety: safety(),
        });
      }

      if (pathname === "/admin/growth/strategy") {
        const limit = intParam(url, "limit", 25, 1, 100);
        const goals = await listGrowthGoals(env, limit);
        return json({
          ok: true,
          mode: "growth_strategy",
          contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
          goals,
          count: goals.length,
          safety: safety(),
        });
      }

      if (pathname === "/admin/growth/channels") {
        const limit = intParam(url, "limit", 50, 1, 200);
        const channels = await listGrowthChannels(env, limit);
        return json({
          ok: true,
          mode: "growth_channels",
          contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
          channels,
          count: channels.length,
          safety: safety(),
        });
      }

      if (pathname === "/admin/growth/budget") {
        const profileId = url.searchParams.get("profile") || "free_safe";
        const day = url.searchParams.get("date") || todayUTC();
        const budget = await getOrCreateGrowthBudgetLedger(env, profileId, day);
        return json({
          ok: true,
          mode: "growth_budget",
          contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
          budget,
          budgetAssessment: assessGrowthBudget(budget, budget.profile_id),
          safety: safety(),
        });
      }

      return json({ ok: false, error: "not_found", path: pathname }, { status: 404 });
    }

    if (request.method === "POST" && pathname === "/admin/growth/strategy") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return writeBlocked(json);
      const saved = await upsertGrowthGoal(env, body.goal || body, body.id || body.goal?.id);
      return json({
        ok: true,
        mode: "growth_strategy_saved",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        goal: saved,
        safety: safety({ readOnly: false, writesGrowthStrategyOnly: true }),
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/channels") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return writeBlocked(json);
      const saved = await upsertGrowthChannel(env, body.channel || body, body.id || body.channel?.id);
      return json({
        ok: true,
        mode: "growth_channel_saved",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        channel: saved,
        safety: safety({ readOnly: false, writesGrowthStrategyOnly: true }),
      });
    }

    return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  } catch (error) {
    const payload = migrationError(error);
    return json(payload, { status: payload.error === "growth_schema_missing" ? 200 : 500 });
  }
}
