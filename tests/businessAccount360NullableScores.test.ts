import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import { buildBusinessAccount360 } from "../src/core/businessAccount360";

type TableRows = Record<string, Record<string, unknown>[]>;

function fixture(): Env {
  const tableRows: TableRows = {
    business_people: [{
      id: "person-1",
      name: "Jamie Example",
      confidenceScore: null,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "not-a-timestamp",
    }],
    business_websites: [],
    business_pages: [{
      id: "page-1",
      httpStatus: 999,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-20T00:00:00Z",
    }],
    business_website_audit_runs: [{
      id: "audit-run-1",
      status: "completed",
      readinessScore: null,
      riskScore: 38,
      confidenceScore: "not-a-score",
      createdAt: "2026-07-20T00:00:00Z",
      updatedAt: "2026-07-21T00:00:00Z",
    }],
    business_audit_observations: [{
      id: "observation-1",
      severity: "high",
      category: "conversion_friction",
      title: "Review enquiry path friction",
      confidenceScore: 78,
      createdAt: "2026-07-21T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    }],
    business_signals: [{
      id: "signal-1",
      signalType: "technology_stack",
      signalStrength: " 80 ",
      confidenceScore: 101,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2099-01-01T00:00:00Z",
    }],
    business_opportunities: [{
      id: "opportunity-1",
      fitScore: 75,
      needScore: -1,
      urgencyScore: 40,
      budgetLikelihoodScore: null,
      contactabilityScore: false,
      evidenceQualityScore: 80,
      riskScore: 20,
      confidenceScore: Number.POSITIVE_INFINITY,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    }],
    business_service_matches: [{
      id: "service-match-1",
      matchScore: 101,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    }],
    business_audit_packs: [{
      id: "audit-pack-1",
      confidenceScore: "70",
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    }],
    business_followups: [],
  };

  return {
    DB: {
      prepare(sql: string) {
        const normalized = sql.replace(/\s+/g, " ").trim();
        return {
          bind() {
            return {
              async first<T>() {
                if (!normalized.includes("FROM business_organizations")) return null;
                return {
                  id: "organization-1",
                  name: "Example Co",
                  fitScore: 70,
                  priorityScore: null,
                  riskScore: 0,
                  confidenceScore: "85",
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
}

test("Account 360 preserves unknown scores and bounds evidence chronology", async () => {
  const observedAt = Date.parse("2026-07-28T00:00:00.000Z");
  const account = await buildBusinessAccount360(fixture(), "organization-1", 25, observedAt);
  if (!account) throw new Error("ACCOUNT_360_FIXTURE_NOT_FOUND");

  assert.equal(account.numericEvidenceContract, "business_account_360_nullable_scores_v1");
  assert.equal(account.timelineEvidenceContract, "business_account_360_bounded_chronology_v1");
  assert.equal(account.organization.fitScore, 70);
  assert.equal(account.organization.priorityScore, null);
  assert.equal(account.organization.riskScore, 0, "a genuine zero remains zero");
  assert.equal(account.organization.confidenceScore, 85);

  assert.equal(account.relationshipContext.stakeholders[0]?.confidenceScore, null);
  assert.equal(account.accountEvidence.pages[0]?.httpStatus, null);
  assert.equal(account.accountEvidence.auditRuns[0]?.readinessScore, null);
  assert.equal(account.accountEvidence.auditRuns[0]?.riskScore, 38);
  assert.equal(account.accountEvidence.auditRuns[0]?.confidenceScore, null);
  assert.equal(account.accountEvidence.auditObservations[0]?.confidenceScore, 78);
  assert.equal(account.accountEvidence.signals[0]?.signalStrength, null);
  assert.equal(account.accountEvidence.signals[0]?.confidenceScore, null);

  const opportunity = account.commercialContext.opportunities[0];
  assert.equal(opportunity?.fitScore, 75);
  assert.equal(opportunity?.needScore, null);
  assert.equal(opportunity?.urgencyScore, 40);
  assert.equal(opportunity?.budgetLikelihoodScore, null);
  assert.equal(opportunity?.contactabilityScore, null);
  assert.equal(opportunity?.evidenceQualityScore, 80);
  assert.equal(opportunity?.riskScore, 20);
  assert.equal(opportunity?.confidenceScore, null);

  assert.equal(account.commercialContext.serviceMatches[0]?.matchScore, null);
  assert.equal(account.accountEvidence.auditPacks[0]?.confidenceScore, 70);
  assert.deepEqual(account.deterministicIndicators.scoreSemantics, {
    range: "0_to_100",
    missingValue: null,
    missingValuesAreZero: false,
  });
  assert.equal(account.deterministicIndicators.latestEvidenceAt, "2026-07-22T00:00:00.000Z");
  assert.deepEqual(account.deterministicIndicators.timelineSemantics, {
    output: "canonical_iso_8601",
    invalidTimestampsExcluded: true,
    futureTimestampsExcluded: true,
  });
  assert.equal(
    account.uncertainties.includes(
      "Missing or invalid score values are returned as null and are never treated as zero.",
    ),
    true,
  );
  assert.equal(
    account.uncertainties.includes(
      "Invalid or future-dated evidence timestamps are excluded from latest-evidence chronology.",
    ),
    true,
  );
});
