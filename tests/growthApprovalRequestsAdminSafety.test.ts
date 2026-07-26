import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import { handleGrowthApprovalRequestsAdmin } from "../src/routes/growthApprovalRequestsAdmin";

const ADMIN_TOKEN = "test-only-growth-approval-admin-token-000000000000000000000001";
const SECRET_DATABASE_ERROR = "approval-database-secret-must-not-reach-response";

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function request(
  path: string,
  body: unknown,
  options: Readonly<{
    token?: string;
    contentType?: string;
  }> = {},
): Request {
  return new Request(`https://worker.example${path}`, {
    method: "POST",
    headers: {
      authorization: options.token ? `Bearer ${options.token}` : "",
      "content-type": options.contentType ?? "application/json",
    },
    body: JSON.stringify(body),
  });
}

function environment(): { env: Env; databaseTouched: () => boolean } {
  let touched = false;
  const env = {
    ADMIN_TOKEN,
    DB: {
      prepare() {
        touched = true;
        throw new Error(SECRET_DATABASE_ERROR);
      },
    },
  } as unknown as Env;
  return { env, databaseTouched: () => touched };
}

async function payload(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

test("Growth approval writes authenticate before parsing or persistence", async () => {
  const { env, databaseTouched } = environment();
  const response = await handleGrowthApprovalRequestsAdmin(
    request("/admin/growth/approval-requests", { confirm: true, step: "review" }),
    env,
    "/admin/growth/approval-requests",
    json,
  );
  assert.equal(response.status, 401);
  assert.equal(databaseTouched(), false);
});

test("query and coerced confirmation cannot authorize approval writes", async () => {
  for (const body of [
    { step: "review" },
    { confirm: 1, step: "review" },
    { confirm: "true", step: "review" },
  ]) {
    const { env, databaseTouched } = environment();
    const response = await handleGrowthApprovalRequestsAdmin(
      request("/admin/growth/approval-requests?confirm=1", body, { token: ADMIN_TOKEN }),
      env,
      "/admin/growth/approval-requests",
      json,
    );
    const result = await payload(response);
    assert.equal(response.status, 400);
    assert.equal(result.error, "confirm_required");
    assert.deepEqual(result.requiredPayload, { confirm: true });
    assert.equal(result.confirmationCoercionAllowed, false);
    assert.equal(databaseTouched(), false);
  }
});

test("unknown and credential-shaped approval fields fail before persistence", async () => {
  for (const body of [
    { confirm: true, step: "review", unexpected: true },
    { confirm: true, approvalPack: { step: "review", accessToken: "must-not-store" } },
    { confirm: true, approvalPack: { step: "review", payloadHint: { oauthSecret: "must-not-store" } } },
  ]) {
    const { env, databaseTouched } = environment();
    const response = await handleGrowthApprovalRequestsAdmin(
      request("/admin/growth/approval-requests", body, { token: ADMIN_TOKEN }),
      env,
      "/admin/growth/approval-requests",
      json,
    );
    const result = await payload(response);
    assert.equal(response.status, 400);
    assert.equal(databaseTouched(), false);
    assert(!JSON.stringify(result).includes("must-not-store"));
  }
});

test("non-JSON approval writes use the shared bounded request contract", async () => {
  const { env, databaseTouched } = environment();
  const response = await handleGrowthApprovalRequestsAdmin(
    request(
      "/admin/growth/approval-requests",
      { confirm: true, step: "review" },
      { token: ADMIN_TOKEN, contentType: "text/plain" },
    ),
    env,
    "/admin/growth/approval-requests",
    json,
  );
  const result = await payload(response);
  assert.equal(response.status, 415);
  assert.equal(result.error, "json_content_type_required");
  assert.equal(databaseTouched(), false);
});

test("invalid status and unknown status fields fail before persistence", async () => {
  for (const body of [
    { confirm: true, id: "approval-0001", status: "sent" },
    { confirm: true, id: "approval-0001", status: "approved", extra: true },
    { confirm: true, status: "approved" },
  ]) {
    const { env, databaseTouched } = environment();
    const response = await handleGrowthApprovalRequestsAdmin(
      request("/admin/growth/approval-requests/status", body, { token: ADMIN_TOKEN }),
      env,
      "/admin/growth/approval-requests/status",
      json,
    );
    assert.equal(response.status, 400);
    assert.equal(databaseTouched(), false);
    assert.equal((await payload(response)).error, "growth_approval_request_invalid");
  }
});

test("database failures expose finite diagnostics without raw approval payloads", async () => {
  const { env, databaseTouched } = environment();
  const response = await handleGrowthApprovalRequestsAdmin(
    request(
      "/admin/growth/approval-requests",
      {
        confirm: true,
        approvalPack: {
          step: "review_candidate",
          route: "/admin/growth/actions",
          payloadHint: { summary: "bounded internal hint" },
          reviewChecklist: ["Verify evidence."],
        },
      },
      { token: ADMIN_TOKEN },
    ),
    env,
    "/admin/growth/approval-requests",
    json,
  );
  const result = await payload(response);
  const text = JSON.stringify(result);
  assert.equal(response.status, 500);
  assert.equal(databaseTouched(), true);
  assert.equal(result.error, "growth_approval_requests_failed");
  assert.equal(result.rawErrorExposed, false);
  assert(!text.includes(SECRET_DATABASE_ERROR));
  assert(!text.includes("bounded internal hint"));
  assert(!text.includes("bodySha256"));
  const safety = result.safety as Record<string, unknown>;
  assert.equal(safety.approvalPayloadExposed, false);
  assert.equal(safety.decisionNoteExposed, false);
  assert.equal(safety.externalStateChange, false);
});
