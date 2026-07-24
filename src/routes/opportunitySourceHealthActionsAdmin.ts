import type { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { boundedJsonFailurePayload, isExplicitJsonConfirmation, readBoundedJsonObject } from "../core/boundedJsonRequest";
import { acquireManualResearchLease, manualResearchLeaseConflict, releaseManualResearchLease } from "../core/manualResearchLease";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

type SourceHealthAction = "pause" | "activate" | "lower_priority" | "raise_priority" | "reset_error";
type SourceHealthActionBody = Record<string, unknown> & {
  confirm?: unknown;
  action?: unknown;
  amount?: unknown;
  reason?: unknown;
};

type SourceHealthSnapshot = {
  status: string;
  priority: number;
  lastError: string | null;
};

const SOURCE_HEALTH_ACTION_CONTRACT = "opportunity_source_health_action_v2_review_only";
const SOURCE_HEALTH_ACTIONS: readonly SourceHealthAction[] = Object.freeze([
  "pause",
  "activate",
  "lower_priority",
  "raise_priority",
  "reset_error",
]);

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

function parseSourceId(pathname: string): string | null {
  const match = pathname.match(/^\/admin\/opportunities\/sources\/([^/]+)\/health-action$/);
  if (!match?.[1]) return null;
  const sourceId = decodeURIComponent(match[1]);
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(sourceId)) return null;
  return sourceId;
}

function boundedPriority(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(0, Math.min(100, Math.round(fallback)));
  return Math.max(0, Math.min(100, Math.round(parsed)));
}

function boundedPriorityDelta(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 10;
  return Math.max(1, Math.min(100, Math.round(parsed)));
}

function boundedReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\s+/g, " ").slice(0, 240);
  return normalized || null;
}

function normalizeAction(value: unknown): SourceHealthAction | null {
  return SOURCE_HEALTH_ACTIONS.includes(value as SourceHealthAction) ? value as SourceHealthAction : null;
}

async function getSource(env: Env, sourceId: string) {
  return env.DB.prepare(
    `SELECT id, url, label, source_type, status, priority, success_count, failure_count, last_error
     FROM opportunity_sources
     WHERE id = ?
     LIMIT 1`
  ).bind(sourceId).first<any>();
}

function snapshot(source: any): SourceHealthSnapshot {
  return {
    status: String(source?.status || "unknown"),
    priority: boundedPriority(source?.priority, 0),
    lastError: typeof source?.last_error === "string" ? source.last_error : null,
  };
}

function mutationForAction(
  env: Env,
  sourceId: string,
  action: SourceHealthAction,
  source: any,
  now: string,
  body: SourceHealthActionBody,
): { statement: D1PreparedStatement; after: SourceHealthSnapshot; message: string } {
  const before = snapshot(source);
  const after = { ...before };

  if (action === "pause") {
    after.status = "paused";
    return {
      statement: env.DB.prepare("UPDATE opportunity_sources SET status = ?, updated_at_iso = ? WHERE id = ?").bind(after.status, now, sourceId),
      after,
      message: "Paused opportunity source for internal review.",
    };
  }

  if (action === "activate") {
    after.status = "active";
    return {
      statement: env.DB.prepare("UPDATE opportunity_sources SET status = ?, cooldown_until_iso = NULL, updated_at_iso = ? WHERE id = ?").bind(after.status, now, sourceId),
      after,
      message: "Activated opportunity source for future confirmed manual research.",
    };
  }

  if (action === "lower_priority") {
    const amount = boundedPriorityDelta(body.amount);
    after.priority = boundedPriority(before.priority - amount, 0);
    return {
      statement: env.DB.prepare("UPDATE opportunity_sources SET priority = ?, updated_at_iso = ? WHERE id = ?").bind(after.priority, now, sourceId),
      after,
      message: `Lowered opportunity source priority by ${amount}.`,
    };
  }

  if (action === "raise_priority") {
    const amount = boundedPriorityDelta(body.amount);
    after.priority = boundedPriority(before.priority + amount, 100);
    return {
      statement: env.DB.prepare("UPDATE opportunity_sources SET priority = ?, updated_at_iso = ? WHERE id = ?").bind(after.priority, now, sourceId),
      after,
      message: `Raised opportunity source priority by ${amount}.`,
    };
  }

  after.lastError = null;
  return {
    statement: env.DB.prepare("UPDATE opportunity_sources SET last_error = NULL, cooldown_until_iso = NULL, updated_at_iso = ? WHERE id = ?").bind(now, sourceId),
    after,
    message: "Reset opportunity source error metadata.",
  };
}

export async function handleOpportunitySourceHealthActionsAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
  }
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });

  const sourceId = parseSourceId(pathname);
  if (!sourceId) return json({ ok: false, error: "invalid_source_health_action_path" }, { status: 404 });

  const parsed = await readBoundedJsonObject<SourceHealthActionBody>(request, {
    maxBytes: 4_096,
    maxDepth: 4,
    maxNodes: 32,
    maxArrayLength: 4,
    maxStringLength: 512,
    maxKeyLength: 64,
  });
  if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status });
  if (!isExplicitJsonConfirmation(parsed.value)) {
    return json({
      ok: false,
      error: "confirm_required",
      requiredPayload: { confirm: true },
      confirmationCoercionAllowed: false,
      requestBodyContract: parsed.contract,
    }, { status: 400 });
  }

  const action = normalizeAction(parsed.value.action);
  if (!action) {
    return json({
      ok: false,
      error: "invalid_action",
      allowedActions: SOURCE_HEALTH_ACTIONS,
      requestBodyContract: parsed.contract,
    }, { status: 400 });
  }

  const requestReceipt = {
    contract: parsed.contract,
    bytes: parsed.bytes,
    bodySha256: parsed.bodySha256,
  };

  if (!(await tableExists(env, "opportunity_sources"))) {
    return json({
      ok: false,
      error: "missing_migration",
      missing: "opportunity_sources",
      requiredMigration: "0004_opportunity_intelligence.sql",
      requestReceipt,
    }, { status: 503 });
  }

  const actionKey = `opportunity-source:${sourceId}`;
  const lease = await acquireManualResearchLease(env, actionKey, 600);
  if (!lease) return json({ ...manualResearchLeaseConflict(actionKey), requestReceipt }, { status: 409 });

  try {
    const source = await getSource(env, sourceId);
    if (!source?.id) return json({ ok: false, error: "source_not_found", requestReceipt }, { status: 404 });

    const now = new Date().toISOString();
    const before = snapshot(source);
    const reason = boundedReason(parsed.value.reason);
    const mutation = mutationForAction(env, sourceId, action, source, now, parsed.value);
    const auditMessage = JSON.stringify({
      contract: SOURCE_HEALTH_ACTION_CONTRACT,
      sourceId,
      action,
      before,
      after: mutation.after,
      reason,
      requestBodySha256: parsed.bodySha256,
      reviewOnly: true,
      executable: false,
      deliverable: false,
      authoritativeForExecution: false,
      externalExecutionAllowed: false,
    });
    const auditInsert = env.DB.prepare(
      `INSERT INTO events (id, type, message, lead_id, created_at_iso)
       VALUES (?, 'opportunity_source_health_action', ?, NULL, ?)`
    ).bind(crypto.randomUUID(), auditMessage, now);

    await env.DB.batch([mutation.statement, auditInsert]);
    const updated = await getSource(env, sourceId);

    return json({
      ok: true,
      mode: "opportunity_source_health_action",
      contract: SOURCE_HEALTH_ACTION_CONTRACT,
      action,
      message: mutation.message,
      source: updated,
      before,
      after: mutation.after,
      requestReceipt,
      leaseContract: lease.contract,
      internalMetadataOnly: true,
      reviewOnly: true,
      executable: false,
      deliverable: false,
      authoritativeForExecution: false,
      externalExecutionAllowed: false,
      safety: {
        writesOnlyD1SourceMetadata: true,
        auditAndSourceUpdateAtomic: true,
        callsNetwork: false,
        callsAI: false,
        sendsEmail: false,
        postsExternally: false,
        requiresConfirm: true,
        exactBooleanConfirmation: true,
        confirmationCoercionAllowed: false,
        overlappingPerSourceActionAllowed: false,
      },
    });
  } catch {
    return json({
      ok: false,
      error: "source_health_action_failed",
      requestReceipt,
      reviewOnly: true,
      executable: false,
      deliverable: false,
      authoritativeForExecution: false,
      externalExecutionAllowed: false,
    }, { status: 500 });
  } finally {
    await releaseManualResearchLease(env, lease).catch(() => false);
  }
}
