import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import { handleBusinessAutopilotPeopleAdmin } from "../src/routes/businessAutopilotPeopleAdmin";

const ADMIN_TOKEN =
  "test-only-business-people-admin-token-000000000000000000000001";
const DATABASE_SECRET = "business-people-database-secret-must-not-leak";

function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function request(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  options: Readonly<{
    token?: string;
    contentType?: string;
  }> = {},
): Request {
  const init: RequestInit = {
    method,
    headers: {
      authorization: options.token ? `Bearer ${options.token}` : "",
      ...(method === "POST"
        ? { "content-type": options.contentType ?? "application/json" }
        : {}),
    },
  };
  if (method === "POST") init.body = JSON.stringify(body);
  return new Request(`https://worker.example${path}`, init);
}

function environment(options: Readonly<{ fail?: boolean }> = {}): {
  env: Env;
  touched: () => number;
  boundValues: () => readonly unknown[];
} {
  let touches = 0;
  let values: unknown[] = [];
  const env = {
    ADMIN_TOKEN,
    DB: {
      prepare() {
        touches += 1;
        if (options.fail) throw new Error(DATABASE_SECRET);
        return {
          bind(...nextValues: unknown[]) {
            values = nextValues;
            return {
              async all() {
                return { results: [] };
              },
              async run() {
                return { success: true };
              },
            };
          },
        };
      },
    },
  } as unknown as Env;
  return {
    env,
    touched: () => touches,
    boundValues: () => values,
  };
}

async function payload(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

test("Business people routes authenticate before reads or body processing", async () => {
  for (const [method, body] of [
    ["GET", undefined],
    ["POST", { confirm: true, person: { name: "Private input" } }],
  ] as const) {
    const { env, touched } = environment();
    const response = await handleBusinessAutopilotPeopleAdmin(
      request(method, "/admin/business/people", body),
      env,
      "/admin/business/people",
      json,
    );
    assert.equal(response.status, 401, method);
    assert.equal(touched(), 0, method);
  }
});

test("Business people reads keep the documented default and reject ambiguous queries", async () => {
  const { env, boundValues } = environment();
  const response = await handleBusinessAutopilotPeopleAdmin(
    request("GET", "/admin/business/people", undefined, { token: ADMIN_TOKEN }),
    env,
    "/admin/business/people",
    json,
  );
  assert.equal(response.status, 200);
  assert.equal(boundValues().at(-1), 25);

  for (const path of [
    "/admin/business/people?limit=0",
    "/admin/business/people?limit=25&limit=50",
    "/admin/business/people?unexpected=1",
  ]) {
    const fixture = environment();
    const rejected = await handleBusinessAutopilotPeopleAdmin(
      request("GET", path, undefined, { token: ADMIN_TOKEN }),
      fixture.env,
      "/admin/business/people",
      json,
    );
    assert.equal(rejected.status, 400, path);
    assert.equal(fixture.touched(), 0, path);
  }
});

test("query and coerced confirmation cannot authorize Business people writes", async () => {
  for (const fixture of [
    {
      path: "/admin/business/people?confirm=1",
      body: { person: { name: "Query confirmation" } },
      error: "query_not_supported",
    },
    {
      path: "/admin/business/people",
      body: { confirm: 1, person: { name: "Numeric confirmation" } },
      error: "confirm_required",
    },
    {
      path: "/admin/business/people",
      body: { confirm: "1", person: { name: "String confirmation" } },
      error: "confirm_required",
    },
  ] as const) {
    const { env, touched } = environment();
    const response = await handleBusinessAutopilotPeopleAdmin(
      request("POST", fixture.path, fixture.body, { token: ADMIN_TOKEN }),
      env,
      "/admin/business/people",
      json,
    );
    const result = await payload(response);
    assert.equal(response.status, 400, fixture.path);
    assert.equal(result.error, fixture.error, fixture.path);
    assert.equal(touched(), 0, fixture.path);
    assert.equal(JSON.stringify(result).includes("Query confirmation"), false);
  }
});

test("Business people writes use bounded JSON and exact reviewed fields", async () => {
  for (const fixture of [
    {
      body: { confirm: true, name: "Flat body is ambiguous" },
      contentType: "application/json",
    },
    {
      body: { confirm: true, person: { name: "Unknown field", unexpected: true } },
      contentType: "application/json",
    },
    {
      body: {
        confirm: true,
        person: { name: "Sensitive metadata", metadata: { accessToken: "must-not-store" } },
      },
      contentType: "application/json",
    },
    {
      body: { confirm: true, person: { name: "Wrong media type" } },
      contentType: "text/plain",
    },
  ]) {
    const { env, touched } = environment();
    const response = await handleBusinessAutopilotPeopleAdmin(
      request("POST", "/admin/business/people", fixture.body, {
        token: ADMIN_TOKEN,
        contentType: fixture.contentType,
      }),
      env,
      "/admin/business/people",
      json,
    );
    const result = await payload(response);
    assert.equal(response.status >= 400, true);
    assert.equal(touched(), 0);
    assert.equal(JSON.stringify(result).includes("must-not-store"), false);
  }
});

test("valid Business people writes persist once and return only reduced contact posture", async () => {
  const { env, touched } = environment();
  const rawEmail = "reviewed.person@example.com";
  const response = await handleBusinessAutopilotPeopleAdmin(
    request(
      "POST",
      "/admin/business/people",
      {
        confirm: true,
        person: {
          id: "person-0001",
          organizationId: "organization-0001",
          name: "Reviewed Person",
          role: "Digital lead",
          email: rawEmail,
          phone: "+61 400 000 000",
          profileUrl: "https://example.com/profile",
          sourceType: "operator",
          sourceUrl: "https://example.com/about",
          allowedUse: "review_only",
          contactStatus: "new",
          confidenceScore: 70,
          metadata: { note: "internal context" },
        },
      },
      { token: ADMIN_TOKEN },
    ),
    env,
    "/admin/business/people",
    json,
  );
  const result = await payload(response);
  const text = JSON.stringify(result);
  assert.equal(response.status, 200);
  assert.equal(touched(), 1);
  assert.equal(result.exactBooleanConfirmation, true);
  assert.equal(result.confirmationCoercionAllowed, false);
  assert.equal(result.queryConfirmationAllowed, false);
  assert.equal(text.includes(rawEmail), false);
  assert.equal(text.includes("internal context"), false);
  assert.equal(text.includes("bodySha256"), false);

  const person = result.person as Record<string, unknown>;
  assert.equal(person.email, null);
  assert.equal(person.phone, null);
  assert.equal(person.profileUrl, null);
  assert.equal(person.sourceUrl, null);
  assert.deepEqual(person.metadata, {});
  assert.equal(person.emailPresent, true);
  assert.equal(person.internalReviewOnly, true);
  assert.equal(person.executable, false);
});

test("Business people database failures are finite and never expose raw input or errors", async () => {
  const { env, touched } = environment({ fail: true });
  const response = await handleBusinessAutopilotPeopleAdmin(
    request(
      "POST",
      "/admin/business/people",
      { confirm: true, person: { name: "Failure fixture" } },
      { token: ADMIN_TOKEN },
    ),
    env,
    "/admin/business/people",
    json,
  );
  const result = await payload(response);
  const text = JSON.stringify(result);
  assert.equal(response.status, 503);
  assert.equal(touched(), 1);
  assert.equal(result.error, "business_people_failed");
  assert.equal(result.rawErrorExposed, false);
  assert.equal(text.includes(DATABASE_SECRET), false);
  assert.equal(text.includes("Failure fixture"), false);
});
