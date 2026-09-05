import type { Relationship360EvidenceItem } from "./businessRelationship360Context";
import type { RelationshipSourceReadinessItem } from "./businessRelationshipSourceReadiness";
import {
  runCanonicalRelationshipManagerCycleWithSupportContext,
  type CanonicalRelationshipManagerSupportContextInput,
  type CanonicalRelationshipManagerSupportContextResult,
} from "./businessRelationshipManagerCanonicalSupportContextRuntime";
import type {
  DocumentRelationshipSnapshot,
  DocumentRelationshipSnapshotPort,
} from "./businessDocumentRelationshipSnapshotPort";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_DOCUMENT_CONTEXT_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_document_context_runtime_v1" as const;

export type CanonicalRelationshipManagerDocumentContextInput = Readonly<{
  supportContext: Omit<CanonicalRelationshipManagerSupportContextInput, "support">;
  support: CanonicalRelationshipManagerSupportContextInput["support"];
  documents: DocumentRelationshipSnapshotPort;
  documentRequired: boolean;
  documentIdentity?: Readonly<{ workspaceId: string; documentId: string }> | null;
}>;

export type CanonicalRelationshipManagerDocumentContextResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_DOCUMENT_CONTEXT_RUNTIME_CONTRACT;
  documentState: "verified" | "not_found" | "provider_unavailable" | "not_required" | "not_current";
  documentEvidenceRef: string | null;
  support: CanonicalRelationshipManagerSupportContextResult;
  externalEffectPerformed: false;
}>;

function withoutDocument(values: readonly RelationshipSourceReadinessItem[] | null | undefined) {
  const input = values ?? [];
  if (input.some((item) => item.domain === "document")) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_DOCUMENT_CALLER_READINESS_FORBIDDEN");
  }
  return Object.freeze([...input]);
}

function availabilityFailure(error: unknown) {
  return error instanceof Error && (
    error.message === "DOCUMENT_RELATIONSHIP_READ_TIMEOUT"
    || error.message === "DOCUMENT_RELATIONSHIP_READ_UNAVAILABLE"
    || /^DOCUMENT_RELATIONSHIP_READ_FAILED:\d{3}$/.test(error.message)
  );
}

function isCurrent(snapshot: DocumentRelationshipSnapshot) {
  if (snapshot.state !== "verified" || !snapshot.document) return false;
  return snapshot.document.reviewState !== "superseded"
    && snapshot.document.reviewState !== "archived"
    && (snapshot.document.currentVersionNumber === 0 || Boolean(snapshot.currentVersion));
}

function documentSummary(snapshot: DocumentRelationshipSnapshot): string {
  if (snapshot.state === "not_found") return "Operations Core document truth was checked and the exact document was not found.";
  if (snapshot.state !== "verified" || !snapshot.document) return "Operations Core document truth is unavailable.";
  const record = snapshot.document;
  const version = snapshot.currentVersion;
  return `${record.title}: purpose ${record.purpose}, review state ${record.reviewState}, current version ${record.currentVersionNumber}/${record.versionCount}${version ? ` (${version.reviewState})` : ""}, payload ${record.payloadReady ? "ready" : "not ready"}. This proves document/version metadata only; attachment bytes remain separately verified.`;
}

function evidence(snapshot: DocumentRelationshipSnapshot): Relationship360EvidenceItem | null {
  if (snapshot.state === "provider_unavailable") return null;
  return Object.freeze({
    id: `document-snapshot-${snapshot.evidenceRef.slice(-24)}`,
    domain: "document",
    summary: documentSummary(snapshot),
    status: snapshot.state === "verified" && isCurrent(snapshot) ? "current" : "uncertain",
    authority: "canonical",
    observedAt: snapshot.observedAt,
    sourceRefs: Object.freeze([snapshot.evidenceRef]),
  });
}

function readiness(snapshot: DocumentRelationshipSnapshot): RelationshipSourceReadinessItem {
  if (snapshot.state === "verified" && isCurrent(snapshot)) return Object.freeze({
    domain: "document",
    state: "verified",
    required: true,
    observedAt: snapshot.observedAt,
    sourceRefs: Object.freeze([snapshot.evidenceRef]),
    detail: "Exact current persistent document/version metadata was resolved. Attachment bytes are not implied verified.",
  });
  if (snapshot.state === "not_found") return Object.freeze({
    domain: "document",
    state: "not_found",
    required: true,
    absenceAcceptable: false,
    observedAt: snapshot.observedAt,
    sourceRefs: Object.freeze([snapshot.evidenceRef]),
    detail: "The exact required document was not found.",
  });
  if (snapshot.state === "verified") return Object.freeze({
    domain: "document",
    state: "stale",
    required: true,
    observedAt: snapshot.observedAt,
    sourceRefs: Object.freeze([snapshot.evidenceRef]),
    detail: "The document exists but is superseded, archived, or lacks its declared current version.",
  });
  return Object.freeze({
    domain: "document",
    state: "provider_unavailable",
    required: true,
    detail: "Operations Core could not provide current document/version truth.",
  });
}

export async function runCanonicalRelationshipManagerCycleWithDocumentContext(
  input: CanonicalRelationshipManagerDocumentContextInput,
): Promise<CanonicalRelationshipManagerDocumentContextResult> {
  if (input.documents.contract !== "business_document_relationship_snapshot_port_v1") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_DOCUMENT_PORT_CONTRACT_INVALID");
  }
  const context = input.supportContext.sourceHydration.context;
  const baseReadiness = withoutDocument(context.sourceReadiness);
  if (context.evidenceItems.some((item) => item.domain === "document")) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_DOCUMENT_CALLER_EVIDENCE_FORBIDDEN");
  }

  if (!input.documentRequired) {
    const support = await runCanonicalRelationshipManagerCycleWithSupportContext({
      ...input.supportContext,
      support: input.support,
      sourceHydration: {
        ...input.supportContext.sourceHydration,
        context: Object.freeze({ ...context, sourceReadiness: baseReadiness }),
      },
    });
    return Object.freeze({
      contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_DOCUMENT_CONTEXT_RUNTIME_CONTRACT,
      documentState: "not_required",
      documentEvidenceRef: null,
      support,
      externalEffectPerformed: false,
    });
  }
  if (!input.documentIdentity) throw new Error("RELATIONSHIP_MANAGER_CANONICAL_DOCUMENT_IDENTITY_REQUIRED");

  let snapshot: DocumentRelationshipSnapshot | null = null;
  let state: CanonicalRelationshipManagerDocumentContextResult["documentState"] = "provider_unavailable";
  let sourceReadiness: RelationshipSourceReadinessItem;
  try {
    snapshot = await input.documents.read(input.documentIdentity);
    state = snapshot.state === "verified" && !isCurrent(snapshot) ? "not_current" : snapshot.state;
    sourceReadiness = readiness(snapshot);
  } catch (error) {
    if (!availabilityFailure(error)) throw error;
    sourceReadiness = Object.freeze({
      domain: "document",
      state: "provider_unavailable",
      required: true,
      detail: "Document snapshot could not be queried; current document/version truth is unknown.",
    });
  }

  const item = snapshot ? evidence(snapshot) : null;
  const support = await runCanonicalRelationshipManagerCycleWithSupportContext({
    ...input.supportContext,
    support: input.support,
    sourceHydration: {
      ...input.supportContext.sourceHydration,
      context: Object.freeze({
        ...context,
        ...(snapshot && snapshot.state === "verified" ? { documentsSummary: documentSummary(snapshot) } : {}),
        evidenceItems: Object.freeze([...context.evidenceItems, ...(item ? [item] : [])]),
        sourceReadiness: Object.freeze([...baseReadiness, sourceReadiness]),
      }),
    },
  });
  const cycle = support.canonical.cycle.canonical.brain.canonicalCycle;
  if (state !== "verified" && cycle.approvalGradeReady) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_DOCUMENT_READINESS_WIDENED");
  }
  if (snapshot && snapshot.state !== "provider_unavailable" && !cycle.decisionContext.evidenceRefs.includes(snapshot.evidenceRef)) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_DOCUMENT_EVIDENCE_NOT_BOUND");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_DOCUMENT_CONTEXT_RUNTIME_CONTRACT,
    documentState: state,
    documentEvidenceRef: snapshot?.evidenceRef ?? null,
    support,
    externalEffectPerformed: false,
  });
}