export type LeadStatus =
  | "new"
  | "scanned"
  | "drafted"
  | "approved"
  | "sent"
  | "failed"
  | "rejected"
  | "do_not_contact";

export type DraftStatus = "queued" | "created" | "approved" | "sent" | "failed" | "rejected";

export type LeadClass =
  | "ideal_client"
  | "possible_client"
  | "possible_partner"
  | "agency_peer"
  | "low_signal"
  | "bad_fit"
  | "do_not_contact";

export interface ScoreBreakdown {
  fit: number;
  contactability: number;
  opportunity: number;
  risk: number;
  total: number;
}

export interface LeadBrief {
  companyName?: string | null;
  businessType?: string | null;
  geoHint?: string | null;
  summary: string;
  siteQualitySummary: string;
  contactSummary: string;
  siteFlags: string[];
  serviceTags: string[];
  techTags: string[];
  outreachAngles: string[];
  groundedFacts: string[];
  avoidSaying: string[];
  confidence: "low" | "medium" | "high";
}

export interface Env {
  DB: D1Database;
  KV?: any;
  AI?: any;
  BRAND_NAME?: string;
  BRAND_DOMAIN?: string;
  BRAND_COUNTRIES?: string;
  PUBLIC_ENGINE_NAME?: string;
  PUBLIC_CONTROL_KEY?: string;
  OUTBOUND_AGENT_ADMIN_TOKEN?: string;
  ADMIN_TOKEN?: string;
  CAP_CRAWL_PER_DAY?: string;
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
  leadClass?: string;
  qualityTier?: string;
  opportunityType?: string;
  decisionSummary?: string;
  draftStrategy?: string;
  toneMode?: string;
  problemSummary?: string;
  leverageSummary?: string;
  recommendedAngle?: string;
  sourceMigrated?: boolean;
}

export interface LeadRow {
  id: string;
  company_name: string;
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
}

const LOCK_PREFIX = "lock:";

export function nowISO(): string {
  return new Date().toISOString();
}

export function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
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
    `SELECT key, value FROM settings WHERE key = ? LIMIT 1`
  ).bind(key).first<SettingRow>();
  return result?.value ?? null;
}

export async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO settings (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).bind(key, value).run();
}

export async function bump(env: Env, key: string, delta: number): Promise<number> {
  const current = Number((await getSetting(env, key)) || 0);
  const next = current + delta;
  await setSetting(env, key, String(next));
  return next;
}

export async function getUsageCounter(env: Env, key: string, day = todayUTC()): Promise<number> {
  try {
    const row = await env.DB.prepare(
      `SELECT value FROM usage_counters WHERE day = ? AND key = ? LIMIT 1`
    ).bind(day, key).first<{ value: number }>();
    return Number(row?.value || 0);
  } catch {
    return 0;
  }
}

export async function bumpUsageCounter(env: Env, key: string, amount = 1, day = todayUTC()): Promise<number> {
  try {
    await env.DB.prepare(
      `INSERT INTO usage_counters (day, key, value, updated_at_iso)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(day, key) DO UPDATE SET
         value = value + excluded.value,
         updated_at_iso = excluded.updated_at_iso`
    ).bind(day, key, amount, nowISO()).run();
  } catch {
    return 0;
  }
  return getUsageCounter(env, key, day);
}

export async function tryAcquireLock(env: Env, key: string, ttlSeconds: number): Promise<string | null> {
  const lockKey = `${LOCK_PREFIX}${key}`;
  const existing = await getSetting(env, lockKey);
  if (existing) {
    const parsed = safeJsonParse<{ token: string; expires: number }>(existing);
    if (parsed && parsed.expires > Date.now()) return null;
  }
  const token = uuid();
  await setSetting(env, lockKey, JSON.stringify({ token, expires: Date.now() + ttlSeconds * 1000 }));
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
  ).bind(uuid(), type, message, leadId, nowISO()).run();
}

export async function listEvents(env: Env, limit = 50): Promise<EventRow[]> {
  const safeLimit = Math.min(500, Math.max(1, limit));
  const { results } = (await env.DB.prepare(
    `SELECT id, type, message, lead_id, created_at_iso
     FROM events
     ORDER BY created_at_iso DESC
     LIMIT ?`
  ).bind(safeLimit).all()) as { results: EventRow[] };
  return results || [];
}

export async function addSuppression(env: Env, email: string, reason: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  await env.DB.prepare(
    `INSERT INTO suppression (email, reason, created_at_iso)
     VALUES (?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET reason = excluded.reason, created_at_iso = excluded.created_at_iso`
  ).bind(normalized, reason, nowISO()).run();
}

export async function isSuppressed(env: Env, email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  const row = await env.DB.prepare(`SELECT email FROM suppression WHERE email = ? LIMIT 1`).bind(normalized).first<{ email: string }>();
  return Boolean(row?.email);
}

function normalizeLeadWebsite(websiteUrl: string): string {
  return String(websiteUrl || "").trim().replace(/\/+$/, "");
}

function companyNameFromWebsite(websiteUrl: string): string {
  try {
    const normalized = /^https?:\/\//i.test(websiteUrl) ? websiteUrl : `https://${websiteUrl}`;
    const host = new URL(normalized).hostname.replace(/^www\./i, "");
    return host || "unknown-site";
  } catch {
    return normalizeLeadWebsite(websiteUrl) || "unknown-site";
  }
}

function inferCountryFromWebsite(websiteUrl: string): string {
  const lower = String(websiteUrl || "").toLowerCase();
  if (lower.includes(".co.nz") || lower.includes(".nz/") || lower.endsWith(".nz")) return "NZ";
  return "AU";
}

export interface InsertLeadInput {
  websiteUrl: string;
  discoverySource?: string | null;
  country?: string | null;
  region?: string | null;
  category?: string | null;
  companyName?: string | null;
  signalsJson?: string | null;
}

export async function insertLead(env: Env, websiteOrInput: string | InsertLeadInput, discoverySource = "manual"): Promise<LeadRow> {
  const input: InsertLeadInput =
    typeof websiteOrInput === "string"
      ? { websiteUrl: websiteOrInput, discoverySource }
      : websiteOrInput;

  const normalized = normalizeLeadWebsite(input.websiteUrl);
  const existing = await env.DB.prepare(
    `SELECT id, company_name, website_url, country, region, category, discovery_source,
            contact_email, contact_page_url, has_contact_form, signals_json,
            score_fit, score_contact, score_risk, score_total, status,
            created_at_iso, updated_at_iso
     FROM leads
     WHERE lower(website_url) = lower(?)
     LIMIT 1`
  ).bind(normalized).first<LeadRow>();

  if (existing) return existing;

  const id = uuid();
  const now = nowISO();
  const companyName = input.companyName || companyNameFromWebsite(normalized);
  const country = input.country || inferCountryFromWebsite(normalized) || "AU";
  const region = Object.prototype.hasOwnProperty.call(input, "region") ? input.region ?? null : null;
  const category = input.category || "general";
  const source = input.discoverySource || discoverySource || "manual";
  const signalsJson = input.signalsJson ?? "{}";

  await env.DB.prepare(
    `INSERT INTO leads (
      id, company_name, website_url, country, region, category, discovery_source,
      contact_email, contact_page_url, has_contact_form, signals_json,
      score_fit, score_contact, score_risk, score_total, status, created_at_iso, updated_at_iso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    companyName,
    normalized,
    country,
    region,
    category,
    source,
    null,
    null,
    0,
    signalsJson,
    0,
    0,
    0,
    0,
    "new",
    now,
    now
  ).run();

  return {
    id,
    company_name: companyName,
    website_url: normalized,
    country,
    region,
    category,
    discovery_source: source,
    contact_email: null,
    contact_page_url: null,
    has_contact_form: 0,
    signals_json: signalsJson,
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
  if (!sets.length) return;
  sets.push("updated_at_iso = ?");
  params.push(nowISO());
  params.push(id);
  await env.DB.prepare(`UPDATE leads SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
}

export async function getLeadById(env: Env, id: string): Promise<LeadRow | null> {
  return (await env.DB.prepare(
    `SELECT id, company_name, website_url, country, region, category, discovery_source,
            contact_email, contact_page_url, has_contact_form, signals_json,
            score_fit, score_contact, score_risk, score_total, status,
            created_at_iso, updated_at_iso
     FROM leads WHERE id = ? LIMIT 1`
  ).bind(id).first<LeadRow>()) || null;
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
  ).bind(
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
  ).run();

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
  return (await env.DB.prepare(
    `SELECT id, lead_id, mode, subject, body_text, followup_text, why_json, status, created_at_iso, updated_at_iso
     FROM drafts WHERE id = ? LIMIT 1`
  ).bind(id).first<DraftRow>()) || null;
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
  if (!sets.length) return;
  sets.push("updated_at_iso = ?");
  params.push(nowISO());
  params.push(id);
  await env.DB.prepare(`UPDATE drafts SET ${sets.join(", ")} WHERE id = ?`).bind(...params).run();
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
  return {
    leadsNewToday: Number((await getSetting(env, "leads_new_today")) || 0),
    draftsCreatedToday: Number((await getSetting(env, "drafts_created_today")) || 0),
    approvalsToday: Number((await getSetting(env, "approvals_today")) || 0),
    sendsSentToday: Number((await getSetting(env, "sends_sent_today")) || 0),
    repliesToday: Number((await getSetting(env, "replies_today")) || 0),
    bouncesToday: Number((await getSetting(env, "bounces_today")) || 0),
    unsubscribesToday: Number((await getSetting(env, "unsubscribes_today")) || 0),
  };
}
