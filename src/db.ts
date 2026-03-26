/**
 * Database helper module for the Outbound Agent.
 */
export type LeadStatus =
  | "new"
  | "scanned"
  | "drafted"
  | "approved"
  | "sent"
  | "failed"
  | "rejected"
  | "do_not_contact";

export type DraftStatus = "created" | "approved" | "sent" | "failed" | "rejected";

export interface LeadRow {
  id: string;
  website: string;
  status: LeadStatus;
  created_at_iso: string;
  updated_at_iso: string;
  data?: any;
}

export interface DraftRow {
  id: string;
  lead_id: string;
  status: DraftStatus;
  created_at_iso: string;
  updated_at_iso: string;
  subject: string;
  body: string;
}

export interface Env {
  DB: D1Database;
  KV?: any;
  MAILCHANNELS_API_KEY?: string;
  FROM_EMAIL?: string;
  REPLY_TO_EMAIL?: string;
  BRAND_NAME?: string;
  PUBLIC_CONTROL_KEY?: string;
  ADMIN_TOKEN?: string;
  CAP_CRAWL_PER_DAY?: string;
  CAP_DRAFTS_PER_DAY?: string;
  CAP_SEND_PER_DAY?: string;
}

export function safeJsonParse<T>(value: unknown): T | undefined {
  try {
    if (typeof value === "string") return JSON.parse(value) as T;
    return value as T;
  } catch {
    return undefined;
  }
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function nowISO(): string {
  return new Date().toISOString();
}

const LOCK_PREFIX = "lock:";

interface SettingRow {
  key: string;
  value: string | null;
}

export async function getSetting(env: Env, key: string): Promise<string | null> {
  const { results } = (await env.DB.prepare(
    `SELECT value FROM settings WHERE key = ? LIMIT 1`
  ).bind(key).all()) as { results: SettingRow[] };
  return results.length ? (results[0].value ?? null) : null;
}

export async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at_iso) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at_iso = excluded.updated_at_iso`
  ).bind(key, value, nowISO()).run();
}

export async function bump(env: Env, key: string, delta: number): Promise<void> {
  const current = Number((await getSetting(env, key)) || 0);
  await setSetting(env, key, String(current + delta));
}

export async function tryAcquireLock(env: Env, key: string, ttlSeconds: number): Promise<string | null> {
  const lockKey = `${LOCK_PREFIX}${key}`;
  const existing = await getSetting(env, lockKey);
  if (existing) {
    const parsed = safeJsonParse<{ token: string; expires: number }>(existing);
    if (parsed && parsed.expires > Date.now()) return null;
  }
  const token = uuid();
  const expires = Date.now() + ttlSeconds * 1000;
  await setSetting(env, lockKey, JSON.stringify({ token, expires }));
  return token;
}

export async function releaseLock(env: Env, key: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  const lockKey = `${LOCK_PREFIX}${key}`;
  const existing = await getSetting(env, lockKey);
  const parsed = existing ? safeJsonParse<{ token: string }>(existing) : undefined;
  if (parsed?.token !== token) return false;
  await env.DB.prepare(`DELETE FROM settings WHERE key = ?`).bind(lockKey).run();
  return true;
}

export async function logEvent(
  env: Env,
  type: string,
  message: string,
  meta: Record<string, any> | null = null
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO events (id, type, message, meta, created_at_iso)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(uuid(), type, message, JSON.stringify(meta || {}), nowISO()).run();
}

export async function listEvents(
  env: Env,
  limit = 50
): Promise<Array<{ id: string; type: string; message: string; meta?: string; created_at_iso: string }>> {
  const { results } = (await env.DB.prepare(
    `SELECT id, type, message, meta, created_at_iso
     FROM events
     ORDER BY created_at_iso DESC
     LIMIT ?`
  ).bind(limit).all()) as { results: any[] };
  return results;
}

export async function addSuppression(env: Env, email: string, reason: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO suppression (email, reason, created_at_iso)
     VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET reason = excluded.reason, created_at_iso = excluded.created_at_iso`
  ).bind(email, reason, nowISO()).run();
}

export async function insertLead(env: Env, website: string): Promise<LeadRow> {
  const existing = await env.DB.prepare(
    `SELECT id, website, status, data, created_at_iso, updated_at_iso
     FROM leads
     WHERE website = ?
     LIMIT 1`
  ).bind(website).first<any>();

  if (existing) {
    return {
      id: existing.id,
      website: existing.website,
      status: existing.status,
      created_at_iso: existing.created_at_iso,
      updated_at_iso: existing.updated_at_iso,
      data: existing.data,
    };
  }

  const id = uuid();
  const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO leads (id, website, status, created_at_iso, updated_at_iso)
     VALUES (?, ?, 'new', ?, ?)`
  ).bind(id, website, now, now).run();

  return { id, website, status: "new", created_at_iso: now, updated_at_iso: now };
}

interface ListLeadOptions {
  status?: LeadStatus;
  limit?: number;
}

export async function listLeads(env: Env, opts: ListLeadOptions = {}): Promise<LeadRow[]> {
  const where: string[] = [];
  const params: any[] = [];
  if (opts.status) {
    where.push(`status = ?`);
    params.push(opts.status);
  }
  const limit = opts.limit ?? 50;
  const sql = `SELECT id, website, status, data, created_at_iso, updated_at_iso FROM leads${
    where.length ? " WHERE " + where.join(" AND ") : ""
  } ORDER BY created_at_iso ASC LIMIT ?`;
  params.push(limit);
  const stmt = env.DB.prepare(sql);
  const { results } = (await stmt.bind(...params).all()) as { results: LeadRow[] };
  return results;
}

export async function updateLead(
  env: Env,
  id: string,
  updates: Partial<{ status: LeadStatus; data: any }>
): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (updates.status) {
    sets.push(`status = ?`);
    params.push(updates.status);
  }
  if ("data" in updates) {
    sets.push(`data = ?`);
    params.push(JSON.stringify(updates.data));
  }
  sets.push(`updated_at_iso = ?`);
  params.push(nowISO());
  params.push(id);
  const sql = `UPDATE leads SET ${sets.join(", ")} WHERE id = ?`;
  await env.DB.prepare(sql).bind(...params).run();
}

export async function insertDraft(env: Env, leadId: string, subject: string, body: string): Promise<DraftRow> {
  const id = uuid();
  const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO drafts (id, lead_id, status, subject, body, created_at_iso, updated_at_iso)
     VALUES (?, ?, 'created', ?, ?, ?, ?)`
  ).bind(id, leadId, subject, body, now, now).run();
  return { id, lead_id: leadId, status: "created", subject, body, created_at_iso: now, updated_at_iso: now };
}

interface ListDraftOptions {
  status?: DraftStatus;
  limit?: number;
}

export async function listDrafts(env: Env, opts: ListDraftOptions = {}): Promise<DraftRow[]> {
  const where: string[] = [];
  const params: any[] = [];
  if (opts.status) {
    where.push(`status = ?`);
    params.push(opts.status);
  }
  const limit = opts.limit ?? 50;
  const sql = `SELECT id, lead_id, status, subject, body, created_at_iso, updated_at_iso FROM drafts${
    where.length ? " WHERE " + where.join(" AND ") : ""
  } ORDER BY created_at_iso ASC LIMIT ?`;
  params.push(limit);
  const stmt = env.DB.prepare(sql);
  const { results } = (await stmt.bind(...params).all()) as { results: DraftRow[] };
  return results;
}

export async function updateDraft(
  env: Env,
  id: string,
  updates: Partial<{ status: DraftStatus }>
): Promise<void> {
  const sets: string[] = [];
  const params: any[] = [];
  if (updates.status) {
    sets.push(`status = ?`);
    params.push(updates.status);
  }
  sets.push(`updated_at_iso = ?`);
  params.push(nowISO());
  params.push(id);
  const sql = `UPDATE drafts SET ${sets.join(", ")} WHERE id = ?`;
  await env.DB.prepare(sql).bind(...params).run();
}

export interface TodayStats {
  leadsNewToday: number;
  draftsCreatedToday: number;
  approvalsToday: number;
  sendsSentToday: number;
  repliesToday: number;
  bouncesToday: number;
  unsubscribesToday: number;
}

export async function getTodayStats(env: Env): Promise<TodayStats> {
  const keys = [
    "leads_new_today",
    "drafts_created_today",
    "approvals_today",
    "sends_sent_today",
    "replies_today",
    "bounces_today",
    "unsubscribes_today",
  ];
  const stats: Record<string, number> = {};
  for (const key of keys) {
    stats[key] = Number((await getSetting(env, key)) || 0);
  }
  return {
    leadsNewToday: stats.leads_new_today,
    draftsCreatedToday: stats.drafts_created_today,
    approvalsToday: stats.approvals_today,
    sendsSentToday: stats.sends_sent_today,
    repliesToday: stats.replies_today,
    bouncesToday: stats.bounces_today,
    unsubscribesToday: stats.unsubscribes_today,
  };
}
