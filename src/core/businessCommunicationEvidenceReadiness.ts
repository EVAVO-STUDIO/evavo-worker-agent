import type { ArtifactResolution } from "./businessArtifactResolver";
import type { CalendarCommitmentVerification } from "./businessCalendarCommitmentVerifier";
import type { IdentityResolution } from "./businessRelationshipIdentityResolver";

export const BUSINESS_COMMUNICATION_EVIDENCE_READINESS_CONTRACT = "business_communication_evidence_readiness_v1" as const;

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

  const identityReady = input.identity.status === "verified" && input.identity.confidence >= (input.requireApprovalGradeIdentity === false ? 70 : 90);
  if (!identityReady) blockers.push("Recipient/person identity is not verified strongly enough for external communication.");
  if (input.identity.selected) {
    for (const item of input.identity.selected.evidence) evidenceIds.add(`${item.source}:${item.ref}`);
  }

  const artifacts = input.artifactResolutions ?? [];
  const artifactsReady = input.attachmentsRequired
    ? artifacts.length > 0 && artifacts.every((item) => item.status === "verified" && item.selected?.current && item.selected.sourceEvidenceIds.length)
    : artifacts.every((item) => item.status === "verified" || item.status === "unresolved");
  if (input.attachmentsRequired && !artifactsReady) blockers.push("A required attachment/document is not resolved to one verified current artifact.");
  for (const resolution of artifacts) {
    if (resolution.status === "ambiguous") blockers.push("Multiple artifacts match a communication attachment requirement.");
    if (resolution.selected) for (const id of resolution.selected.sourceEvidenceIds) evidenceIds.add(id);
  }

  const calendars = input.calendarCommitments ?? [];
  const calendarReady = input.calendarPromiseRequired
    ? calendars.length > 0 && calendars.every((item) => item.status === "verified_available" && item.canPromise)
    : calendars.every((item) => item.status !== "verified_unavailable");
  if (input.calendarPromiseRequired && !calendarReady) blockers.push("A proposed meeting/time commitment is not verified available in the authoritative calendar.");
  for (const verification of calendars) for (const id of verification.evidenceIds) evidenceIds.add(id);

  if (!input.attachmentsRequired && !artifacts.length) warnings.push("No artifact verification was required for this communication.");
  if (!input.calendarPromiseRequired && !calendars.length) warnings.push("No calendar promise was required for this communication.");

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
