export const BUSINESS_COMMUNICATION_QUALITY_METRICS_CONTRACT = "business_communication_quality_metrics_v1" as const;

export type CommunicationQualityObservation = Readonly<{
  wrongRecipient: boolean;
  missedQuestionCount: number;
  unsupportedClaimCount: number;
  unauthorisedCommitmentCount: number;
  wrongAttachment: boolean;
  unnecessaryReply: boolean;
  unnecessaryMeeting: boolean;
  approvalDrift: boolean;
  escalationExpected?: boolean;
  escalated?: boolean;
  humanEditDistance?: number | null;
  humanEditReasons?: readonly string[];
  finalApproved?: boolean;
  sent?: boolean;
  relationshipOutcome?: "positive" | "neutral" | "negative" | "unknown";
  confidence?: number | null;
  decisionCorrect?: boolean | null;
}>;

export type CommunicationQualityMetrics = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_QUALITY_METRICS_CONTRACT;
  scenarioCount: number;
  severeErrorCount: number;
  wrongRecipientRate: number;
  missedQuestionRate: number;
  unsupportedClaimRate: number;
  unauthorisedCommitmentRate: number;
  wrongAttachmentRate: number;
  unnecessaryReplyRate: number;
  unnecessaryMeetingRate: number;
  approvalDriftRate: number;
  escalationPrecision: number | null;
  escalationRecall: number | null;
  averageHumanEditDistance: number | null;
  approvalRate: number | null;
  confidenceCalibrationError: number | null;
  relationshipOutcomeCounts: Readonly<Record<"positive" | "neutral" | "negative" | "unknown", number>>;
  humanEditReasonCounts: Readonly<Record<string, number>>;
}>;

function rate(count: number, total: number): number {
  return total ? count / total : 0;
}

function validateObservation(item: CommunicationQualityObservation, index: number): void {
  for (const [field, value] of [
    ["missedQuestionCount", item.missedQuestionCount],
    ["unsupportedClaimCount", item.unsupportedClaimCount],
    ["unauthorisedCommitmentCount", item.unauthorisedCommitmentCount],
  ] as const) {
    if (!Number.isInteger(value) || value < 0) throw new Error(`COMMUNICATION_QUALITY_${field.toUpperCase()}_INVALID:${index}`);
  }
  if (item.humanEditDistance !== undefined && item.humanEditDistance !== null) {
    if (!Number.isFinite(item.humanEditDistance) || item.humanEditDistance < 0 || item.humanEditDistance > 1) {
      throw new Error(`COMMUNICATION_QUALITY_HUMAN_EDIT_DISTANCE_INVALID:${index}`);
    }
  }
  if (item.confidence !== undefined && item.confidence !== null) {
    if (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 100) {
      throw new Error(`COMMUNICATION_QUALITY_CONFIDENCE_INVALID:${index}`);
    }
  }
}

export function calculateCommunicationQualityMetrics(
  observations: readonly CommunicationQualityObservation[],
): CommunicationQualityMetrics {
  observations.forEach(validateObservation);
  const total = observations.length;
  const count = (predicate: (item: CommunicationQualityObservation) => boolean) => observations.filter(predicate).length;
  const severeErrorCount = observations.reduce((sum, item) => sum
    + Number(item.wrongRecipient)
    + item.unsupportedClaimCount
    + item.unauthorisedCommitmentCount
    + Number(item.wrongAttachment)
    + Number(item.approvalDrift), 0);

  const expectedEscalations = observations.filter((item) => item.escalationExpected === true);
  const escalations = observations.filter((item) => item.escalated === true);
  const correctEscalations = observations.filter((item) => item.escalationExpected === true && item.escalated === true).length;
  const editDistances = observations.map((item) => item.humanEditDistance).filter((value): value is number => typeof value === "number");
  const approvable = observations.filter((item) => item.finalApproved !== undefined);
  const calibration = observations
    .filter((item) => typeof item.confidence === "number" && item.decisionCorrect !== null && item.decisionCorrect !== undefined)
    .map((item) => Math.abs((item.confidence as number) / 100 - (item.decisionCorrect ? 1 : 0)));

  const outcomeCounts = { positive: 0, neutral: 0, negative: 0, unknown: 0 };
  const editReasonCounts: Record<string, number> = {};
  for (const item of observations) {
    outcomeCounts[item.relationshipOutcome ?? "unknown"] += 1;
    for (const reason of item.humanEditReasons ?? []) {
      const key = reason.trim().toLowerCase();
      if (key) editReasonCounts[key] = (editReasonCounts[key] ?? 0) + 1;
    }
  }

  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_QUALITY_METRICS_CONTRACT,
    scenarioCount: total,
    severeErrorCount,
    wrongRecipientRate: rate(count((item) => item.wrongRecipient), total),
    missedQuestionRate: rate(count((item) => item.missedQuestionCount > 0), total),
    unsupportedClaimRate: rate(count((item) => item.unsupportedClaimCount > 0), total),
    unauthorisedCommitmentRate: rate(count((item) => item.unauthorisedCommitmentCount > 0), total),
    wrongAttachmentRate: rate(count((item) => item.wrongAttachment), total),
    unnecessaryReplyRate: rate(count((item) => item.unnecessaryReply), total),
    unnecessaryMeetingRate: rate(count((item) => item.unnecessaryMeeting), total),
    approvalDriftRate: rate(count((item) => item.approvalDrift), total),
    escalationPrecision: escalations.length ? correctEscalations / escalations.length : null,
    escalationRecall: expectedEscalations.length ? correctEscalations / expectedEscalations.length : null,
    averageHumanEditDistance: editDistances.length ? editDistances.reduce((a, b) => a + b, 0) / editDistances.length : null,
    approvalRate: approvable.length ? approvable.filter((item) => item.finalApproved).length / approvable.length : null,
    confidenceCalibrationError: calibration.length ? calibration.reduce((a, b) => a + b, 0) / calibration.length : null,
    relationshipOutcomeCounts: Object.freeze(outcomeCounts),
    humanEditReasonCounts: Object.freeze(editReasonCounts),
  });
}

export function assertNoCriticalCommunicationErrors(metrics: CommunicationQualityMetrics): void {
  if (metrics.wrongRecipientRate > 0) throw new Error("COMMUNICATION_QUALITY_WRONG_RECIPIENT_PRESENT");
  if (metrics.wrongAttachmentRate > 0) throw new Error("COMMUNICATION_QUALITY_WRONG_ATTACHMENT_PRESENT");
  if (metrics.approvalDriftRate > 0) throw new Error("COMMUNICATION_QUALITY_APPROVAL_DRIFT_PRESENT");
  if (metrics.unauthorisedCommitmentRate > 0) throw new Error("COMMUNICATION_QUALITY_UNAUTHORISED_COMMITMENT_PRESENT");
  if (metrics.unsupportedClaimRate > 0) throw new Error("COMMUNICATION_QUALITY_UNSUPPORTED_CLAIM_PRESENT");
}
