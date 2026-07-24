import type { Env } from "../db";

export const MANUAL_RESEARCH_LEASE_CONTRACT = "manual_research_lease_v1";

export type ManualResearchLease = {
  contract: typeof MANUAL_RESEARCH_LEASE_CONTRACT;
  actionKey: string;
  token: string;
  storedValue: string;
  acquiredAtISO: string;
  expiresAtISO: string;
};

const LEASE_PREFIX = "manual-research-lease:";

function boundedTtlSeconds(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 600;
  return Math.max(30, Math.min(1800, Math.round(parsed)));
}

function normalizedActionKey(raw: string): string {
  const normalized = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 160);
  return normalized || "unknown-action";
}

export async function acquireManualResearchLease(env: Env, actionKey: string, ttlSeconds = 600): Promise<ManualResearchLease | null> {
  const normalizedKey = normalizedActionKey(actionKey);
  const acquiredAtMs = Date.now();
  const ttl = boundedTtlSeconds(ttlSeconds);
  const expiresAtMs = acquiredAtMs + ttl * 1000;
  const token = crypto.randomUUID();
  const storedValue = `${expiresAtMs}:${token}`;
  const settingKey = `${LEASE_PREFIX}${normalizedKey}`;

  const result = await env.DB.prepare(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value
     WHERE
       CASE
         WHEN instr(settings.value, ':') > 1
           THEN CAST(substr(settings.value, 1, instr(settings.value, ':') - 1) AS INTEGER)
         ELSE 0
       END <= ?`
  ).bind(settingKey, storedValue, acquiredAtMs).run();

  if (Number(result.meta?.changes || 0) !== 1) return null;

  return {
    contract: MANUAL_RESEARCH_LEASE_CONTRACT,
    actionKey: normalizedKey,
    token,
    storedValue,
    acquiredAtISO: new Date(acquiredAtMs).toISOString(),
    expiresAtISO: new Date(expiresAtMs).toISOString(),
  };
}

export async function releaseManualResearchLease(env: Env, lease: ManualResearchLease | null): Promise<boolean> {
  if (!lease) return false;
  const settingKey = `${LEASE_PREFIX}${normalizedActionKey(lease.actionKey)}`;
  const result = await env.DB.prepare(
    "DELETE FROM settings WHERE key = ? AND value = ?"
  ).bind(settingKey, lease.storedValue).run();
  return Number(result.meta?.changes || 0) === 1;
}

export function manualResearchLeaseConflict(action: string) {
  return {
    ok: false,
    error: "research_action_in_progress",
    action: normalizedActionKey(action),
    retryable: true,
    automaticRetryAllowed: false,
    scheduledFallbackAllowed: false,
    externalExecutionAllowed: false,
    contract: MANUAL_RESEARCH_LEASE_CONTRACT,
  };
}
