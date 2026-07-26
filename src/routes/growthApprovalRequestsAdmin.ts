import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import {
  listGrowthApprovalRequestSummaries,
  saveGrowthApprovalRequest,
  toGrowthApprovalRequestSummary,
  updateGrowthApprovalRequestStatus,
  type GrowthApprovalStatus,
} from "../core/growthApprovalRequests";
import {
  growthInternalWriteFailurePayload,
  readGrowthInternalWriteRequest,
} from "../core/growthInternalWriteRequest";

export type JsonResponse = (data: any, init?: ResponseInit) => Response;

type UnknownRecord = Record<string, unknown>;

const READ_SAFETY = Object.freeze({
  readOnly: true,
  internalMetadataOnly: true,
  externalStateChange: false,
  callsAI: false,
  callsNetwork: false,
  canSendEmail: false,
  canPostSocial: false,
  canSubmitForms: false,
  approvalPayloadExposed: false,
  decisionNoteExposed: false,
});
const WRITE_SAFETY = Object.freeze({
  ...READ_SAFETY,
  readOnly: false,
  boundedJsonRequired: true,
  exactBooleanConfirmationRequired: true,
  confirmationCoercionAllowed: false,
  sensitiveInputKeysAllowed: false,
});
const CREATE_TOP_LEVEL_KEYS = new Set([
  "approvalPack",
  "pack",
  "id",
  "source",
  "step",
  "route",
  "method",
  "requiresConfirm",
  "dashboardAnchor",
  "setupGap",
  "targetCampaignId",
  "targetCampaignName",
  "payloadHint",
  "payload",
  "reviewChecklist",
  "explicitBlocks",
  "auditReason",
  "safety",
]);
const CREATE_PACK_KEYS = new Set([
  "id",
  "source",
  "step",
  "title",
  "route",
  "method",
  "requiresConfirm",
  "dashboardAnchor",
  "setupGap",
  "targetCampaignId",
  "targetCampaignName",
  "payloadHint",
  "payload",
  "reviewChecklist",
  "explicitBlocks",
  "auditReason",
  "safety",
]);
const STATUS_KEYS = new Set([
  "id",
  "requestId",
  "status",
  "reviewer",
  "decisionNote",
  "reason",
]);
const APPROVAL_STATUSES = new Set<GrowthApprovalStatus>([
  "pending",
  "approved",
  "rejected",
  "archived",
]);

function intParam(url: URL, key: string, fallback: number, min: number, max: number): number {
  const value = Number(url.searchParams.get(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function recordValue(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as UnknownRecord;
}

function exactKeys(record: UnknownRecord, allowed: ReadonlySet<string>, code: string): void {
  const unknown = Object.keys(record).filter((key) => !allowed.has(key));
  if (unknown.length) throw new Error(code);
}

function boundedRequiredText(value: unknown, code: string, maximum = 128): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !value ||
    value.length > maximum ||
    /\p{Cc}/u.test(value)
  ) throw new Error(code);
  return value;
}

function boundedOptionalText(value: unknown, code: string, maximum: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return boundedRequiredText(value, code, maximum);
}

function requiredTextFrom(
  primary: unknown,
  fallback: unknown,
  defaultValue: string,
  code: string,
  maximum: number,
): string {
  return boundedRequiredText(primary ?? fallback ?? defaultValue, code, maximum);
}

function optionalTextFrom(
  primary: unknown,
  fallback: unknown,
  code: string,
  maximum: number,
): string | null | undefined {
  const value = primary ?? fallback;
  if (value === null) return null;
  return boundedOptionalText(value, code, maximum);
}

function stringArrayFrom(
  primary: unknown,
  fallback: unknown,
  code: string,
): string[] {
  const value = primary ?? fallback;
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(code);
  }
  return [...value];
}

function migrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const missingTable = /no such table: growth_approval_requests/i.test(message);
  const inputFailure = message.startsWith("GROWTH_APPROVAL_") ||
    message.startsWith("growth_approval_request_");
  return {
    ok: false,
    mode: "growth_approval_requests_error",
    error: missingTable
      ? "growth_approval_requests_schema_missing"
      : inputFailure
        ? "growth_approval_request_invalid"
        : "growth_approval_requests_failed",
    requiredMigration: missingTable ? "0019_growth_approval_requests.sql" : null,
    rawErrorExposed: false,
    safety: READ_SAFETY,
  };
}

async function confirmedBody(request: Request, json: JsonResponse) {
  const parsed = await readGrowthInternalWriteRequest(request);
  if (parsed.ok) return parsed;
  return {
    ...parsed,
    response: json({
      ...growthInternalWriteFailurePayload(parsed),
      safety: WRITE_SAFETY,
    }, { status: parsed.status }),
  } as const;
}

export async function handleGrowthApprovalRequestsAdmin(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse,
): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (request.method === "OPTIONS") {
    return json(
      { ok: false, error: "method_not_allowed" },
      { status: 405, headers: { allow: "GET, POST" } },
    );
  }
  const url = new URL(request.url);

  try {
    if (request.method === "GET" && pathname === "/admin/growth/approval-requests") {
      const requests = await listGrowthApprovalRequestSummaries(
        env,
        intParam(url, "limit", 25, 1, 100),
        url.searchParams.get("status") || undefined,
      );
      return json({
        ok: true,
        mode: "growth_approval_requests",
        requests,
        count: requests.length,
        approvalPayloadExposed: false,
        decisionNoteExposed: false,
        safety: READ_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/approval-requests") {
      const parsed = await confirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const body = recordValue(parsed.body, "GROWTH_APPROVAL_BODY_INVALID");
      exactKeys(body, CREATE_TOP_LEVEL_KEYS, "GROWTH_APPROVAL_KEYS_INVALID");
      const pack = recordValue(
        body.approvalPack ?? body.pack ?? body,
        "GROWTH_APPROVAL_PACK_INVALID",
      );
      exactKeys(pack, CREATE_PACK_KEYS, "GROWTH_APPROVAL_PACK_KEYS_INVALID");

      const saved = await saveGrowthApprovalRequest(env, {
        source: requiredTextFrom(
          pack.source,
          body.source,
          "growth_operator",
          "GROWTH_APPROVAL_SOURCE_INVALID",
          128,
        ),
        step: requiredTextFrom(
          pack.step ?? pack.title,
          body.step,
          "unknown_step",
          "GROWTH_APPROVAL_STEP_INVALID",
          128,
        ),
        route: requiredTextFrom(
          pack.route,
          body.route,
          "/admin/growth/unknown",
          "GROWTH_APPROVAL_ROUTE_INVALID",
          512,
        ),
        method: requiredTextFrom(
          pack.method,
          body.method,
          "POST",
          "GROWTH_APPROVAL_METHOD_INVALID",
          16,
        ),
        requiresConfirm: true,
        dashboardAnchor: optionalTextFrom(
          pack.dashboardAnchor,
          body.dashboardAnchor,
          "GROWTH_APPROVAL_DASHBOARD_ANCHOR_INVALID",
          256,
        ),
        setupGap: optionalTextFrom(
          pack.setupGap,
          body.setupGap,
          "GROWTH_APPROVAL_SETUP_GAP_INVALID",
          1_000,
        ),
        targetCampaignId: optionalTextFrom(
          pack.targetCampaignId,
          body.targetCampaignId,
          "GROWTH_APPROVAL_CAMPAIGN_ID_INVALID",
          128,
        ),
        targetCampaignName: optionalTextFrom(
          pack.targetCampaignName,
          body.targetCampaignName,
          "GROWTH_APPROVAL_CAMPAIGN_NAME_INVALID",
          256,
        ),
        payloadHint: recordValue(
          pack.payloadHint ?? pack.payload ?? body.payloadHint ?? body.payload ?? {},
          "GROWTH_APPROVAL_PAYLOAD_INVALID",
        ),
        reviewChecklist: stringArrayFrom(
          pack.reviewChecklist,
          body.reviewChecklist,
          "GROWTH_APPROVAL_CHECKLIST_INVALID",
        ),
        explicitBlocks: stringArrayFrom(
          pack.explicitBlocks,
          body.explicitBlocks,
          "GROWTH_APPROVAL_BLOCKS_INVALID",
        ),
        auditReason: stringArrayFrom(
          pack.auditReason,
          body.auditReason,
          "GROWTH_APPROVAL_AUDIT_REASON_INVALID",
        ),
        safety: null,
      }, boundedOptionalText(body.id ?? pack.id, "GROWTH_APPROVAL_ID_INVALID", 128));

      return json({
        ok: true,
        mode: "growth_approval_request_saved",
        request: toGrowthApprovalRequestSummary(saved),
        requestReceipt: Object.freeze({
          contractVersion: parsed.contractVersion,
          bodySha256Available: true,
          exactBooleanConfirmation: true,
        }),
        approvalPayloadExposed: false,
        decisionNoteExposed: false,
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/approval-requests/status") {
      const parsed = await confirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const body = recordValue(parsed.body, "GROWTH_APPROVAL_STATUS_BODY_INVALID");
      exactKeys(body, STATUS_KEYS, "GROWTH_APPROVAL_STATUS_KEYS_INVALID");
      const id = boundedRequiredText(
        body.id ?? body.requestId,
        "GROWTH_APPROVAL_ID_INVALID",
        128,
      );
      const status = boundedRequiredText(
        body.status ?? "pending",
        "GROWTH_APPROVAL_STATUS_INVALID",
        32,
      ).toLowerCase() as GrowthApprovalStatus;
      if (!APPROVAL_STATUSES.has(status)) throw new Error("GROWTH_APPROVAL_STATUS_INVALID");
      const reviewer = boundedOptionalText(body.reviewer, "GROWTH_APPROVAL_REVIEWER_INVALID", 128);
      const decisionNote = boundedOptionalText(
        body.decisionNote ?? body.reason,
        "GROWTH_APPROVAL_DECISION_NOTE_INVALID",
        2_000,
      );
      const saved = await updateGrowthApprovalRequestStatus(
        env,
        id,
        status,
        reviewer,
        decisionNote,
      );
      return json({
        ok: true,
        mode: "growth_approval_request_status_updated",
        request: toGrowthApprovalRequestSummary(saved),
        requestReceipt: Object.freeze({
          contractVersion: parsed.contractVersion,
          bodySha256Available: true,
          exactBooleanConfirmation: true,
        }),
        approvalPayloadExposed: false,
        decisionNoteExposed: false,
        safety: WRITE_SAFETY,
      });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    return json(migrationError(error), {
      status: error instanceof Error && (
        error.message.startsWith("GROWTH_APPROVAL_") ||
        error.message.startsWith("growth_approval_request_")
      ) ? 400 : 500,
    });
  }
}
