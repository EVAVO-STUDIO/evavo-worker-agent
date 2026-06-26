import { Env, nowISO, todayUTC, uuid, safeJsonParse } from "../db";

export type GrowthAutomationMode = "observe" | "draft" | "assist" | "approved_autopilot" | "owned_channel_autopilot" | "blocked";
export type GrowthChannelClass = "owned" | "provider_expected" | "direct" | "community" | "procurement" | "blocked";
export type GrowthBudgetProfileId = "free_safe" | "research_budgeted" | "growth_budgeted";

export interface GrowthGoalRow {
  id: string;
  title: string;
  description: string | null;
  service_focus: string;
  audience_focus: string;
  region_focus: string;
  campaign_name: string | null;
  priority: number;
  status: string;
  budget_profile_id: string;
  automation_mode: string;
  active_from: string | null;
  active_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrowthChannelRow {
  id: string;
  platform: string;
  channel_type: string;
  channel_class: string;
  name: string;
  url: string | null;
  rules_url: string | null;
  automation_mode: string;
  link_policy: string;
  disclosure_policy: string;
  execution_policy: string;
  max_actions_per_day: number;
  max_actions_per_week: number;
  status: string;
  cooldown_until: string | null;
  last_action_at: string | null;
  positive_outcome_count: number;
  negative_outcome_count: number;
  removal_count: number;
  notes: string | null;
  rule_evidence: string;
  created_at: string;
  updated_at: string;
}

export interface GrowthBudgetLedgerRow {
  id: string;
  budget_date: string;
  profile_id: string;
  worker_invocations: number;
  cpu_ms_estimate: number;
  d1_rows_read: number;
  d1_rows_written: number;
  network_fetches: number;
  ai_calls: number;
  draft_generations: number;
  public_actions_executed: number;
  contact_actions_executed: number;
  retries: number;
  errors: number;
  estimated_cost_cents: number;
  hard_stop_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface GrowthBudgetProfile {
  id: GrowthBudgetProfileId;
  maxNetworkFetchesPerDay: number;
  maxAiDraftsPerDay: number;
  maxD1WritesPerDay: number;
  maxPublicActionsPerDay: number;
  maxContactActionsPerDay: number;
}

export interface GrowthGoalInput {
  title: string;
  description?: string | null;
  serviceFocus?: string[];
  audienceFocus?: string[];
  regionFocus?: string[];
  campaignName?: string | null;
  priority?: number;
  status?: string;
  budgetProfileId?: GrowthBudgetProfileId;
  automationMode?: GrowthAutomationMode;
  activeFrom?: string | null;
  activeUntil?: string | null;
}

export interface GrowthChannelInput {
  platform: string;
  channelType: string;
  channelClass: GrowthChannelClass;
  name: string;
  url?: string | null;
  rulesUrl?: string | null;
  automationMode?: GrowthAutomationMode;
  linkPolicy?: string;
  disclosurePolicy?: string;
  executionPolicy?: string;
  maxActionsPerDay?: number;
  maxActionsPerWeek?: number;
  status?: string;
  notes?: string | null;
  ruleEvidence?: unknown[];
}

const BUDGET_PROFILES: Record<GrowthBudgetProfileId, GrowthBudgetProfile> = {
  free_safe: {
    id: "free_safe",
    maxNetworkFetchesPerDay: 20,
    maxAiDraftsPerDay: 0,
    maxD1WritesPerDay: 2000,
    maxPublicActionsPerDay: 0,
    maxContactActionsPerDay: 0,
  },
  research_budgeted: {
    id: "research_budgeted",
    maxNetworkFetchesPerDay: 100,
    maxAiDraftsPerDay: 5,
    maxD1WritesPerDay: 5000,
    maxPublicActionsPerDay: 0,
    maxContactActionsPerDay: 0,
  },
  growth_budgeted: {
    id: "growth_budgeted",
    maxNetworkFetchesPerDay: 250,
    maxAiDraftsPerDay: 20,
    maxD1WritesPerDay: 10000,
    maxPublicActionsPerDay: 3,
    maxContactActionsPerDay: 5,
  },
};

function clampInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? []);
}

export function parseGrowthJsonArray(value: string | null | undefined): unknown[] {
  const parsed = safeJsonParse<unknown[]>(value || "[]");
  return Array.isArray(parsed) ? parsed : [];
}

export function getGrowthBudgetProfile(profileId: string | null | undefined): GrowthBudgetProfile {
  if (profileId === "research_budgeted" || profileId === "growth_budgeted" || profileId === "free_safe") {
    return BUDGET_PROFILES[profileId];
  }
  return BUDGET_PROFILES.free_safe;
}

export async function listGrowthGoals(env: Env, limit = 25): Promise<GrowthGoalRow[]> {
  const safeLimit = Math.min(100, Math.max(1, limit));
  const { results } = (await env.DB.prepare(
    `SELECT id, title, description, service_focus, audience_focus, region_focus, campaign_name,
            priority, status, budget_profile_id, automation_mode, active_from, active_until,
            created_at, updated_at
     FROM growth_goals
     ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, priority DESC, updated_at DESC
     LIMIT ?`
  ).bind(safeLimit).all()) as { results: GrowthGoalRow[] };
  return results || [];
}

export async function upsertGrowthGoal(env: Env, input: GrowthGoalInput, id = uuid()): Promise<GrowthGoalRow> {
  const now = nowISO();
  const priority = clampInt(input.priority, 50, 0, 100);
  const budgetProfile = getGrowthBudgetProfile(input.budgetProfileId).id;
  const automationMode = input.automationMode || "observe";
  await env.DB.prepare(
    `INSERT INTO growth_goals (
       id, title, description, service_focus, audience_focus, region_focus, campaign_name,
       priority, status, budget_profile_id, automation_mode, active_from, active_until,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       service_focus = excluded.service_focus,
       audience_focus = excluded.audience_focus,
       region_focus = excluded.region_focus,
       campaign_name = excluded.campaign_name,
       priority = excluded.priority,
       status = excluded.status,
       budget_profile_id = excluded.budget_profile_id,
       automation_mode = excluded.automation_mode,
       active_from = excluded.active_from,
       active_until = excluded.active_until,
       updated_at = excluded.updated_at`
  ).bind(
    id,
    input.title.trim(),
    input.description ?? null,
    toJson(input.serviceFocus || []),
    toJson(input.audienceFocus || []),
    toJson(input.regionFocus || []),
    input.campaignName ?? null,
    priority,
    input.status || "active",
    budgetProfile,
    automationMode,
    input.activeFrom ?? null,
    input.activeUntil ?? null,
    now,
    now
  ).run();

  const row = await env.DB.prepare(
    `SELECT id, title, description, service_focus, audience_focus, region_focus, campaign_name,
            priority, status, budget_profile_id, automation_mode, active_from, active_until,
            created_at, updated_at
     FROM growth_goals WHERE id = ? LIMIT 1`
  ).bind(id).first<GrowthGoalRow>();

  if (!row) throw new Error("growth_goal_upsert_failed");
  return row;
}

export async function listGrowthChannels(env: Env, limit = 50): Promise<GrowthChannelRow[]> {
  const safeLimit = Math.min(200, Math.max(1, limit));
  const { results } = (await env.DB.prepare(
    `SELECT id, platform, channel_type, channel_class, name, url, rules_url, automation_mode,
            link_policy, disclosure_policy, execution_policy, max_actions_per_day, max_actions_per_week,
            status, cooldown_until, last_action_at, positive_outcome_count, negative_outcome_count,
            removal_count, notes, rule_evidence, created_at, updated_at
     FROM growth_channels
     ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, updated_at DESC
     LIMIT ?`
  ).bind(safeLimit).all()) as { results: GrowthChannelRow[] };
  return results || [];
}

export async function upsertGrowthChannel(env: Env, input: GrowthChannelInput, id = uuid()): Promise<GrowthChannelRow> {
  const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO growth_channels (
       id, platform, channel_type, channel_class, name, url, rules_url, automation_mode,
       link_policy, disclosure_policy, execution_policy, max_actions_per_day, max_actions_per_week,
       status, notes, rule_evidence, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       platform = excluded.platform,
       channel_type = excluded.channel_type,
       channel_class = excluded.channel_class,
       name = excluded.name,
       url = excluded.url,
       rules_url = excluded.rules_url,
       automation_mode = excluded.automation_mode,
       link_policy = excluded.link_policy,
       disclosure_policy = excluded.disclosure_policy,
       execution_policy = excluded.execution_policy,
       max_actions_per_day = excluded.max_actions_per_day,
       max_actions_per_week = excluded.max_actions_per_week,
       status = excluded.status,
       notes = excluded.notes,
       rule_evidence = excluded.rule_evidence,
       updated_at = excluded.updated_at`
  ).bind(
    id,
    input.platform.trim(),
    input.channelType.trim(),
    input.channelClass,
    input.name.trim(),
    input.url ?? null,
    input.rulesUrl ?? null,
    input.automationMode || "observe",
    input.linkPolicy || "approval_required",
    input.disclosurePolicy || "required_when_promotional",
    input.executionPolicy || "confirm_required",
    clampInt(input.maxActionsPerDay, 0, 0, 100),
    clampInt(input.maxActionsPerWeek, 0, 0, 500),
    input.status || "active",
    input.notes ?? null,
    toJson(input.ruleEvidence || []),
    now,
    now
  ).run();

  const row = await env.DB.prepare(
    `SELECT id, platform, channel_type, channel_class, name, url, rules_url, automation_mode,
            link_policy, disclosure_policy, execution_policy, max_actions_per_day, max_actions_per_week,
            status, cooldown_until, last_action_at, positive_outcome_count, negative_outcome_count,
            removal_count, notes, rule_evidence, created_at, updated_at
     FROM growth_channels WHERE id = ? LIMIT 1`
  ).bind(id).first<GrowthChannelRow>();

  if (!row) throw new Error("growth_channel_upsert_failed");
  return row;
}

export async function getOrCreateGrowthBudgetLedger(env: Env, profileId: string, day = todayUTC()): Promise<GrowthBudgetLedgerRow> {
  const profile = getGrowthBudgetProfile(profileId).id;
  const existing = await env.DB.prepare(
    `SELECT id, budget_date, profile_id, worker_invocations, cpu_ms_estimate, d1_rows_read,
            d1_rows_written, network_fetches, ai_calls, draft_generations, public_actions_executed,
            contact_actions_executed, retries, errors, estimated_cost_cents, hard_stop_reason,
            created_at, updated_at
     FROM growth_budget_ledger
     WHERE budget_date = ? AND profile_id = ?
     LIMIT 1`
  ).bind(day, profile).first<GrowthBudgetLedgerRow>();

  if (existing) return existing;

  const now = nowISO();
  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO growth_budget_ledger (id, budget_date, profile_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, day, profile, now, now).run();

  const created = await env.DB.prepare(
    `SELECT id, budget_date, profile_id, worker_invocations, cpu_ms_estimate, d1_rows_read,
            d1_rows_written, network_fetches, ai_calls, draft_generations, public_actions_executed,
            contact_actions_executed, retries, errors, estimated_cost_cents, hard_stop_reason,
            created_at, updated_at
     FROM growth_budget_ledger
     WHERE id = ? LIMIT 1`
  ).bind(id).first<GrowthBudgetLedgerRow>();

  if (!created) throw new Error("growth_budget_ledger_create_failed");
  return created;
}

export function assessGrowthBudget(ledger: GrowthBudgetLedgerRow, profileId: string): {
  ok: boolean;
  profile: GrowthBudgetProfile;
  softStop: boolean;
  hardStopReason: string | null;
  usage: Record<string, number>;
} {
  const profile = getGrowthBudgetProfile(profileId);
  const hardStopReason = ledger.hard_stop_reason;
  const usage = {
    networkFetches: ledger.network_fetches,
    aiDrafts: ledger.ai_calls,
    d1Writes: ledger.d1_rows_written,
    publicActions: ledger.public_actions_executed,
    contactActions: ledger.contact_actions_executed,
  };
  const overHardCap = Boolean(hardStopReason)
    || usage.networkFetches >= profile.maxNetworkFetchesPerDay
    || usage.aiDrafts >= profile.maxAiDraftsPerDay
    || usage.d1Writes >= profile.maxD1WritesPerDay
    || usage.publicActions >= profile.maxPublicActionsPerDay
    || usage.contactActions >= profile.maxContactActionsPerDay;
  const softStop = usage.networkFetches >= Math.floor(profile.maxNetworkFetchesPerDay * 0.8)
    || usage.aiDrafts >= Math.floor(profile.maxAiDraftsPerDay * 0.8)
    || usage.d1Writes >= Math.floor(profile.maxD1WritesPerDay * 0.8)
    || usage.publicActions >= Math.floor(profile.maxPublicActionsPerDay * 0.8)
    || usage.contactActions >= Math.floor(profile.maxContactActionsPerDay * 0.8);

  return {
    ok: !overHardCap,
    profile,
    softStop,
    hardStopReason,
    usage,
  };
}

export async function getGrowthOverview(env: Env): Promise<{
  goals: GrowthGoalRow[];
  channels: GrowthChannelRow[];
  budget: GrowthBudgetLedgerRow;
  budgetAssessment: ReturnType<typeof assessGrowthBudget>;
  counts: Record<string, number>;
}> {
  const goals = await listGrowthGoals(env, 25);
  const channels = await listGrowthChannels(env, 50);
  const preferredProfile = goals.find((goal) => goal.status === "active")?.budget_profile_id || "free_safe";
  const budget = await getOrCreateGrowthBudgetLedger(env, preferredProfile);
  const budgetAssessment = assessGrowthBudget(budget, preferredProfile);

  const countsRow = await env.DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM growth_goals) AS goals,
       (SELECT COUNT(*) FROM growth_channels) AS channels,
       (SELECT COUNT(*) FROM growth_signals) AS signals,
       (SELECT COUNT(*) FROM growth_actions) AS actions,
       (SELECT COUNT(*) FROM growth_drafts) AS drafts,
       (SELECT COUNT(*) FROM growth_outcomes) AS outcomes`
  ).first<Record<string, number>>();

  return {
    goals,
    channels,
    budget,
    budgetAssessment,
    counts: countsRow || {},
  };
}
