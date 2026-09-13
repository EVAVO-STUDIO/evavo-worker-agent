import type { CommunicationWritingProvenanceBinding } from "./businessCommunicationSendEnvelope";
import {
  bindStaffWritingProvenanceForApproval,
  type StaffWritingEnvelopeV2Like,
} from "./businessStaffWritingProvenanceBinding";
import type { StaffCommunicationHandoffV2Like } from "./businessStaffCommunicationHandoffV2";

export const BUSINESS_STAFF_WRITING_OUTPUT_BINDING_CONTRACT = "business_staff_writing_output_binding_v1" as const;

export type StaffDraftCandidateLike = Readonly<{
  id: string;
  subject?: string;
  body: string;
  warnings?: readonly string[];
  unresolvedAssumptionIds?: readonly string[];
  [key: string]: unknown;
}>;

export type StaffDraftPackageLike = Readonly<{
  schema: "evavo-writing/draft-package";
  version: 1;
  requestId: string;
  packageId: string;
  status: "ready" | "needs_input" | "blocked";
  recommendedCandidateId?: string;
  candidates: readonly StaffDraftCandidateLike[];
  missingInformation?: readonly string[];
  warnings?: readonly string[];
  [key: string]: unknown;
}>;

export type BoundStaffDraftSelection = Readonly<{
  contract: typeof BUSINESS_STAFF_WRITING_OUTPUT_BINDING_CONTRACT;
  writingProvenance: CommunicationWritingProvenanceBinding;
  decisionPackageId: string;
  writingPackageId: string;
  writingRequestId: string;
  candidateId: string;
  subject: string | null;
  body: string;
  sourceRefs: readonly string[];
}>;

function clean(value: unknown, code: string, max = 200_000): string {
  if (typeof value !== "string") throw new Error(code);
  const out = value.trim();
  if (!out || out.length > max) throw new Error(code);
  return out;
}

/**
 * Validates that the chosen draft output actually belongs to the same writing
 * request whose Relationship Manager provenance Worker already verified.
 * Nothing here authorises sending; it only creates the immutable identity
 * inputs that the later approval envelope can bind.
 */
export function bindStaffWritingOutputForApproval(input: Readonly<{
  handoff: StaffCommunicationHandoffV2Like;
  writingEnvelope: StaffWritingEnvelopeV2Like | unknown;
  draftPackage: StaffDraftPackageLike | unknown;
  candidateId?: string | null;
}>): BoundStaffDraftSelection {
  const provenance = bindStaffWritingProvenanceForApproval({
    handoff: input.handoff,
    writingEnvelope: input.writingEnvelope,
  });
  const draftPackage = input.draftPackage as Partial<StaffDraftPackageLike> | null;
  if (!draftPackage || draftPackage.schema !== "evavo-writing/draft-package" || draftPackage.version !== 1) {
    throw new Error("STAFF_WRITING_OUTPUT_CONTRACT_INVALID");
  }
  const requestId = clean(draftPackage.requestId, "STAFF_WRITING_OUTPUT_REQUEST_ID_REQUIRED", 300);
  if (requestId !== provenance.approvalBinding.writingRequestId) throw new Error("STAFF_WRITING_OUTPUT_REQUEST_MISMATCH");
  if (draftPackage.status !== "ready") throw new Error(`STAFF_WRITING_OUTPUT_NOT_READY:${draftPackage.status ?? "unknown"}`);
  if (draftPackage.missingInformation?.length) throw new Error("STAFF_WRITING_OUTPUT_MISSING_INFORMATION");
  if (!Array.isArray(draftPackage.candidates) || draftPackage.candidates.length < 1) throw new Error("STAFF_WRITING_OUTPUT_CANDIDATE_REQUIRED");

  const chosenId = clean(input.candidateId ?? draftPackage.recommendedCandidateId, "STAFF_WRITING_OUTPUT_CANDIDATE_ID_REQUIRED", 300);
  const matches = draftPackage.candidates.filter((candidate) => candidate.id === chosenId);
  if (matches.length !== 1) throw new Error(matches.length ? "STAFF_WRITING_OUTPUT_CANDIDATE_AMBIGUOUS" : "STAFF_WRITING_OUTPUT_CANDIDATE_NOT_FOUND");
  const candidate = matches[0]!;
  const body = clean(candidate.body, "STAFF_WRITING_OUTPUT_BODY_REQUIRED");
  if (candidate.unresolvedAssumptionIds?.length) throw new Error("STAFF_WRITING_OUTPUT_UNRESOLVED_ASSUMPTIONS");
  if (candidate.warnings?.length) throw new Error("STAFF_WRITING_OUTPUT_CANDIDATE_WARNINGS_REQUIRE_REVIEW");
  if (draftPackage.warnings?.length) throw new Error("STAFF_WRITING_OUTPUT_PACKAGE_WARNINGS_REQUIRE_REVIEW");

  const subject = typeof candidate.subject === "string" && candidate.subject.trim() ? candidate.subject.trim() : null;
  return Object.freeze({
    contract: BUSINESS_STAFF_WRITING_OUTPUT_BINDING_CONTRACT,
    writingProvenance: provenance.approvalBinding,
    decisionPackageId: provenance.decisionPackageId,
    writingPackageId: clean(draftPackage.packageId, "STAFF_WRITING_OUTPUT_PACKAGE_ID_REQUIRED", 300),
    writingRequestId: requestId,
    candidateId: chosenId,
    subject,
    body,
    sourceRefs: provenance.sourceRefs,
  });
}
