import { Env, nowISO, uuid } from "../db";

export interface GrowthAuditEventInput {
  eventType: string;
  entityType: string;
  entityId?: string | null;
  actor?: string;
  automationMode?: string | null;
  reason?: string | null;
  inputSnapshot?: unknown;
  outputSnapshot?: unknown;
  safetyResult?: unknown;
  budgetResult?: unknown;
}

export interface GrowthAuditEventRow {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  actor: string;
  automation_mode: string | null;
  reason: string | null;
  input_snapshot: string;
  output_snapshot: string;
  safety_result: string;
  budget_result: string;
  created_at: string;
}

function toJson(value: unknown): string {
  return JSON.stringify(value ?? {});
}

export async function logGrowthAuditEvent(env: Env, input: GrowthAuditEventInput): Promise<GrowthAuditEventRow> {
  const id = uuid();
  const createdAt = nowISO();
  await env.DB.prepare(
    `INSERT INTO growth_audit_events (
       id, event_type, entity_type, entity_id, actor, automation_mode, reason,
       input_snapshot, output_snapshot, safety_result, budget_result, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id,
    input.eventType,
    input.entityType,
    input.entityId ?? null,
    input.actor || "system",
    input.automationMode ?? null,
    input.reason ?? null,
    toJson(input.inputSnapshot),
    toJson(input.outputSnapshot),
    toJson(input.safetyResult),
    toJson(input.budgetResult),
    createdAt
  ).run();

  const row = await env.DB.prepare(
    `SELECT id, event_type, entity_type, entity_id, actor, automation_mode, reason,
            input_snapshot, output_snapshot, safety_result, budget_result, created_at
     FROM growth_audit_events WHERE id = ? LIMIT 1`
  ).bind(id).first<GrowthAuditEventRow>();

  if (!row) throw new Error("growth_audit_event_create_failed");
  return row;
}

export async function listGrowthAuditEvents(env: Env, limit = 50, entityType?: string): Promise<GrowthAuditEventRow[]> {
  const safeLimit = Math.min(200, Math.max(1, Math.round(Number(limit) || 50)));
  const where = entityType ? "WHERE entity_type = ?" : "";
  const stmt = env.DB.prepare(
    `SELECT id, event_type, entity_type, entity_id, actor, automation_mode, reason,
            input_snapshot, output_snapshot, safety_result, budget_result, created_at
     FROM growth_audit_events
     ${where}
     ORDER BY created_at DESC
     LIMIT ?`
  );
  const result = entityType
    ? await stmt.bind(entityType, safeLimit).all<GrowthAuditEventRow>()
    : await stmt.bind(safeLimit).all<GrowthAuditEventRow>();
  return result.results || [];
}
