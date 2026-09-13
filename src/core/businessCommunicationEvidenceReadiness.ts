import type { ArtifactResolution } from "./businessArtifactResolver";
import type { CalendarCommitmentVerification } from "./businessCalendarCommitmentVerifier";
import type { IdentityResolution } from "./businessRelationshipIdentityResolver";

export const BUSINESS_COMMUNICATION_EVIDENCE_READINESS_CONTRACT = "business_communication_evidence_readiness_v2" as const;

export type CommunicationEvidenceReadiness = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_EVIDENCE_READINESS_CONTRACT;
  status: "ready_for_drafting" | "ready_for_approval" | "blocked";
  identityReady: boolean;
  artifactsReady: boolean;
  calendarReady: boolean;
  blockers: readonly string[];
  warnings: readonly string[];
  evidenceIds: readonly string[];
}>;

function qualifiedEvidenceRef(source: string, ref: string): string {
  const cleanSource = source.trim().toLowerCase();
  const cleanRef = ref.trim();
  if (!cleanRef) return "";
  return cleanRef.toLowerCase().startsWith(`${cleanSource}:`) ? cleanRef : `${cleanSource}:${cleanRef}`;
}

function cleanEvidenceIds(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))]);
}

export function assessCommunicationEvidenceReadiness(input: Readonly<{
  identity: IdentityResolution;
  artifactResolutions?: readonly ArtifactResolution[];
  calendarCommitments?: readonly CalendarCommitmentVerification[];
  attachmentsRequired?: boolean;
  calendarPromiseRequired?: boolean;
  requireApprovalGradeIdentity?: boolean;
}>): CommunicationEvidenceReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const evidenceIds = new Set<string>();

  const identityContractValid = input.identity.contract === "business_relationship_identity_resolver_v2";
  const selectedIdentityEvidence = input.identity.selected
    ? input.identity.selected.evidence.map((item) => qualifiedEvidenceRef(item.source, item.ref)).filter(Boolean)
    : [];
  const identityReady = identityContractValid
    && input.identity.status === "verified"
    && Boolean(input.identity.selected)
    && selectedIdentityEvidence.length > 0
    && input.identity.confidence >= (input.requireApprovalGradeIdentity === false ? 70 : 90);
  if (!identityReady) blockers.push("Recipient/person identity is not verified strongly enough with evidence-backed identity v2 for external communication.");
  for (const ref of selectedIdentityEvidence) evidenceIds.add(ref);

  const artifacts = input.artifactResolutions ?? [];
  const artifactContractValid = artifacts.every((item) => item.contract === "business_artifact_resolver_v2");
  const artifactVerified = (item: ArtifactResolution): boolean => {
    if (item.contract !== "business_artifact_resolver_v2" || item.status !== "verified" || !item.selected?.current) return false;
    const refs = cleanEvidenceIds(item.selected.sourceEvidenceIds);
    return refs.length > 0;
  };
  const artifactsReady = input.attachmentsRequired
    ? artifactContractValid && artifacts.length > 0 && artifacts.every(artifactVerified)
    : artifactContractValid && artifacts.every((item) => item.status === "verified" || item.status === "unresolved");
  if (input.attachmentsRequired && !artifactsReady) blockers.push("A required attachment/document is not resolved to one verified current artifact with concrete provenance.");
  if (!artifactContractValid) blockers.push("Artifact evidence uses an unsupported resolver contract.");
  for (const resolution of artifacts) {
    if (resolution.status === "ambiguous") blockers.push("Multiple artifacts match a communication attachment requirement.");
    if (resolution.selected) for (const id of cleanEvidenceIds(resolution.selected.sourceEvidenceIds)) evidenceIds.add(id);
  }

  const calendars = input.calendarCommitments ?? [];
  const calendarContractValid = calendars.every((item) => item.contract === "business_calendar_commitment_verifier_v2");
  const calendarReady = input.calendarPromiseRequired
    ? calendarContractValid && calendars.length > 0 && calendars.every((item) => item.status === "verified_available" && item.canPromise && cleanEvidenceIds(item.evidenceIds).length > 0)
    : calendarContractValid;
  if (input.calendarPromiseRequired && !calendarReady) blockers.push("A proposed meeting/time commitment is not verified available by current authoritative calendar evidence.");
  if (!calendarContractValid) blockers.push("Calendar evidence uses an unsupported verifier contract.");
  for (const verification of calendars) for (const id of cleanEvidenceIds(verification.evidenceIds)) evidenceIds.add(id);

  if (!input.attachmentsRequired && !artifacts.length) warnings.push("No artifact verification was required for this communication.");
  if (!input.calendarPromiseRequired && !calendars.length) warnings.push("No calendar promise was required for this communication.");
  if (!input.calendarPromiseRequired && calendars.some((item) => item.status === "verified_unavailable")) {
    warnings.push("Calendar evidence includes an unavailable slot, but this communication does not require a calendar promise.");
  }

  const status: CommunicationEvidenceReadiness["status"] = blockers.length
    ? "blocked"
    : identityReady && artifactsReady && calendarReady
      ? "ready_for_approval"
      : "ready_for_drafting";

  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_EVIDENCE_READINESS_CONTRACT,
    status,
    identityReady,
    artifactsReady,
    calendarReady,
    blockers: Object.freeze([...new Set(blockers)]),
    warnings: Object.freeze([...new Set(warnings)]),
    evidenceIds: Object.freeze([...evidenceIds]),
  });
}
