import assert from "node:assert/strict";
import test from "node:test";

import {
  BUSINESS_ACCOUNT_DIMENSION_EVIDENCE_CONTRACT,
  BUSINESS_ACCOUNT_DIMENSION_ITEM_LIMIT,
  BUSINESS_ACCOUNT_DIMENSION_KEYS,
  buildBusinessAccountDimensionEvidence,
  businessAccountDimensionCoverage,
} from "../src/core/businessAccountDimensionEvidence";

const OBSERVED_AT = Date.parse("2026-07-28T00:00:00.000Z");

function signal(
  id: string,
  signalType: string,
  overrides: Record<string, unknown> = {},
) {
  return {
    id,
    signalType,
    evidenceSummary: `Reviewed evidence for ${signalType}.`,
    evidenceUrl: `https://example.test/evidence/${id}`,
    signalStrength: 0,
    confidenceScore: 80,
    riskFlags: [],
    createdAt: "2026-07-01T00:00:00.000Z",
    updatedAt: "2026-07-20T00:00:00.000Z",
    ...overrides,
  };
}

test("dimension register is complete, deterministic and preserves observed zero", () => {
  const register = buildBusinessAccountDimensionEvidence([
    signal("signal-tech", "technology_stack", {
      signalStrength: 0,
      confidenceScore: 85,
      updatedAt: "2026-07-24T00:00:00.000Z",
    }),
    signal("signal-tender", "procurement_tender", {
      signalStrength: 72,
      confidenceScore: 90,
      updatedAt: "2026-07-25T00:00:00.000Z",
    }),
    signal("signal-friction", "conversion_friction", {
      signalStrength: 66,
      confidenceScore: 70,
      riskFlags: ["review_required"],
      updatedAt: "2026-07-23T00:00:00.000Z",
    }),
  ], OBSERVED_AT);

  assert.equal(
    BUSINESS_ACCOUNT_DIMENSION_EVIDENCE_CONTRACT,
    "business_account_360_dimension_evidence_v1",
  );
  assert.deepEqual(Object.keys(register), [...BUSINESS_ACCOUNT_DIMENSION_KEYS]);
  assert.equal(Object.isFrozen(register), true);

  assert.equal(register.technology.status, "stored_evidence_present");
  assert.equal(register.technology.evidenceCount, 1);
  assert.deepEqual(register.technology.matchedSignalTypes, ["technology_stack"]);
  assert.equal(register.technology.maximumSignalStrengthScore, 0);
  assert.equal(register.technology.maximumConfidenceScore, 85);
  assert.equal(register.technology.latestEvidenceAt, "2026-07-24T00:00:00.000Z");
  assert.equal(register.technology.evidenceItems[0]?.signalId, "signal-tech");
  assert.equal(register.technology.evidenceItems[0]?.signalStrength, 0);

  assert.equal(register.procurement.evidenceCount, 1);
  assert.equal(register.procurement.maximumSignalStrengthScore, 72);
  assert.equal(register.painPoints.evidenceCount, 1);
  assert.deepEqual(register.painPoints.evidenceItems[0]?.riskFlags, ["review_required"]);

  assert.equal(register.funding.status, "not_evidenced");
  assert.equal(register.funding.evidenceCount, 0);
  assert.equal(register.funding.maximumSignalStrengthScore, null);
  assert.equal(register.funding.maximumConfidenceScore, null);
  assert.equal(register.funding.latestEvidenceAt, null);
  assert.deepEqual(register.funding.evidenceItems, []);
  assert.match(register.funding.uncertainty, /no conclusion is available/i);
});

test("dimension evidence is bounded, newest-first and explicit about item truncation", () => {
  const signals = Array.from(
    { length: BUSINESS_ACCOUNT_DIMENSION_ITEM_LIMIT + 2 },
    (_, index) => signal(`signal-tech-${index}`, "technology_platform", {
      signalStrength: index,
      confidenceScore: 60 + index,
      updatedAt: `2026-07-${String(10 + index).padStart(2, "0")}T00:00:00.000Z`,
    }),
  );
  const register = buildBusinessAccountDimensionEvidence(signals, OBSERVED_AT);
  const technology = register.technology;

  assert.equal(technology.evidenceCount, signals.length);
  assert.equal(technology.evidenceItems.length, BUSINESS_ACCOUNT_DIMENSION_ITEM_LIMIT);
  assert.equal(technology.evidenceItemsMayBeTruncated, true);
  assert.equal(technology.evidenceItems[0]?.signalId, "signal-tech-6");
  assert.equal(technology.evidenceItems.at(-1)?.signalId, "signal-tech-2");
  assert.equal(technology.latestEvidenceAt, "2026-07-16T00:00:00.000Z");
  assert.equal(technology.maximumSignalStrengthScore, 6);
  assert.equal(technology.maximumConfidenceScore, 66);
});

test("invalid scores, unsafe URLs and future timestamps are withheld without inventing evidence", () => {
  const register = buildBusinessAccountDimensionEvidence([
    signal("signal-budget", "budget_spend", {
      evidenceUrl: "javascript:alert(1)",
      signalStrength: "80",
      confidenceScore: 101,
      createdAt: "not-a-timestamp",
      updatedAt: "2099-01-01T00:00:00.000Z",
    }),
  ], OBSERVED_AT);
  const budget = register.budgetSignals;
  const item = budget.evidenceItems[0];

  assert.equal(budget.status, "stored_evidence_present");
  assert.equal(budget.maximumSignalStrengthScore, null);
  assert.equal(budget.maximumConfidenceScore, null);
  assert.equal(budget.latestEvidenceAt, null);
  assert.equal(item?.evidenceUrl, null);
  assert.equal(item?.signalStrength, null);
  assert.equal(item?.confidenceScore, null);
  assert.equal(item?.observedAt, null);
});

test("coverage projection remains compatible while using the richer register as source", () => {
  const register = buildBusinessAccountDimensionEvidence([
    signal("signal-product", "product_launch"),
  ], OBSERVED_AT);
  const coverage = businessAccountDimensionCoverage(register);

  assert.deepEqual(coverage.products, {
    status: "stored_evidence_present",
    matchedSignalTypes: ["product_launch"],
  });
  assert.deepEqual(coverage.competitors, {
    status: "not_evidenced",
    matchedSignalTypes: [],
  });
  assert.equal(Object.isFrozen(coverage), true);
  assert.equal(Object.isFrozen(coverage.products), true);
});
