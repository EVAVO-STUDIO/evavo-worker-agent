import { Env, todayUTC } from "../db";
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
import { planGrowthActionFromSignal } from "../core/growthActionPlanner";
import { upsertGrowthAction } from "../core/growthActions";
import {
  boundedJsonFailurePayload,
  isExplicitJsonConfirmation,
  readBoundedJsonObject,
} from "../core/boundedJsonRequest";
import { getGrowthBrief } from "../core/growthBrief";
import { listGrowthActions, listGrowthSignals } from "../core/growthEngagementReadModels";
import { updateGrowthActionStatus, updateGrowthSignalStatus } from "../core/growthQueueReview";
import { upsertGrowthSignal } from "../core/growthSignals";
import { handleGrowthAutonomousDiscoveryAdmin } from "./growthAutonomousDiscoveryAdmin";
import { handleGrowthBlackboardAdmin } from "./growthBlackboardAdmin";
import { handleGrowthCapabilitiesAdmin } from "./growthCapabilitiesAdmin";
import { handleGrowthCampaignIntelligenceAdmin } from "./growthCampaignIntelligenceAdmin";
import { handleGrowthStrategyMemoryAdmin } from "./growthStrategyMemoryAdmin";

type JsonResponse = (data: any, init?: ResponseInit) => Response;
type SafetyOverrides = Partial<ReturnType<typeof safetyBase>>;
type ConfirmedBodyResult =
  | Readonly<{ ok: true; body: any; requestBodySha256: string }>
  | Readonly<{ ok: false; response: Response }>;

const MAX_GROWTH_ADMIN_BODY_BYTES = 32_768;
const SENSITIVE_GROWTH_INPUT_KEYS = new Set([
  "authorization",
  "cookie",
  "password",
  "secret",
  "secretref",
  "token",
  "accesstoken",
  "refreshtoken",
  "providertoken",
  "servicerolekey",
  "apikey",
  "privatekey",
  "clientsecret",
]);

const campaignIntelligencePrefixes = [
  "/admin/growth/autonomy",
  "/admin/growth/cycle",
  "/admin/growth/operator",
  "/admin/growth/campaigns",
  "/admin/growth/experiments",
  "/admin/growth/decisions",
  "/admin/growth/metrics",
  "/admin/growth/evidence",
  "/admin/growth/learning",
];

const strategyMemoryPrefixes = [
  "/admin/growth/strategy-memory",
  "/admin/growth/objectives",
  "/admin/growth/key-results",
  "/admin/growth/segments",
  "/admin/growth/offers",
  "/admin/growth/positioning",
  "/admin/growth/runtime-constraints",
];

const blackboardPrefixes = ["/admin/growth/blackboard"];
const autonomousDiscoveryPrefixes = ["/admin/growth/discovery"];

function pathMatches(pathname: string, prefixes: string[]) {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
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
    internalMetadataOnly: true,
    externalStateChange: false,
    writesGrowthStrategyOnly: false,
    writesGrowthQueueOnly: false,
    callsAI: false,
    callsNetwork: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    sendsEmail: false,
    postsPublicly: false,
    submitsForms: false,
    executesGrowthActions: false,
    requiresConfirmationForWrites: true,
    boundedJsonRequired: true,
    exactBooleanConfirmationRequired: true,
    confirmationCoercionAllowed: false,
    sensitiveInputKeysAllowed: false,
    rawErrorsExposed: false,
  };
}

function safety(overrides: SafetyOverrides = {}) {
  return { ...safetyBase(), ...overrides };
}

function migrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const missingGrowthTable = /no such table: growth_/i.test(message);
  const duplicateSignal = /UNIQUE constraint failed: growth_signals\.duplicate_key/i.test(message);
  const diagnosticCode = missingGrowthTable
    ? "growth_schema_missing"
    : duplicateSignal
      ? "growth_signal_duplicate"
      : "growth_admin_failed";
  return {
    ok: false,
    mode: "growth_admin_error",
    error: diagnosticCode,
    diagnosticCode,
    requiredMigration: missingGrowthTable
      ? "latest Growth migration, including 0012_growth_autonomy_core.sql through 0023_growth_activity_budget_ledger.sql"
      : null,
    rawErrorExposed: false,
    safety: safety({ readOnly: true }),
  };
}

function writeBlocked(json: JsonResponse): Response {
  return json({
    ok: false,
    error: "confirm_required",
    requiredPayload: { confirm: true },
    confirmationCoercionAllowed: false,
    reason: "Growth internal writes require exact JSON { confirm: true }. No execution, AI, email, posting, form submission or provider mutation is performed by this route.",
    safety: safety({ readOnly: false, writesGrowthStrategyOnly: true, writesGrowthQueueOnly: true }),
  }, { status: 400 });
}

function normalizedInputKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function containsSensitiveInputKey(value: unknown): boolean {
  const stack: unknown[] = [value];
  while (stack.length) {
    const current = stack.pop();
    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }
    if (!current || typeof current !== "object") continue;
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      if (SENSITIVE_GROWTH_INPUT_KEYS.has(normalizedInputKey(key))) return true;
      stack.push(child);
    }
  }
  return false;
}

async function readConfirmedBody(
  request: Request,
  json: JsonResponse,
): Promise<ConfirmedBodyResult> {
  const parsed = await readBoundedJsonObject<Record<string, any>>(request, {
    maxBytes: MAX_GROWTH_ADMIN_BODY_BYTES,
    maxDepth: 10,
    maxNodes: 1_000,
    maxArrayLength: 200,
    maxStringLength: 16_384,
    maxKeyLength: 160,
  });
  if (!parsed.ok) {
    return Object.freeze({
      ok: false,
      response: json({
        ...boundedJsonFailurePayload(parsed),
        safety: safety({ readOnly: false }),
      }, { status: parsed.status }),
    });
  }
  if (!isExplicitJsonConfirmation(parsed.value)) {
    return Object.freeze({ ok: false, response: writeBlocked(json) });
  }
  if (containsSensitiveInputKey(parsed.value)) {
    return Object.freeze({
      ok: false,
      response: json({
        ok: false,
        error: "forbidden_growth_input_key",
        safety: safety({ readOnly: false }),
      }, { status: 400 }),
    });
  }
  const { confirm: _confirm, ...body } = parsed.value;
  return Object.freeze({
    ok: true,
    body: Object.freeze(body),
    requestBodySha256: parsed.bodySha256,
  });
}

function auditInput(body: any, requestBodySha256: string) {
  return {
    requestBodySha256,
    payload: body,
  };
}

export async function handleGrowthAdmin(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return json(
      { ok: false, error: "method_not_allowed" },
      { status: 405, headers: { allow: "GET, POST" } },
    );
  }

  const url = new URL(request.url);

  try {
    if (pathname === "/admin/growth/capabilities") {
      return await handleGrowthCapabilitiesAdmin(request, env, pathname, json);
    }
    if (pathMatches(pathname, autonomousDiscoveryPrefixes)) {
      return await handleGrowthAutonomousDiscoveryAdmin(request, env, pathname, json);
    }
    if (pathMatches(pathname, campaignIntelligencePrefixes)) {
      return await handleGrowthCampaignIntelligenceAdmin(request, env, pathname, json);
    }
    if (pathMatches(pathname, strategyMemoryPrefixes)) {
      return await handleGrowthStrategyMemoryAdmin(request, env, pathname, json);
    }
    if (pathMatches(pathname, blackboardPrefixes)) {
      return await handleGrowthBlackboardAdmin(request, env, pathname, json);
    }

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
      if (pathname === "/admin/growth/brief") {
        const profileId = url.searchParams.get("profile") || "free_safe";
        const brief = await getGrowthBrief(env, profileId);
        return json({
          ok: true,
          mode: "growth_brief",
          contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
          ...brief,
          safety: safety(),
        });
      }
      if (pathname === "/admin/growth/strategy") {
        const goals = await listGrowthGoals(env, intParam(url, "limit", 25, 1, 100));
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
        const channels = await listGrowthChannels(env, intParam(url, "limit", 50, 1, 200));
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
        const status = optionalStatus(url);
        const signals = await listGrowthSignals(env, intParam(url, "limit", 50, 1, 200), status);
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
        const status = optionalStatus(url);
        const actions = await listGrowthActions(env, intParam(url, "limit", 50, 1, 200), status);
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
        const entityType = optionalEntityType(url);
        const events = await listGrowthAuditEvents(env, intParam(url, "limit", 50, 1, 200), entityType);
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
      const parsed = await readConfirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const body = parsed.body;
      const saved = await upsertGrowthGoal(env, body.goal || body, body.id || body.goal?.id);
      const routeSafety = safety({ readOnly: false, writesGrowthStrategyOnly: true });
      const audit = await logGrowthAuditEvent(env, {
        eventType: "growth_strategy_saved",
        entityType: "growth_goal",
        entityId: saved.id,
        actor: "admin",
        automationMode: saved.automation_mode,
        reason: "Confirmed Growth strategy metadata save. No execution, AI, email, posting or form submission performed.",
        inputSnapshot: auditInput(body.goal || body, parsed.requestBodySha256),
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
      const parsed = await readConfirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const body = parsed.body;
      const saved = await upsertGrowthChannel(env, body.channel || body, body.id || body.channel?.id);
      const routeSafety = safety({ readOnly: false, writesGrowthStrategyOnly: true });
      const audit = await logGrowthAuditEvent(env, {
        eventType: "growth_channel_saved",
        entityType: "growth_channel",
        entityId: saved.id,
        actor: "admin",
        automationMode: saved.automation_mode,
        reason: "Confirmed Growth channel metadata save. No outreach, posting, form submission, AI generation or external execution performed.",
        inputSnapshot: auditInput(body.channel || body, parsed.requestBodySha256),
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
      const parsed = await readConfirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const body = parsed.body;
      const saved = await upsertGrowthSignal(env, body.signal || body, body.id || body.signal?.id);
      const routeSafety = safety({ readOnly: false, writesGrowthQueueOnly: true });
      const audit = await logGrowthAuditEvent(env, {
        eventType: "growth_signal_saved",
        entityType: "growth_signal",
        entityId: saved.id,
        actor: "admin",
        automationMode: "observe",
        reason: "Confirmed Growth signal metadata save. No draft generation, outreach, posting, form submission, AI call or external execution performed.",
        inputSnapshot: auditInput(body.signal || body, parsed.requestBodySha256),
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
      const parsed = await readConfirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const body = parsed.body;
      const saved = await upsertGrowthAction(env, body.action || body, body.id || body.action?.id);
      const routeSafety = safety({ readOnly: false, writesGrowthQueueOnly: true });
      const audit = await logGrowthAuditEvent(env, {
        eventType: "growth_action_saved",
        entityType: "growth_action",
        entityId: saved.id,
        actor: "admin",
        automationMode: saved.recommended_mode,
        reason: "Confirmed Growth action metadata save. The action is queued only; no draft generation, outreach, posting, form submission, AI call, approval or external execution performed.",
        inputSnapshot: auditInput(body.action || body, parsed.requestBodySha256),
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

    if (request.method === "POST" && pathname === "/admin/growth/actions/plan") {
      const parsed = await readConfirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const body = parsed.body;
      const saved = await planGrowthActionFromSignal(env, String(body.signalId || body.id || ""));
      const routeSafety = safety({ readOnly: false, writesGrowthQueueOnly: true });
      const audit = await logGrowthAuditEvent(env, {
        eventType: "growth_action_planned",
        entityType: "growth_action",
        entityId: saved.id,
        actor: "system",
        automationMode: saved.recommended_mode,
        reason: "Deterministic Growth queue plan from a saved signal. Queue metadata only.",
        inputSnapshot: auditInput({ signalId: body.signalId || body.id || null }, parsed.requestBodySha256),
        outputSnapshot: { action: saved },
        safetyResult: routeSafety,
        budgetResult: { aiCalls: 0, networkFetches: 0, publicActions: 0, contactActions: 0 },
      });
      return json({
        ok: true,
        mode: "growth_action_planned",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        action: saved,
        audit,
        safety: routeSafety,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/signals/status") {
      const parsed = await readConfirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const body = parsed.body;
      const routeSafety = safety({ readOnly: false, writesGrowthQueueOnly: true });
      const updated = await updateGrowthSignalStatus(
        env,
        String(body.id || body.signalId || ""),
        String(body.status || "reviewed"),
      );
      return json({
        ok: true,
        mode: "growth_signal_status_updated",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        signal: updated,
        safety: routeSafety,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/actions/status") {
      const parsed = await readConfirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const body = parsed.body;
      const routeSafety = safety({ readOnly: false, writesGrowthQueueOnly: true });
      const updated = await updateGrowthActionStatus(
        env,
        String(body.id || body.actionId || ""),
        String(body.status || "reviewed"),
        routeSafety,
      );
      return json({
        ok: true,
        mode: "growth_action_status_updated",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        action: updated,
        safety: routeSafety,
      });
    }

    return json({ ok: false, error: "not_found", path: pathname }, { status: 404 });
  } catch (error) {
    return json(migrationError(error), { status: 500 });
  }
}
