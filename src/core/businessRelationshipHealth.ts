export const BUSINESS_RELATIONSHIP_HEALTH_CONTRACT = "business_relationship_health_v1" as const;

export type RelationshipEvidenceKind =
  | "meaningful_interaction"
  | "response"
  | "meeting"
  | "commitment_kept"
  | "commitment_missed"
  | "issue_opened"
  | "issue_resolved"
  | "positive_feedback"
  | "negative_feedback"
  | "project_success"
  | "project_problem"
  | "commercial_progress"
  | "commercial_stall";

export type RelationshipEvidence = Readonly<{
  id: string;
  kind: RelationshipEvidenceKind;
  occurredAt: string;
  confidence: number;
  source: string;
  summary: string;
}>;

export type RelationshipHealth = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_HEALTH_CONTRACT;
  status: "healthy" | "attention" | "at_risk" | "insufficient_evidence";
  evidenceCoverage: "none" | "limited" | "moderate" | "strong";
  recency: Readonly<{ daysSinceMeaningfulInteraction: number | null; status: "current" | "aging" | "stale" | "unknown" }>;
  engagement: Readonly<{ value: number | null; evidenceIds: readonly string[] }>;
  reliability: Readonly<{ value: number | null; evidenceIds: readonly string[] }>;
  issuePressure: Readonly<{ value: number | null; evidenceIds: readonly string[] }>;
  relationshipSignals: Readonly<{ positive: number; negative: number; evidenceIds: readonly string[] }>;
  reasons: readonly string[];
  uncertainties: readonly string[];
  nextReviewFocus: readonly string[];
}>;

const DAY_MS = 86_400_000;

function score(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? value : null;
}

function parseTimestamp(value: string, now: number): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= now ? parsed : null;
}

function boundedEvidence(evidence: readonly RelationshipEvidence[], now: number) {
  return evidence
    .map((item) => {
      const confidence = score(item.confidence);
      const occurredAt = parseTimestamp(item.occurredAt, now);
      const id = typeof item.id === "string" && item.id.trim() ? item.id.trim().slice(0, 128) : null;
      const source = typeof item.source === "string" && item.source.trim() ? item.source.trim().slice(0, 500) : null;
      if (confidence === null || occurredAt === null || !id || !source) return null;
      return { ...item, id, confidence, occurredAt };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
}

function weightedRatio(positive: number, negative: number): number | null {
  const total = positive + negative;
  if (!total) return null;
  return Math.round((positive / total) * 100);
}

export function buildBusinessRelationshipHealth(
  evidence: readonly RelationshipEvidence[],
  now = Date.now(),
): RelationshipHealth {
  const valid = boundedEvidence(evidence, now);
  const reasons: string[] = [];
  const uncertainties: string[] = [];
  const nextReviewFocus: string[] = [];

  const interactionKinds = new Set<RelationshipEvidenceKind>(["meaningful_interaction", "response", "meeting"]);
  const interactions = valid.filter((item) => interactionKinds.has(item.kind));
  const latestInteraction = interactions.length
    ? Math.max(...interactions.map((item) => item.occurredAt))
    : null;
  const daysSinceMeaningfulInteraction = latestInteraction === null
    ? null
    : Math.floor((now - latestInteraction) / DAY_MS);
  const recencyStatus = daysSinceMeaningfulInteraction === null
    ? "unknown" as const
    : daysSinceMeaningfulInteraction <= 21
      ? "current" as const
      : daysSinceMeaningfulInteraction <= 60
        ? "aging" as const
        : "stale" as const;

  const engagementPositive = valid
    .filter((item) => ["meaningful_interaction", "response", "meeting", "commercial_progress"].includes(item.kind))
    .reduce((sum, item) => sum + item.confidence, 0);
  const engagementNegative = valid
    .filter((item) => item.kind === "commercial_stall")
    .reduce((sum, item) => sum + item.confidence, 0);
  const engagementIds = valid
    .filter((item) => ["meaningful_interaction", "response", "meeting", "commercial_progress", "commercial_stall"].includes(item.kind))
    .map((item) => item.id);
  const engagement = weightedRatio(engagementPositive, engagementNegative);

  const reliabilityPositive = valid
    .filter((item) => item.kind === "commitment_kept")
    .reduce((sum, item) => sum + item.confidence, 0);
  const reliabilityNegative = valid
    .filter((item) => item.kind === "commitment_missed")
    .reduce((sum, item) => sum + item.confidence, 0);
  const reliabilityIds = valid
    .filter((item) => item.kind === "commitment_kept" || item.kind === "commitment_missed")
    .map((item) => item.id);
  const reliability = weightedRatio(reliabilityPositive, reliabilityNegative);

  const issuePositive = valid
    .filter((item) => item.kind === "issue_opened" || item.kind === "project_problem")
    .reduce((sum, item) => sum + item.confidence, 0);
  const issueRelief = valid
    .filter((item) => item.kind === "issue_resolved")
    .reduce((sum, item) => sum + item.confidence, 0);
  const issueIds = valid
    .filter((item) => ["issue_opened", "issue_resolved", "project_problem"].includes(item.kind))
    .map((item) => item.id);
  const issuePressure = issuePositive + issueRelief
    ? Math.max(0, Math.min(100, Math.round((issuePositive / (issuePositive + issueRelief)) * 100)))
    : null;

  const positiveSignals = valid
    .filter((item) => ["positive_feedback", "project_success", "commercial_progress", "commitment_kept"].includes(item.kind))
    .length;
  const negativeSignals = valid
    .filter((item) => ["negative_feedback", "project_problem", "commercial_stall", "commitment_missed"].includes(item.kind))
    .length;
  const signalIds = valid
    .filter((item) => [
      "positive_feedback", "negative_feedback", "project_success", "project_problem",
      "commercial_progress", "commercial_stall", "commitment_kept", "commitment_missed",
    ].includes(item.kind))
    .map((item) => item.id);

  const sourceCount = new Set(valid.map((item) => item.source)).size;
  const evidenceCoverage = valid.length === 0
    ? "none" as const
    : valid.length < 3 || sourceCount < 2
      ? "limited" as const
      : valid.length < 7
        ? "moderate" as const
        : "strong" as const;

  if (recencyStatus === "stale") reasons.push("There has been no evidenced meaningful interaction for more than 60 days.");
  if (recencyStatus === "aging") reasons.push("The relationship is aging and should be reviewed before it becomes stale.");
  if (reliability !== null && reliability < 50) reasons.push("Missed commitments outweigh evidenced kept commitments.");
  if (issuePressure !== null && issuePressure >= 60) reasons.push("Open/problem evidence outweighs evidenced issue resolution.");
  if (negativeSignals > positiveSignals) reasons.push("Negative relationship signals currently outnumber positive signals.");
  if (engagement !== null && engagement >= 70 && recencyStatus === "current") reasons.push("Recent engagement evidence is strong.");
  if (reliability !== null && reliability >= 70) reasons.push("Commitment reliability evidence is positive.");

  if (recencyStatus === "unknown") uncertainties.push("No canonical meaningful-interaction evidence is available.");
  if (engagement === null) uncertainties.push("Engagement cannot be assessed from the available evidence.");
  if (reliability === null) uncertainties.push("Commitment reliability is unknown because no kept/missed commitment evidence is available.");
  if (issuePressure === null) uncertainties.push("Issue pressure is unknown because no issue evidence is available.");
  if (evidenceCoverage === "limited") uncertainties.push("Evidence coverage is limited; avoid treating this projection as a complete relationship picture.");

  if (recencyStatus === "aging" || recencyStatus === "stale") nextReviewFocus.push("Check whether a meaningful follow-up is due and whether EVAVO owes the next move.");
  if (reliability !== null && reliability < 70) nextReviewFocus.push("Review open commitments, owners and due dates.");
  if (issuePressure !== null && issuePressure >= 40) nextReviewFocus.push("Review unresolved issues and recovery actions before pursuing new commercial activity.");
  if (negativeSignals) nextReviewFocus.push("Read the underlying negative evidence before drafting or recommending outreach.");
  if (!nextReviewFocus.length) nextReviewFocus.push("Maintain normal review cadence and keep relationship evidence current.");

  let status: RelationshipHealth["status"] = "healthy";
  if (evidenceCoverage === "none" || evidenceCoverage === "limited") {
    status = "insufficient_evidence";
  } else if (
    recencyStatus === "stale"
    || (reliability !== null && reliability < 40)
    || (issuePressure !== null && issuePressure >= 70)
    || negativeSignals >= positiveSignals + 2
  ) {
    status = "at_risk";
  } else if (
    recencyStatus === "aging"
    || (reliability !== null && reliability < 70)
    || (issuePressure !== null && issuePressure >= 40)
    || negativeSignals > positiveSignals
  ) {
    status = "attention";
  }

  return {
    contract: BUSINESS_RELATIONSHIP_HEALTH_CONTRACT,
    status,
    evidenceCoverage,
    recency: { daysSinceMeaningfulInteraction, status: recencyStatus },
    engagement: { value: engagement, evidenceIds: engagementIds },
    reliability: { value: reliability, evidenceIds: reliabilityIds },
    issuePressure: { value: issuePressure, evidenceIds: issueIds },
    relationshipSignals: { positive: positiveSignals, negative: negativeSignals, evidenceIds: signalIds },
    reasons,
    uncertainties,
    nextReviewFocus,
  };
}
