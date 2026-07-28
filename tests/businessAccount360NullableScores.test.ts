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
      confidenceScore: 0,
      confidenceScoreObserved: 0,
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
      readinessScore: 0,
      readinessScoreObserved: 1,
      riskScore: 38,
      riskScoreObserved: 1,
      confidenceScore: "not-a-score",
      confidenceScoreObserved: 1,
      createdAt: "2026-07-20T00:00:00Z",
      updatedAt: "2026-07-21T00:00:00Z",
    }],
    business_audit_observations: [{
      id: "observation-1",
      severity: "high",
      category: "conversion_friction",
      title: "Review enquiry path friction",
      confidenceScore: 78,
      confidenceScoreObserved: 1,
      createdAt: "2026-07-21T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    }],
    business_signals: [{
      id: "signal-1",
      signalType: "technology_stack",
      signalStrength: " 80 ",
      signalStrengthObserved: 1,
      confidenceScore: 101,
      confidenceScoreObserved: 1,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2099-01-01T00:00:00Z",
    }],
    business_opportunities: [{
      id: "opportunity-1",
      fitScore: 75,
      fitScoreObserved: 1,
      needScore: -1,
      needScoreObserved: 1,
      urgencyScore: 40,
      urgencyScoreObserved: 1,
      budgetLikelihoodScore: 0,
      budgetLikelihoodScoreObserved: 0,
      contactabilityScore: false,
      contactabilityScoreObserved: 1,
      evidenceQualityScore: 80,
      evidenceQualityScoreObserved: 1,
      riskScore: 0,
      riskScoreObserved: 1,
      confidenceScore: Number.POSITIVE_INFINITY,
      confidenceScoreObserved: 1,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    }],
    business_service_matches: [{
      id: "service-match-1",
      matchScore: 0,
      matchScoreObserved: 1,
      createdAt: "2026-07-01T00:00:00Z",
      updatedAt: "2026-07-22T00:00:00Z",
    }],
    business_audit_packs: [{
      id: "audit-pack-1",
      confidenceScore: "70",
      confidenceScoreObserved: 1,
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
                  fitScoreObserved: 1,
                  priorityScore: 0,
                  priorityScoreObserved: 0,
                  riskScore: 0,
                  riskScoreObserved: 1,
                  confidenceScore: "85",
                  confidenceScoreObserved: 1,
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

test("Account 360 preserves explicit zero and withholds unobserved scores", async () => {
  const observedAt = Date.parse("2026-07-28T00:00:00.000Z");
  const account = await buildBusinessAccount360(fixture(), "organization-1", 25, observedAt);
  if (!account) throw new Error("ACCOUNT_360_FIXTURE_NOT_FOUND");

  assert.equal(account.numericEvidenceContract, "business_account_360_observed_scores_v1");
  assert.equal(account.scoreProvenanceContract, "business_score_observation_flags_v1");
  assert.equal(account.timelineEvidenceContract, "business_account_360_bounded_chronology_v1");
  assert.equal(account.organization.fitScore, 70);
  assert.equal(account.organization.priorityScore, null);
  assert.equal(account.organization.riskScore, 0, "an observed zero remains visible");
  assert.equal(account.organization.confidenceScore, 85);

  assert.equal(account.relationshipContext.stakeholders[0]?.confidenceScore, null);
  assert.equal(account.accountEvidence.pages[0]?.httpStatus, null);
  assert.equal(account.accountEvidence.auditRuns[0]?.readinessScore, 0);
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
  assert.equal(opportunity?.riskScore, 0);
  assert.equal(opportunity?.confidenceScore, null);

  assert.equal(account.commercialContext.serviceMatches[0]?.matchScore, 0);
  assert.equal(account.accountEvidence.auditPacks[0]?.confidenceScore, 70);
  assert.deepEqual(account.deterministicIndicators.scoreSemantics, {
    range: "0_to_100",
    missingValue: null,
    observationFlagsRequired: true,
    explicitZeroPreserved: true,
    unobservedValuesReturnedAsNull: true,
  });
  assert.equal(account.deterministicIndicators.latestEvidenceAt, "2026-07-22T00:00:00.000Z");
  assert.deepEqual(account.deterministicIndicators.timelineSemantics, {
    output: "canonical_iso_8601",
    invalidTimestampsExcluded: true,
    futureTimestampsExcluded: true,
  });
  assert.equal(account.deterministicIndicators.recordsMayBeTruncated, false);

  const boundedAccount = await buildBusinessAccount360(
    fixture(),
    "organization-1",
    1,
    observedAt,
  );
  if (!boundedAccount) throw new Error("ACCOUNT_360_BOUNDED_FIXTURE_NOT_FOUND");
  assert.equal(boundedAccount.deterministicIndicators.recordsMayBeTruncated, true);

  assert.equal(
    account.uncertainties.includes(
      "Explicit observed zero scores are preserved; legacy, missing or invalid scores are returned as null.",
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
