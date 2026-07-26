import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import { handleGrowthCampaignIntelligenceAdmin } from "../src/routes/growthCampaignIntelligenceAdmin";

const ADMIN_TOKEN = "test-only-growth-campaign-error-admin-token-000000000001";

function environment(): Env {
  return {
    ADMIN_TOKEN,
    DB: {
      prepare() {
        throw new Error("D1 must not be reached for rejected route input");
      },
    },
  } as unknown as Env;
}

function request(path: string, body: unknown): Request {
  return new Request(`https://growth-worker.example${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${ADMIN_TOKEN}`,
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function jsonResponse(data: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

const cases = [
  {
    label: "experiment",
    path: "/admin/growth/experiments",
    body: {
      confirm: true,
      experiment: {
        campaignId: "campaign-0001",
        name: "Example experiment",
        unexpected: true,
      },
    },
  },
  {
    label: "metric",
    path: "/admin/growth/metrics",
    body: {
      confirm: true,
      metric: {
        campaignId: "campaign-0001",
        unexpected: true,
      },
    },
  },
  {
    label: "evidence",
    path: "/admin/growth/evidence",
    body: {
      confirm: true,
      evidence: {
        evidenceType: "public_signal",
        summary: "Grounded public evidence.",
        unexpected: true,
      },
    },
  },
  {
    label: "learning",
    path: "/admin/growth/learning",
    body: {
      confirm: true,
      learning: {
        noteType: "outcome",
        summary: "A bounded internal learning note.",
        unexpected: true,
      },
    },
  },
] as const;

for (const fixture of cases) {
  test(`${fixture.label} route validation is classified as a finite client input failure`, async () => {
    const response = await handleGrowthCampaignIntelligenceAdmin(
      request(fixture.path, fixture.body),
      environment(),
      fixture.path,
      jsonResponse,
    );
    const payload = await response.json() as Record<string, unknown>;
    assert.equal(response.status, 400);
    assert.equal(payload.error, "growth_campaign_intelligence_invalid_request");
    assert.equal(payload.rawErrorExposed, false);
    assert(!("message" in payload));
    assert.equal(
      (payload.safety as Record<string, unknown>).exactBooleanConfirmationRequired,
      true,
    );
  });
}
