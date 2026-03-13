// src/db.ts
// D1 helpers for EVAVO Outbound Agent

export interface Env {
  DB: D1Database;
  AI: any;

  ADMIN_TOKEN?: string;
  MAILCHANNELS_API_KEY?: string;
  FROM_EMAIL?: string;
  REPLY_TO_EMAIL?: string;
  PUBLIC_BASE_URL?: string;

  PUBLIC_ENGINE_NAME?: string;
  WORKER_PUBLIC_ORIGIN?: string;
  BRAND_NAME?: string;
  BRAND_DOMAIN?: string;
  BRAND_COUNTRIES?: string;
  CAP_CRAWL_PER_DAY?: string;
  CAP_DRAFTS_PER_DAY?: string;
  CAP_SEND_PER_DAY?: string;

  WEIGHT_PARTNER?: string;
  WEIGHT_REBUILD?: string;
  WEIGHT_TEARDOWN?: string;

  PUBLIC_CONTROL_KEY?: string;
}

export type LeadStatus =
  | "new"
  | "scanned"
  | "qualified"
  | "drafted"
  | "approved"
  | "sent"
  | "replied"
  | "bounced"
  | "unsubscribed"
  | "do_not_contact"
  | "rejected";

export type DraftStatus = "queued" | "approved" | "sent" | "failed" | "rejected";
export type LeadClass = "ideal_client" | "possible_partner" | "agency_peer" | "low_signal" | "do_not_contact";

export type LeadBrief = {
  companyName: string | null;
  businessType: string | null;
  geoHint: string | null;
  summary: string;
  siteQualitySummary: string;
  siteFlags: string[];
  serviceTags: string[];
  techTags: string[];
  outreachAngles: string[];
  groundedFacts: string[];
  avoidSaying: string[];
  contactSummary: string;
  confidence: "low" | "medium" | "high";
};

export type ScoreBreakdown = {
  fit: number;
  contactability: number;
  opportunity: number;
  risk: number;
  total: number;
};

export type LeadRow = {
  id: string;
  company_name: string;
  website_url: string;
  country: string;
  region: string | null;
  category: string;
  discovery_source: string | null;
  contact_email: string | null;
  contact_page_url: string | null;
  has_contact_form: number;
  signals_json: string;
  score_fit: number;
  score_contact: number;
  score_risk: number;
  score_total: number;
  status: LeadStatus;
  created_at_iso: string;
  updated_at_iso: string;
  lead_class?: LeadClass | null;
  all_emails_json?: string | null;
  lead_brief_json?: string | null;
  score_breakdown_json?: string | null;
  last_scanned_at_iso?: string | null;
};

export type DraftRow = {
  id: string;
  lead_id: string;
  subject: string;
  body: string;
  followup_text?: string;
  why_json?: string;
  status: DraftStatus;
  created_at_iso: string;
  updated_at_iso: string;
};

export type EventRow = {
  id: string;
  type: string;
  message: string;
  lead_id: string | null;
  created_at_iso: string;
};

export function nowISO() {
  return new Date().toISOString();
}

export function uuid() {
  return crypto.randomUUID();
}

type TableInfoRow = {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | null;
  pk: number;
};

type LeadSchema = {
  hasLeadClass: boolean;
  hasAllEmails: boolean;
  hasLeadBrief: boolean;
  hasScoreBreakdown: boolean;
  hasLastScanned: boolean;
};

type DraftSchema = {
  bodyColumn: string;
  followupColumn: string | null;
  whyJsonColumn: string | null;
  modeColumn: string | null;
  statusColumn: string | null;
};

let leadSchemaCache: LeadSchema | null = null;
let draftSchemaCache: DraftSchema | null = null;

async function loadLeadSchema(env: Env): Promise<LeadSchema> {
  if (leadSchemaCache) return leadSchemaCache;
  const info = await env.DB.prepare("PRAGMA table_info(leads)").all<TableInfoRow>();
  const rows = (info.results || []) as TableInfoRow[];
  const names = new Set(rows.map((r) => String(r.name || "").toLowerCase()));
  leadSchemaCache = {
    hasLeadClass: names.has("lead_class"),
    hasAllEmails: names.has("all_emails_json"),
    hasLeadBrief: names.has("lead_brief_json"),
    hasScoreBreakdown: names.has("score_breakdown_json"),
    hasLastScanned: names.has("last_scanned_at_iso"),
  };
  return leadSchemaCache;
}

async function loadDraftSchema(env: Env): Promise<DraftSchema> {
  if (draftSchemaCache) return draftSchemaCache;
  const info = await env.DB.prepare("PRAGMA table_info(drafts)").all<TableInfoRow>();
  const rows = (info.results || []) as TableInfoRow[];
  const names = new Set(rows.map((r) => String(r.name || "").toLowerCase()));
  draftSchemaCache = {
    bodyColumn: names.has("body_text") ? "body_text" : names.has("body") ? "body" : "body_text",
    followupColumn: names.has("followup_text") ? "followup_text" : null,
    whyJsonColumn: names.has("why_json") ? "why_json" : null,
    modeColumn: names.has("mode") ? "mode" : null,
    statusColumn: names.has("status") ? "status" : null,
  };
  return draftSchemaCache;
}

export function safeJsonParse<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function getSetting(env: Env, key: string): Promise<string | null> {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?").bind(key).first<any>();
  return (row?.value ?? null) as string | null;
}

export async function setSetting(env: Env, key: string, value: string): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
  )
    .bind(key, value)
    .run();
}

export async function setSettings(env: Env, patch: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    await setSetting(env, key, value);
  }
}

export async function listSettings(env: Env): Promise<Record<string, string>> {
  const rows = await env.DB.prepare("SELECT key, value FROM settings ORDER BY key ASC").all<any>();
  const out: Record<string, string> = {};
  for (const row of rows.results || []) out[String(row.key)] = String(row.value ?? "");
  return out;
}

export async function logEvent(env: Env, type: string, message: string, leadId?: string | null): Promise<void> {
  await env.DB.prepare(
    "INSERT INTO events(id, type, message, lead_id, created_at_iso) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(uuid(), type, message.slice(0, 5000), leadId ?? null, nowISO())
    .run();
}

export async function bump(env: Env, key: string, delta = 1): Promise<number> {
  const current = parseInt((await getSetting(env, key)) || "0", 10) || 0;
  const next = current + delta;
  await setSetting(env, key, String(next));
  return next;
}

export async function addSuppression(env: Env, email: string, reason = "unsubscribed"): Promise<void> {
  const cleaned = (email || "").trim().toLowerCase();
  if (!cleaned) return;
  await env.DB.prepare(
    "INSERT INTO suppressions(email, reason, created_at_iso) VALUES (?, ?, ?) ON CONFLICT(email) DO UPDATE SET reason = excluded.reason, created_at_iso = excluded.created_at_iso"
  )
    .bind(cleaned, reason.slice(0, 200), nowISO())
    .run();
}

export async function isSuppressed(env: Env, email: string | null | undefined): Promise<boolean> {
  const cleaned = (email || "").trim().toLowerCase();
  if (!cleaned) return false;
  const row = await env.DB.prepare("SELECT email FROM suppressions WHERE email = ?").bind(cleaned).first<any>();
  return !!row;
}

function mapLeadRow(row: any): LeadRow {
  return row as LeadRow;
}

function mapDraftRow(row: any): DraftRow {
  return {
    id: row.id,
    lead_id: row.lead_id,
    subject: row.subject,
    body: row.body,
    followup_text: row.followup_text || "",
    why_json: row.why_json || "[]",
    status: row.status,
    created_at_iso: row.created_at_iso,
    updated_at_iso: row.updated_at_iso,
  };
}

export async function getLeadByWebsite(env: Env, websiteUrl: string): Promise<LeadRow | null> {
  const schema = await loadLeadSchema(env);
  const extra = [
    schema.hasLeadClass ? ", lead_class" : ", NULL as lead_class",
    schema.hasAllEmails ? ", all_emails_json" : ", NULL as all_emails_json",
    schema.hasLeadBrief ? ", lead_brief_json" : ", NULL as lead_brief_json",
    schema.hasScoreBreakdown ? ", score_breakdown_json" : ", NULL as score_breakdown_json",
    schema.hasLastScanned ? ", last_scanned_at_iso" : ", NULL as last_scanned_at_iso",
  ].join("");
  const row = await env.DB.prepare(`SELECT * ${extra} FROM leads WHERE website_url = ?`).bind(websiteUrl).first<any>();
  return row ? mapLeadRow(row) : null;
}

export async function getLeadById(env: Env, id: string): Promise<LeadRow | null> {
  const schema = await loadLeadSchema(env);
  const extra = [
    schema.hasLeadClass ? ", lead_class" : ", NULL as lead_class",
    schema.hasAllEmails ? ", all_emails_json" : ", NULL as all_emails_json",
    schema.hasLeadBrief ? ", lead_brief_json" : ", NULL as lead_brief_json",
    schema.hasScoreBreakdown ? ", score_breakdown_json" : ", NULL as score_breakdown_json",
    schema.hasLastScanned ? ", last_scanned_at_iso" : ", NULL as last_scanned_at_iso",
  ].join("");
  const row = await env.DB.prepare(`SELECT * ${extra} FROM leads WHERE id = ?`).bind(id).first<any>();
  return row ? mapLeadRow(row) : null;
}

export async function insertLead(env: Env, lead: Partial<LeadRow> & { company_name: string; website_url: string }): Promise<string> {
  const schema = await loadLeadSchema(env);
  const id = lead.id || uuid();
  const created = lead.created_at_iso || nowISO();
  const updated = lead.updated_at_iso || created;

  const columns = [
    "id",
    "company_name",
    "website_url",
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
    "created_at_iso",
    "updated_at_iso",
  ];
  const values: any[] = [
    id,
    lead.company_name,
    lead.website_url,
    lead.country || "UNK",
    lead.region ?? null,
    lead.category || "other",
    lead.discovery_source ?? null,
    lead.contact_email ?? null,
    lead.contact_page_url ?? null,
    typeof lead.has_contact_form === "number" ? lead.has_contact_form : 0,
    lead.signals_json || "[]",
    lead.score_fit ?? 0,
    lead.score_contact ?? 0,
    lead.score_risk ?? 0,
    lead.score_total ?? 0,
    (lead.status as LeadStatus) || "new",
    created,
    updated,
  ];

  if (schema.hasLeadClass) {
    columns.push("lead_class");
    values.push(lead.lead_class ?? "low_signal");
  }
  if (schema.hasAllEmails) {
    columns.push("all_emails_json");
    values.push(lead.all_emails_json ?? "[]");
  }
  if (schema.hasLeadBrief) {
    columns.push("lead_brief_json");
    values.push(lead.lead_brief_json ?? "{}");
  }
  if (schema.hasScoreBreakdown) {
    columns.push("score_breakdown_json");
    values.push(lead.score_breakdown_json ?? "{}");
  }
  if (schema.hasLastScanned) {
    columns.push("last_scanned_at_iso");
    values.push(lead.last_scanned_at_iso ?? null);
  }

  const placeholders = columns.map(() => "?").join(", ");
  await env.DB.prepare(`INSERT INTO leads(${columns.join(", ")}) VALUES(${placeholders})`).bind(...values).run();
  return id;
}

export async function updateLead(env: Env, id: string, patch: Partial<LeadRow>): Promise<void> {
  const current = await getLeadById(env, id);
  if (!current) return;
  const schema = await loadLeadSchema(env);

  const baseCols = [
    "company_name=?",
    "website_url=?",
    "country=?",
    "region=?",
    "category=?",
    "discovery_source=?",
    "contact_email=?",
    "contact_page_url=?",
    "has_contact_form=?",
    "signals_json=?",
    "score_fit=?",
    "score_contact=?",
    "score_risk=?",
    "score_total=?",
    "status=?",
    "updated_at_iso=?",
  ];
  const values: any[] = [
    patch.company_name ?? current.company_name,
    patch.website_url ?? current.website_url,
    patch.country ?? current.country,
    patch.region ?? current.region,
    patch.category ?? current.category,
    patch.discovery_source ?? current.discovery_source,
    patch.contact_email ?? current.contact_email,
    patch.contact_page_url ?? current.contact_page_url,
    patch.has_contact_form ?? current.has_contact_form,
    patch.signals_json ?? current.signals_json,
    patch.score_fit ?? current.score_fit,
    patch.score_contact ?? current.score_contact,
    patch.score_risk ?? current.score_risk,
    patch.score_total ?? current.score_total,
    patch.status ?? current.status,
    nowISO(),
  ];

  if (schema.hasLeadClass) {
    baseCols.push("lead_class=?");
    values.push(patch.lead_class ?? current.lead_class ?? "low_signal");
  }
  if (schema.hasAllEmails) {
    baseCols.push("all_emails_json=?");
    values.push(patch.all_emails_json ?? current.all_emails_json ?? "[]");
  }
  if (schema.hasLeadBrief) {
    baseCols.push("lead_brief_json=?");
    values.push(patch.lead_brief_json ?? current.lead_brief_json ?? "{}");
  }
  if (schema.hasScoreBreakdown) {
    baseCols.push("score_breakdown_json=?");
    values.push(patch.score_breakdown_json ?? current.score_breakdown_json ?? "{}");
  }
  if (schema.hasLastScanned) {
    baseCols.push("last_scanned_at_iso=?");
    values.push(patch.last_scanned_at_iso ?? current.last_scanned_at_iso ?? null);
  }

  values.push(id);
  await env.DB.prepare(`UPDATE leads SET ${baseCols.join(", ")} WHERE id=?`).bind(...values).run();
}

export async function listLeads(env: Env, opts?: { status?: string; limit?: number }): Promise<LeadRow[]> {
  const schema = await loadLeadSchema(env);
  const limit = Math.min(250, Math.max(1, opts?.limit || 50));
  const extra = [
    schema.hasLeadClass ? ", lead_class" : ", NULL as lead_class",
    schema.hasAllEmails ? ", all_emails_json" : ", NULL as all_emails_json",
    schema.hasLeadBrief ? ", lead_brief_json" : ", NULL as lead_brief_json",
    schema.hasScoreBreakdown ? ", score_breakdown_json" : ", NULL as score_breakdown_json",
    schema.hasLastScanned ? ", last_scanned_at_iso" : ", NULL as last_scanned_at_iso",
  ].join("");
  if (opts?.status) {
    const rows = await env.DB.prepare(`SELECT * ${extra} FROM leads WHERE status = ? ORDER BY created_at_iso DESC LIMIT ${limit}`)
      .bind(opts.status)
      .all<any>();
    return (rows.results || []).map(mapLeadRow);
  }
  const rows = await env.DB.prepare(`SELECT * ${extra} FROM leads ORDER BY created_at_iso DESC LIMIT ${limit}`).all<any>();
  return (rows.results || []).map(mapLeadRow);
}

export async function insertDraft(
  env: Env,
  leadId: string,
  subject: string,
  body: string,
  extras?: { followupText?: string; whyJson?: string; status?: DraftStatus; mode?: string }
): Promise<string> {
  const id = uuid();
  const now = nowISO();
  const schema = await loadDraftSchema(env);
  const columns = ["id", "lead_id", "subject", schema.bodyColumn, "created_at_iso", "updated_at_iso"];
  const values: any[] = [id, leadId, subject, body, now, now];
  if (schema.followupColumn) {
    columns.push(schema.followupColumn);
    values.push(extras?.followupText ?? "");
  }
  if (schema.whyJsonColumn) {
    columns.push(schema.whyJsonColumn);
    values.push(extras?.whyJson ?? "[]");
  }
  if (schema.modeColumn) {
    columns.push(schema.modeColumn);
    values.push(extras?.mode ?? "email");
  }
  if (schema.statusColumn) {
    columns.push(schema.statusColumn);
    values.push(extras?.status ?? "queued");
  }
  const placeholders = columns.map(() => "?").join(", ");
  await env.DB.prepare(`INSERT INTO drafts(${columns.join(", ")}) VALUES(${placeholders})`).bind(...values).run();
  return id;
}

export async function updateDraft(env: Env, id: string, patch: Partial<DraftRow>): Promise<void> {
  const schema = await loadDraftSchema(env);
  const row = await env.DB.prepare(`SELECT id, lead_id, subject, ${schema.bodyColumn} as body${schema.followupColumn ? `, ${schema.followupColumn} as followup_text` : ", '' as followup_text"}${schema.whyJsonColumn ? `, ${schema.whyJsonColumn} as why_json` : ", '[]' as why_json"}, status, created_at_iso, updated_at_iso FROM drafts WHERE id = ?`).bind(id).first<any>();
  if (!row) return;
  const cols = [`subject=?`, `${schema.bodyColumn}=?`, `updated_at_iso=?`];
  const vals: any[] = [patch.subject ?? row.subject, patch.body ?? row.body, nowISO()];
  if (schema.followupColumn) {
    cols.push(`${schema.followupColumn}=?`);
    vals.push(patch.followup_text ?? row.followup_text ?? "");
  }
  if (schema.whyJsonColumn) {
    cols.push(`${schema.whyJsonColumn}=?`);
    vals.push(patch.why_json ?? row.why_json ?? "[]");
  }
  if (schema.statusColumn) {
    cols.push(`status=?`);
    vals.push(patch.status ?? row.status);
  }
  vals.push(id);
  await env.DB.prepare(`UPDATE drafts SET ${cols.join(", ")} WHERE id=?`).bind(...vals).run();
}

export async function listDrafts(env: Env, opts?: { status?: DraftStatus | string; limit?: number }): Promise<DraftRow[]> {
  const schema = await loadDraftSchema(env);
  const limit = Math.min(250, Math.max(1, opts?.limit || 50));
  const select = `SELECT id, lead_id, subject, ${schema.bodyColumn} AS body${schema.followupColumn ? `, ${schema.followupColumn} AS followup_text` : ", '' AS followup_text"}${schema.whyJsonColumn ? `, ${schema.whyJsonColumn} AS why_json` : ", '[]' AS why_json"}, status, created_at_iso, updated_at_iso FROM drafts`;
  if (opts?.status) {
    const rows = await env.DB.prepare(`${select} WHERE status = ? ORDER BY created_at_iso DESC LIMIT ${limit}`)
      .bind(opts.status)
      .all<any>();
    return (rows.results || []).map(mapDraftRow);
  }
  const rows = await env.DB.prepare(`${select} ORDER BY created_at_iso DESC LIMIT ${limit}`).all<any>();
  return (rows.results || []).map(mapDraftRow);
}

export async function listApprovedDrafts(env: Env, limit = 50): Promise<Array<DraftRow & { lead: LeadRow }>> {
  const drafts = await listDrafts(env, { status: "approved", limit });
  const out: Array<DraftRow & { lead: LeadRow }> = [];
  for (const draft of drafts) {
    const lead = await getLeadById(env, draft.lead_id);
    if (lead) out.push({ ...draft, lead });
  }
  return out;
}

export async function listEvents(env: Env, limit = 100): Promise<EventRow[]> {
  const rows = await env.DB.prepare(`SELECT id, type, message, lead_id, created_at_iso FROM events ORDER BY created_at_iso DESC LIMIT ${Math.min(500, Math.max(1, limit))}`).all<any>();
  return (rows.results || []) as EventRow[];
}

export async function countToday(env: Env, type: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) as c FROM events WHERE type = ? AND date(created_at_iso) = date('now')`).bind(type).first<any>();
  return Number(row?.c || 0);
}
