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

export interface Env {
  DB: D1Database;
  KV?: any;
  AI?: any;
  MAILCHANNELS_API_KEY?: string;
  FROM_EMAIL?: string;
  REPLY_TO_EMAIL?: string;
  BRAND_NAME?: string;
  BRAND_DOMAIN?: string;
  BRAND_COUNTRIES?: string;
  PUBLIC_ENGINE_NAME?: string;
  PUBLIC_CONTROL_KEY?: string;
  OUTBOUND_AGENT_ADMIN_TOKEN?: string;
  ADMIN_TOKEN?: string;
  CAP_CRAWL_PER_DAY?: string;
  CAP_DRAFTS_PER_DAY?: string;
  CAP_SEND_PER_DAY?: string;
}

export interface LeadSignals {
  summary?: string;
  brief?: string;
  siteQualitySummary?: string;
  contactSummary?: string;
  serviceTags?: string[];
  techTags?: string[];
  outreachAngles?: string[];
  groundedFacts?: string[];
  avoidSaying?: string[];
  title?: string;
  description?: string;
  companyName?: string;
}

export interface LeadRow {
  id: string;
  company_name: string | null;
  website_url: string;
  country: string | null;
  region: string | null;
  category: string | null;
  discovery_source: string | null;
  contact_email: string | null;
  contact_page_url: string | null;
  has_contact_form: number;
  signals_json: string | null;
  score_fit: number;
  score_contact: number;
  score_risk: number;
  score_total: number;
  status: LeadStatus;
  created_at_iso: string;
  updated_at_iso: string;
}

export interface DraftRow {
  id: string;
  lead_id: string;
  mode: string | null;
  subject: string;
  body_text: string;
  followup_text: string | null;
  why_json: string | null;
  status: DraftStatus;
  created_at_iso: string;
  updated_at_iso: string;
}

export interface EventRow {
  id: string;
  type: string;
  message: string;
  lead_id: string | null;
  created_at_iso: string;
}

interface SettingRow {
  key: string;
  value: string | null;
  updated_at_iso: string;
}

const LOCK_PREFIX = "lock:";

export function nowISO(): string {
  return new Date().toISOString();
}

export function uuid(): string {
  return crypto.randomUUID();
}

export function safeJsonParse<T>(value: unknown): T | undefined {
  try {
    if (typeof value === "string") return JSON.parse(value) as T;
    return value as T;
  } catch {
    return undefined;
  }
}

export function getAdminToken(env: Env): string | undefined {
  return env.OUTBOUND_AGENT_ADMIN_TOKEN || env.ADMIN_TOKEN;
}

export function parseLeadSignals(row: Pick<LeadRow, "signals_json"> | { signals_json?: string | null }): LeadSignals {
  return safeJsonParse<LeadSignals>(row.signals_json || null) || {};
}

export async function getSetting(env: Env, key: string): Promise<string | null> {
  const result = await env.DB.prepare(
    `SELECT key, value, updated_at_iso
     FROM settings
     WHERE key = ?
     LIMIT 1`
  )
    .bind(key)
    .first<SettingRow>();
  return result?.value ?? null;
}

export async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at_iso)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       updated_at_iso = excluded.updated_at_iso`
  )
    .bind(key, value, nowISO())
    .run();
}

export async function bump(env: Env, key: string, delta: number): Promise<number> {
  const current = Number((await getSetting(env, key)) || 0);
  const next = current + delta;
  await setSetting(env, key, String(next));
  return next;
}

export async function tryAcquireLock(env: Env, key: string, ttlSeconds: number): Promise<string | null> {
  const lockKey = `${LOCK_PREFIX}${key}`;
  const existing = await getSetting(env, lockKey);
  if (existing) {
    const parsed = safeJsonParse<{ token: string; expires: number }>(existing);
    if (parsed && parsed.expires > Date.now()) return null;
  }
  const token = uuid();
  await setSetting(
    env,
    lockKey,
    JSON.stringify({
      token,
      expires: Date.now() + ttlSeconds * 1000,
    })
  );
  return token;
}

export async function releaseLock(env: Env, key: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  const lockKey = `${LOCK_PREFIX}${key}`;
  const existing = await getSetting(env, lockKey);
  const parsed = safeJsonParse<{ token: string }>(existing);
  if (!parsed || parsed.token !== token) return false;
  await env.DB.prepare(`DELETE FROM settings WHERE key = ?`).bind(lockKey).run();
  return true;
}

export async function logEvent(env: Env, type: string, message: string, leadId: string | null = null): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO events (id, type, message, lead_id, created_at_iso)
     VALUES (?, ?, ?, ?, ?)`
  )
    .bind(uuid(), type, message, leadId, nowISO())
    .run();
}

export async function listEvents(env: Env, limit = 50): Promise<EventRow[]> {
  const { results } = (await env.DB.prepare(
    `SELECT id, type, message, lead_id, created_at_iso
     FROM events
     ORDER BY created_at_iso DESC
     LIMIT ?`
  )
    .bind(limit)
    .all()) as { results: EventRow[] };
  return results || [];
}

export async function addSuppression(env: Env, email: string, reason: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await env.DB.prepare(
    `INSERT INTO suppression (email, reason, created_at_iso)
     VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       reason = excluded.reason,
       created_at_iso = excluded.created_at_iso`
  )
    .bind(normalized, reason, nowISO())
    .run();
}

export async function isSuppressed(env: Env, email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const row = await env.DB.prepare(`SELECT email FROM suppression WHERE email = ? LIMIT 1`)
    .bind(normalized)
    .first<{ email: string }>();
  return Boolean(row?.email);
}

function normalizeLeadWebsite(websiteUrl: string): string {
  return websiteUrl.trim().replace(/\/+$/, "");
}

export async function insertLead(env: Env, websiteUrl: string, discoverySource = "manual"): Promise<LeadRow> {
  const normalized = normalizeLeadWebsite(websiteUrl);
  const existing = await env.DB.prepare(
    `SELECT id, company_name, website_url, country, region, category, discovery_source,
            contact_email, contact_page_url, has_contact_form, signals_json,
            score_fit, score_contact, score_risk, score_total, status,
            created_at_iso, updated_at_iso
     FROM leads
     WHERE lower(website_url) = lower(?)
     LIMIT 1`
  )
    .bind(normalized)
    .first<LeadRow>();

  if (existing) return existing;

  const id = uuid();
  const now = nowISO();

  await env.DB.prepare(
    `INSERT INTO leads (
      id, company_name, website_url, country, region, category, discovery_source,
      contact_email, contact_page_url, has_contact_form, signals_json,
      score_fit, score_contact, score_risk, score_total, status, created_at_iso, updated_at_iso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      null,
      normalized,
      null,
      null,
      "general",
      discoverySource,
      null,
      null,
      0,
      null,
      0,
      0,
      0,
      0,
      "new",
      now,
      now
    )
    .run();

  return {
    id,
    company_name: null,
    website_url: normalized,
    country: null,
    region: null,
    category: "general",
    discovery_source: discoverySource,
    contact_email: null,
    contact_page_url: null,
    has_contact_form: 0,
    signals_json: null,
    score_fit: 0,
    score_contact: 0,
    score_risk: 0,
    score_total: 0,
    status: "new",
    created_at_iso: now,
    updated_at_iso: now,
  };
}

interface ListLeadOptions {
  status?: LeadStatus;
  limit?: number;
}

export async function listLeads(env: Env, opts: ListLeadOptions = {}): Promise<LeadRow[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.status) {
    clauses.push("status = ?");
    params.push(opts.status);
  }
  const limit = Math.min(500, Math.max(1, opts.limit ?? 50));
  const sql = `SELECT id, company_name, website_url, country, region, category, discovery_source,
                      contact_email, contact_page_url, has_contact_form, signals_json,
                      score_fit, score_contact, score_risk, score_total, status,
                      created_at_iso, updated_at_iso
               FROM leads
               ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
               ORDER BY updated_at_iso DESC
               LIMIT ?`;
  params.push(limit);
  const { results } = (await env.DB.prepare(sql).bind(...params).all()) as { results: LeadRow[] };
  return results || [];
}

export interface LeadUpdateInput {
  company_name?: string | null;
  country?: string | null;
  region?: string | null;
  category?: string | null;
  discovery_source?: string | null;
  contact_email?: string | null;
  contact_page_url?: string | null;
  has_contact_form?: number;
  signals_json?: string | null;
  score_fit?: number;
  score_contact?: number;
  score_risk?: number;
  score_total?: number;
  status?: LeadStatus;
}

export async function updateLead(env: Env, id: string, updates: LeadUpdateInput): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const orderedKeys: Array<keyof LeadUpdateInput> = [
    "company_name",
    "country",
    "region",
    "category",
    "discovery_source",
    "contact_email",
    "contact_page_url",
    "has_contact_form",
    "signals_json",
    "score_fit",
    "score_contact",
    "score_risk",
    "score_total",
    "status",
  ];

  for (const key of orderedKeys) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      sets.push(`${key} = ?`);
      params.push((updates as any)[key]);
    }
  }

  sets.push("updated_at_iso = ?");
  params.push(nowISO());
  params.push(id);

  await env.DB.prepare(
    `UPDATE leads
     SET ${sets.join(", ")}
     WHERE id = ?`
  )
    .bind(...params)
    .run();
}

export async function getLeadById(env: Env, id: string): Promise<LeadRow | null> {
  return (
    (await env.DB.prepare(
      `SELECT id, company_name, website_url, country, region, category, discovery_source,
              contact_email, contact_page_url, has_contact_form, signals_json,
              score_fit, score_contact, score_risk, score_total, status,
              created_at_iso, updated_at_iso
       FROM leads
       WHERE id = ?
       LIMIT 1`
    )
      .bind(id)
      .first<LeadRow>()) || null
  );
}

export interface DraftInsertInput {
  leadId: string;
  mode?: string | null;
  subject: string;
  bodyText: string;
  followupText?: string | null;
  whyJson?: string | null;
}

export async function insertDraft(env: Env, input: DraftInsertInput): Promise<DraftRow> {
  const now = nowISO();
  const id = uuid();

  await env.DB.prepare(
    `INSERT INTO drafts (
      id, lead_id, mode, subject, body_text, followup_text, why_json, status, created_at_iso, updated_at_iso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      input.leadId,
      input.mode || "heuristic",
      input.subject,
      input.bodyText,
      input.followupText || null,
      input.whyJson || null,
      "created",
      now,
      now
    )
    .run();

  return {
    id,
    lead_id: input.leadId,
    mode: input.mode || "heuristic",
    subject: input.subject,
    body_text: input.bodyText,
    followup_text: input.followupText || null,
    why_json: input.whyJson || null,
    status: "created",
    created_at_iso: now,
    updated_at_iso: now,
  };
}

interface ListDraftOptions {
  status?: DraftStatus;
  limit?: number;
}

export async function listDrafts(env: Env, opts: ListDraftOptions = {}): Promise<DraftRow[]> {
  const clauses: string[] = [];
  const params: unknown[] = [];
  if (opts.status) {
    clauses.push("status = ?");
    params.push(opts.status);
  }
  const limit = Math.min(500, Math.max(1, opts.limit ?? 50));
  const sql = `SELECT id, lead_id, mode, subject, body_text, followup_text, why_json, status, created_at_iso, updated_at_iso
               FROM drafts
               ${clauses.length ? `WHERE ${clauses.join(" AND ")}` : ""}
               ORDER BY updated_at_iso DESC
               LIMIT ?`;
  params.push(limit);
  const { results } = (await env.DB.prepare(sql).bind(...params).all()) as { results: DraftRow[] };
  return results || [];
}

export async function getDraftById(env: Env, id: string): Promise<DraftRow | null> {
  return (
    (await env.DB.prepare(
      `SELECT id, lead_id, mode, subject, body_text, followup_text, why_json, status, created_at_iso, updated_at_iso
       FROM drafts
       WHERE id = ?
       LIMIT 1`
    )
      .bind(id)
      .first<DraftRow>()) || null
  );
}

export async function updateDraft(
  env: Env,
  id: string,
  updates: Partial<Pick<DraftRow, "status" | "subject" | "body_text" | "followup_text" | "why_json" | "mode">>
): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  const orderedKeys: Array<keyof typeof updates> = ["status", "subject", "body_text", "followup_text", "why_json", "mode"];
  for (const key of orderedKeys) {
    if (Object.prototype.hasOwnProperty.call(updates, key)) {
      sets.push(`${key} = ?`);
      params.push((updates as any)[key]);
    }
  }
  sets.push("updated_at_iso = ?");
  params.push(nowISO());
  params.push(id);

  await env.DB.prepare(
    `UPDATE drafts
     SET ${sets.join(", ")}
     WHERE id = ?`
  )
    .bind(...params)
    .run();
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
  const map = {
    leadsNewToday: "leads_new_today",
    draftsCreatedToday: "drafts_created_today",
    approvalsToday: "approvals_today",
    sendsSentToday: "sends_sent_today",
    repliesToday: "replies_today",
    bouncesToday: "bounces_today",
    unsubscribesToday: "unsubscribes_today",
  } as const;

  const out: Record<string, number> = {};
  for (const [targetKey, sourceKey] of Object.entries(map)) {
    out[targetKey] = Number((await getSetting(env, sourceKey)) || 0);
  }
  return out as TodayStats;
}
