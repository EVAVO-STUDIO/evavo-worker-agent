import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import {
  buildBusinessAccount360,
  businessAccount360Failure,
  parseBusinessAccount360Limit,
  parseBusinessAccount360Path,
} from "../src/core/businessAccount360";

type Fixture = {
  env: Env;
  calls: Array<{ sql: string; values: unknown[] }>;
};

function fixture(): Fixture {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const tableRows: Record<string, Record<string, unknown>[]> = {
    business_people: [{
      id: "person-1",
      name: "Jamie Example",
      role: "Digital lead",
      sourceType: "public",
      allowedUse: "review_only",
      contactStatus: "new",
      confidenceScore: 75,
      emailPresent: 1,
      phonePresent: 0,
      profileUrlPresent: 1,
      sourceUrlPresent: 1,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-20T00:00:00Z",
    }],
    business_websites: [{
      id: "website-1",
      url: "https://evavo.com.au",
      domain: "evavo.com.au",
      status: "reviewed",
      lastCheckedAt: "2026-07-20T00:00:00Z",
      robotsStatus: "allowed",
      crawlAllowed: 1,
      techHintsJson: '["Next.js","Cloudflare"]',
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-20T00:00:00Z",
    }],
    business_pages: [{
      id: "page-1",
      websiteId: "website-1",
      url: "https://evavo.com.au/work",
      pageType: "work",
      title: "Work",
      status: "reviewed",
      lastFetchedAt: "2026-07-20T00:00:00Z",
      httpStatus: 200,
      contentHash: "content-hash",
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-20T00:00:00Z",
    }],
    business_signals: [{
      id: "signal-1",
      websiteId: "website-1",
      pageId: "page-1",
      signalType: "technology_stack",
      signalStrength: 80,
      evidenceSummary: "Public technology evidence",
      evidenceUrl: "https://evavo.com.au/work",
      confidenceScore: 85,
      riskFlagsJson: "[]",
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-21T00:00:00Z",
    }],
    business_opportunities: [{
      id: "opportunity-1",
      opportunityType: "website",
      status: "review",
      priority: "B",
      fitScore: 75,
      needScore: 60,
      urgencyScore: 40,
      budgetLikelihoodScore: 30,
      contactabilityScore: 50,
      evidenceQualityScore: 80,
      riskScore: 20,
      confidenceScore: 65,
      recommendedService: "Website strategy",
      recommendedAngle: "Review only",
      nextStep: "Owner review",
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    }],
    business_service_matches: [{
      id: "service-match-1",
      opportunityId: "opportunity-1",
      signalId: "signal-1",
      serviceKey: "website_strategy",
      matchScore: 70,
      reason: "Evidence-linked fit",
      evidenceJson: '["signal-1"]',
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    }],
    business_audit_packs: [{
      id: "audit-pack-1",
      opportunityId: "opportunity-1",
      title: "Website review",
      summary: "Bounded summary",
      auditType: "website_teardown",
      riskFlagsJson: "[]",
      confidenceScore: 70,
      status: "draft",
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    }],
    business_followups: [{
      id: "followup-1",
      personId: "person-1",
      opportunityId: "opportunity-1",
      followupType: "manual_review",
      dueAt: null,
      status: "open",
      notesPresent: 1,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-23T00:00:00Z",
    }],
  };

  const env = {
    DB: {
      prepare(sql: string) {
        const normalized = sql.replace(/\s+/g, " ").trim();
        return {
          bind(...values: unknown[]) {
            calls.push({ sql: normalized, values });
            return {
              async first<T>() {
                if (!normalized.includes("FROM business_organizations")) return null;
                return {
                  id: "organization-1",
                  name: "Example Co",
                  domain: "evavo.com.au",
                  websiteUrl: "https://evavo.com.au",
                  industry: "Technology",
                  location: "Melbourne",
                  sourceType: "operator",
                  sourceUrl: "https://evavo.com.au/about",
                  status: "reviewed",
                  fitScore: 70,
                  priorityScore: 65,
                  riskScore: 15,
                  confidenceScore: 80,
                  createdAt: "2026-07-01T00:00:00Z",
                  updatedAt: "2026-07-19T00:00:00Z",
                } as T;
              },
              async all<T>() {
                for (const [table, results] of Object.entries(tableRows)) {
                  if (normalized.includes(`FROM ${table}`)) {
                    return { results: results as T[] };
                  }
                }
                throw new Error(`Unhandled SQL: ${normalized}`);
              },
            };
          },
        };
      },
    },
  } as unknown as Env;

  return { env, calls };
}

test("Account 360 path and query parsing are exact and bounded", () => {
  assert.deepEqual(
    parseBusinessAccount360Path(
      "/admin/business/organizations/organization-1/account-360",
    ),
    { matched: true, organizationId: "organization-1" },
  );
  assert.equal(
    parseBusinessAccount360Path(
      "/admin/business/organizations/%2F/account-360",
    ).organizationId,
    null,
  );
  assert.deepEqual(
    parseBusinessAccount360Path("/admin/business/organizations"),
    { matched: false },
  );

  assert.deepEqual(
    parseBusinessAccount360Limit(new URL("https://worker.example/test")),
    { ok: true, value: 25 },
  );
  assert.equal(
    parseBusinessAccount360Limit(
      new URL("https://worker.example/test?limit=50"),
    ).ok,
    true,
  );
  for (const url of [
    "https://worker.example/test?limit=51",
    "https://worker.example/test?limit=10&limit=20",
    "https://worker.example/test?confirm=1",
  ]) {
    assert.equal(parseBusinessAccount360Limit(new URL(url)).ok, false, url);
  }
});

test("Account 360 returns bounded evidence and reduced relationship context", async () => {
  const { env, calls } = fixture();
  const account = await buildBusinessAccount360(
    env,
    "organization-1",
    25,
  );
  assert.ok(account);
  assert.equal(account.organization.name, "Example Co");
  assert.deepEqual(account.organization.metadata, {});
  assert.equal(
    account.relationshipContext.stakeholders[0].emailPresent,
    true,
  );
  assert.equal(
    "email" in account.relationshipContext.stakeholders[0],
    false,
  );
  assert.equal(account.accountEvidence.websites[0].crawlAllowed, true);
  assert.equal(
    account.accountEvidence.signals[0].evidenceUrl,
    "https://evavo.com.au/work",
  );
  assert.equal(
    account.commercialContext.opportunities[0].budgetAmountKnown,
    false,
  );
  assert.equal(
    account.commercialContext.serviceMatches[0].evidencePayloadRedacted,
    true,
  );
  assert.equal(
    account.relationshipContext.followups[0].notesRedacted,
    true,
  );
  assert.equal(
    account.deterministicIndicators.returnedCounts.signals,
    1,
  );
  assert.equal(
    account.deterministicIndicators.countsAreReturnedRowsOnly,
    true,
  );
  assert.equal(
    account.deterministicIndicators.dimensionCoverage.technology.status,
    "stored_evidence_present",
  );
  assert.equal(
    account.relationshipContext.relationshipHealth.status,
    "not_computed",
  );
  assert.equal(account.commercialContext.dealHealth.status, "not_computed");
  assert.equal(
    calls.every((call) => call.values[0] === "organization-1"),
    true,
  );
  assert.equal(
    calls.slice(1).every((call) => call.values[1] === 25),
    true,
  );
});

test("Account 360 failures are finite and never expose raw D1 errors", () => {
  const secret = "database-secret-that-must-not-leak";
  const failure = businessAccount360Failure(new Error(secret));
  assert.equal(failure.rawErrorExposed, false);
  assert.equal(JSON.stringify(failure).includes(secret), false);
  assert.equal(failure.externalExecutionAllowed, false);
});
