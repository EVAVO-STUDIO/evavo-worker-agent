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
  type GrowthChannelInput,
  type GrowthGoalInput,
} from "../core/growthAutonomy";
import {
  listGrowthAuditEventSummaries,
  logGrowthAuditEvent,
  toGrowthAuditEventSummary,
} from "../core/growthAudit";
import { planGrowthActionFromSignal } from "../core/growthActionPlanner";
import { upsertGrowthAction, type GrowthActionInput } from "../core/growthActions";
import { getGrowthBrief } from "../core/growthBrief";
import { listGrowthActions, listGrowthSignals } from "../core/growthEngagementReadModels";
import {
  growthInternalWriteFailurePayload,
  readGrowthInternalWriteRequest,
} from "../core/growthInternalWriteRequest";
import { updateGrowthActionStatus, updateGrowthSignalStatus } from "../core/growthQueueReview";
import { upsertGrowthSignal, type GrowthSignalInput } from "../core/growthSignals";
import { handleGrowthAutonomousDiscoveryAdmin } from "./growthAutonomousDiscoveryAdmin";
import { handleGrowthBlackboardAdmin } from "./growthBlackboardAdmin";
import { handleGrowthCapabilitiesAdmin } from "./growthCapabilitiesAdmin";
import { handleGrowthCampaignIntelligenceAdmin } from "./growthCampaignIntelligenceAdmin";
import { handleGrowthStrategyMemoryAdmin } from "./growthStrategyMemoryAdmin";

type JsonResponse = (data: any, init?: ResponseInit) => Response;
type UnknownRecord = Record<string, unknown>;
type SafetyOverrides = Partial<ReturnType<typeof safetyBase>>;

const CAMPAIGN_INTELLIGENCE_PREFIXES = [
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
const STRATEGY_MEMORY_PREFIXES = [
  "/admin/growth/strategy-memory",
  "/admin/growth/objectives",
  "/admin/growth/key-results",
  "/admin/growth/segments",
  "/admin/growth/offers",
  "/admin/growth/positioning",
  "/admin/growth/runtime-constraints",
];
const BLACKBOARD_PREFIXES = ["/admin/growth/blackboard"];
const AUTONOMOUS_DISCOVERY_PREFIXES = ["/admin/growth/discovery"];

const AUTOMATION_MODES = new Set(growthAutomationModes);
const BUDGET_PROFILES = new Set(["free_safe", "research_budgeted", "growth_budgeted"]);
const CHANNEL_CLASSES = new Set(["owned", "provider_expected", "direct", "community", "procurement", "blocked"]);
const SIGNAL_STATUSES = new Set(["new", "triaged", "watch", "ignored", "duplicate", "converted_to_action", "blocked"]);
const ACTION_STATUSES = new Set(["queued", "needs_review", "approved", "rejected", "blocked", "archived"]);

const GOAL_INPUT_KEYS = new Set([
  "id",
  "title",
  "description",
  "serviceFocus",
  "audienceFocus",
  "regionFocus",
  "campaignName",
  "priority",
  "status",
  "budgetProfileId",
  "automationMode",
  "activeFrom",
  "activeUntil",
]);
const GOAL_BODY_KEYS = new Set(["goal", "id"]);
const CHANNEL_INPUT_KEYS = new Set([
  "id",
  "platform",
  "channelType",
  "channelClass",
  "name",
  "url",
  "rulesUrl",
  "automationMode",
  "linkPolicy",
  "disclosurePolicy",
  "executionPolicy",
  "maxActionsPerDay",
  "maxActionsPerWeek",
  "status",
  "notes",
  "ruleEvidence",
]);
const CHANNEL_BODY_KEYS = new Set(["channel", "id"]);
const SIGNAL_INPUT_KEYS = new Set([
  "id",
  "goalId",
  "channelId",
  "sourceUrl",
  "sourceTitle",
  "signalType",
  "serviceMatch",
  "audienceMatch",
  "evidence",
  "urgency",
  "fitScore",
  "riskScore",
  "costScore",
  "status",
  "duplicateKey",
  "discoveredAt",
]);
const SIGNAL_BODY_KEYS = new Set(["signal", "id"]);
const ACTION_INPUT_KEYS = new Set([
  "id",
  "signalId",
  "channelId",
  "actionType",
  "recommendedMode",
  "reason",
  "contextEvidence",
  "evavoFitExplanation",
  "channelPolicyResult",
  "linkPolicyResult",
  "disclosurePolicyResult",
  "costEstimate",
  "riskFlags",
  "status",
  "blockedReason",
]);
const ACTION_BODY_KEYS = new Set(["action", "id"]);
const ACTION_PLAN_KEYS = new Set(["signalId", "id"]);
const SIGNAL_STATUS_KEYS = new Set(["id", "signalId", "status"]);
const ACTION_STATUS_KEYS = new Set(["id", "actionId", "status", "blockedReason"]);

function pathMatches(pathname: string, prefixes: readonly string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function intParam(url: URL, key: string, fallback: number, min: number, max: number): number {
  const raw = url.searchParams.get(key);
  if (raw === null || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) throw new Error("GROWTH_FALLBACK_QUERY_INVALID");
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error("GROWTH_FALLBACK_QUERY_INVALID");
  return Math.max(min, Math.min(max, value));
}

function optionalQueryText(url: URL, key: string, maximum: number): string | undefined {
  const raw = url.searchParams.get(key);
  if (raw === null || raw === "") return undefined;
  if (raw.trim() !== raw || raw.length > maximum || /\p{Cc}/u.test(raw)) {
    throw new Error("GROWTH_FALLBACK_QUERY_INVALID");
  }
  return raw;
}

function budgetProfile(url: URL, key: string): string {
  const value = optionalQueryText(url, key, 64) ?? "free_safe";
  if (!BUDGET_PROFILES.has(value)) throw new Error("GROWTH_FALLBACK_QUERY_INVALID");
  return value;
}

function budgetDate(url: URL): string {
  const value = optionalQueryText(url, "date", 10) ?? todayUTC();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`))) {
    throw new Error("GROWTH_FALLBACK_QUERY_INVALID");
  }
  return value;
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
    queryConfirmationAllowed: false,
    sensitiveInputKeysAllowed: false,
    rawErrorsExposed: false,
    auditSnapshotsExposed: false,
  };
}

function safety(overrides: SafetyOverrides = {}) {
  return Object.freeze({ ...safetyBase(), ...overrides });
}

function recordValue(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as UnknownRecord;
}

function exactKeys(record: UnknownRecord, allowed: ReadonlySet<string>, code: string): void {
  if (Object.keys(record).some((key) => !allowed.has(key))) throw new Error(code);
}

function boundedRequiredText(value: unknown, code: string, maximum = 160): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !value ||
    value.length > maximum ||
    /\p{Cc}/u.test(value)
  ) throw new Error(code);
  return value;
}

function boundedOptionalText(value: unknown, code: string, maximum: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return boundedRequiredText(value, code, maximum);
}

function optionalIdentifier(value: unknown, code: string): string | undefined {
  const text = boundedOptionalText(value, code, 160);
  if (text && text.includes("..")) throw new Error(code);
  return text;
}

function requiredIdentifierAliases(
  primary: unknown,
  secondary: unknown,
  code: string,
): string {
  const first = optionalIdentifier(primary, code);
  const second = optionalIdentifier(secondary, code);
  if (first && second && first !== second) throw new Error(`${code}_CONFLICT`);
  return boundedRequiredText(first ?? second, code, 160);
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

function validateGoal(input: UnknownRecord): void {
  boundedRequiredText(input.title, "GROWTH_FALLBACK_GOAL_TITLE_INVALID", 240);
  if (input.budgetProfileId !== undefined && !BUDGET_PROFILES.has(String(input.budgetProfileId))) {
    throw new Error("GROWTH_FALLBACK_GOAL_BUDGET_PROFILE_INVALID");
  }
  if (input.automationMode !== undefined && !AUTOMATION_MODES.has(input.automationMode as any)) {
    throw new Error("GROWTH_FALLBACK_GOAL_AUTOMATION_MODE_INVALID");
  }
}

function validateChannel(input: UnknownRecord): void {
  boundedRequiredText(input.platform, "GROWTH_FALLBACK_CHANNEL_PLATFORM_INVALID", 120);
  boundedRequiredText(input.channelType, "GROWTH_FALLBACK_CHANNEL_TYPE_INVALID", 120);
  boundedRequiredText(input.name, "GROWTH_FALLBACK_CHANNEL_NAME_INVALID", 240);
  const channelClass = boundedRequiredText(input.channelClass, "GROWTH_FALLBACK_CHANNEL_CLASS_INVALID", 80);
  if (!CHANNEL_CLASSES.has(channelClass)) throw new Error("GROWTH_FALLBACK_CHANNEL_CLASS_INVALID");
  if (input.automationMode !== undefined && !AUTOMATION_MODES.has(input.automationMode as any)) {
    throw new Error("GROWTH_FALLBACK_CHANNEL_AUTOMATION_MODE_INVALID");
  }
}

function validateSignal(input: UnknownRecord): void {
  boundedRequiredText(input.sourceUrl, "GROWTH_FALLBACK_SIGNAL_SOURCE_URL_INVALID", 2_048);
  boundedRequiredText(input.signalType, "GROWTH_FALLBACK_SIGNAL_TYPE_INVALID", 120);
  boundedRequiredText(input.evidence, "GROWTH_FALLBACK_SIGNAL_EVIDENCE_INVALID", 4_000);
  if (input.status !== undefined && !SIGNAL_STATUSES.has(String(input.status))) {
    throw new Error("GROWTH_FALLBACK_SIGNAL_STATUS_INVALID");
  }
}

function validateAction(input: UnknownRecord): void {
  boundedRequiredText(input.actionType, "GROWTH_FALLBACK_ACTION_TYPE_INVALID", 120);
  boundedRequiredText(input.reason, "GROWTH_FALLBACK_ACTION_REASON_INVALID", 2_000);
  if (input.status !== undefined && !ACTION_STATUSES.has(String(input.status))) {
    throw new Error("GROWTH_FALLBACK_ACTION_STATUS_INVALID");
  }
  if (input.recommendedMode !== undefined && !AUTOMATION_MODES.has(input.recommendedMode as any)) {
    throw new Error("GROWTH_FALLBACK_ACTION_MODE_INVALID");
  }
}

async function confirmedBody(request: Request, json: JsonResponse) {
  const parsed = await readGrowthInternalWriteRequest(request);
  if (parsed.ok) return parsed;
  return {
    ...parsed,
    response: json({
      ...growthInternalWriteFailurePayload(parsed),
      safety: safety({ readOnly: false }),
    }, { status: parsed.status }),
  } as const;
}

function requestReceipt(contractVersion: string) {
  return Object.freeze({
    contractVersion,
    bodySha256Available: true,
    exactBooleanConfirmation: true,
  });
}

function auditInput(payload: unknown, requestBodySha256: string) {
  return Object.freeze({ requestBodySha256, payload });
}

function normalizedFailure(error: unknown): Readonly<{
  status: 400 | 404 | 409 | 503;
  payload: Readonly<Record<string, unknown>>;
}> {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const missingGrowthTable = /no such table: growth_/i.test(message);
  const duplicateSignal = /UNIQUE constraint failed: growth_signals\.duplicate_key/i.test(message);
  const notFound = message.endsWith("_not_found");
  const inputFailure =
    message.startsWith("GROWTH_FALLBACK_") ||
    /growth_(goal|channel|signal|action|queue_review)_(required|invalid|not_allowed|too_short|must_be)/.test(message);
  const status = duplicateSignal ? 409 : notFound ? 404 : inputFailure ? 400 : 503;
  const diagnosticCode = missingGrowthTable
    ? "growth_schema_missing"
    : duplicateSignal
      ? "growth_signal_duplicate"
      : notFound
        ? "growth_record_not_found"
        : inputFailure
          ? "growth_admin_invalid_request"
          : "growth_admin_failed";
  return Object.freeze({
    status,
    payload: Object.freeze({
      ok: false,
      mode: "growth_admin_error",
      error: diagnosticCode,
      diagnosticCode,
      requiredMigration: missingGrowthTable
        ? "latest Growth migration, including 0012_growth_autonomy_core.sql through 0023_growth_activity_budget_ledger.sql"
        : null,
      rawErrorExposed: false,
      auditSnapshotsExposed: false,
      safety: safety({ readOnly: !inputFailure }),
    }),
  });
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
    if (pathMatches(pathname, AUTONOMOUS_DISCOVERY_PREFIXES)) {
      return await handleGrowthAutonomousDiscoveryAdmin(request, env, pathname, json);
    }
    if (pathMatches(pathname, CAMPAIGN_INTELLIGENCE_PREFIXES)) {
      return await handleGrowthCampaignIntelligenceAdmin(request, env, pathname, json);
    }
    if (pathMatches(pathname, STRATEGY_MEMORY_PREFIXES)) {
      return await handleGrowthStrategyMemoryAdmin(request, env, pathname, json);
    }
    if (pathMatches(pathname, BLACKBOARD_PREFIXES)) {
      return await handleGrowthBlackboardAdmin(request, env, pathname, json);
    }

    if (request.method === "POST" && [...url.searchParams.keys()].length !== 0) {
      return json({
        ok: false,
        error: "query_not_supported",
        queryConfirmationAllowed: false,
        safety: safety({ readOnly: false }),
      }, { status: 400 });
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
        const profileId = budgetProfile(url, "profile");
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
        const status = optionalQueryText(url, "status", 48);
        const signals = await listGrowthSignals(env, intParam(url, "limit", 50, 1, 200), status);
        return json({
          ok: true,
          mode: "growth_signals",
          contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
          signals,
          count: signals.length,
          filter: { status: status ?? null },
          safety: safety(),
        });
      }
      if (pathname === "/admin/growth/actions") {
        const status = optionalQueryText(url, "status", 48);
        const actions = await listGrowthActions(env, intParam(url, "limit", 50, 1, 200), status);
        return json({
          ok: true,
          mode: "growth_actions",
          contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
          actions,
          count: actions.length,
          filter: { status: status ?? null },
          safety: safety(),
        });
      }
      if (pathname === "/admin/growth/audit") {
        const entityType = optionalQueryText(url, "entityType", 64);
        const events = await listGrowthAuditEventSummaries(
          env,
          intParam(url, "limit", 50, 1, 200),
          entityType,
        );
        return json({
          ok: true,
          mode: "growth_audit_events",
          contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
          events,
          count: events.length,
          auditSnapshotsExposed: false,
          filter: { entityType: entityType ?? null },
          safety: safety(),
        });
      }
      if (pathname === "/admin/growth/budget") {
        const profileId = budgetProfile(url, "profile");
        const day = budgetDate(url);
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
      const parsed = await confirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "goal",
        GOAL_BODY_KEYS,
        GOAL_INPUT_KEYS,
        "GROWTH_FALLBACK_GOAL",
      );
      validateGoal(input);
      const saved = await upsertGrowthGoal(env, input as unknown as GrowthGoalInput, id);
      const routeSafety = safety({ readOnly: false, writesGrowthStrategyOnly: true });
      const audit = await logGrowthAuditEvent(env, {
        eventType: "growth_strategy_saved",
        entityType: "growth_goal",
        entityId: saved.id,
        actor: "admin",
        automationMode: saved.automation_mode,
        reason: "Confirmed Growth strategy metadata save. No execution, AI, email, posting or form submission performed.",
        inputSnapshot: auditInput({ id: id ?? null, ...input }, parsed.bodySha256),
        outputSnapshot: { goal: saved },
        safetyResult: routeSafety,
      });
      return json({
        ok: true,
        mode: "growth_strategy_saved",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        goal: saved,
        audit: toGrowthAuditEventSummary(audit),
        requestReceipt: requestReceipt(parsed.contractVersion),
        auditSnapshotsExposed: false,
        safety: routeSafety,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/channels") {
      const parsed = await confirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "channel",
        CHANNEL_BODY_KEYS,
        CHANNEL_INPUT_KEYS,
        "GROWTH_FALLBACK_CHANNEL",
      );
      validateChannel(input);
      const saved = await upsertGrowthChannel(env, input as unknown as GrowthChannelInput, id);
      const routeSafety = safety({ readOnly: false, writesGrowthStrategyOnly: true });
      const audit = await logGrowthAuditEvent(env, {
        eventType: "growth_channel_saved",
        entityType: "growth_channel",
        entityId: saved.id,
        actor: "admin",
        automationMode: saved.automation_mode,
        reason: "Confirmed Growth channel metadata save. No outreach, posting, form submission, AI generation or external execution performed.",
        inputSnapshot: auditInput({ id: id ?? null, ...input }, parsed.bodySha256),
        outputSnapshot: { channel: saved },
        safetyResult: routeSafety,
      });
      return json({
        ok: true,
        mode: "growth_channel_saved",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        channel: saved,
        audit: toGrowthAuditEventSummary(audit),
        requestReceipt: requestReceipt(parsed.contractVersion),
        auditSnapshotsExposed: false,
        safety: routeSafety,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/signals") {
      const parsed = await confirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "signal",
        SIGNAL_BODY_KEYS,
        SIGNAL_INPUT_KEYS,
        "GROWTH_FALLBACK_SIGNAL",
      );
      validateSignal(input);
      const saved = await upsertGrowthSignal(env, input as unknown as GrowthSignalInput, id);
      const routeSafety = safety({ readOnly: false, writesGrowthQueueOnly: true });
      const audit = await logGrowthAuditEvent(env, {
        eventType: "growth_signal_saved",
        entityType: "growth_signal",
        entityId: saved.id,
        actor: "admin",
        automationMode: "observe",
        reason: "Confirmed Growth signal metadata save. No draft generation, outreach, posting, form submission, AI call or external execution performed.",
        inputSnapshot: auditInput({ id: id ?? null, ...input }, parsed.bodySha256),
        outputSnapshot: { signal: saved },
        safetyResult: routeSafety,
      });
      return json({
        ok: true,
        mode: "growth_signal_saved",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        signal: saved,
        audit: toGrowthAuditEventSummary(audit),
        requestReceipt: requestReceipt(parsed.contractVersion),
        auditSnapshotsExposed: false,
        safety: routeSafety,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/actions") {
      const parsed = await confirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "action",
        ACTION_BODY_KEYS,
        ACTION_INPUT_KEYS,
        "GROWTH_FALLBACK_ACTION",
      );
      validateAction(input);
      const saved = await upsertGrowthAction(env, input as unknown as GrowthActionInput, id);
      const routeSafety = safety({ readOnly: false, writesGrowthQueueOnly: true });
      const audit = await logGrowthAuditEvent(env, {
        eventType: "growth_action_saved",
        entityType: "growth_action",
        entityId: saved.id,
        actor: "admin",
        automationMode: saved.recommended_mode,
        reason: "Confirmed Growth action metadata save. The action is queued only; no draft generation, outreach, posting, form submission, AI call, approval or external execution performed.",
        inputSnapshot: auditInput({ id: id ?? null, ...input }, parsed.bodySha256),
        outputSnapshot: { action: saved },
        safetyResult: routeSafety,
      });
      return json({
        ok: true,
        mode: "growth_action_saved",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        action: saved,
        audit: toGrowthAuditEventSummary(audit),
        requestReceipt: requestReceipt(parsed.contractVersion),
        auditSnapshotsExposed: false,
        safety: routeSafety,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/actions/plan") {
      const parsed = await confirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      exactKeys(parsed.body, ACTION_PLAN_KEYS, "GROWTH_FALLBACK_ACTION_PLAN_KEYS_INVALID");
      const signalId = requiredIdentifierAliases(
        parsed.body.signalId,
        parsed.body.id,
        "GROWTH_FALLBACK_SIGNAL_ID_INVALID",
      );
      const saved = await planGrowthActionFromSignal(env, signalId);
      const routeSafety = safety({ readOnly: false, writesGrowthQueueOnly: true });
      const audit = await logGrowthAuditEvent(env, {
        eventType: "growth_action_planned",
        entityType: "growth_action",
        entityId: saved.id,
        actor: "system",
        automationMode: saved.recommended_mode,
        reason: "Deterministic Growth queue plan from a saved signal. Queue metadata only.",
        inputSnapshot: auditInput({ signalId }, parsed.bodySha256),
        outputSnapshot: { action: saved },
        safetyResult: routeSafety,
        budgetResult: { aiCalls: 0, networkFetches: 0, publicActions: 0, contactActions: 0 },
      });
      return json({
        ok: true,
        mode: "growth_action_planned",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        action: saved,
        audit: toGrowthAuditEventSummary(audit),
        requestReceipt: requestReceipt(parsed.contractVersion),
        auditSnapshotsExposed: false,
        safety: routeSafety,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/signals/status") {
      const parsed = await confirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      exactKeys(parsed.body, SIGNAL_STATUS_KEYS, "GROWTH_FALLBACK_SIGNAL_STATUS_KEYS_INVALID");
      const id = requiredIdentifierAliases(
        parsed.body.id,
        parsed.body.signalId,
        "GROWTH_FALLBACK_SIGNAL_ID_INVALID",
      );
      const status = boundedRequiredText(
        parsed.body.status,
        "GROWTH_FALLBACK_SIGNAL_STATUS_INVALID",
        64,
      );
      if (!SIGNAL_STATUSES.has(status)) throw new Error("GROWTH_FALLBACK_SIGNAL_STATUS_INVALID");
      const updated = await updateGrowthSignalStatus(env, id, status);
      return json({
        ok: true,
        mode: "growth_signal_status_updated",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        signal: updated,
        requestReceipt: requestReceipt(parsed.contractVersion),
        auditSnapshotsExposed: false,
        safety: safety({ readOnly: false, writesGrowthQueueOnly: true }),
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/actions/status") {
      const parsed = await confirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      exactKeys(parsed.body, ACTION_STATUS_KEYS, "GROWTH_FALLBACK_ACTION_STATUS_KEYS_INVALID");
      const id = requiredIdentifierAliases(
        parsed.body.id,
        parsed.body.actionId,
        "GROWTH_FALLBACK_ACTION_ID_INVALID",
      );
      const status = boundedRequiredText(
        parsed.body.status,
        "GROWTH_FALLBACK_ACTION_STATUS_INVALID",
        64,
      );
      if (!ACTION_STATUSES.has(status)) throw new Error("GROWTH_FALLBACK_ACTION_STATUS_INVALID");
      const blockedReason = boundedOptionalText(
        parsed.body.blockedReason,
        "GROWTH_FALLBACK_ACTION_BLOCKED_REASON_INVALID",
        1_000,
      );
      const updated = await updateGrowthActionStatus(env, id, status, blockedReason);
      return json({
        ok: true,
        mode: "growth_action_status_updated",
        contractVersion: "growth_agent_v1_strategy_channel_voice_cost_governed",
        action: updated,
        requestReceipt: requestReceipt(parsed.contractVersion),
        auditSnapshotsExposed: false,
        safety: safety({ readOnly: false, writesGrowthQueueOnly: true }),
      });
    }

    return json({ ok: false, error: "not_found", path: pathname }, { status: 404 });
  } catch (error) {
    const failure = normalizedFailure(error);
    return json(failure.payload, { status: failure.status });
  }
}
