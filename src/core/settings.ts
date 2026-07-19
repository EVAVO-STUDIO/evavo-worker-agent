import { Env, getSetting } from "../db";

export const FREE_SAFE_DEFAULT_SETTINGS = {
  cost_mode: "free_safe",
  hard_stop_on_budget: "1",
  ai_enabled: "0",
  ai_mode: "off",
  sending_enabled: "0",
  approval_required: "1",
  drafting_enabled: "0",
  daily_external_fetch_limit: "250",
  daily_source_page_limit: "25",
  daily_profile_page_limit: "100",
  daily_business_site_scan_limit: "50",
  daily_contact_page_scan_limit: "50",
  daily_draft_limit: "0",
  daily_ai_call_limit: "0",
  daily_send_limit: "0",
  daily_deep_diagnostic_limit: "0",
  daily_source_replenish_limit: "5",
  daily_bulk_backfill_limit: "0",
  per_tick_source_page_limit: "2",
  per_tick_profile_page_limit: "10",
  per_tick_business_site_limit: "5",
  per_tick_contact_page_limit: "5",
  per_tick_draft_limit: "0",
  per_tick_ai_call_limit: "0",
  source_failure_cooldown_threshold: "3",
  source_failure_retire_threshold: "8",
  source_cooldown_hours: "72",
  draft_backlog_pause_scan_threshold: "50",
  raw_event_retention_days: "30",
} as const;

export type SettingKey = keyof typeof FREE_SAFE_DEFAULT_SETTINGS;
export const ALLOWED_SETTING_KEYS = new Set<string>(Object.keys(FREE_SAFE_DEFAULT_SETTINGS));

export async function getSettingWithDefault(env: Env, key: SettingKey): Promise<string> {
  return (await getSetting(env, key)) ?? FREE_SAFE_DEFAULT_SETTINGS[key];
}

export async function getNumericSetting(env: Env, key: SettingKey): Promise<number> {
  const raw = await getSettingWithDefault(env, key);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}
