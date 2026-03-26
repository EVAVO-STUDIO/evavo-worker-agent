import { randomUUID } from "crypto";

/**
 * Database helper module for the Outbound Agent.
 *
 * This module centralises all reads and writes to the underlying D1 database and
 * exposes a strongly‑typed interface. It also introduces simple locking
 * primitives to prevent concurrent runs of the engine. Each function
 * documents the expected semantics and returns plain objects rather than
 * exposing raw SQL statements. Any schema changes should be performed in
 * `schema.sql` and mirrored here.
 */

export type LeadStatus =
  | "new"
  | "scanned"
  | "drafted"
  | "approved"
  | "sent"
  | "failed";

export type DraftStatus = "created" | "approved" | "sent" | "failed";

export type SendStatus = "pending" | "sent" | "failed";

export interface LeadRow {
  id: string;
  website: string;
  status: LeadStatus;
  created_at_iso: string;
  updated_at_iso: string;
  // Additional fields parsed from JSON columns (score, brief, etc.) are
  // intentionally omitted here for brevity. Consumers should parse these
  // properties via the `safeJsonParse` helper when needed.
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
  // Settings for sending emails
  MAILCHANNELS_API_KEY?: string;
  FROM_EMAIL?: string;
  REPLY_TO_EMAIL?: string;
  BRAND_NAME?: string;
  PUBLIC_CONTROL_KEY?: string;
}

// -----------------------------------------------------------------------------
// Helpers
//
// A handful of helper functions make it safer to work with JSON columns and
// timestamps. Use these helpers throughout the worker rather than ad‑hoc
// implementations scattered in different modules.

/**
 * Attempt to parse a JSON value, returning undefined if parsing fails.
 */
export function safeJsonParse<T>(value: unknown): T | undefined {
  try {
    if (typeof value === "string") return JSON.parse(value) as T;
    return value as T;
  } catch {
    return undefined;
  }
}

/**
 * Generate a RFC4122 v4 UUID using the crypto module. Workers
 * polyfill crypto.randomUUID by default, but Node’s implementation is used
 * here to keep parity in test environments.
 */
export function uuid(): string {
  return randomUUID();
}

/**
 * Return the current ISO timestamp. All dates persisted to the DB should
 * originate from this helper to enforce consistent formatting.
 */
export function nowISO(): string {
  return new Date().toISOString();
}

// -----------------------------------------------------------------------------
// Settings and Locks
//
// Settings are stored in a generic key/value table (`settings`) and typed
// accordingly. Locks live in the same table with a special prefix and an
// expiration timestamp. The helper functions below abstract reading and
// writing to this table and apply simple TTL semantics for locks.

const LOCK_PREFIX = "lock:";

interface SettingRow {
  key: string;
  value: string | null;
  updated_at_iso: string;
}

/**
 * Retrieve a setting by key. Missing keys resolve to undefined.
 */
export async function getSetting(env: Env, key: string): Promise<string | null> {
  const { results } = (await env.DB.prepare(
    `SELECT value FROM settings WHERE key = ? LIMIT 1`
  )
    .bind(key)
    .all()) as { results: SettingRow[] };
  return results.length ? (results[0].value ?? null) : null;
}

/**
 * Persist a setting. If the key exists, its value and updated_at timestamp
 * are replaced.
 */
export async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at_iso) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at_iso=excluded.updated_at_iso`
  )
    .bind(key, value, nowISO())
    .run();
}

/**
 * Acquire a lock for a given key. Returns a token if the lock is acquired or
 * null if it is currently held. Locks expire automatically after `ttlSeconds`.
 */
export async function tryAcquireLock(
  env: Env,
  key: string,
  ttlSeconds: number
): Promise<string | null> {
  const lockKey = `${LOCK_PREFIX}${key}`;
  // Clear expired lock
  const existing = await getSetting(env, lockKey);
  if (existing) {
    const { token, expires }: { token: string; expires: number } = safeJsonParse(existing) || {};
    const now = Date.now();
    if (expires > now) {
      return null;
    }
  }
  const token = uuid();
  const expires = Date.now() + ttlSeconds * 1000;
  await setSetting(env, lockKey, JSON.stringify({ token, expires }));
  return token;
}

/**
 * Release a previously acquired lock. Only the lock holder (identified by
 * matching token) can release it. Returns true if released.
 */
export async function releaseLock(
  env: Env,
  key: string,
  token: string | null
): Promise<boolean> {
  if (!token) return false;
  const lockKey = `${LOCK_PREFIX}${key}`;
  const existing = await getSetting(env, lockKey);
  if (existing) {
    const { token: storedToken } = safeJsonParse(existing) || {};
    if (storedToken === token) {
      await env.DB.prepare(`DELETE FROM settings WHERE key = ?`).bind(lockKey).run();
      return true;
    }
  }
  return false;
}

// -----------------------------------------------------------------------------
// Event Logging
//
// Events are used to track system behaviour for debugging and analytics. Each
// log entry records a type, a message, optional JSON metadata and a timestamp.

export async function logEvent(
  env: Env,
  type: string,
  message: string,
  meta: Record<string, any> | null = null
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO events (id, type, message, meta, created_at_iso)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(uuid(), type, message, JSON.stringify(meta || {}), nowISO())
    .run();
}

export async function listEvents(env: Env, limit = 50): Promise<Array<{ id: string; type: string; message: string; created_at_iso: string }>> {
  const { results } = (await env.DB.prepare(
    `SELECT id, type, message, created_at_iso FROM events ORDER BY created_at_iso DESC LIMIT ?`
  )
    .bind(limit)
    .all()) as { results: any[] };
  return results;
}

// -----------------------------------------------------------------------------
// Suppression
//
// The suppression list stores unsubscribed email addresses along with a reason.

export async function addSuppression(env: Env, email: string, reason: string): Promise<void> {
  const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO suppression (email, reason, created_at_iso)
     VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET reason = excluded.reason, created_at_iso = excluded.created_at_iso`
  )
    .bind(email, reason, now)
    .run();
}

// -----------------------------------------------------------------------------
// Counters
//
/**
 * Increment a numeric setting by the specified delta. Used for tracking daily
 * budgets (crawl, draft, send) and other simple counters. If the key does not
 * exist it will be created with the delta as its initial value.
 */
export async function bump(env: Env, key: string, delta: number): Promise<void> {
  const current = Number((await getSetting(env, key)) || 0);
  await setSetting(env, key, String(current + delta));
}

// -----------------------------------------------------------------------------
// Leads
//
// The leads table tracks prospective contacts discovered by the agent. Leads
// transition through a finite set of statuses as they move from discovery
// through scanning, drafting and sending.

export async function insertLead(env: Env, website: string): Promise<LeadRow> {
  const id = uuid();
  const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO leads (id, website, status, created_at_iso, updated_at_iso) VALUES (?, ?, 'new', ?, ?)`
  )
    .bind(id, website, now, now)
    .run();
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
  const sql = `SELECT id, website, status, created_at_iso, updated_at_iso FROM leads${
    where.length ? " WHERE " + where.join(" AND ") : ""
  } ORDER BY created_at_iso ASC LIMIT ?`;
  params.push(limit);
  const { results } = (await env.DB.prepare(sql).bind(...params).all()) as { results: LeadRow[] };
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

// -----------------------------------------------------------------------------
// Drafts
//
export async function insertDraft(
  env: Env,
  leadId: string,
  subject: string,
  body: string
): Promise<DraftRow> {
  const id = uuid();
  const now = nowISO();
  await env.DB.prepare(
    `INSERT INTO drafts (id, lead_id, status, subject, body, created_at_iso, updated_at_iso)
     VALUES (?, ?, 'created', ?, ?, ?, ?)`
  )
    .bind(id, leadId, subject, body, now, now)
    .run();
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
  const { results } = (await env.DB.prepare(sql).bind(...params).all()) as { results: DraftRow[] };
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

// -----------------------------------------------------------------------------
// Stats
//
export interface TodayStats {
  leadsNewToday: number;
  draftsCreatedToday: number;
  approvalsToday: number;
  repliesToday: number;
  bouncesToday: number;
  unsubscribesToday: number;
}

/**
 * Compute aggregated statistics for the current day by querying counters from the
 * settings table. All values fallback to zero if missing.
 */
export async function getTodayStats(env: Env): Promise<TodayStats> {
  const keys = [
    "leads_new_today",
    "drafts_created_today",
    "approvals_today",
    "replies_today",
    "bounces_today",
    "unsubscribes_today",
  ];
  const stats: any = {};
  for (const key of keys) {
    stats[key] = Number((await getSetting(env, key)) || 0);
  }
  return {
    leadsNewToday: stats.leads_new_today,
    draftsCreatedToday: stats.drafts_created_today,
    approvalsToday: stats.approvals_today,
    repliesToday: stats.replies_today,
    bouncesToday: stats.bounces_today,
    unsubscribesToday: stats.unsubscribes_today,
  };
}
