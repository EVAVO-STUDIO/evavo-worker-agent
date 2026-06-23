import { Env, getSetting, getUsageCounter, bumpUsageCounter, logEvent, nowISO, todayUTC, uuid } from "../db";
import { getNumericSetting, getSettingWithDefault, SettingKey } from "./settings";

export type BudgetedAction =
  | "source_page_fetch"
  | "profile_page_fetch"
  | "business_site_scan"
  | "contact_page_scan"
  | "ai_call"
  | "draft_create"
  | "email_send"
  | "deep_diagnostic"
  | "source_replenish"
  | "bulk_backfill";

export type BudgetDecisionCode =
  | "allowed"
  | "blocked_budget"
  | "blocked_free_safe"
  | "blocked_ai_disabled"
  | "blocked_sending_disabled"
  | "blocked_requires_confirm";

export interface BudgetDecisionResult {
  allowed: boolean;
  decision: BudgetDecisionCode;
  action: BudgetedAction;
  reason: string;
  used: number;
  limit: number;
  remaining: number;
}

const ACTION_COUNTERS: Record<BudgetedAction, string> = {
  source_page_fetch: "source_pages_scanned",
  profile_page_fetch: "profile_pages_scanned",
  business_site_scan: "business_sites_scanned",
  contact_page_scan: "contact_pages_scanned",
  ai_call: "ai_calls",
  draft_create: "drafts_created",
  email_send: "emails_sent",
  deep_diagnostic: "deep_diagnostics",
  source_replenish: "source_replenishments",
  bulk_backfill: "bulk_backfills",
};

const ACTION_LIMITS: Record<BudgetedAction, SettingKey> = {
  source_page_fetch: "daily_source_page_limit",
  profile_page_fetch: "daily_profile_page_limit",
  business_site_scan: "daily_business_site_scan_limit",
  contact_page_scan: "daily_contact_page_scan_limit",
  ai_call: "daily_ai_call_limit",
  draft_create: "daily_draft_limit",
  email_send: "daily_send_limit",
  deep_diagnostic: "daily_deep_diagnostic_limit",
  source_replenish: "daily_source_replenish_limit",
  bulk_backfill: "daily_bulk_backfill_limit",
};

async function recordBudgetDecision(
  env: Env,
  action: BudgetedAction,
  decision: BudgetDecisionCode,
  reason: string,
  usage: Record<string, unknown>
): Promise<void> {
  try {
    await env.DB.prepare(
      `INSERT INTO budget_decisions (id, day, action, decision, reason, usage_json, created_at_iso)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(uuid(), todayUTC(), action, decision, reason, JSON.stringify(usage), nowISO()).run();
  } catch {
    // Migration may not be applied yet. Budget checks should still fail safe without crashing health routes.
  }
}

async function block(
  env: Env,
  action: BudgetedAction,
  decision: BudgetDecisionCode,
  reason: string,
  used: number,
  limit: number,
  units: number,
  mode: string
): Promise<BudgetDecisionResult> {
  await recordBudgetDecision(env, action, decision, reason, { used, limit, units, mode });
  await logEvent(env, "budget_skip", reason).catch(() => undefined);
  return { allowed: false, decision, action, reason, used, limit, remaining: Math.max(0, limit - used) };
}

export async function checkBudget(
  env: Env,
  action: BudgetedAction,
  units = 1,
  opts: { confirm?: boolean } = {}
): Promise<BudgetDecisionResult> {
  const mode = await getSettingWithDefault(env, "cost_mode");
  const counterKey = ACTION_COUNTERS[action];
  const limitKey = ACTION_LIMITS[action];
  const used = await getUsageCounter(env, counterKey);
  const limit = await getNumericSetting(env, limitKey);

  if (action === "ai_call" && (await getSetting(env, "ai_enabled")) !== "1") {
    return block(env, action, "blocked_ai_disabled", "AI calls are disabled in FREE_SAFE mode.", used, limit, units, mode);
  }

  if (action === "email_send" && (await getSetting(env, "sending_enabled")) !== "1") {
    return block(env, action, "blocked_sending_disabled", "Sending is disabled.", used, limit, units, mode);
  }

  if (mode === "free_safe" && action === "deep_diagnostic" && !opts.confirm) {
    return block(env, action, "blocked_requires_confirm", "Deep diagnostics require confirm=1 in FREE_SAFE mode.", used, limit, units, mode);
  }

  if (used + units > limit) {
    return block(env, action, "blocked_budget", `Budget blocked ${action}: ${used}/${limit} used, requested ${units}.`, used, limit, units, mode);
  }

  await recordBudgetDecision(env, action, "allowed", `Budget allowed ${action}.`, { used, limit, units, mode });
  return { allowed: true, decision: "allowed", action, reason: "allowed", used, limit, remaining: Math.max(0, limit - used - units) };
}

export async function consumeBudget(env: Env, action: BudgetedAction, units = 1): Promise<number> {
  return bumpUsageCounter(env, ACTION_COUNTERS[action], units);
}

export async function getBudgetSnapshot(env: Env): Promise<Record<string, { used: number; limit: number; remaining: number }>> {
  const actions: BudgetedAction[] = ["source_page_fetch", "profile_page_fetch", "business_site_scan", "contact_page_scan", "ai_call", "draft_create", "email_send"];
  const out: Record<string, { used: number; limit: number; remaining: number }> = {};
  for (const action of actions) {
    const used = await getUsageCounter(env, ACTION_COUNTERS[action]);
    const limit = await getNumericSetting(env, ACTION_LIMITS[action]);
    out[action] = { used, limit, remaining: Math.max(0, limit - used) };
  }
  return out;
}
