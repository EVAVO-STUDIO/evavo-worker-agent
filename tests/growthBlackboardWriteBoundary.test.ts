import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import { handleGrowthBlackboardAdmin } from "../src/routes/growthBlackboardAdmin";

const ADMIN_TOKEN = "test-only-growth-blackboard-admin-token-000000000000001";

type DatabaseCall = Readonly<{
  sql: string;
  values: readonly unknown[];
  operation: "all" | "first" | "run";
}>;

function fakeDatabase(options: Readonly<{
  throwOnAll?: string;
  entityRow?: Readonly<Record<string, unknown>>;
}> = {}): Readonly<{ db: Env["DB"]; calls: DatabaseCall[] }> {
  const calls: DatabaseCall[] = [];
  const db = {
    prepare(sql: string) {
      return {
        bind(...values: unknown[]) {
          return {
            async all() {
              calls.push(Object.freeze({ sql, values: Object.freeze([...values]), operation: "all" as const }));
              if (options.throwOnAll) throw new Error(options.throwOnAll);
              return { results: [] };
            },
            async first() {
              calls.push(Object.freeze({ sql, values: Object.freeze([...values]), operation: "first" as const }));
              if (/SELECT \* FROM growth_entities/i.test(sql)) return options.entityRow ?? null;
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

test("blackboard list routes retain their documented 50-record default", async () => {
  for (const path of [
    "/admin/growth/blackboard/facts",
    "/admin/growth/blackboard/entities",
    "/admin/growth/blackboard/relationships",
    "/admin/growth/blackboard/signals",
    "/admin/growth/blackboard/assets",
  ]) {
    const { db, calls } = fakeDatabase();
    const response = await handleGrowthBlackboardAdmin(
      request(path),
      environment(db),
      path,
      jsonResponse,
    );
    assert.equal(response.status, 200, path);
    assert.deepEqual(calls[0]?.values, [50], path);
  }
});

test("blackboard query and coerced confirmation fail before D1 access", async () => {
  for (const [label, path, body, expected] of [
    [
      "query-confirmation",
      "/admin/growth/blackboard/entities?confirm=1",
      {},
      "query_not_supported",
    ],
    [
      "coerced-confirmation",
      "/admin/growth/blackboard/entities",
      { confirm: 1, entity: { entityType: "company", name: "Example" } },
      "confirm_required",
    ],
  ] as const) {
    const { db, calls } = fakeDatabase();
    const routePath = path.split("?", 1)[0]!;
    const response = await handleGrowthBlackboardAdmin(
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

test("blackboard sensitive, unknown and conflicting fields fail closed", async () => {
  const fixtures = [
    {
      label: "sensitive",
      body: {
        confirm: true,
        entity: { entityType: "company", name: "Example", accessToken: "unsafe" },
      },
      expected: "forbidden_growth_input_key",
    },
    {
      label: "unknown",
      body: {
        confirm: true,
        entity: { entityType: "company", name: "Example", unexpected: true },
      },
      expected: "growth_blackboard_invalid_request",
    },
    {
      label: "conflicting-id",
      body: {
        confirm: true,
        id: "entity-outer-0001",
        entity: { id: "entity-inner-0002", entityType: "company", name: "Example" },
      },
      expected: "growth_blackboard_invalid_request",
    },
  ] as const;

  for (const fixture of fixtures) {
    const { db, calls } = fakeDatabase();
    const response = await handleGrowthBlackboardAdmin(
      request("/admin/growth/blackboard/entities", {
        method: "POST",
        body: fixture.body,
        contentType: "application/json",
      }),
      environment(db),
      "/admin/growth/blackboard/entities",
      jsonResponse,
    );
    const result = await payload(response);
    assert.equal(response.status, 400, fixture.label);
    assert.equal(result.error, fixture.expected, fixture.label);
    assert.equal(result.rawErrorExposed ?? false, false, fixture.label);
    assert.equal(calls.length, 0, fixture.label);
  }
});

test("valid blackboard writes return a reduced confirmation receipt", async () => {
  const entityRow = Object.freeze({
    id: "entity-0001",
    entity_type: "company",
    name: "Example Property Group",
    status: "active",
  });
  const { db, calls } = fakeDatabase({ entityRow });
  const response = await handleGrowthBlackboardAdmin(
    request("/admin/growth/blackboard/entities", {
      method: "POST",
      contentType: "application/json",
      body: {
        confirm: true,
        id: "entity-0001",
        entity: {
          entityType: "company",
          name: "Example Property Group",
        },
      },
    }),
    environment(db),
    "/admin/growth/blackboard/entities",
    jsonResponse,
  );
  const result = await payload(response);
  assert.equal(response.status, 200);
  assert.equal(result.mode, "growth_entity_saved");
  assert.deepEqual(result.entity, entityRow);
  assert.deepEqual(result.requestReceipt, {
    contractVersion: "growth_internal_write_request_v1",
    bodySha256Available: true,
    exactBooleanConfirmation: true,
  });
  assert.equal((result.safety as Record<string, unknown>).queryConfirmationAllowed, false);
  assert.equal(calls.filter((call) => call.operation === "run").length, 1);
  assert.equal(calls.filter((call) => call.operation === "first").length, 1);
});

test("blackboard database failures never expose raw details", async () => {
  const secret = "PRIVATE_BLACKBOARD_DATABASE_DETAIL_MUST_NOT_PROJECT";
  const { db } = fakeDatabase({ throwOnAll: secret });
  const response = await handleGrowthBlackboardAdmin(
    request("/admin/growth/blackboard/entities"),
    environment(db),
    "/admin/growth/blackboard/entities",
    jsonResponse,
  );
  const result = await payload(response);
  assert.equal(response.status, 503);
  assert.equal(result.error, "growth_blackboard_failed");
  assert.equal(result.rawErrorExposed, false);
  assert(!JSON.stringify(result).includes(secret));
  assert(!("message" in result));
});
