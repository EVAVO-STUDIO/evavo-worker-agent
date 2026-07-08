import { Env, nowISO, safeJsonParse, uuid } from "../db";
import { businessAutopilotMetadataWriteSafety, businessAutopilotReadSafety } from "./businessAutopilotSafety";

function stringify(value: unknown) {
  return JSON.stringify(value ?? null);
}

function parse(value: unknown, fallback: unknown) {
  return safeJsonParse(value) ?? fallback;
}

function sanitizeString(value: unknown, fallback: string, max = 512) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function nullable(value: unknown, max = 512) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, max) : null;
}

function safeLimit(limit: number, fallback = 25, max = 100) {
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(max, Math.round(limit)));
}

function numberValue(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function boolNumber(value: unknown) {
  return value ? 1 : 0;
}

export type BusinessWebsiteInput = {
  id?: string;
  organizationId?: string | null;
  url: string;
  domain?: string | null;
  status?: string | null;
  lastCheckedAt?: string | null;
  robotsStatus?: string | null;
  crawlAllowed?: boolean | number | null;
  techHints?: unknown[];
  metadata?: Record<string, unknown>;
};

export type BusinessPageInput = {
  id?: string;
  websiteId?: string | null;
  organizationId?: string | null;
  url: string;
  pageType?: string | null;
  title?: string | null;
  status?: string | null;
  lastFetchedAt?: string | null;
  httpStatus?: number | null;
  contentHash?: string | null;
  metadata?: Record<string, unknown>;
};

export type BusinessWebsiteAuditRunInput = {
  id?: string;
  websiteId?: string | null;
  organizationId?: string | null;
  status?: string | null;
  auditType?: string | null;
  source?: string | null;
  requestedBy?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  readinessScore?: number | null;
  riskScore?: number | null;
  confidenceScore?: number | null;
  summary?: string | null;
  metadata?: Record<string, unknown>;
};

export type BusinessAuditObservationInput = {
  id?: string;
  auditRunId?: string | null;
  websiteId?: string | null;
  organizationId?: string | null;
  pageId?: string | null;
  signalId?: string | null;
  category?: string | null;
  severity?: string | null;
  title: string;
  evidenceSummary?: string | null;
  recommendation?: string | null;
  confidenceScore?: number | null;
  metadata?: Record<string, unknown>;
};

export function businessWebsiteReadPayload<T>(items: T[], key: string) {
  return {
    ok: true,
    [key]: items,
    count: items.length,
    safety: businessAutopilotReadSafety(),
  };
}

export function businessWebsiteWritePayload<T>(record: T, key: string) {
  return {
    ok: true,
    [key]: record,
    safety: businessAutopilotMetadataWriteSafety(),
  };
}

export async function listBusinessWebsites(env: Env, limit = 25, status?: string) {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = "WHERE status = ?";
    params.push(sanitizeString(status, "new", 64));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_websites ${where} ORDER BY updated_at DESC, created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    url: row.url,
    domain: row.domain,
    status: row.status,
    lastCheckedAt: row.last_checked_at,
    robotsStatus: row.robots_status,
    crawlAllowed: Boolean(row.crawl_allowed),
    techHints: parse(row.tech_hints_json, []),
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessWebsite(env: Env, input: BusinessWebsiteInput) {
  const now = nowISO();
  const id = sanitizeString(input.id || uuid(), uuid(), 128);
  const record = {
    id,
    organizationId: nullable(input.organizationId, 128),
    url: sanitizeString(input.url, "https://example.invalid", 2048),
    domain: nullable(input.domain, 255),
    status: sanitizeString(input.status, "new", 64),
    lastCheckedAt: nullable(input.lastCheckedAt, 64),
    robotsStatus: sanitizeString(input.robotsStatus, "unknown", 64),
    crawlAllowed: Boolean(input.crawlAllowed),
    techHints: Array.isArray(input.techHints) ? input.techHints : [],
    metadata: input.metadata || {},
  };
  await env.DB.prepare(`
    INSERT INTO business_websites (
      id, organization_id, url, domain, status, last_checked_at, robots_status, crawl_allowed,
      tech_hints_json, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      organization_id = excluded.organization_id,
      url = excluded.url,
      domain = excluded.domain,
      status = excluded.status,
      last_checked_at = excluded.last_checked_at,
      robots_status = excluded.robots_status,
      crawl_allowed = excluded.crawl_allowed,
      tech_hints_json = excluded.tech_hints_json,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.organizationId,
    record.url,
    record.domain,
    record.status,
    record.lastCheckedAt,
    record.robotsStatus,
    boolNumber(record.crawlAllowed),
    stringify(record.techHints),
    stringify(record.metadata),
    now,
    now,
  ).run();
  return { ...record, createdAt: now, updatedAt: now };
}

export async function listBusinessPages(env: Env, limit = 25, pageType?: string) {
  const params: unknown[] = [];
  let where = "";
  if (pageType) {
    where = "WHERE page_type = ?";
    params.push(sanitizeString(pageType, "unknown", 128));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_pages ${where} ORDER BY updated_at DESC, created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    websiteId: row.website_id,
    organizationId: row.organization_id,
    url: row.url,
    pageType: row.page_type,
    title: row.title,
    status: row.status,
    lastFetchedAt: row.last_fetched_at,
    httpStatus: row.http_status === null || row.http_status === undefined ? null : numberValue(row.http_status),
    contentHash: row.content_hash,
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessPage(env: Env, input: BusinessPageInput) {
  const now = nowISO();
  const id = sanitizeString(input.id || uuid(), uuid(), 128);
  const record = {
    id,
    websiteId: nullable(input.websiteId, 128),
    organizationId: nullable(input.organizationId, 128),
    url: sanitizeString(input.url, "https://example.invalid", 2048),
    pageType: sanitizeString(input.pageType, "unknown", 128),
    title: nullable(input.title, 512),
    status: sanitizeString(input.status, "new", 64),
    lastFetchedAt: nullable(input.lastFetchedAt, 64),
    httpStatus: input.httpStatus === null || input.httpStatus === undefined ? null : numberValue(input.httpStatus),
    contentHash: nullable(input.contentHash, 256),
    metadata: input.metadata || {},
  };
  await env.DB.prepare(`
    INSERT INTO business_pages (
      id, website_id, organization_id, url, page_type, title, status, last_fetched_at,
      http_status, content_hash, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      website_id = excluded.website_id,
      organization_id = excluded.organization_id,
      url = excluded.url,
      page_type = excluded.page_type,
      title = excluded.title,
      status = excluded.status,
      last_fetched_at = excluded.last_fetched_at,
      http_status = excluded.http_status,
      content_hash = excluded.content_hash,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.websiteId,
    record.organizationId,
    record.url,
    record.pageType,
    record.title,
    record.status,
    record.lastFetchedAt,
    record.httpStatus,
    stringify(record.metadata),
    now,
    now,
  ).run();
  return { ...record, createdAt: now, updatedAt: now };
}

export async function listBusinessWebsiteAuditRuns(env: Env, limit = 25, status?: string) {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = "WHERE status = ?";
    params.push(sanitizeString(status, "queued", 64));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_website_audit_runs ${where} ORDER BY updated_at DESC, created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    websiteId: row.website_id,
    organizationId: row.organization_id,
    status: row.status,
    auditType: row.audit_type,
    source: row.source,
    requestedBy: row.requested_by,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    readinessScore: numberValue(row.readiness_score),
    riskScore: numberValue(row.risk_score),
    confidenceScore: numberValue(row.confidence_score),
    summary: row.summary,
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessWebsiteAuditRun(env: Env, input: BusinessWebsiteAuditRunInput) {
  const now = nowISO();
  const id = sanitizeString(input.id || uuid(), uuid(), 128);
  const record = {
    id,
    websiteId: nullable(input.websiteId, 128),
    organizationId: nullable(input.organizationId, 128),
    status: sanitizeString(input.status, "queued", 64),
    auditType: sanitizeString(input.auditType, "website_funnel_audit", 128),
    source: sanitizeString(input.source, "operator", 128),
    requestedBy: nullable(input.requestedBy, 256),
    startedAt: nullable(input.startedAt, 64),
    completedAt: nullable(input.completedAt, 64),
    readinessScore: numberValue(input.readinessScore),
    riskScore: numberValue(input.riskScore),
    confidenceScore: numberValue(input.confidenceScore),
    summary: nullable(input.summary, 2048),
    metadata: input.metadata || {},
  };
  await env.DB.prepare(`
    INSERT INTO business_website_audit_runs (
      id, website_id, organization_id, status, audit_type, source, requested_by, started_at,
      completed_at, readiness_score, risk_score, confidence_score, summary, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      website_id = excluded.website_id,
      organization_id = excluded.organization_id,
      status = excluded.status,
      audit_type = excluded.audit_type,
      source = excluded.source,
      requested_by = excluded.requested_by,
      started_at = excluded.started_at,
      completed_at = excluded.completed_at,
      readiness_score = excluded.readiness_score,
      risk_score = excluded.risk_score,
      confidence_score = excluded.confidence_score,
      summary = excluded.summary,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.websiteId,
    record.organizationId,
    record.status,
    record.auditType,
    record.source,
    record.requestedBy,
    record.startedAt,
    record.completedAt,
    record.readinessScore,
    record.riskScore,
    record.confidenceScore,
    record.summary,
    stringify(record.metadata),
    now,
    now,
  ).run();
  return { ...record, createdAt: now, updatedAt: now };
}

export async function listBusinessAuditObservations(env: Env, limit = 25, category?: string) {
  const params: unknown[] = [];
  let where = "";
  if (category) {
    where = "WHERE category = ?";
    params.push(sanitizeString(category, "general", 128));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_audit_observations ${where} ORDER BY updated_at DESC, created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    auditRunId: row.audit_run_id,
    websiteId: row.website_id,
    organizationId: row.organization_id,
    pageId: row.page_id,
    signalId: row.signal_id,
    category: row.category,
    severity: row.severity,
    title: row.title,
    evidenceSummary: row.evidence_summary,
    recommendation: row.recommendation,
    confidenceScore: numberValue(row.confidence_score),
    metadata: parse(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessAuditObservation(env: Env, input: BusinessAuditObservationInput) {
  const now = nowISO();
  const id = sanitizeString(input.id || uuid(), uuid(), 128);
  const record = {
    id,
    auditRunId: nullable(input.auditRunId, 128),
    websiteId: nullable(input.websiteId, 128),
    organizationId: nullable(input.organizationId, 128),
    pageId: nullable(input.pageId, 128),
    signalId: nullable(input.signalId, 128),
    category: sanitizeString(input.category, "general", 128),
    severity: sanitizeString(input.severity, "info", 64),
    title: sanitizeString(input.title, "Untitled observation", 512),
    evidenceSummary: nullable(input.evidenceSummary, 2048),
    recommendation: nullable(input.recommendation, 2048),
    confidenceScore: numberValue(input.confidenceScore),
    metadata: input.metadata || {},
  };
  await env.DB.prepare(`
    INSERT INTO business_audit_observations (
      id, audit_run_id, website_id, organization_id, page_id, signal_id, category, severity,
      title, evidence_summary, recommendation, confidence_score, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      audit_run_id = excluded.audit_run_id,
      website_id = excluded.website_id,
      organization_id = excluded.organization_id,
      page_id = excluded.page_id,
      signal_id = excluded.signal_id,
      category = excluded.category,
      severity = excluded.severity,
      title = excluded.title,
      evidence_summary = excluded.evidence_summary,
      recommendation = excluded.recommendation,
      confidence_score = excluded.confidence_score,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.auditRunId,
    record.websiteId,
    record.organizationId,
    record.pageId,
    record.signalId,
    record.category,
    record.severity,
    record.title,
    record.evidenceSummary,
    record.recommendation,
    record.confidenceScore,
    stringify(record.metadata),
    now,
    now,
  ).run();
  return { ...record, createdAt: now, updatedAt: now };
}
