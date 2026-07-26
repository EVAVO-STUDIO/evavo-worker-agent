import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import { handleGrowthAdmin } from "../src/routes/growthAdminProtected";

const ADMIN_TOKEN = "test-only-growth-fallback-admin-token-000000000000000000000001";
const SECRET_DATABASE_ERROR = "database-secret-detail-must-not-reach-response";

function json(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
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

test("Growth fallback uses shared authentication before request parsing or persistence", async () => {
  const { env, databaseTouched } = environment();
  const response = await handleGrowthAdmin(
    request("/admin/growth/strategy", { confirm: true, title: "Example goal" }),
    env,
    "/admin/growth/strategy",
    json,
  );
  assert.equal(response.status, 401);
  assert.equal(databaseTouched(), false);
});

test("query confirmation cannot replace exact JSON confirmation", async () => {
  const { env, databaseTouched } = environment();
  const response = await handleGrowthAdmin(
    request("/admin/growth/strategy?confirm=1", { title: "Example goal" }, { token: ADMIN_TOKEN }),
    env,
    "/admin/growth/strategy",
    json,
  );
  const body = await payload(response);
  assert.equal(response.status, 400);
  assert.equal(body.error, "confirm_required");
  assert.deepEqual(body.requiredPayload, { confirm: true });
  assert.equal(body.confirmationCoercionAllowed, false);
  assert.equal(databaseTouched(), false);
});

test("coerced confirmation is rejected before persistence", async () => {
  const { env, databaseTouched } = environment();
  const response = await handleGrowthAdmin(
    request("/admin/growth/strategy", { confirm: 1, title: "Example goal" }, { token: ADMIN_TOKEN }),
    env,
    "/admin/growth/strategy",
    json,
  );
  assert.equal(response.status, 400);
  assert.equal((await payload(response)).error, "confirm_required");
  assert.equal(databaseTouched(), false);
});

test("credential-shaped nested fields are rejected before audit or persistence", async () => {
  const { env, databaseTouched } = environment();
  const response = await handleGrowthAdmin(
    request(
      "/admin/growth/strategy",
      { confirm: true, goal: { title: "Example goal", accessToken: "must-not-store" } },
      { token: ADMIN_TOKEN },
    ),
    env,
    "/admin/growth/strategy",
    json,
  );
  const body = await payload(response);
  assert.equal(response.status, 400);
  assert.equal(body.error, "forbidden_growth_input_key");
  assert.equal(databaseTouched(), false);
  assert(!JSON.stringify(body).includes("must-not-store"));
});

test("non-JSON fallback writes fail through the bounded request contract", async () => {
  const { env, databaseTouched } = environment();
  const response = await handleGrowthAdmin(
    request(
      "/admin/growth/strategy",
      { confirm: true, title: "Example goal" },
      { token: ADMIN_TOKEN, contentType: "text/plain" },
    ),
    env,
    "/admin/growth/strategy",
    json,
  );
  const body = await payload(response);
  assert.equal(response.status, 415);
  assert.equal(body.error, "json_content_type_required");
  assert.equal(databaseTouched(), false);
});

test("unexpected database failures are reduced to finite diagnostics", async () => {
  const { env, databaseTouched } = environment();
  const response = await handleGrowthAdmin(
    request(
      "/admin/growth/strategy",
      { confirm: true, title: "Example goal" },
      { token: ADMIN_TOKEN },
    ),
    env,
    "/admin/growth/strategy",
    json,
  );
  const body = await payload(response);
  const text = JSON.stringify(body);
  assert.equal(response.status, 500);
  assert.equal(databaseTouched(), true);
  assert.equal(body.error, "growth_admin_failed");
  assert.equal(body.diagnosticCode, "growth_admin_failed");
  assert.equal(body.rawErrorExposed, false);
  assert(!text.includes(SECRET_DATABASE_ERROR));
  assert(!text.includes("requestBodySha256"));
  const safety = body.safety as Record<string, unknown>;
  assert.equal(safety.boundedJsonRequired, true);
  assert.equal(safety.exactBooleanConfirmationRequired, true);
  assert.equal(safety.confirmationCoercionAllowed, false);
  assert.equal(safety.sensitiveInputKeysAllowed, false);
  assert.equal(safety.rawErrorsExposed, false);
  assert.equal(safety.externalStateChange, false);
});
