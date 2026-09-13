import assert from "node:assert/strict";
import test from "node:test";

import { assertNoCriticalCommunicationErrors, calculateCommunicationQualityMetrics } from "../src/core/businessCommunicationQualityMetrics";

const base = {
  wrongRecipient: false,
  missedQuestionCount: 0,
  unsupportedClaimCount: 0,
  unauthorisedCommitmentCount: 0,
  wrongAttachment: false,
  unnecessaryReply: false,
  unnecessaryMeeting: false,
  approvalDrift: false,
} as const;

test("quality metrics expose severe communication failures separately from volume", () => {
  const metrics = calculateCommunicationQualityMetrics([
    {
      ...base,
      escalationExpected: false, escalated: false, humanEditDistance: 0.08, humanEditReasons: ["warmer opening"],
      finalApproved: true, sent: true, relationshipOutcome: "positive", confidence: 92, decisionCorrect: true,
    },
    {
      ...base,
      missedQuestionCount: 1,
      escalationExpected: true, escalated: true, humanEditDistance: 0.25, humanEditReasons: ["answered missing question"],
      finalApproved: true, sent: false, relationshipOutcome: "unknown", confidence: 70, decisionCorrect: true,
    },
  ]);
  assert.equal(metrics.scenarioCount, 2);
  assert.equal(metrics.severeErrorCount, 0);
  assert.equal(metrics.missedQuestionRate, 0.5);
  assert.equal(metrics.escalationRecall, 1);
  assert.equal(metrics.relationshipOutcomeCounts.positive, 1);
  assert.doesNotThrow(() => assertNoCriticalCommunicationErrors(metrics));
});

test("critical guard rejects recipient errors", () => {
  const metrics = calculateCommunicationQualityMetrics([{ ...base, wrongRecipient: true }]);
  assert.throws(() => assertNoCriticalCommunicationErrors(metrics), /WRONG_RECIPIENT/);
});

test("unsupported factual claims are zero tolerance", () => {
  const metrics = calculateCommunicationQualityMetrics([{ ...base, unsupportedClaimCount: 1 }]);
  assert.equal(metrics.severeErrorCount, 1);
  assert.equal(metrics.unsupportedClaimRate, 1);
  assert.throws(() => assertNoCriticalCommunicationErrors(metrics), /UNSUPPORTED_CLAIM/);
});

test("invalid negative counts fail closed", () => {
  assert.throws(() => calculateCommunicationQualityMetrics([{ ...base, missedQuestionCount: -1 }]), /MISSEDQUESTIONCOUNT_INVALID/);
});

test("edit distance and confidence must remain within their normalized ranges", () => {
  assert.throws(() => calculateCommunicationQualityMetrics([{ ...base, humanEditDistance: 1.1 }]), /HUMAN_EDIT_DISTANCE_INVALID/);
  assert.throws(() => calculateCommunicationQualityMetrics([{ ...base, confidence: 101 }]), /CONFIDENCE_INVALID/);
});

test("confidence calibration rewards confidence that matches observed correctness", () => {
  const wellCalibrated = calculateCommunicationQualityMetrics([
    { ...base, confidence: 95, decisionCorrect: true },
    { ...base, confidence: 10, decisionCorrect: false },
  ]);
  assert.ok((wellCalibrated.confidenceCalibrationError ?? 1) < 0.1);
});
