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
import { listGrowthAuditEvents, logGrowthAuditEvent } from "../core/growthAudit";
import { upsertGrowthAction } from "../core/growthActions";
import { listGrowthActions, listGrowthSignals } from "../core/growthEngagementReadModels";
import { upsertGrowthSignal } from "../core/growthSignals";

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

function optionalStatus(url: URL): string | undefined {
  const status = url.searchParams.get("status") || undefined;
  return status && status.length <= 48 ? status : undefined;
}

function optionalEntityType(url: URL): string | undefined {
  const entityType = url.searchParams.get("entityType") || undefined;
  return entityType && entityType.length <= 64 ? entityType : undefined;
}

function safetyBase() {
  return {
    readOnly: true,
    writesGrowthStrategyOnly: false,
    writesGrowthQueueOnly: false,
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
  const duplicateSignal = /UNIQUE constraint failed: growth_signals\.duplicate_key/i.test(message);
  return {
    ok: false,
    mode: "growth_admin_error",
    error: missingGrowthTable ? "growth_schema_missing" : duplicateSignal ? "growth_signal_duplicate" : "growth_admin_failed",
    message,
    requiredMigration: missingGrowthTable ? "latest Growth migration, including 0012_growth_autonomy_core.sql and 0013_growth_audit_events.sql" : null,
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
    reason: "Growth writes require confirm=1 or { confirm: true }. No execution, AI, email, posting, or form submission is performed by this route.",
    safety: safety({ readOnly: false, writesGrowthStrategyOnly: true, writesGrowthQueueOnly: true }),
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

      if (pathname === "/admin/growth/signals") {
        const limit = intParam(url, "limit", 50, 1, 200);
        const status = optionalStatus(url);
        const signals = await listGrowthSignals(env, limit, status);
        return json({
          ok: true,
          mode: "growth_signals",
          contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
          signals,
          count: signals.length,
          filter: { status: status || null },
          safety: safety(),
        });
      }

      if (pathname === "/admin/growth/actions") {
        const limit = intParam(url, "limit", 50, 1, 200);
        const status = optionalStatus(url);
        const actions = await listGrowthActions(env, limit, status);
        return json({
          ok: true,
          mode: "growth_actions",
          contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
          actions,
          count: actions.length,
          filter: { status: status || null },
          safety: safety(),
        });
      }

      if (pathname === "/admin/growth/audit") {
        const limit = intParam(url, "limit", 50, 1, 200);
        const entityType = optionalEntityType(url);
        const events = await listGrowthAuditEvents(env, limit, entityType);
        return json({
          ok: true,
          mode: "growth_audit_events",
          contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
          events,
          count: events.length,
          filter: { entityType: entityType || null },
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
      const routeSafety = safety({ readOnly: false, writesGrowthStrategyOnly: true });
      const audit = await logGrowthAuditEvent(env, {
        eventType: "growth_strategy_saved",
        entityType: "growth_goal",
        entityId: saved.id,
        actor: "admin",
        automationMode: saved.automation_mode,
        reason: "Confirmed Growth Strategy metadata save. No execution, AI, email, posting, or form submission performed.",
        inputSnapshot: { id: body.id || body.goal?.id || null, body: body.goal || body },
        outputSnapshot: { goal: saved },
        safetyResult: routeSafety,
      });
      return json({
        ok: true,
        mode: "growth_strategy_saved",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        goal: saved,
        audit,
        safety: routeSafety,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/channels") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return writeBlocked(json);
      const saved = await upsertGrowthChannel(env, body.channel || body, body.id || body.channel?.id);
      const routeSafety = safety({ readOnly: false, writesGrowthStrategyOnly: true });
      const audit = await logGrowthAuditEvent(env, {
        eventType: "growth_channel_saved",
        entityType: "growth_channel",
        entityId: saved.id,
        actor: "admin",
        automationMode: saved.automation_mode,
        reason: "Confirmed Growth channel metadata save. No outreach, posting, form submission, AI generation, or external execution performed.",
        inputSnapshot: { id: body.id || body.channel?.id || null, body: body.channel || body },
        outputSnapshot: { channel: saved },
        safetyResult: routeSafety,
      });
      return json({
        ok: true,
        mode: "growth_channel_saved",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        channel: saved,
        audit,
        safety: routeSafety,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/signals") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return writeBlocked(json);
      const saved = await upsertGrowthSignal(env, body.signal || body, body.id || body.signal?.id);
      const routeSafety = safety({ readOnly: false, writesGrowthQueueOnly: true });
      const audit = await logGrowthAuditEvent(env, {
        eventType: "growth_signal_saved",
        entityType: "growth_signal",
        entityId: saved.id,
        actor: "admin",
        automationMode: "observe",
        reason: "Confirmed Growth signal metadata save. No draft generation, outreach, posting, form submission, AI call, or external execution performed.",
        inputSnapshot: { id: body.id || body.signal?.id || null, body: body.signal || body },
        outputSnapshot: { signal: saved },
        safetyResult: routeSafety,
      });
      return json({
        ok: true,
        mode: "growth_signal_saved",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        signal: saved,
        audit,
        safety: routeSafety,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/actions") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return writeBlocked(json);
      const saved = await upsertGrowthAction(env, body.action || body, body.id || body.action?.id);
      const routeSafety = safety({ readOnly: false, writesGrowthQueueOnly: true });
      const audit = await logGrowthAuditEvent(env, {
        eventType: "growth_action_saved",
        entityType: "growth_action",
        entityId: saved.id,
        actor: "admin",
        automationMode: saved.recommended_mode,
        reason: "Confirmed Growth action metadata save. The action is queued only; no draft generation, outreach, posting, form submission, AI call, approval, or external execution performed.",
        inputSnapshot: { id: body.id || body.action?.id || null, body: body.action || body },
        outputSnapshot: { action: saved },
        safetyResult: routeSafety,
      });
      return json({
        ok: true,
        mode: "growth_action_saved",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        action: saved,
        audit,
        safety: routeSafety,
      });
    }

    return json({ ok: false, error: "method_not_allowed" }, { status: 405 });
  } catch (error) {
    const payload = migrationError(error);
    return json(payload, { status: payload.error === "growth_schema_missing" || payload.error === "growth_signal_duplicate" ? 200 : 500 });
  }
}
