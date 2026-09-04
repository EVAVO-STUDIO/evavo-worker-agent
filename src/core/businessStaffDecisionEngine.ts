export const BUSINESS_STAFF_DECISION_CONTRACT = "business_staff_decision_v1" as const;

export type StaffDecisionDisposition =
  | "act_internal"
  | "prepare_for_approval"
  | "escalate"
  | "defer"
  | "reject";

export type StaffAuthorityLevel =
  | "observe"
  | "internal_reversible"
  | "external_reversible"
  | "consequential";

export type StaffEvidence = Readonly<{
  id: string;
  kind: string;
  summary: string;
  observedAt: string;
  confidence: number;
  source: string;
  supports: readonly string[];
  conflicts?: readonly string[];
}>;

export type StaffDecisionRequest = Readonly<{
  id: string;
  objective: string;
  proposedAction: string;
  actionClass: "analysis" | "record_update" | "followup_plan" | "draft" | "external_action" | "spend";
  requestedAuthority: StaffAuthorityLevel;
  relationshipId?: string | null;
  organizationId?: string | null;
  personId?: string | null;
  reversible: boolean;
  externalStateChange: boolean;
  financialImpactAud?: number | null;
  stakeholderImpact: "low" | "medium" | "high";
  deadlineAt?: string | null;
  suppressionActive?: boolean;
  legalOrComplianceUncertainty?: boolean;
  identityOrRecipientUncertainty?: boolean;
  evidence: readonly StaffEvidence[];
  alternatives?: readonly string[];
}>;

export type StaffAuthorityPolicy = Readonly<{
  level: StaffAuthorityLevel;
  externalExecutionEnabled: boolean;
  maxAutonomousFinancialImpactAud: number;
  minimumEvidenceConfidence: number;
  minimumDecisionConfidence: number;
  maxEvidenceAgeDays: number;
}>;

export type StaffDecision = Readonly<{
  contract: typeof BUSINESS_STAFF_DECISION_CONTRACT;
  requestId: string;
  disposition: StaffDecisionDisposition;
  decisionConfidence: number;
  evidenceConfidence: number;
  authorityLevel: StaffAuthorityLevel;
  rationale: readonly string[];
  evidenceIds: readonly string[];
  uncertainties: readonly string[];
  alternativesConsidered: readonly string[];
  redTeamChecks: readonly string[];
  nextAction: string;
  requiresHumanApproval: boolean;
  mayMutateExternalState: boolean;
}>;

const DAY_MS = 86_400_000;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function boundedText(value: unknown, max = 500): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized && !CONTROL.test(normalized) ? normalized.slice(0, max) : null;
}

function boundedScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
    ? value
    : null;
}

function finiteNonNegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function parseObservedAt(value: string, now: number): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && parsed <= now ? parsed : null;
}

function uniqueText(values: readonly string[] | undefined, maxItems = 8): string[] {
  return [...new Set((values ?? [])
    .map((value) => boundedText(value, 300))
    .filter((value): value is string => Boolean(value)))]
    .slice(0, maxItems);
}

function evidenceAssessment(
  evidence: readonly StaffEvidence[],
  policy: StaffAuthorityPolicy,
  now: number,
) {
  const valid = evidence
    .map((item) => {
      const id = boundedText(item.id, 128);
      const summary = boundedText(item.summary, 500);
      const source = boundedText(item.source, 500);
      const confidence = boundedScore(item.confidence);
      const observedAt = parseObservedAt(item.observedAt, now);
      if (!id || !summary || !source || confidence === null || observedAt === null) return null;
      const ageDays = Math.floor((now - observedAt) / DAY_MS);
      return { item, id, confidence, ageDays };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  if (!valid.length) {
    return {
      confidence: 0,
      ids: [] as string[],
      uncertainties: ["No valid, attributable evidence supports this decision."],
      conflictCount: 0,
      staleCount: 0,
    };
  }

  const staleCount = valid.filter((item) => item.ageDays > policy.maxEvidenceAgeDays).length;
  const conflictCount = valid.reduce(
    (count, item) => count + (item.item.conflicts?.length ? 1 : 0),
    0,
  );
  const weighted = valid.reduce((sum, item) => {
    const freshness = item.ageDays <= policy.maxEvidenceAgeDays ? 1 : 0.55;
    const conflictPenalty = item.item.conflicts?.length ? 0.75 : 1;
    return sum + item.confidence * freshness * conflictPenalty;
  }, 0) / valid.length;

  const diversity = new Set(valid.map((item) => boundedText(item.item.source, 500))).size;
  const diversityBonus = Math.min(8, Math.max(0, diversity - 1) * 2);
  const confidence = Math.max(0, Math.min(100, Math.round(weighted + diversityBonus)));
  const uncertainties: string[] = [];
  if (staleCount) uncertainties.push(`${staleCount} evidence item(s) are older than the policy freshness window.`);
  if (conflictCount) uncertainties.push(`${conflictCount} evidence item(s) contain conflicting observations.`);

  return {
    confidence,
    ids: valid.map((item) => item.id),
    uncertainties,
    conflictCount,
    staleCount,
  };
}

function authorityRank(level: StaffAuthorityLevel): number {
  switch (level) {
    case "observe": return 0;
    case "internal_reversible": return 1;
    case "external_reversible": return 2;
    case "consequential": return 3;
  }
}

export function decideBusinessStaffAction(
  request: StaffDecisionRequest,
  policy: StaffAuthorityPolicy,
  now = Date.now(),
): StaffDecision {
  const objective = boundedText(request.objective, 500);
  const action = boundedText(request.proposedAction, 500);
  const evidence = evidenceAssessment(request.evidence, policy, now);
  const uncertainties = [...evidence.uncertainties];
  const rationale: string[] = [];
  const redTeamChecks: string[] = [];
  const alternatives = uniqueText(request.alternatives);
  const financialImpact = finiteNonNegative(request.financialImpactAud) ?? 0;

  if (!objective) uncertainties.push("The objective is missing or invalid.");
  if (!action) uncertainties.push("The proposed action is missing or invalid.");
  if (request.identityOrRecipientUncertainty) uncertainties.push("The stakeholder or recipient identity is uncertain.");
  if (request.legalOrComplianceUncertainty) uncertainties.push("Legal or compliance interpretation is uncertain.");

  if (request.suppressionActive) {
    return {
      contract: BUSINESS_STAFF_DECISION_CONTRACT,
      requestId: request.id,
      disposition: "reject",
      decisionConfidence: 100,
      evidenceConfidence: evidence.confidence,
      authorityLevel: policy.level,
      rationale: ["An active suppression or do-not-contact rule is a hard veto."],
      evidenceIds: evidence.ids,
      uncertainties,
      alternativesConsidered: alternatives,
      redTeamChecks: ["Suppression overrides fit, urgency, opportunity value and prior relationship history."],
      nextAction: "Keep the relationship suppressed until an authorised operator explicitly changes the suppression record.",
      requiresHumanApproval: true,
      mayMutateExternalState: false,
    };
  }

  const requestedRank = authorityRank(request.requestedAuthority);
  const permittedRank = authorityRank(policy.level);
  const authorityExceeded = requestedRank > permittedRank;
  const externalBlocked = request.externalStateChange && !policy.externalExecutionEnabled;
  const spendExceeded = request.actionClass === "spend"
    && financialImpact > policy.maxAutonomousFinancialImpactAud;
  const lowEvidence = evidence.confidence < policy.minimumEvidenceConfidence;
  const highImpact = request.stakeholderImpact === "high";
  const consequential = request.requestedAuthority === "consequential" || !request.reversible || highImpact;

  redTeamChecks.push(
    request.reversible ? "Action is represented as reversible." : "Action is not safely reversible.",
    request.externalStateChange ? "Action would mutate external state." : "Action is internal-only.",
    `Evidence confidence is ${evidence.confidence}/100.`,
  );
  if (financialImpact > 0) redTeamChecks.push(`Declared financial impact is AUD ${financialImpact}.`);
  if (evidence.conflictCount) redTeamChecks.push("Conflicting evidence prevents a clean high-confidence decision.");
  if (request.identityOrRecipientUncertainty) redTeamChecks.push("Wrong-recipient risk requires escalation before contact.");
  if (request.legalOrComplianceUncertainty) redTeamChecks.push("Compliance uncertainty must not be resolved by assumption.");

  let disposition: StaffDecisionDisposition = "act_internal";
  let nextAction = "Perform the bounded internal action and record the resulting evidence and outcome.";

  if (!objective || !action || request.identityOrRecipientUncertainty || request.legalOrComplianceUncertainty) {
    disposition = "escalate";
    nextAction = "Resolve the identified uncertainty with an authorised operator before proceeding.";
  } else if (externalBlocked || authorityExceeded || spendExceeded || consequential) {
    disposition = "prepare_for_approval";
    nextAction = "Prepare a review package with evidence, alternatives, expected outcome and rollback plan; do not execute externally.";
  } else if (lowEvidence) {
    disposition = "defer";
    nextAction = "Gather fresher or stronger attributable evidence, then re-evaluate the decision.";
  }

  if (disposition === "act_internal") {
    rationale.push("The action is within current authority, reversible, internal-only and supported by sufficient evidence.");
  } else if (disposition === "prepare_for_approval") {
    rationale.push("The action exceeds autonomous authority or has consequential/external impact, so execution is approval-gated.");
  } else if (disposition === "defer") {
    rationale.push("Evidence quality is below the minimum autonomous decision threshold.");
  } else if (disposition === "escalate") {
    rationale.push("A material ambiguity or compliance/identity uncertainty prevents a trustworthy autonomous decision.");
  }

  let decisionConfidence = evidence.confidence;
  if (evidence.conflictCount) decisionConfidence -= 10;
  if (request.stakeholderImpact === "medium") decisionConfidence -= 3;
  if (highImpact) decisionConfidence -= 8;
  if (!request.reversible) decisionConfidence -= 8;
  decisionConfidence = Math.max(0, Math.min(100, Math.round(decisionConfidence)));

  if (
    disposition === "act_internal"
    && decisionConfidence < policy.minimumDecisionConfidence
  ) {
    disposition = "defer";
    rationale.splice(0, rationale.length, "Overall decision confidence is below the autonomous action threshold.");
    nextAction = "Improve evidence or reduce uncertainty before taking the internal action.";
  }

  if (!alternatives.length) {
    alternatives.push("Take no action until more evidence is available.");
  }

  return {
    contract: BUSINESS_STAFF_DECISION_CONTRACT,
    requestId: request.id,
    disposition,
    decisionConfidence,
    evidenceConfidence: evidence.confidence,
    authorityLevel: policy.level,
    rationale,
    evidenceIds: evidence.ids,
    uncertainties,
    alternativesConsidered: alternatives,
    redTeamChecks,
    nextAction,
    requiresHumanApproval: disposition === "prepare_for_approval" || disposition === "escalate",
    mayMutateExternalState: disposition === "act_internal" ? false : false,
  };
}
