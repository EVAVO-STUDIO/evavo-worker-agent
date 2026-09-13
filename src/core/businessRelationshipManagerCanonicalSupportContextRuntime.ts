import type { Relationship360EvidenceItem } from "./businessRelationship360Context";
import type { RelationshipSourceReadinessItem } from "./businessRelationshipSourceReadiness";
import {
  runCanonicalRelationshipManagerCycleWithSourcesFromEnv,
  type CanonicalRelationshipManagerSourceHydrationEnvInput,
  type CanonicalRelationshipManagerSourceHydrationEnvResult,
} from "./businessRelationshipManagerCanonicalSourceHydrationEnv";
import type {
  SupportRelationshipSnapshot,
  SupportRelationshipSnapshotPort,
} from "./businessSupportRelationshipSnapshotPort";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_CONTEXT_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_support_context_runtime_v1" as const;

export type CanonicalRelationshipManagerSupportContextInput = Readonly<{
  sourceHydration: CanonicalRelationshipManagerSourceHydrationEnvInput;
  support: SupportRelationshipSnapshotPort;
  supportRequired: boolean;
  supportIdentity?: Readonly<{ organisationId: string; ticketId: string }> | null;
}>;

export type CanonicalRelationshipManagerSupportContextResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_CONTEXT_RUNTIME_CONTRACT;
  supportState: "verified" | "not_found" | "provider_unavailable" | "not_required";
  supportEvidenceRef: string | null;
  canonical: CanonicalRelationshipManagerSourceHydrationEnvResult;
  externalEffectPerformed: false;
}>;

function withoutSupport(values: readonly RelationshipSourceReadinessItem[] | null | undefined) {
  const input = values ?? [];
  if (input.some((item) => item.domain === "support")) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_CALLER_READINESS_FORBIDDEN");
  }
  return Object.freeze([...input]);
}

function availabilityFailure(error: unknown) {
  return error instanceof Error && (
    error.message === "SUPPORT_RELATIONSHIP_READ_TIMEOUT"
    || error.message === "SUPPORT_RELATIONSHIP_READ_UNAVAILABLE"
    || /^SUPPORT_RELATIONSHIP_READ_FAILED:\d{3}$/.test(error.message)
  );
}

function supportSummary(snapshot: SupportRelationshipSnapshot): string {
  if (snapshot.state === "not_found") return "Support Agent exact ticket lookup completed successfully and no matching ticket was found.";
  if (snapshot.state !== "verified" || !snapshot.ticket || !snapshot.emotionRisk) return "Support Agent current ticket truth is unavailable.";
  const risk = snapshot.emotionRisk;
  const ticket = snapshot.ticket;
  return `Support ticket ${snapshot.ticketId}: ${ticket.status}, priority ${ticket.priority}, category ${ticket.category}; customer emotion ${risk.emotionState}, urgency ${risk.urgency}, human intervention ${risk.humanInterventionHint}.${ticket.internalSummary ? ` ${ticket.internalSummary}` : ""}`;
}

function evidence(snapshot: SupportRelationshipSnapshot): Relationship360EvidenceItem | null {
  if (snapshot.state === "provider_unavailable") return null;
  return Object.freeze({
    id: `support-snapshot-${snapshot.evidenceRef.slice(-24)}`,
    domain: "support",
    summary: supportSummary(snapshot),
    status: "current",
    authority: "canonical",
    observedAt: snapshot.observedAt,
    sourceRefs: Object.freeze([snapshot.evidenceRef]),
  });
}

function readiness(snapshot: SupportRelationshipSnapshot): RelationshipSourceReadinessItem {
  if (snapshot.state === "verified") return Object.freeze({
    domain: "support",
    state: "verified",
    required: true,
    observedAt: snapshot.observedAt,
    sourceRefs: Object.freeze([snapshot.evidenceRef]),
    detail: "Current organisation-scoped Support Agent ticket state and emotion risk were resolved.",
  });
  if (snapshot.state === "not_found") return Object.freeze({
    domain: "support",
    state: "not_found",
    required: true,
    absenceAcceptable: false,
    observedAt: snapshot.observedAt,
    sourceRefs: Object.freeze([snapshot.evidenceRef]),
    detail: "The exact required support ticket was not found; support context remains unresolved.",
  });
  return Object.freeze({
    domain: "support",
    state: "provider_unavailable",
    required: true,
    detail: "Support Agent could not provide current ticket/service truth.",
  });
}

export async function runCanonicalRelationshipManagerCycleWithSupportContext(
  input: CanonicalRelationshipManagerSupportContextInput,
): Promise<CanonicalRelationshipManagerSupportContextResult> {
  if (input.support.contract !== "business_support_relationship_snapshot_port_v1") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_PORT_CONTRACT_INVALID");
  }
  const baseReadiness = withoutSupport(input.sourceHydration.context.sourceReadiness);
  if (input.sourceHydration.context.evidenceItems.some((item) => item.domain === "support")) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_CALLER_EVIDENCE_FORBIDDEN");
  }
  if (!input.supportRequired) {
    const canonical = await runCanonicalRelationshipManagerCycleWithSourcesFromEnv({
      ...input.sourceHydration,
      context: Object.freeze({ ...input.sourceHydration.context, sourceReadiness: baseReadiness }),
    });
    return Object.freeze({
      contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_CONTEXT_RUNTIME_CONTRACT,
      supportState: "not_required",
      supportEvidenceRef: null,
      canonical,
      externalEffectPerformed: false,
    });
  }
  if (!input.supportIdentity) throw new Error("RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_IDENTITY_REQUIRED");

  let snapshot: SupportRelationshipSnapshot | null = null;
  let state: "verified" | "not_found" | "provider_unavailable" = "provider_unavailable";
  let supportReadiness: RelationshipSourceReadinessItem;
  try {
    snapshot = await input.support.read(input.supportIdentity);
    state = snapshot.state;
    supportReadiness = readiness(snapshot);
  } catch (error) {
    if (!availabilityFailure(error)) throw error;
    supportReadiness = Object.freeze({
      domain: "support",
      state: "provider_unavailable",
      required: true,
      detail: "Support Agent snapshot could not be queried; current support state is unknown.",
    });
  }

  const supportEvidence = snapshot ? evidence(snapshot) : null;
  const canonical = await runCanonicalRelationshipManagerCycleWithSourcesFromEnv({
    ...input.sourceHydration,
    context: Object.freeze({
      ...input.sourceHydration.context,
      ...(snapshot && snapshot.state !== "provider_unavailable" ? { supportSummary: supportSummary(snapshot) } : {}),
      evidenceItems: Object.freeze([
        ...input.sourceHydration.context.evidenceItems,
        ...(supportEvidence ? [supportEvidence] : []),
      ]),
      sourceReadiness: Object.freeze([...baseReadiness, supportReadiness]),
    }),
  });
  const cycle = canonical.cycle.canonical.brain.canonicalCycle;
  if (state !== "verified" && cycle.approvalGradeReady) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_READINESS_WIDENED");
  }
  if (snapshot && snapshot.state !== "provider_unavailable" && !cycle.decisionContext.evidenceRefs.includes(snapshot.evidenceRef)) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_EVIDENCE_NOT_BOUND");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_CONTEXT_RUNTIME_CONTRACT,
    supportState: state,
    supportEvidenceRef: snapshot?.evidenceRef ?? null,
    canonical,
    externalEffectPerformed: false,
  });
}