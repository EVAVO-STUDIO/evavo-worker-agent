export const BUSINESS_OBLIGATION_LEDGER_CONTRACT = "business_obligation_ledger_v1" as const;

export type ObligationOwner = "evavo" | "counterparty" | "shared" | "unknown";
export type ObligationStatus = "open" | "satisfied" | "superseded" | "cancelled" | "uncertain";

export type BusinessObligation = Readonly<{
  id: string;
  relationshipId?: string | null;
  personId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  owner: ObligationOwner;
  statement: string;
  status: ObligationStatus;
  importance: "low" | "normal" | "high" | "critical";
  createdAt: string;
  dueAt?: string | null;
  sourceEvidenceIds: readonly string[];
  satisfactionEvidenceIds: readonly string[];
  supersededById?: string | null;
}>;

export type ObligationAssessment = Readonly<{
  contract: typeof BUSINESS_OBLIGATION_LEDGER_CONTRACT;
  obligation: BusinessObligation;
  overdue: boolean;
  dueSoon: boolean;
  needsAttention: boolean;
  attentionReason: string | null;
}>;

export function assessBusinessObligation(obligation: BusinessObligation, now = new Date()): ObligationAssessment {
  if (!obligation.sourceEvidenceIds.length) throw new Error("OBLIGATION_SOURCE_EVIDENCE_REQUIRED");
  const due = obligation.dueAt ? new Date(obligation.dueAt) : null;
  if (due && Number.isNaN(due.getTime())) throw new Error("OBLIGATION_DUE_AT_INVALID");

  const active = obligation.status === "open" || obligation.status === "uncertain";
  const overdue = Boolean(active && due && due.getTime() < now.getTime());
  const dueSoon = Boolean(active && due && !overdue && due.getTime() - now.getTime() <= 48 * 60 * 60 * 1000);
  let attentionReason: string | null = null;

  if (overdue) attentionReason = obligation.owner === "evavo"
    ? "EVAVO owns an overdue commitment."
    : "An active counterparty/shared obligation is overdue and may warrant proportionate follow-up.";
  else if (dueSoon && obligation.owner === "evavo") attentionReason = "EVAVO owns a commitment due soon.";
  else if (obligation.status === "uncertain") attentionReason = "The obligation state is uncertain and should be verified before acting.";
  else if (obligation.importance === "critical" && active) attentionReason = "A critical active obligation requires explicit ownership.";

  return Object.freeze({
    contract: BUSINESS_OBLIGATION_LEDGER_CONTRACT,
    obligation,
    overdue,
    dueSoon,
    needsAttention: Boolean(attentionReason),
    attentionReason,
  });
}

export function openEvavoObligations(obligations: readonly BusinessObligation[]): readonly BusinessObligation[] {
  return Object.freeze(obligations.filter((item) => item.owner === "evavo" && (item.status === "open" || item.status === "uncertain")));
}
