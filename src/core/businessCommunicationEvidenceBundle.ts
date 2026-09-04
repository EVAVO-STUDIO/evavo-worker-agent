export const BUSINESS_COMMUNICATION_EVIDENCE_BUNDLE_CONTRACT = "business_communication_evidence_bundle_v1" as const;

export type CommunicationEvidenceSource =
  | "gmail"
  | "calendar"
  | "operations_core"
  | "docs_suite"
  | "support_agent"
  | "worker_agent"
  | "operator";

export type CommunicationEvidenceItem = Readonly<{
  id: string;
  source: CommunicationEvidenceSource;
  sourceRef: string;
  kind: string;
  summary: string;
  observedAt: string;
  confidence: number;
  authoritativeFor: readonly string[];
  staleAfterDays?: number | null;
}>;

export type CommunicationEvidenceBundle = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_EVIDENCE_BUNDLE_CONTRACT;
  relationshipId: string | null;
  organizationId: string | null;
  personId: string | null;
  threadId: string;
  assembledAt: string;
  items: readonly CommunicationEvidenceItem[];
  coverage: Readonly<{
    thread: boolean;
    identity: boolean;
    calendar: boolean;
    project: boolean;
    commercial: boolean;
    support: boolean;
    documents: boolean;
  }>;
  missingCriticalContext: readonly string[];
}>;

export function buildBusinessCommunicationEvidenceBundle(input: Readonly<{
  relationshipId?: string | null;
  organizationId?: string | null;
  personId?: string | null;
  threadId: string;
  items: readonly CommunicationEvidenceItem[];
  assembledAt?: string;
}>): CommunicationEvidenceBundle {
  const items = input.items.filter((item) => {
    if (!item.id?.trim() || !item.sourceRef?.trim() || !item.summary?.trim()) return false;
    if (!Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 100) return false;
    return Number.isFinite(Date.parse(item.observedAt));
  });

  const has = (predicate: (item: CommunicationEvidenceItem) => boolean) => items.some(predicate);
  const coverage = {
    thread: has((item) => item.source === "gmail" && item.authoritativeFor.includes("thread")),
    identity: has((item) => item.authoritativeFor.includes("identity")),
    calendar: has((item) => item.source === "calendar"),
    project: has((item) => item.source === "operations_core" && item.authoritativeFor.includes("project_state")),
    commercial: has((item) => item.source === "operations_core" && item.authoritativeFor.includes("commercial_state")),
    support: has((item) => item.source === "support_agent" || item.authoritativeFor.includes("support_state")),
    documents: has((item) => item.source === "docs_suite" || item.authoritativeFor.includes("document_state")),
  };

  const missingCriticalContext: string[] = [];
  if (!coverage.thread) missingCriticalContext.push("Canonical thread evidence is missing.");
  if (!coverage.identity) missingCriticalContext.push("Canonical participant identity evidence is missing.");

  return {
    contract: BUSINESS_COMMUNICATION_EVIDENCE_BUNDLE_CONTRACT,
    relationshipId: input.relationshipId ?? null,
    organizationId: input.organizationId ?? null,
    personId: input.personId ?? null,
    threadId: input.threadId,
    assembledAt: input.assembledAt ?? new Date().toISOString(),
    items,
    coverage,
    missingCriticalContext,
  };
}

export function communicationEvidenceForClaim(
  bundle: CommunicationEvidenceBundle,
  authority: string,
): readonly CommunicationEvidenceItem[] {
  return bundle.items.filter((item) => item.authoritativeFor.includes(authority));
}
