import assert from "node:assert/strict";
import test from "node:test";

import { assertNoCriticalCommunicationErrors, calculateCommunicationQualityMetrics } from "../src/core/businessCommunicationQualityMetrics";

test("quality metrics expose severe communication failures separately from volume", () => {
  const metrics = calculateCommunicationQualityMetrics([
    {
      wrongRecipient: false, missedQuestionCount: 0, unsupportedClaimCount: 0, unauthorisedCommitmentCount: 0,
      wrongAttachment: false, unnecessaryReply: false, unnecessaryMeeting: false, approvalDrift: false,
      escalationExpected: false, escalated: false, humanEditDistance: 0.08, humanEditReasons: ["warmer opening"],
      finalApproved: true, sent: true, relationshipOutcome: "positive", confidence: 92, decisionCorrect: true,
    },
    {
      wrongRecipient: false, missedQuestionCount: 1, unsupportedClaimCount: 0, unauthorisedCommitmentCount: 0,
      wrongAttachment: false, unnecessaryReply: false, unnecessaryMeeting: false, approvalDrift: false,
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

test("critical guard rejects recipient, attachment, approval drift and authority errors", () => {
  const metrics = calculateCommunicationQualityMetrics([{
    wrongRecipient: true, missedQuestionCount: 0, unsupportedClaimCount: 0, unauthorisedCommitmentCount: 0,
    wrongAttachment: false, unnecessaryReply: false, unnecessaryMeeting: false, approvalDrift: false,
  }]);
  assert.throws(() => assertNoCriticalCommunicationErrors(metrics), /WRONG_RECIPIENT/);
});

test("confidence calibration rewards confidence that matches observed correctness", () => {
  const wellCalibrated = calculateCommunicationQualityMetrics([
    { wrongRecipient: false, missedQuestionCount: 0, unsupportedClaimCount: 0, unauthorisedCommitmentCount: 0, wrongAttachment: false, unnecessaryReply: false, unnecessaryMeeting: false, approvalDrift: false, confidence: 95, decisionCorrect: true },
    { wrongRecipient: false, missedQuestionCount: 0, unsupportedClaimCount: 0, unauthorisedCommitmentCount: 0, wrongAttachment: false, unnecessaryReply: false, unnecessaryMeeting: false, approvalDrift: false, confidence: 10, decisionCorrect: false },
  ]);
  assert.ok((wellCalibrated.confidenceCalibrationError ?? 1) < 0.1);
});
