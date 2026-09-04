export const BUSINESS_STAFF_PRIORITY_CONTRACT = "business_staff_priority_v1" as const;

export type StaffWorkKind =
  | "relationship_repair"
  | "existing_client_commitment"
  | "delivery_blocker"
  | "support_issue"
  | "invoice_or_payment"
  | "proposal_or_scope"
  | "internal_dependency"
  | "partner_or_supplier"
  | "new_lead"
  | "routine_admin";

export type StaffPriorityInput = Readonly<{
  id: string;
  kind: StaffWorkKind;
  relationshipRisk: "low" | "medium" | "high";
  stakeholderImpact: "low" | "medium" | "high";
  evavoOwesNextMove: boolean;
  explicitCommitment: boolean;
  overdue: boolean;
  blocksDelivery: boolean;
  blocksRevenue: boolean;
  deadlineAt?: string | null;
  createdAt: string;
  evidenceConfidence: number;
  reversibleDelay: boolean;
  commercialValueAud?: number | null;
}>;

export type StaffPriorityDecision = Readonly<{
  contract: typeof BUSINESS_STAFF_PRIORITY_CONTRACT;
  id: string;
  score: number;
  band: "critical" | "high" | "normal" | "low";
  reasons: readonly string[];
  deprioritisationReasons: readonly string[];
}>;

const KIND_WEIGHT: Record<StaffWorkKind, number> = {
  relationship_repair: 34,
  existing_client_commitment: 30,
  delivery_blocker: 28,
  support_issue: 24,
  invoice_or_payment: 18,
  proposal_or_scope: 16,
  internal_dependency: 14,
  partner_or_supplier: 10,
  new_lead: 8,
  routine_admin: 2,
};

const DAY_MS = 86_400_000;

function riskWeight(value: StaffPriorityInput["relationshipRisk"]): number {
  return value === "high" ? 22 : value === "medium" ? 10 : 0;
}

function impactWeight(value: StaffPriorityInput["stakeholderImpact"]): number {
  return value === "high" ? 18 : value === "medium" ? 8 : 0;
}

function dueWeight(deadlineAt: string | null | undefined, now: number): { score: number; reason?: string } {
  if (!deadlineAt) return { score: 0 };
  const due = Date.parse(deadlineAt);
  if (!Number.isFinite(due)) return { score: 0 };
  const delta = due - now;
  if (delta < 0) return { score: 20, reason: "The work is past its evidenced deadline." };
  if (delta <= DAY_MS) return { score: 15, reason: "The evidenced deadline is within 24 hours." };
  if (delta <= 3 * DAY_MS) return { score: 8, reason: "The evidenced deadline is within three days." };
  return { score: 0 };
}

export function prioritiseStaffWork(input: StaffPriorityInput, now = Date.now()): StaffPriorityDecision {
  const reasons: string[] = [];
  const deprioritisationReasons: string[] = [];
  let score = KIND_WEIGHT[input.kind];

  if (input.kind === "relationship_repair") reasons.push("Relationship repair outranks ordinary commercial pursuit because unresolved trust damage compounds quickly.");
  if (input.kind === "existing_client_commitment") reasons.push("An existing client commitment should generally outrank speculative new business.");
  if (input.blocksDelivery) { score += 22; reasons.push("This work blocks delivery."); }
  if (input.blocksRevenue) { score += 10; reasons.push("This work blocks recognised or near-term revenue."); }
  if (input.evavoOwesNextMove) { score += 12; reasons.push("EVAVO owns the next move."); }
  if (input.explicitCommitment) { score += 14; reasons.push("EVAVO made an explicit commitment tied to this work."); }
  if (input.overdue) { score += 15; reasons.push("The work is already overdue."); }

  score += riskWeight(input.relationshipRisk);
  if (input.relationshipRisk === "high") reasons.push("Relationship risk is high.");
  else if (input.relationshipRisk === "medium") reasons.push("Relationship risk is elevated.");

  score += impactWeight(input.stakeholderImpact);
  if (input.stakeholderImpact === "high") reasons.push("Stakeholder impact is high.");
  else if (input.stakeholderImpact === "medium") reasons.push("Stakeholder impact is material.");

  const due = dueWeight(input.deadlineAt, now);
  score += due.score;
  if (due.reason) reasons.push(due.reason);

  if (input.evidenceConfidence < 60) {
    score -= 12;
    deprioritisationReasons.push("Evidence confidence is low, so urgency should not be manufactured from uncertain context.");
  }

  if (input.kind === "new_lead" && !input.blocksRevenue && !input.explicitCommitment) {
    deprioritisationReasons.push("A new lead should not displace existing commitments, delivery blockers, support problems or relationship repair by default.");
  }

  if (input.reversibleDelay && input.kind === "routine_admin") {
    score -= 8;
    deprioritisationReasons.push("This routine work can be delayed with little downside.");
  }

  const commercialValue = typeof input.commercialValueAud === "number" && Number.isFinite(input.commercialValueAud)
    ? Math.max(0, input.commercialValueAud)
    : 0;
  if (commercialValue >= 100_000) score += 8;
  else if (commercialValue >= 25_000) score += 4;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const band = score >= 75 ? "critical" : score >= 55 ? "high" : score >= 25 ? "normal" : "low";

  return {
    contract: BUSINESS_STAFF_PRIORITY_CONTRACT,
    id: input.id,
    score,
    band,
    reasons,
    deprioritisationReasons,
  };
}

export function rankStaffWork(items: readonly StaffPriorityInput[], now = Date.now()): readonly StaffPriorityDecision[] {
  return items
    .map((item) => prioritiseStaffWork(item, now))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}
