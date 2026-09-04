export const BUSINESS_OBLIGATION_LEDGER_CONTRACT = "business_obligation_ledger_v1" as const;

export type ObligationOwner = "evavo" | "counterparty" | "shared" | "unknown";
export type ObligationStatus = "open" | "satisfied" | "superseded" | "cancelled" | "uncertain";
export type ObligationImportance = "low" | "normal" | "high" | "critical";
export type ObligationTransitionKind = "observe" | "satisfy" | "supersede" | "cancel" | "mark_uncertain";

export type BusinessObligation = Readonly<{
  id: string;
  relationshipId?: string | null;
  personId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  owner: ObligationOwner;
  statement: string;
  status: ObligationStatus;
  importance: ObligationImportance;
  createdAt: string;
  dueAt?: string | null;
  dueAtEvidenceId?: string | null;
  sourceEvidenceIds: readonly string[];
  satisfactionEvidenceIds: readonly string[];
  supersededById?: string | null;
  stateEvidenceIds?: readonly string[];
  lastTransitionAt?: string | null;
}>;

export type ObligationAssessment = Readonly<{
  contract: typeof BUSINESS_OBLIGATION_LEDGER_CONTRACT;
  obligation: BusinessObligation;
  overdue: boolean;
  dueSoon: boolean;
  dueAtEvidenceVerified: boolean;
  stateEvidenceVerified: boolean;
  needsAttention: boolean;
  attentionReason: string | null;
}>;

export type ObligationTransition = Readonly<{
  kind: ObligationTransitionKind;
  obligationId: string;
  evidenceIds: readonly string[];
  occurredAt: string;
  supersededById?: string | null;
}>;

export type ObligationLedgerSnapshot = Readonly<{
  contract: typeof BUSINESS_OBLIGATION_LEDGER_CONTRACT;
  generatedAt: string;
  obligations: readonly BusinessObligation[];
  openEvavo: readonly BusinessObligation[];
  openCounterparty: readonly BusinessObligation[];
  openShared: readonly BusinessObligation[];
  uncertain: readonly BusinessObligation[];
  evidenceGaps: readonly string[];
  nextActionOwner: ObligationOwner | "none";
}>;

function timestamp(value: string, field: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(`OBLIGATION_${field.toUpperCase()}_INVALID`);
  return parsed.toISOString();
}

function evidence(ids: readonly string[], field: string): readonly string[] {
  const cleaned = [...new Set(ids.map((item) => item.trim()).filter(Boolean))];
  if (!cleaned.length) throw new Error(`OBLIGATION_${field.toUpperCase()}_EVIDENCE_REQUIRED`);
  return Object.freeze(cleaned);
}

function cleanEvidence(ids: readonly string[] | undefined): readonly string[] {
  return Object.freeze([...new Set((ids ?? []).map((item) => item.trim()).filter(Boolean))]);
}

/**
 * Read-compatible v1 validation. Historical v1 records may predate explicit due/state evidence fields
 * and transition timestamps. We preserve those records for audit/read purposes and surface evidence gaps
 * instead of rewriting history. New state mutations remain strict in applyObligationTransition().
 */
function validate(obligation: BusinessObligation): BusinessObligation {
  if (!obligation.id.trim()) throw new Error("OBLIGATION_ID_REQUIRED");
  if (!obligation.statement.trim()) throw new Error("OBLIGATION_STATEMENT_REQUIRED");
  const sourceEvidenceIds = evidence(obligation.sourceEvidenceIds, "source");
  const createdAt = timestamp(obligation.createdAt, "created_at");
  const dueAt = obligation.dueAt ? timestamp(obligation.dueAt, "due_at") : null;
  const lastTransitionAt = obligation.lastTransitionAt ? timestamp(obligation.lastTransitionAt, "last_transition_at") : null;
  if (lastTransitionAt && Date.parse(lastTransitionAt) < Date.parse(createdAt)) {
    throw new Error("OBLIGATION_LAST_TRANSITION_BEFORE_CREATED");
  }
  if (obligation.status === "superseded" && !obligation.supersededById?.trim()) throw new Error("OBLIGATION_SUPERSEDED_BY_REQUIRED");
  return Object.freeze({
    ...obligation,
    statement: obligation.statement.trim(),
    createdAt,
    dueAt,
    dueAtEvidenceId: obligation.dueAtEvidenceId?.trim() || null,
    sourceEvidenceIds,
    satisfactionEvidenceIds: cleanEvidence(obligation.satisfactionEvidenceIds),
    stateEvidenceIds: cleanEvidence(obligation.stateEvidenceIds),
    lastTransitionAt,
  });
}

function stateEvidenceVerified(obligation: BusinessObligation): boolean {
  if (obligation.status === "open") return true;
  if (obligation.status === "satisfied") return Boolean(obligation.satisfactionEvidenceIds.length && obligation.stateEvidenceIds?.length);
  return Boolean(obligation.stateEvidenceIds?.length);
}

export function assessBusinessObligation(obligation: BusinessObligation, now = new Date()): ObligationAssessment {
  const checked = validate(obligation);
  if (Number.isNaN(now.getTime())) throw new Error("OBLIGATION_NOW_INVALID");
  const due = checked.dueAt ? new Date(checked.dueAt) : null;
  const active = checked.status === "open" || checked.status === "uncertain";
  const overdue = Boolean(active && due && due.getTime() < now.getTime());
  const dueSoon = Boolean(active && due && !overdue && due.getTime() - now.getTime() <= 48 * 60 * 60 * 1000);
  const dueAtEvidenceVerified = !checked.dueAt || Boolean(checked.dueAtEvidenceId?.trim());
  const stateVerified = stateEvidenceVerified(checked);
  let attentionReason: string | null = null;

  if (!stateVerified) attentionReason = "The obligation has a historical state without explicit transition evidence; verify it before relying on that state for consequential action.";
  else if (!dueAtEvidenceVerified && active) attentionReason = "The active obligation has a due date without direct due-date evidence; verify the date before relying on urgency.";
  else if (overdue) attentionReason = checked.owner === "evavo"
    ? "EVAVO owns an overdue commitment."
    : "An active counterparty/shared obligation is overdue and may warrant proportionate follow-up.";
  else if (dueSoon && checked.owner === "evavo") attentionReason = "EVAVO owns a commitment due soon.";
  else if (checked.status === "uncertain") attentionReason = "The obligation state is uncertain and should be verified before acting.";
  else if (checked.importance === "critical" && active) attentionReason = "A critical active obligation requires explicit ownership.";
  else if (checked.owner === "unknown" && active) attentionReason = "The obligation has no verified owner.";

  return Object.freeze({
    contract: BUSINESS_OBLIGATION_LEDGER_CONTRACT,
    obligation: checked,
    overdue,
    dueSoon,
    dueAtEvidenceVerified,
    stateEvidenceVerified: stateVerified,
    needsAttention: Boolean(attentionReason),
    attentionReason,
  });
}

export function applyObligationTransition(obligation: BusinessObligation, transition: ObligationTransition): BusinessObligation {
  const current = validate(obligation);
  if (transition.obligationId !== current.id) throw new Error("OBLIGATION_TRANSITION_ID_MISMATCH");
  const stateEvidenceIds = evidence(transition.evidenceIds, "transition");
  const occurredAt = timestamp(transition.occurredAt, "transition_at");
  if (Date.parse(occurredAt) < Date.parse(current.createdAt)) throw new Error("OBLIGATION_TRANSITION_BEFORE_CREATED");
  if (current.lastTransitionAt && Date.parse(occurredAt) < Date.parse(current.lastTransitionAt)) {
    throw new Error("OBLIGATION_TRANSITION_OUT_OF_ORDER");
  }

  switch (transition.kind) {
    case "observe":
      return current;
    case "satisfy":
      if (current.status === "satisfied") {
        if (!stateEvidenceVerified(current)) throw new Error("OBLIGATION_EXISTING_STATE_EVIDENCE_MISSING");
        return current;
      }
      if (current.status === "superseded" || current.status === "cancelled") throw new Error("OBLIGATION_TERMINAL_TRANSITION_INVALID");
      return validate({ ...current, status: "satisfied", satisfactionEvidenceIds: stateEvidenceIds, stateEvidenceIds, lastTransitionAt: occurredAt });
    case "supersede":
      if (!transition.supersededById?.trim() || transition.supersededById === current.id) throw new Error("OBLIGATION_SUPERSEDED_BY_INVALID");
      if (current.status === "satisfied" || current.status === "cancelled") throw new Error("OBLIGATION_TERMINAL_TRANSITION_INVALID");
      if (current.status === "superseded" && current.supersededById === transition.supersededById) {
        if (!stateEvidenceVerified(current)) throw new Error("OBLIGATION_EXISTING_STATE_EVIDENCE_MISSING");
        return current;
      }
      return validate({ ...current, status: "superseded", supersededById: transition.supersededById.trim(), stateEvidenceIds, lastTransitionAt: occurredAt });
    case "cancel":
      if (current.status === "cancelled") {
        if (!stateEvidenceVerified(current)) throw new Error("OBLIGATION_EXISTING_STATE_EVIDENCE_MISSING");
        return current;
      }
      if (current.status === "satisfied" || current.status === "superseded") throw new Error("OBLIGATION_TERMINAL_TRANSITION_INVALID");
      return validate({ ...current, status: "cancelled", stateEvidenceIds, lastTransitionAt: occurredAt });
    case "mark_uncertain":
      if (current.status === "satisfied" || current.status === "superseded" || current.status === "cancelled") throw new Error("OBLIGATION_TERMINAL_TRANSITION_INVALID");
      if (current.status === "uncertain") {
        if (!stateEvidenceVerified(current)) throw new Error("OBLIGATION_EXISTING_STATE_EVIDENCE_MISSING");
        return current;
      }
      return validate({ ...current, status: "uncertain", stateEvidenceIds, lastTransitionAt: occurredAt });
  }
}

export function mergeBusinessObligations(existing: readonly BusinessObligation[], incoming: readonly BusinessObligation[]): readonly BusinessObligation[] {
  const byId = new Map<string, BusinessObligation>();
  for (const item of existing) byId.set(item.id, validate(item));
  for (const item of incoming) {
    const checked = validate(item);
    const prior = byId.get(checked.id);
    if (!prior) {
      byId.set(checked.id, checked);
      continue;
    }
    const sameIdentity = prior.owner === checked.owner && prior.statement === checked.statement && prior.createdAt === checked.createdAt;
    if (!sameIdentity) throw new Error(`OBLIGATION_ID_CONFLICT:${checked.id}`);
    const stateChanged = prior.status !== checked.status || prior.supersededById !== checked.supersededById;
    if (prior.lastTransitionAt && stateChanged && !checked.lastTransitionAt) {
      throw new Error(`OBLIGATION_STATE_CHRONOLOGY_MISSING:${checked.id}`);
    }
    if (prior.lastTransitionAt && checked.lastTransitionAt && checked.lastTransitionAt < prior.lastTransitionAt) {
      throw new Error(`OBLIGATION_STATE_REGRESSION:${checked.id}`);
    }
    const priorEvidence = new Set(prior.sourceEvidenceIds);
    const addsEvidence = checked.sourceEvidenceIds.some((id) => !priorEvidence.has(id));
    if (addsEvidence) byId.set(checked.id, validate({ ...checked, sourceEvidenceIds: [...prior.sourceEvidenceIds, ...checked.sourceEvidenceIds] }));
    else if (stateChanged || prior.lastTransitionAt !== checked.lastTransitionAt) byId.set(checked.id, checked);
  }
  return Object.freeze([...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)));
}

export function openEvavoObligations(obligations: readonly BusinessObligation[]): readonly BusinessObligation[] {
  return Object.freeze(obligations.map(validate).filter((item) => item.owner === "evavo" && (item.status === "open" || item.status === "uncertain")));
}

export function buildObligationLedgerSnapshot(obligations: readonly BusinessObligation[], now = new Date()): ObligationLedgerSnapshot {
  if (Number.isNaN(now.getTime())) throw new Error("OBLIGATION_NOW_INVALID");
  const checked = obligations.map(validate);
  const active = checked.filter((item) => item.status === "open" || item.status === "uncertain");
  const openEvavo = active.filter((item) => item.owner === "evavo");
  const openCounterparty = active.filter((item) => item.owner === "counterparty");
  const openShared = active.filter((item) => item.owner === "shared");
  const uncertain = checked.filter((item) => item.status === "uncertain" || item.owner === "unknown");
  const assessments = checked.map((item) => assessBusinessObligation(item, now));
  const evidenceGaps = assessments.flatMap((assessment) => {
    const gaps: string[] = [];
    if (!assessment.dueAtEvidenceVerified) gaps.push(`${assessment.obligation.id}:due_at_evidence_missing`);
    if (!assessment.stateEvidenceVerified) gaps.push(`${assessment.obligation.id}:state_evidence_missing`);
    return gaps;
  });
  const urgentEvavo = openEvavo.some((item) => assessBusinessObligation(item, now).needsAttention);
  const nextActionOwner: ObligationLedgerSnapshot["nextActionOwner"] = urgentEvavo || openEvavo.length
    ? "evavo"
    : openShared.length
      ? "shared"
      : openCounterparty.length
        ? "counterparty"
        : uncertain.length
          ? "unknown"
          : "none";
  return Object.freeze({
    contract: BUSINESS_OBLIGATION_LEDGER_CONTRACT,
    generatedAt: now.toISOString(),
    obligations: Object.freeze(checked),
    openEvavo: Object.freeze(openEvavo),
    openCounterparty: Object.freeze(openCounterparty),
    openShared: Object.freeze(openShared),
    uncertain: Object.freeze(uncertain),
    evidenceGaps: Object.freeze([...new Set(evidenceGaps)]),
    nextActionOwner,
  });
}
