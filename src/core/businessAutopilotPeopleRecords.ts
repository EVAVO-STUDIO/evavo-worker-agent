import { Env, nowISO, safeJsonParse, uuid } from "../db";
import { businessAutopilotMetadataWriteSafety, businessAutopilotReadSafety } from "./businessAutopilotSafety";
import {
  BUSINESS_SCORE_PROVENANCE_CONTRACT,
  readBusinessObservedScore,
} from "./businessScoreProvenance";

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

export type BusinessPersonInput = {
  id?: string;
  organizationId?: string | null;
  name: string;
  role?: string | null;
  email?: string | null;
  phone?: string | null;
  profileUrl?: string | null;
  sourceType?: string | null;
  sourceUrl?: string | null;
  allowedUse?: string | null;
  contactStatus?: string | null;
  confidenceScore?: number | null;
  metadata?: Record<string, unknown>;
};

export function businessPeopleReadPayload<T>(people: T[]) {
  return {
    ok: true,
    people,
    count: people.length,
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    safety: businessAutopilotReadSafety(),
  };
}

export function businessPersonWritePayload<T>(person: T) {
  return {
    ok: true,
    person,
    safety: businessAutopilotMetadataWriteSafety(),
  };
}

export async function listBusinessPeople(env: Env, limit = 25, contactStatus?: string) {
  const params: unknown[] = [];
  let where = "";
  if (contactStatus) {
    where = "WHERE contact_status = ?";
    params.push(sanitizeString(contactStatus, "new", 64));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM business_people ${where} ORDER BY updated_at DESC, created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    organizationId: row.organization_id,
    name: row.name,
    role: row.role,
    email: row.email,
    phone: row.phone,
    profileUrl: row.profile_url,
    sourceType: row.source_type,
    sourceUrl: row.source_url,
    allowedUse: row.allowed_use,
    contactStatus: row.contact_status,
    confidenceScore: readBusinessObservedScore(
      row.confidence_score,
      row.confidence_score_observed,
    ),
    metadata: parse(row.metadata_json, {}),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function saveBusinessPerson(env: Env, input: BusinessPersonInput) {
  const now = nowISO();
  const id = sanitizeString(input.id || uuid(), uuid(), 128);
  const record = {
    id,
    organizationId: nullable(input.organizationId, 128),
    name: sanitizeString(input.name, "Unknown person", 255),
    role: nullable(input.role, 255),
    email: nullable(input.email, 255),
    phone: nullable(input.phone, 64),
    profileUrl: nullable(input.profileUrl, 2048),
    sourceType: sanitizeString(input.sourceType, "operator", 64),
    sourceUrl: nullable(input.sourceUrl, 2048),
    allowedUse: sanitizeString(input.allowedUse, "unknown", 64),
    contactStatus: sanitizeString(input.contactStatus, "new", 64),
    confidenceScore: numberValue(input.confidenceScore),
    metadata: input.metadata || {},
  };
  await env.DB.prepare(`
    INSERT INTO business_people (
      id, organization_id, name, role, email, phone, profile_url, source_type, source_url,
      allowed_use, contact_status, confidence_score, metadata_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      organization_id = excluded.organization_id,
      name = excluded.name,
      role = excluded.role,
      email = excluded.email,
      phone = excluded.phone,
      profile_url = excluded.profile_url,
      source_type = excluded.source_type,
      source_url = excluded.source_url,
      allowed_use = excluded.allowed_use,
      contact_status = excluded.contact_status,
      confidence_score = excluded.confidence_score,
      metadata_json = excluded.metadata_json,
      updated_at = excluded.updated_at
  `).bind(
    id,
    record.organizationId,
    record.name,
    record.role,
    record.email,
    record.phone,
    record.profileUrl,
    record.sourceType,
    record.sourceUrl,
    record.allowedUse,
    record.contactStatus,
    record.confidenceScore,
    stringify(record.metadata),
    now,
    now,
  ).run();
  return { ...record, createdAt: now, updatedAt: now };
}
