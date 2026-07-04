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
    record.contentHash,
    stringify(record.metadata),
    now,
    now,
  ).run();
  return { ...record, createdAt: now, updatedAt: now };
}
