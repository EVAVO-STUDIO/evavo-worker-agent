import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import { handleGrowthAdmin } from "../src/routes/growthAdminProtected";

const ADMIN_TOKEN = "test-only-growth-route-shape-admin-token-0000000000000001";

type DatabaseCall = Readonly<{
  sql: string;
  values: readonly unknown[];
  operation: "all" | "first" | "run";
}>;

const ACTION_ROW = Object.freeze({
  id: "action-0001",
  signal_id: "signal-0001",
  channel_id: null,
  action_type: "prepare_internal_review",
  recommended_mode: "observe",
  reason: "Prepare an evidence-backed internal review before any external action.",
  context_evidence: null,
  evavo_fit_explanation: null,
  channel_policy_result: "{}",
  link_policy_result: "{}",
  disclosure_policy_result: "{}",
  cost_estimate: "{}",
  risk_flags: "[]",
  status: "approved",
  approved_by: null,
  approved_at: null,
  executed_at: null,
  blocked_reason: null,
  created_at: "2026-07-26T10:00:00.000Z",
  updated_at: "2026-07-26T10:00:00.000Z",
});

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
              if (/FROM growth_actions WHERE id = \?/i.test(sql)) return ACTION_ROW;
              return null;
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
  options: Readonly<{ method?: "GET" | "POST"; body?: unknown }> = {},
): Request {
  const method = options.method ?? "GET";
  const headers = new Headers({
    authorization: `Bearer ${ADMIN_TOKEN}`,
    accept: "application/json",
  });
  if (options.body !== undefined) headers.set("content-type", "application/json");
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

test("Growth fallback list routes keep their documented default limits", async () => {
  for (const [path, expected] of [
    ["/admin/growth/strategy", 25],
    ["/admin/growth/channels", 50],
    ["/admin/growth/signals", 50],
    ["/admin/growth/actions", 50],
  ] as const) {
    const { db, calls } = fakeDatabase();
    const response = await handleGrowthAdmin(
      request(path),
      environment(db),
      path,
      jsonResponse,
    );
    assert.equal(response.status, 200, path);
    assert.deepEqual(calls[0]?.values, [expected], path);
  }
});

test("malformed list limits fail as input instead of silently becoming one record", async () => {
  const { db, calls } = fakeDatabase();
  const response = await handleGrowthAdmin(
    request("/admin/growth/strategy?limit=invalid"),
    environment(db),
    "/admin/growth/strategy",
    jsonResponse,
  );
  const result = await payload(response);
  assert.equal(response.status, 400);
  assert.equal(result.error, "growth_admin_invalid_request");
  assert.equal(calls.length, 0);
});

test("flat and wrapped fallback inputs cannot be mixed", async () => {
  const { db, calls } = fakeDatabase();
  const response = await handleGrowthAdmin(
    request("/admin/growth/strategy", {
      method: "POST",
      body: {
        confirm: true,
        goal: { title: "Qualified opportunity pipeline" },
        title: "Ambiguous top-level title",
      },
    }),
    environment(db),
    "/admin/growth/strategy",
    jsonResponse,
  );
  const result = await payload(response);
  assert.equal(response.status, 400);
  assert.equal(result.error, "growth_admin_invalid_request");
  assert.equal(calls.length, 0);
});

test("action planning requires one unambiguous signal identifier", async () => {
  for (const [label, body] of [
    ["missing", { confirm: true }],
    [
      "conflicting",
      { confirm: true, id: "signal-0001", signalId: "signal-0002" },
    ],
  ] as const) {
    const { db, calls } = fakeDatabase();
    const response = await handleGrowthAdmin(
      request("/admin/growth/actions/plan", { method: "POST", body }),
      environment(db),
      "/admin/growth/actions/plan",
      jsonResponse,
    );
    const result = await payload(response);
    assert.equal(response.status, 400, label);
    assert.equal(result.error, "growth_admin_invalid_request", label);
    assert.equal(calls.length, 0, label);
  }
});

test("signal and action status updates require explicit statuses", async () => {
  for (const [path, body] of [
    ["/admin/growth/signals/status", { confirm: true, signalId: "signal-0001" }],
    ["/admin/growth/actions/status", { confirm: true, actionId: "action-0001" }],
  ] as const) {
    const { db, calls } = fakeDatabase();
    const response = await handleGrowthAdmin(
      request(path, { method: "POST", body }),
      environment(db),
      path,
      jsonResponse,
    );
    const result = await payload(response);
    assert.equal(response.status, 400, path);
    assert.equal(result.error, "growth_admin_invalid_request", path);
    assert.equal(calls.length, 0, path);
  }
});

test("action status does not persist the safety object as a blocked reason", async () => {
  const { db, calls } = fakeDatabase();
  const response = await handleGrowthAdmin(
    request("/admin/growth/actions/status", {
      method: "POST",
      body: {
        confirm: true,
        actionId: "action-0001",
        status: "approved",
      },
    }),
    environment(db),
    "/admin/growth/actions/status",
    jsonResponse,
  );
  const result = await payload(response);
  assert.equal(response.status, 200);
  assert.equal(result.mode, "growth_action_status_updated");
  assert.deepEqual(result.requestReceipt, {
    contractVersion: "growth_internal_write_request_v1",
    bodySha256Available: true,
    exactBooleanConfirmation: true,
  });
  const update = calls.find((call) => call.operation === "run" && /UPDATE growth_actions/i.test(call.sql));
  assert(update, "action status update must execute");
  assert.equal(update.values[0], "approved");
  assert.equal(update.values[1], null, "blocked reason must remain null when not explicitly supplied");
  assert.notEqual(update.values[1], "[object Object]");
});
