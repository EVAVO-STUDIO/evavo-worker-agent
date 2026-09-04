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
  ADMIN_TOKEN?: string;
  CAP_CRAWL_PER_DAY?: string;
  BRAIN_BASE_URL?: string;
  BRAIN_API_TOKEN?: string;
  BRAIN_RELATIONSHIP_MEMORY_WRITE_TOKEN?: string;
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
  return env.ADMIN_TOKEN;
}

export function parseLeadSignals(row: Pick<LeadRow, "signals_json"> | { signals_json?: string | null }): LeadSignals {
  return safeJsonParse<LeadSignals>(row.signals_json || null) || {};
}
