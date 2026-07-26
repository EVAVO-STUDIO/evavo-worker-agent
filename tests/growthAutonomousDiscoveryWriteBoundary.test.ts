import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import { handleGrowthAutonomousDiscoveryAdmin } from "../src/routes/growthAutonomousDiscoveryAdmin";

const ADMIN_TOKEN = "test-only-growth-discovery-admin-token-000000000000000001";

type DatabaseCall = Readonly<{
  sql: string;
  values: readonly unknown[];
  operation: "all" | "run";
}>;

function fakeDatabase(options: Readonly<{ throwOnAll?: string }> = {}): Readonly<{
  db: Env["DB"];
  calls: DatabaseCall[];
}> {
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
  options: Readonly<{
    method?: "GET" | "POST" | "OPTIONS";
    body?: unknown;
    token?: string;
  }> = {},
): Request {
  const method = options.method ?? "GET";
  const headers = new Headers({ accept: "application/json" });
  if (options.token) headers.set("authorization", `Bearer ${options.token}`);
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
    headers: { "content-type": "application/json; charset=utf-8", ...(init.headers as Record<string, string> | undefined) },
  });
}

async function payload(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

test("discovery authentication precedes OPTIONS and database access", async () => {
  const { db, calls } = fakeDatabase();
  const response = await handleGrowthAutonomousDiscoveryAdmin(
    request("/admin/growth/discovery/research-runs", { method: "OPTIONS" }),
    environment(db),
    "/admin/growth/discovery/research-runs",
    jsonResponse,
  );
  assert.equal(response.status, 401);
  assert.equal(calls.length, 0);
});

test("discovery list routes retain their documented limits", async () => {
  for (const [path, expected] of [
    ["/admin/growth/discovery/research-runs", 25],
    ["/admin/growth/discovery/source-candidates", 50],
    ["/admin/growth/discovery/signals", 50],
    ["/admin/growth/discovery/opportunity-scores", 50],
    ["/admin/growth/discovery/agent-decisions", 50],
    ["/admin/growth/discovery/feedback", 50],
  ] as const) {
    const { db, calls } = fakeDatabase();
    const response = await handleGrowthAutonomousDiscoveryAdmin(
      request(path, { token: ADMIN_TOKEN }),
      environment(db),
      path,
      jsonResponse,
    );
    assert.equal(response.status, 200, path);
    assert.deepEqual(calls[0]?.values, [expected], path);
  }
});

test("discovery query and coerced confirmation fail before D1 access", async () => {
  for (const [label, path, body, expected] of [
    [
      "query-confirmation",
      "/admin/growth/discovery/research-runs/plan?confirm=1",
      {},
      "query_not_supported",
    ],
    [
      "coerced-confirmation",
      "/admin/growth/discovery/research-runs/plan",
      { confirm: "1", objective: "Find qualified public opportunities." },
      "confirm_required",
    ],
  ] as const) {
    const { db, calls } = fakeDatabase();
    const pathname = path.split("?", 1)[0]!;
    const response = await handleGrowthAutonomousDiscoveryAdmin(
      request(path, { method: "POST", body, token: ADMIN_TOKEN }),
      environment(db),
      pathname,
      jsonResponse,
    );
    assert.equal(response.status, 400, label);
    assert.equal((await payload(response)).error, expected, label);
    assert.equal(calls.length, 0, label);
  }
});

test("discovery rejects credential keys, alias conflicts and invented candidate defaults", async () => {
  const fixtures = [
    {
      label: "credential-key",
      path: "/admin/growth/discovery/research-runs/plan",
      body: {
        confirm: true,
        researchRun: {
          objective: "Find qualified public opportunities.",
          providerToken: "must-not-store",
        },
      },
      expected: "forbidden_growth_input_key",
    },
    {
      label: "alias-conflict",
      path: "/admin/growth/discovery/source-candidates",
      body: {
        confirm: true,
        candidate: {
          domain: "example.com",
          url: "https://example.com/opportunity",
          sourceType: "public_directory",
          discoveryMethod: "manual_review",
          crawlAllowed: false,
          crawl_allowed: true,
        },
      },
      expected: "growth_autonomous_discovery_invalid_request",
    },
    {
      label: "missing-candidate-url",
      path: "/admin/growth/discovery/source-candidates",
      body: {
        confirm: true,
        candidate: {
          domain: "example.com",
          sourceType: "public_directory",
          discoveryMethod: "manual_review",
        },
      },
      expected: "growth_autonomous_discovery_invalid_request",
    },
  ] as const;

  for (const fixture of fixtures) {
    const { db, calls } = fakeDatabase();
    const response = await handleGrowthAutonomousDiscoveryAdmin(
      request(fixture.path, { method: "POST", body: fixture.body, token: ADMIN_TOKEN }),
      environment(db),
      fixture.path,
      jsonResponse,
    );
    const result = await payload(response);
    assert.equal(response.status, 400, fixture.label);
    assert.equal(result.error, fixture.expected, fixture.label);
    assert.equal(calls.length, 0, fixture.label);
    assert(!JSON.stringify(result).includes("must-not-store"), fixture.label);
  }
});

test("valid fetch queue metadata requires exact fields and returns a reduced receipt", async () => {
  const { db, calls } = fakeDatabase();
  const response = await handleGrowthAutonomousDiscoveryAdmin(
    request("/admin/growth/discovery/fetch-queue", {
      method: "POST",
      token: ADMIN_TOKEN,
      body: {
        confirm: true,
        id: "fetch-queue-0001",
        fetch: {
          candidateId: "candidate-0001",
          url: "https://example.com/public-opportunity",
          purpose: "collect_public_evidence",
          maxBytes: 100000,
          maxRedirects: 2,
        },
      },
    }),
    environment(db),
    "/admin/growth/discovery/fetch-queue",
    jsonResponse,
  );
  const result = await payload(response);
  assert.equal(response.status, 200);
  assert.equal(result.mode, "growth_fetch_queue_enqueued_metadata_only");
  assert.deepEqual(result.requestReceipt, {
    contractVersion: "growth_internal_write_request_v1",
    bodySha256Available: true,
    exactBooleanConfirmation: true,
  });
  const insert = calls.find((call) => call.operation === "run");
  assert(insert);
  assert.equal(insert.values[0], "fetch-queue-0001");
  assert.equal(insert.values[1], "candidate-0001");
  assert.equal(insert.values[4], "https://example.com/public-opportunity");
  assert.equal((result.safety as Record<string, unknown>).savesReviewItemsOnly, true);
});

test("discovery database failures are reduced without raw details", async () => {
  const secret = "PRIVATE_DISCOVERY_DATABASE_DETAIL_MUST_NOT_PROJECT";
  const { db } = fakeDatabase({ throwOnAll: secret });
  const response = await handleGrowthAutonomousDiscoveryAdmin(
    request("/admin/growth/discovery/research-runs", { token: ADMIN_TOKEN }),
    environment(db),
    "/admin/growth/discovery/research-runs",
    jsonResponse,
  );
  const result = await payload(response);
  assert.equal(response.status, 503);
  assert.equal(result.error, "growth_autonomous_discovery_failed");
  assert.equal(result.rawErrorExposed, false);
  assert(!JSON.stringify(result).includes(secret));
  assert(!("message" in result));
});
