import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import { handleGrowthApprovalRequestsAdmin } from "../src/routes/growthApprovalRequestsAdmin";

const ADMIN_TOKEN = "test-only-growth-approval-admin-token-000000000000000001";

const APPROVAL_ROW = Object.freeze({
  id: "approval-0001",
  created_at: "2026-07-26T10:00:00.000Z",
  updated_at: "2026-07-26T10:00:00.000Z",
  status: "pending",
  source: "growth_operator",
  step: "review_campaign",
  route: "/admin/growth/campaigns",
  method: "POST",
  requires_confirm: 1,
  dashboard_anchor: null,
  setup_gap: null,
  target_campaign_id: null,
  target_campaign_name: null,
  payload_json: "{}",
  review_checklist_json: "[]",
  explicit_blocks_json: "[]",
  audit_reason_json: "[]",
  safety_json: "{}",
  reviewer: null,
  decision_note: null,
  reviewed_at: null,
});

type DatabaseCall = Readonly<{
  sql: string;
  values: readonly unknown[];
  operation: "all" | "first" | "run";
}>;

function fakeDatabase(): Readonly<{ db: Env["DB"]; calls: DatabaseCall[] }> {
  const calls: DatabaseCall[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async all() {
              calls.push(Object.freeze({ sql, values: Object.freeze([...values]), operation: "all" as const }));
              return { results: [] };
            },
            async first() {
              calls.push(Object.freeze({ sql, values: Object.freeze([...values]), operation: "first" as const }));
              return APPROVAL_ROW;
            },
            async run() {
              calls.push(Object.freeze({ sql, values: Object.freeze([...values]), operation: "run" as const }));
              return { success: true };
            },
          };
        },
      };
    },
  } as unknown as Env["DB"];
  return { db, calls };
}

function environment(db: Env["DB"]): Env {
  return { DB: db, ADMIN_TOKEN } as Env;
}

function request(
  path: string,
  options: Readonly<{ method?: "GET" | "POST"; body?: unknown; contentType?: string }> = {},
): Request {
  const method = options.method ?? "GET";
  const headers = new Headers({
    authorization: `Bearer ${ADMIN_TOKEN}`,
    accept: "application/json",
  });
  if (options.contentType) headers.set("content-type", options.contentType);
  return new Request(`https://growth-worker.example${path}`, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
}

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function payload(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

test("approval list retains the documented 25-record default", async () => {
  const { db, calls } = fakeDatabase();
  const response = await handleGrowthApprovalRequestsAdmin(
    request("/admin/growth/approval-requests"),
    environment(db),
    "/admin/growth/approval-requests",
    jsonResponse,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(calls[0]?.values, [25]);
});

test("approval query and coerced confirmation fail before D1 access", async () => {
  for (const [label, path, body, expected] of [
    [
      "query-confirmation",
      "/admin/growth/approval-requests?confirm=1",
      {},
      "query_not_supported",
    ],
    [
      "coerced-confirmation",
      "/admin/growth/approval-requests",
      { confirm: "1", step: "review_campaign" },
      "confirm_required",
    ],
  ] as const) {
    const { db, calls } = fakeDatabase();
    const routePath = path.split("?", 1)[0]!;
    const response = await handleGrowthApprovalRequestsAdmin(
      request(path, { method: "POST", body, contentType: "application/json" }),
      environment(db),
      routePath,
      jsonResponse,
    );
    assert.equal(response.status, 400, label);
    assert.equal((await payload(response)).error, expected, label);
    assert.equal(calls.length, 0, label);
  }
});

test("approval wrappers and identifiers cannot be ambiguous", async () => {
  for (const [label, body] of [
    [
      "two-wrappers",
      {
        confirm: true,
        approvalPack: { step: "review_campaign" },
        pack: { step: "other_campaign" },
      },
    ],
    [
      "identifier-conflict",
      {
        confirm: true,
        id: "approval-outer-0001",
        approvalPack: { id: "approval-inner-0002", step: "review_campaign" },
      },
    ],
  ] as const) {
    const { db, calls } = fakeDatabase();
    const response = await handleGrowthApprovalRequestsAdmin(
      request("/admin/growth/approval-requests", {
        method: "POST",
        body,
        contentType: "application/json",
      }),
      environment(db),
      "/admin/growth/approval-requests",
      jsonResponse,
    );
    const result = await payload(response);
    assert.equal(response.status, 400, label);
    assert.equal(result.error, "growth_approval_request_invalid", label);
    assert.equal(result.rawErrorExposed, false, label);
    assert.equal(calls.length, 0, label);
  }
});

test("approval status is required and alias identifiers must agree", async () => {
  for (const [label, body] of [
    ["status-missing", { confirm: true, id: "approval-0001" }],
    [
      "identifier-conflict",
      {
        confirm: true,
        id: "approval-0001",
        requestId: "approval-0002",
        status: "approved",
      },
    ],
  ] as const) {
    const { db, calls } = fakeDatabase();
    const response = await handleGrowthApprovalRequestsAdmin(
      request("/admin/growth/approval-requests/status", {
        method: "POST",
        body,
        contentType: "application/json",
      }),
      environment(db),
      "/admin/growth/approval-requests/status",
      jsonResponse,
    );
    const result = await payload(response);
    assert.equal(response.status, 400, label);
    assert.equal(result.error, "growth_approval_request_invalid", label);
    assert.equal(calls.length, 0, label);
  }
});

test("valid approval creation returns only the reduced summary and receipt", async () => {
  const { db, calls } = fakeDatabase();
  const response = await handleGrowthApprovalRequestsAdmin(
    request("/admin/growth/approval-requests", {
      method: "POST",
      contentType: "application/json",
      body: {
        confirm: true,
        id: "approval-0001",
        approvalPack: {
          step: "review_campaign",
          route: "/admin/growth/campaigns",
          method: "POST",
          reviewChecklist: ["Review evidence"],
        },
      },
    }),
    environment(db),
    "/admin/growth/approval-requests",
    jsonResponse,
  );
  const result = await payload(response);
  assert.equal(response.status, 200);
  assert.equal(result.mode, "growth_approval_request_saved");
  assert.deepEqual(result.requestReceipt, {
    contractVersion: "growth_internal_write_request_v1",
    bodySha256Available: true,
    exactBooleanConfirmation: true,
  });
  assert.equal(result.approvalPayloadExposed, false);
  assert.equal(result.decisionNoteExposed, false);
  assert(!JSON.stringify(result).includes("payload_json"));
  assert.equal(calls.filter((call) => call.operation === "run").length, 1);
  assert.equal(calls.filter((call) => call.operation === "first").length, 1);
});
