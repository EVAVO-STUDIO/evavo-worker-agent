import type { BusinessObligation } from "./businessObligationLedger";
import type { BrainMemoryContextResponse } from "./businessMemoryContextBridge";

export const BUSINESS_RELATIONSHIP_360_CONTEXT_CONTRACT = "business_relationship_360_context_v3" as const;

export type Relationship360EvidenceItem = Readonly<{
  id: string;
  domain: "identity" | "gmail" | "operations" | "careers" | "support" | "document" | "calendar" | "memory" | "decision" | "obligation" | "other";
  summary: string;
  status: "current" | "historical" | "uncertain" | "conflicting";
  authority: "canonical" | "authoritative" | "supporting" | "observational";
  observedAt: string;
  sourceRefs: readonly string[];
}>;

export type Relationship360Input = Readonly<{
  relationshipId: string;
  personId?: string | null;
  organizationId?: string | null;
  projectId?: string | null;
  threadId?: string | null;
  identitySummary?: string | null;
  organizationSummary?: string | null;
  projectSummary?: string | null;
  commercialSummary?: string | null;
  careersSummary?: string | null;
  supportSummary?: string | null;
  communicationSummary?: string | null;
  documentsSummary?: string | null;
  priorDecisionSummaries?: readonly string[];
  obligations?: readonly BusinessObligation[];
  evidenceItems: readonly Relationship360EvidenceItem[];
  memory?: BrainMemoryContextResponse | null;
  now: string;
}>;

export type Relationship360Context = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_360_CONTEXT_CONTRACT;
  relationshipId: string;
  generatedAt: string;
  identity: string | null;
  organization: string | null;
  project: string | null;
  commercial: string | null;
  careers: string | null;
  support: string | null;
  communications: string | null;
  documents: string | null;
  openEvavoObligations: readonly string[];
  openCounterpartyObligations: readonly string[];
  priorDecisions: readonly string[];
  currentEvidence: readonly Relationship360EvidenceItem[];
  historicalEvidence: readonly Relationship360EvidenceItem[];
  conflicts: readonly string[];
  missingCriticalContext: readonly string[];
  recommendedAttention: readonly string[];
  contextSummary: string;
  evidenceRefs: readonly string[];
}>;

function iso(value: string, code = "RELATIONSHIP_360_NOW_INVALID"): string {
  const d = new Date(value);
  if (!value || Number.isNaN(d.getTime())) throw new Error(code);
  return d.toISOString();
}

function clean(value?: string | null): string | null {
  const v = value?.replace(/\s+/g, " ").trim();
  return v || null;
}

function cleanRefs(values: readonly string[]): readonly string[] {
  const refs = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  if (!refs.length) throw new Error("RELATIONSHIP_360_EVIDENCE_SOURCE_REFS_REQUIRED");
  return Object.freeze(refs);
}

function validateEvidenceItem(item: Relationship360EvidenceItem, nowMs: number): Relationship360EvidenceItem {
  const id = item.id.trim();
  if (!id) throw new Error("RELATIONSHIP_360_EVIDENCE_ID_REQUIRED");
  const summary = clean(item.summary);
  if (!summary) throw new Error("RELATIONSHIP_360_EVIDENCE_SUMMARY_REQUIRED");
  const observedAt = iso(item.observedAt, "RELATIONSHIP_360_EVIDENCE_OBSERVED_AT_INVALID");
  if (Date.parse(observedAt) > nowMs + 60_000) throw new Error("RELATIONSHIP_360_EVIDENCE_FUTURE_OBSERVATION");
  return Object.freeze({
    ...item,
    id,
    summary,
    observedAt,
    sourceRefs: cleanRefs(item.sourceRefs),
  });
}

function cleanTextList(values: readonly string[] | undefined): readonly string[] {
  return Object.freeze([...new Set((values ?? []).map((value) => clean(value)).filter((value): value is string => Boolean(value)))]);
}

export function buildBusinessRelationship360Context(input: Relationship360Input): Relationship360Context {
  const relationshipId = input.relationshipId.trim();
  if (!relationshipId) throw new Error("RELATIONSHIP_360_RELATIONSHIP_REQUIRED");
  const now = iso(input.now);
  const nowMs = Date.parse(now);
  const evidenceItems = input.evidenceItems.map((item) => validateEvidenceItem(item, nowMs));
  const ids = new Set<string>();
  for (const item of evidenceItems) {
    if (ids.has(item.id)) throw new Error(`RELATIONSHIP_360_DUPLICATE_EVIDENCE_ID:${item.id}`);
    ids.add(item.id);
  }

  const currentEvidence = evidenceItems.filter((item) => item.status === "current");
  const historicalEvidence = evidenceItems.filter((item) => item.status === "historical");
  const conflictItems = evidenceItems.filter((item) => item.status === "conflicting");
  const uncertainItems = evidenceItems.filter((item) => item.status === "uncertain");

  const conflicts = conflictItems.map((item) => `${item.domain}: ${item.summary}`);
  const missingCriticalContext: string[] = [];
  if (!clean(input.identitySummary)) missingCriticalContext.push("Verified person/relationship identity is missing.");
  if (input.projectId && !clean(input.projectSummary)) missingCriticalContext.push("A project is linked but current project state is missing.");
  if (input.threadId && !clean(input.communicationSummary)) missingCriticalContext.push("A communication thread is linked but current thread state is missing.");
  if (uncertainItems.some((item) => item.domain === "document")) missingCriticalContext.push("Document/version context contains unresolved uncertainty.");
  if (uncertainItems.some((item) => item.domain === "identity")) missingCriticalContext.push("Identity context contains unresolved uncertainty.");
  if (uncertainItems.some((item) => item.domain === "careers")) missingCriticalContext.push("Careers/role-opening context contains unresolved uncertainty.");

  const obligations = input.obligations ?? [];
  const active = obligations.filter((item) => item.status === "open" || item.status === "uncertain");
  const evavo = active.filter((item) => item.owner === "evavo").map((item) => item.statement.trim()).filter(Boolean);
  const external = active.filter((item) => item.owner === "counterparty").map((item) => item.statement.trim()).filter(Boolean);

  const recommendedAttention: string[] = [];
  if (evavo.length) recommendedAttention.push(`EVAVO owns ${evavo.length} active obligation(s); address these before creating new communication debt.`);
  if (conflicts.length) recommendedAttention.push("Resolve conflicting evidence before making a consequential external claim or commitment.");
  if (missingCriticalContext.length) recommendedAttention.push("Fill critical context gaps before approval-grade external action.");
  if (clean(input.careersSummary)) recommendedAttention.push("Use dedicated careers truth for role-opening claims; do not infer hiring status from project or commercial state.");
  if (clean(input.supportSummary)) recommendedAttention.push("Consider live support/service context before choosing tone, commitments or follow-up pressure.");

  const memoryEvidence = input.memory?.records ?? [];
  const evidenceRefs = [...new Set([
    ...evidenceItems.flatMap((item) => item.sourceRefs),
    ...memoryEvidence.flatMap((item) => item.sourceRefs.map((ref) => ref.trim()).filter(Boolean)),
    ...obligations.flatMap((item) => item.sourceEvidenceIds.map((ref) => ref.trim()).filter(Boolean)),
  ])];

  const pieces = [
    clean(input.identitySummary) ? `Identity: ${clean(input.identitySummary)}` : null,
    clean(input.organizationSummary) ? `Organisation: ${clean(input.organizationSummary)}` : null,
    clean(input.projectSummary) ? `Project: ${clean(input.projectSummary)}` : null,
    clean(input.commercialSummary) ? `Commercial: ${clean(input.commercialSummary)}` : null,
    clean(input.careersSummary) ? `Careers: ${clean(input.careersSummary)}` : null,
    clean(input.supportSummary) ? `Support: ${clean(input.supportSummary)}` : null,
    clean(input.communicationSummary) ? `Communication: ${clean(input.communicationSummary)}` : null,
    evavo.length ? `EVAVO owes: ${evavo.join("; ")}` : null,
    conflicts.length ? `Conflicts: ${conflicts.join("; ")}` : null,
  ].filter((value): value is string => Boolean(value));

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_360_CONTEXT_CONTRACT,
    relationshipId,
    generatedAt: now,
    identity: clean(input.identitySummary),
    organization: clean(input.organizationSummary),
    project: clean(input.projectSummary),
    commercial: clean(input.commercialSummary),
    careers: clean(input.careersSummary),
    support: clean(input.supportSummary),
    communications: clean(input.communicationSummary),
    documents: clean(input.documentsSummary),
    openEvavoObligations: Object.freeze(evavo),
    openCounterpartyObligations: Object.freeze(external),
    priorDecisions: cleanTextList(input.priorDecisionSummaries),
    currentEvidence: Object.freeze(currentEvidence),
    historicalEvidence: Object.freeze(historicalEvidence),
    conflicts: Object.freeze(conflicts),
    missingCriticalContext: Object.freeze(missingCriticalContext),
    recommendedAttention: Object.freeze(recommendedAttention),
    contextSummary: pieces.join(" | ") || "No usable relationship context was available.",
    evidenceRefs: Object.freeze(evidenceRefs),
  });
}
