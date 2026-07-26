import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import { handleGrowthCampaignIntelligenceAdmin } from "../src/routes/growthCampaignIntelligenceAdmin";

const ADMIN_TOKEN = "test-only-growth-campaign-admin-token-00000000000000000001";

type DatabaseCall = Readonly<{
  sql: string;
  values: readonly unknown[];
  operation: "all" | "first" | "run";
}>;

type FakeDatabaseOptions = Readonly<{
  throwOnAll?: string;
  campaignRow?: Readonly<Record<string, unknown>>;
}>;

function fakeDatabase(options: FakeDatabaseOptions = {}): Readonly<{
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
            async first() {
              calls.push(Object.freeze({ sql, values: Object.freeze([...values]), operation: "first" as const }));
              if (/SELECT \* FROM growth_campaigns/i.test(sql)) {
                return options.campaignRow ?? null;
              }
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

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function adminRequest(
  path: string,
  options: Readonly<{
    method?: "GET" | "POST";
    body?: unknown;
    contentType?: string;
  }> = {},
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

async function body(response: Response): Promise<Record<string, unknown>> {
  return await response.json() as Record<string, unknown>;
}

test("campaign list uses the documented fallback limit when the query is absent", async () => {
  const { db, calls } = fakeDatabase();
  const response = await handleGrowthCampaignIntelligenceAdmin(
    adminRequest("/admin/growth/campaigns"),
    environment(db),
    "/admin/growth/campaigns",
    jsonResponse,
  );
  assert.equal(response.status, 200);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0]?.values, [25]);
});

test("query-string confirmation is rejected before body parsing or D1 access", async () => {
  const { db, calls } = fakeDatabase();
  const response = await handleGrowthCampaignIntelligenceAdmin(
    adminRequest("/admin/growth/campaigns?confirm=1", {
      method: "POST",
      body: {},
      contentType: "application/json",
    }),
    environment(db),
    "/admin/growth/campaigns",
    jsonResponse,
  );
  assert.equal(response.status, 400);
  assert.equal((await body(response)).error, "query_not_supported");
  assert.equal(calls.length, 0);
});

test("coerced confirmation and sensitive input keys fail before D1 access", async () => {
  for (const [label, requestBody, expected] of [
    [
      "coerced-confirmation",
      { confirm: "1", campaign: { name: "Example", goal: "A sufficiently detailed growth goal." } },
      "confirm_required",
    ],
    [
      "sensitive-key",
      { confirm: true, campaign: { name: "Example", goal: "A sufficiently detailed growth goal.", apiToken: "secret" } },
      "forbidden_growth_input_key",
    ],
  ] as const) {
    const { db, calls } = fakeDatabase();
    const response = await handleGrowthCampaignIntelligenceAdmin(
      adminRequest("/admin/growth/campaigns", {
        method: "POST",
        body: requestBody,
        contentType: "application/json",
      }),
      environment(db),
      "/admin/growth/campaigns",
      jsonResponse,
    );
    assert.equal(response.status, 400, label);
    assert.equal((await body(response)).error, expected, label);
    assert.equal(calls.length, 0, label);
  }
});

test("mixed wrapper fields and conflicting identifiers fail closed", async () => {
  for (const [label, requestBody] of [
    [
      "mixed-wrapper",
      {
        confirm: true,
        campaign: { name: "Example", goal: "A sufficiently detailed growth goal." },
        goal: "Ambiguous top-level value",
      },
    ],
    [
      "identifier-conflict",
      {
        confirm: true,
        id: "campaign-outer-0001",
        campaign: {
          id: "campaign-inner-0002",
          name: "Example",
          goal: "A sufficiently detailed growth goal.",
        },
      },
    ],
  ] as const) {
    const { db, calls } = fakeDatabase();
    const response = await handleGrowthCampaignIntelligenceAdmin(
      adminRequest("/admin/growth/campaigns", {
        method: "POST",
        body: requestBody,
        contentType: "application/json",
      }),
      environment(db),
      "/admin/growth/campaigns",
      jsonResponse,
    );
    const payload = await body(response);
    assert.equal(response.status, 400, label);
    assert.equal(payload.error, "growth_campaign_intelligence_invalid_request", label);
    assert.equal(payload.rawErrorExposed, false, label);
    assert.equal(calls.length, 0, label);
  }
});

test("valid campaign writes use exact confirmed JSON and return a reduced receipt", async () => {
  const campaignRow = Object.freeze({
    id: "campaign-0001",
    name: "Example campaign",
    goal: "A sufficiently detailed growth goal for owner review.",
    status: "draft",
  });
  const { db, calls } = fakeDatabase({ campaignRow });
  const response = await handleGrowthCampaignIntelligenceAdmin(
    adminRequest("/admin/growth/campaigns", {
      method: "POST",
      contentType: "application/json",
      body: {
        confirm: true,
        id: "campaign-0001",
        campaign: {
          name: "Example campaign",
          goal: "A sufficiently detailed growth goal for owner review.",
        },
      },
    }),
    environment(db),
    "/admin/growth/campaigns",
    jsonResponse,
  );
  const payload = await body(response);
  assert.equal(response.status, 200);
  assert.equal(payload.mode, "growth_campaign_saved");
  assert.deepEqual(payload.campaign, campaignRow);
  assert.deepEqual(payload.requestReceipt, {
    contractVersion: "growth_internal_write_request_v1",
    bodySha256Available: true,
    exactBooleanConfirmation: true,
  });
  assert.equal((payload.safety as Record<string, unknown>).queryConfirmationAllowed, false);
  assert.equal(calls.filter((call) => call.operation === "run").length, 1);
  assert.equal(calls.filter((call) => call.operation === "first").length, 1);
});

test("database failures are reduced without exposing raw error text", async () => {
  const secret = "SQLITE_PRIVATE_DATABASE_DETAIL_MUST_NOT_PROJECT";
  const { db } = fakeDatabase({ throwOnAll: secret });
  const response = await handleGrowthCampaignIntelligenceAdmin(
    adminRequest("/admin/growth/campaigns"),
    environment(db),
    "/admin/growth/campaigns",
    jsonResponse,
  );
  const payload = await body(response);
  assert.equal(response.status, 503);
  assert.equal(payload.error, "growth_campaign_intelligence_failed");
  assert.equal(payload.rawErrorExposed, false);
  assert(!JSON.stringify(payload).includes(secret));
  assert(!("message" in payload));
});
