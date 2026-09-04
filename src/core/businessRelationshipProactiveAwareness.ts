export const BUSINESS_RELATIONSHIP_PROACTIVE_AWARENESS_CONTRACT = "business_relationship_proactive_awareness_v1" as const;

export type ProactiveSignalKind =
  | "evavo_commitment_due"
  | "evavo_commitment_overdue"
  | "counterparty_commitment_overdue"
  | "client_waiting_too_long"
  | "stale_relationship"
  | "unresolved_issue"
  | "delivery_risk"
  | "commercial_risk"
  | "relationship_repair_needed"
  | "update_before_chase"
  | "nothing_to_do";

export type ProactiveAwarenessInput = Readonly<{
  now: string;
  relationshipId?: string | null;
  relationshipType?: "active_client" | "prospective_client" | "partner" | "supplier" | "internal" | "other";
  lastMeaningfulInteractionAt?: string | null;
  lastOutboundUpdateAt?: string | null;
  unresolvedIssueCount?: number;
  relationshipAtRisk?: boolean;
  deliveryBlocked?: boolean;
  materialCommercialRisk?: boolean;
  evavoOwnsNextMove?: boolean;
  evavoCommitmentDueAt?: string | null;
  counterpartyCommitmentDueAt?: string | null;
  counterpartyWaitingOnEvavo?: boolean;
  promisedUpdateDueAt?: string | null;
  suppressionActive?: boolean;
}>;

export type ProactiveAwarenessDecision = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_PROACTIVE_AWARENESS_CONTRACT;
  signals: readonly Readonly<{
    kind: ProactiveSignalKind;
    severity: "info" | "attention" | "high" | "critical";
    reason: string;
    recommendedAction: "none" | "prepare_update" | "create_internal_task" | "escalate" | "review_relationship";
  }>[];
  shouldActBeforeInbound: boolean;
  highestSeverity: "info" | "attention" | "high" | "critical";
}>;

function ms(value?: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function daysBetween(a: number, b: number): number {
  return Math.floor((a - b) / 86_400_000);
}

const SEVERITY_RANK = { info: 0, attention: 1, high: 2, critical: 3 } as const;

export function assessProactiveRelationshipAwareness(input: ProactiveAwarenessInput): ProactiveAwarenessDecision {
  const now = ms(input.now);
  if (now === null) throw new Error("PROACTIVE_AWARENESS_INVALID_NOW");

  if (input.suppressionActive) {
    return {
      contract: BUSINESS_RELATIONSHIP_PROACTIVE_AWARENESS_CONTRACT,
      signals: [{
        kind: "nothing_to_do",
        severity: "info",
        reason: "Suppression is active; no proactive external communication should be prepared.",
        recommendedAction: "none",
      }],
      shouldActBeforeInbound: false,
      highestSeverity: "info",
    };
  }

  const signals: Array<ProactiveAwarenessDecision["signals"][number]> = [];
  const evavoDue = ms(input.evavoCommitmentDueAt);
  const counterpartyDue = ms(input.counterpartyCommitmentDueAt);
  const promisedUpdateDue = ms(input.promisedUpdateDueAt);
  const lastInteraction = ms(input.lastMeaningfulInteractionAt);
  const lastOutbound = ms(input.lastOutboundUpdateAt);

  if (input.relationshipAtRisk) {
    signals.push({ kind: "relationship_repair_needed", severity: "critical", reason: "Relationship evidence indicates material risk that should be reviewed before normal outreach.", recommendedAction: "escalate" });
  }
  if (input.deliveryBlocked) {
    signals.push({ kind: "delivery_risk", severity: "critical", reason: "Delivery is blocked; the responsible owner should act before the counterparty needs to chase.", recommendedAction: "create_internal_task" });
  }
  if (input.materialCommercialRisk) {
    signals.push({ kind: "commercial_risk", severity: "high", reason: "A material commercial risk is unresolved and deserves proactive internal review.", recommendedAction: "review_relationship" });
  }
  if ((input.unresolvedIssueCount ?? 0) > 0) {
    signals.push({ kind: "unresolved_issue", severity: (input.unresolvedIssueCount ?? 0) > 2 ? "high" : "attention", reason: `${input.unresolvedIssueCount} unresolved relationship or service issue(s) remain open.`, recommendedAction: "review_relationship" });
  }

  if (input.evavoOwnsNextMove && evavoDue !== null) {
    const overdueDays = daysBetween(now, evavoDue);
    if (overdueDays > 0) {
      signals.push({ kind: "evavo_commitment_overdue", severity: overdueDays >= 3 ? "critical" : "high", reason: `An EVAVO-owned commitment is overdue by ${overdueDays} day(s).`, recommendedAction: "create_internal_task" });
    } else if (overdueDays === 0) {
      signals.push({ kind: "evavo_commitment_due", severity: "high", reason: "An EVAVO-owned commitment is due now.", recommendedAction: "create_internal_task" });
    }
  }

  if (promisedUpdateDue !== null && now >= promisedUpdateDue) {
    signals.push({ kind: "update_before_chase", severity: "high", reason: "A promised update is due; prepare the update before the counterparty has to ask for it.", recommendedAction: "prepare_update" });
  }

  if (input.counterpartyWaitingOnEvavo && lastOutbound !== null) {
    const waitingDays = daysBetween(now, lastOutbound);
    if (waitingDays >= 2) {
      signals.push({ kind: "client_waiting_too_long", severity: waitingDays >= 5 ? "high" : "attention", reason: `The counterparty appears to have been waiting on EVAVO for ${waitingDays} day(s).`, recommendedAction: "prepare_update" });
    }
  }

  if (counterpartyDue !== null && now > counterpartyDue) {
    const overdueDays = daysBetween(now, counterpartyDue);
    signals.push({ kind: "counterparty_commitment_overdue", severity: overdueDays >= 5 ? "attention" : "info", reason: `A counterparty-owned commitment is overdue by ${overdueDays} day(s); review whether a proportionate follow-up is actually needed.`, recommendedAction: "review_relationship" });
  }

  if (lastInteraction !== null && ["active_client", "partner"].includes(input.relationshipType ?? "other")) {
    const staleDays = daysBetween(now, lastInteraction);
    if (staleDays >= 45) {
      signals.push({ kind: "stale_relationship", severity: staleDays >= 90 ? "attention" : "info", reason: `No meaningful interaction is recorded for ${staleDays} day(s).`, recommendedAction: "review_relationship" });
    }
  }

  if (signals.length === 0) {
    signals.push({ kind: "nothing_to_do", severity: "info", reason: "No evidence-backed proactive action is currently warranted.", recommendedAction: "none" });
  }

  const highestSeverity = signals.reduce<ProactiveAwarenessDecision["highestSeverity"]>((current, item) =>
    SEVERITY_RANK[item.severity] > SEVERITY_RANK[current] ? item.severity : current,
  "info");

  return {
    contract: BUSINESS_RELATIONSHIP_PROACTIVE_AWARENESS_CONTRACT,
    signals,
    shouldActBeforeInbound: signals.some((item) => item.recommendedAction === "prepare_update" || item.recommendedAction === "create_internal_task" || item.recommendedAction === "escalate"),
    highestSeverity,
  };
}
