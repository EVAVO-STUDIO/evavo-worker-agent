import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import {
  buildBusinessScoreWrite,
  businessOpportunityPriorityFromScores,
  businessScoreObserved,
  readBusinessObservedScore,
} from "../src/core/businessScoreProvenance";
import {
  saveBusinessOpportunity,
  saveBusinessPerson,
} from "../src/core/businessScoreProvenanceWriters";

type RecordedCall = {
  sql: string;
  values: unknown[];
};

function fixture(options: { failRun?: boolean } = {}) {
  const calls: RecordedCall[] = [];
  const env = {
    DB: {
      prepare(sql: string) {
        const normalized = sql.replace(/\s+/g, " ").trim();
        return {
          bind(...values: unknown[]) {
            calls.push({ sql: normalized, values });
            return {
              async run() {
                if (options.failRun) {
                  throw new Error("no such column: confidence_score_observed");
                }
                return { success: true };
              },
              async first<T>() {
                return null as T | null;
              },
            };
          },
        };
      },
    },
  } as unknown as Env;
  return { env, calls };
}

test("score provenance distinguishes explicit zero from absent or invalid input", () => {
  assert.deepEqual(buildBusinessScoreWrite(0), {
    value: 0,
    observed: 1,
    supplied: true,
  });
  assert.deepEqual(buildBusinessScoreWrite(undefined), {
    value: 0,
    observed: 0,
    supplied: false,
  });
  assert.deepEqual(buildBusinessScoreWrite(null), {
    value: 0,
    observed: 0,
    supplied: true,
  });
  assert.deepEqual(buildBusinessScoreWrite("0"), {
    value: 0,
    observed: 0,
    supplied: true,
  });
  assert.deepEqual(buildBusinessScoreWrite(101), {
    value: 0,
    observed: 0,
    supplied: true,
  });
  assert.equal(readBusinessObservedScore(0, 1), 0);
  assert.equal(readBusinessObservedScore(0, 0), null);
  assert.equal(readBusinessObservedScore("70", "1"), 70);
  assert.equal(readBusinessObservedScore(101, 1), null);
  assert.equal(businessScoreObserved(true), true);
  assert.equal(businessScoreObserved("1"), true);
  assert.equal(businessScoreObserved(0), false);
});

test("opportunity priority uses only bounded score values", () => {
  assert.equal(
    businessOpportunityPriorityFromScores({
      fitScore: 100,
      needScore: 100,
      urgencyScore: 0,
      contactabilityScore: 100,
      evidenceQualityScore: 100,
      riskScore: 0,
    }),
    "A",
  );
  assert.equal(
    businessOpportunityPriorityFromScores({
      fitScore: 101,
      needScore: -1,
      urgencyScore: Number.POSITIVE_INFINITY,
      contactabilityScore: "100",
      evidenceQualityScore: null,
      riskScore: undefined,
    }),
    "D",
  );
});

test("people writes store score and observation flag in one statement", async () => {
  const { env, calls } = fixture();
  const person = await saveBusinessPerson(env, {
    id: "person-1",
    name: "Jamie Example",
    confidenceScore: 0,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO business_people/i);
  assert.match(calls[0].sql, /confidence_score, confidence_score_observed/i);
  assert.match(calls[0].sql, /confidence_score_observed = excluded\.confidence_score_observed/i);
  assert.equal(calls[0].values[11], 0);
  assert.equal(calls[0].values[12], 1);
  assert.equal(person.confidenceScore, 0);
  assert.equal(person.confidenceScoreObserved, true);
  assert.equal(person.scoreProvenanceContract, "business_score_observation_flags_v1");
});

test("missing people score is stored as unobserved rather than a trusted zero", async () => {
  const { env, calls } = fixture();
  const person = await saveBusinessPerson(env, {
    id: "person-2",
    name: "Taylor Example",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].values[11], 0);
  assert.equal(calls[0].values[12], 0);
  assert.equal(person.confidenceScore, null);
  assert.equal(person.confidenceScoreObserved, false);
});

test("opportunity writes preserve explicit zeros and withhold omitted scores", async () => {
  const { env, calls } = fixture();
  const opportunity = await saveBusinessOpportunity(env, {
    id: "opportunity-1",
    organizationId: "organization-1",
    fitScore: 100,
    needScore: 100,
    urgencyScore: 0,
    contactabilityScore: 100,
    evidenceQualityScore: 100,
    riskScore: 0,
    confidenceScore: 0,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /INSERT INTO business_opportunities/i);
  assert.match(calls[0].sql, /fit_score_observed/i);
  assert.match(calls[0].sql, /confidence_score_observed/i);
  assert.equal(opportunity.priority, "A");
  assert.equal(opportunity.urgencyScore, 0);
  assert.equal(opportunity.urgencyScoreObserved, true);
  assert.equal(opportunity.budgetLikelihoodScore, null);
  assert.equal(opportunity.budgetLikelihoodScoreObserved, false);
  assert.equal(opportunity.riskScore, 0);
  assert.equal(opportunity.riskScoreObserved, true);
  assert.equal(opportunity.confidenceScore, 0);
  assert.equal(opportunity.confidenceScoreObserved, true);
});

test("missing provenance schema fails the single atomic write statement", async () => {
  const { env, calls } = fixture({ failRun: true });
  await assert.rejects(
    saveBusinessPerson(env, {
      id: "person-3",
      name: "Morgan Example",
      confidenceScore: 50,
    }),
    /confidence_score_observed/,
  );
  assert.equal(calls.length, 1);
  assert.match(calls[0].sql, /confidence_score_observed/);
});
