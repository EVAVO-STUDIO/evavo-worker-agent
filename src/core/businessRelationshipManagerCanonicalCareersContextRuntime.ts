import type { BrainMemoryContextPort } from "./businessBrainMemoryContextPort";
import {
  roleOpeningEvidenceFromCareersSnapshot,
  type CareersRoleTruthPort,
  type CareersRoleTruthSnapshot,
} from "./businessCareersRoleTruthPort";
import type { OperationsCoreRelationshipSnapshotPort } from "./businessOperationsCoreRelationshipSnapshotPort";
import {
  resolveRoleOpeningTruth,
  type RoleOpeningTruth,
} from "./businessRoleOpeningTruth";
import type { Relationship360EvidenceItem } from "./businessRelationship360Context";
import {
  runCanonicalRelationshipManagerCycleWithOperationsContext,
  type CanonicalRelationshipManagerOperationsContextInput,
  type CanonicalRelationshipManagerOperationsContextResult,
} from "./businessRelationshipManagerCanonicalOperationsContextRuntime";
import type { RelationshipSourceReadinessItem } from "./businessRelationshipSourceReadiness";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CONTEXT_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_careers_context_runtime_v4" as const;

export type CanonicalRelationshipManagerCareersContextInput = Readonly<{
  cycle: CanonicalRelationshipManagerOperationsContextInput["cycle"];
  context: CanonicalRelationshipManagerOperationsContextInput["context"];
  brain: BrainMemoryContextPort;
  operations: OperationsCoreRelationshipSnapshotPort;
  operationsRequired: boolean;
  operationsIdentity?: CanonicalRelationshipManagerOperationsContextInput["operationsIdentity"];
  careers: CareersRoleTruthPort;
  careersRequired: boolean;
  careersIdentity?: Readonly<{
    workspaceId: string;
    targetRoleId?: string | null;
    targetRoleKey?: string | null;
  }> | null;
}>;

export type CanonicalRelationshipManagerCareersContextResult = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CONTEXT_RUNTIME_CONTRACT;
  careersState: "verified" | "not_found" | "provider_unavailable" | "not_required";
  careersEvidenceRef: string | null;
  roleTruth: RoleOpeningTruth | null;
  applicationUrl: string | null;
  candidateRoleAuthorityDerived: boolean;
  canonical: CanonicalRelationshipManagerOperationsContextResult;
  externalEffectPerformed: false;
}>;

function withoutCareersDomain(values: readonly RelationshipSourceReadinessItem[] | null | undefined) {
  const source = values ?? [];
  if (source.some((item) => item.domain === "careers")) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CALLER_READINESS_FORBIDDEN");
  }
  return Object.freeze([...source]);
}

function availabilityFailure(error: unknown) {
  return error instanceof Error && (
    error.message === "CAREERS_ROLE_TRUTH_READ_TIMEOUT"
    || error.message === "CAREERS_ROLE_TRUTH_READ_UNAVAILABLE"
    || /^CAREERS_ROLE_TRUTH_READ_FAILED:\d{3}$/.test(error.message)
  );
}

function readiness(snapshot: CareersRoleTruthSnapshot): RelationshipSourceReadinessItem {
  if (snapshot.state === "verified") return Object.freeze({
    domain: "careers", state: "verified", required: true,
    observedAt: snapshot.observedAt, sourceRefs: Object.freeze([snapshot.evidenceRef]),
    detail: "Dedicated persistent careers role-state truth was queried successfully.",
  });
  if (snapshot.state === "not_found") return Object.freeze({
    domain: "careers", state: "not_found", required: true, absenceAcceptable: true,
    observedAt: snapshot.observedAt, sourceRefs: Object.freeze([snapshot.evidenceRef]),
    detail: "Dedicated careers truth was queried successfully and returned no matching role. This supports only that no confirmed opening was found; it does not support a company-wide not-hiring claim.",
  });
  return Object.freeze({
    domain: "careers", state: "provider_unavailable", required: true,
    detail: "Dedicated careers role-state truth is unavailable; current role-opening status is unknown.",
  });
}

function verifiedApplicationUrl(snapshot: CareersRoleTruthSnapshot, roleTruth: RoleOpeningTruth | null): string | null {
  if (snapshot.state !== "verified" || roleTruth?.maySayRoleExists !== true) return null;
  const matches = snapshot.roles.filter((role) => role.authoritative && role.state === "open" && Boolean(role.applicationUrl));
  if (matches.length !== 1) return null;
  return matches[0]!.applicationUrl;
}

function careersSummary(snapshot: CareersRoleTruthSnapshot, roleTruth: RoleOpeningTruth | null, applicationUrl: string | null): string {
  if (snapshot.state === "not_found") return "Dedicated careers truth was checked successfully and no matching current role record was found. This does not establish that EVAVO is not hiring generally.";
  if (snapshot.state !== "verified") return "Dedicated careers truth is unavailable; current role-opening status is unknown.";
  const roles = snapshot.roles.map((role) => `${role.title}: ${role.state}${role.authoritative ? " (authoritative)" : " (review required)"}`).join("; ");
  const safety = roleTruth?.maySayRoleExists ? "A specific current role-exists claim is supported." : "No specific role-exists claim is currently authorised.";
  const path = applicationUrl ? ` Verified application path: ${applicationUrl}` : " No unique verified application path is available.";
  return `${roles}. ${safety}${path} A company-wide not-hiring claim is not authorised.`;
}

function careersEvidence(snapshot: CareersRoleTruthSnapshot, roleTruth: RoleOpeningTruth | null, applicationUrl: string | null): Relationship360EvidenceItem | null {
  if (snapshot.state === "provider_unavailable") return null;
  return Object.freeze({
    id: `careers-snapshot-${snapshot.evidenceRef.slice(-24)}`,
    domain: "careers",
    summary: careersSummary(snapshot, roleTruth, applicationUrl),
    status: "current",
    authority: "canonical",
    observedAt: snapshot.observedAt,
    sourceRefs: Object.freeze([snapshot.evidenceRef]),
  });
}

export async function runCanonicalRelationshipManagerCycleWithCareersContext(
  input: CanonicalRelationshipManagerCareersContextInput,
): Promise<CanonicalRelationshipManagerCareersContextResult> {
  if (input.careers.contract !== "business_careers_role_truth_port_v1") throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_PORT_CONTRACT_INVALID");
  const baseReadiness = withoutCareersDomain(input.context.sourceReadiness);
  if (input.context.evidenceItems.some((item) => item.domain === "careers")) throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CALLER_EVIDENCE_FORBIDDEN");
  if (!input.careersRequired) {
    const canonical = await runCanonicalRelationshipManagerCycleWithOperationsContext({
      cycle: input.cycle,
      context: Object.freeze({ ...input.context, sourceReadiness: baseReadiness }),
      brain: input.brain, operations: input.operations,
      operationsRequired: input.operationsRequired, operationsIdentity: input.operationsIdentity,
    });
    return Object.freeze({
      contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CONTEXT_RUNTIME_CONTRACT,
      careersState: "not_required", careersEvidenceRef: null, roleTruth: null,
      applicationUrl: null, candidateRoleAuthorityDerived: false, canonical, externalEffectPerformed: false,
    });
  }
  if (!input.careersIdentity) throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_IDENTITY_REQUIRED");

  let snapshot: CareersRoleTruthSnapshot | null = null;
  let careersState: Exclude<CanonicalRelationshipManagerCareersContextResult["careersState"], "not_required"> = "provider_unavailable";
  let careersReadiness: RelationshipSourceReadinessItem;
  let roleTruth: RoleOpeningTruth | null = null;
  let applicationUrl: string | null = null;
  let evidence: Relationship360EvidenceItem | null = null;
  try {
    snapshot = await input.careers.read(input.careersIdentity);
    careersState = snapshot.state;
    careersReadiness = readiness(snapshot);
    if (snapshot.state !== "provider_unavailable") {
      roleTruth = resolveRoleOpeningTruth({
        evidence: roleOpeningEvidenceFromCareersSnapshot(snapshot),
        targetRoleId: snapshot.targetRoleId,
      });
      applicationUrl = verifiedApplicationUrl(snapshot, roleTruth);
      evidence = careersEvidence(snapshot, roleTruth, applicationUrl);
    }
  } catch (error) {
    if (!availabilityFailure(error)) throw error;
    careersReadiness = Object.freeze({
      domain: "careers", state: "provider_unavailable", required: true,
      detail: "Dedicated careers truth could not be queried; current role-opening status is unknown.",
    });
  }

  let candidateRoleAuthorityDerived = false;
  let cycle = input.cycle;
  if (input.cycle.scenario === "graduate_or_candidate") {
    if (!input.cycle.candidate) throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CANDIDATE_CONTEXT_REQUIRED");
    const explicitRoleOpen = roleTruth?.maySayRoleExists === true;
    cycle = Object.freeze({
      ...input.cycle,
      candidate: Object.freeze({
        ...input.cycle.candidate,
        explicitRoleOpen,
        activeRecruitmentProcess: false,
      }),
    });
    candidateRoleAuthorityDerived = true;
  }

  const canonical = await runCanonicalRelationshipManagerCycleWithOperationsContext({
    cycle,
    context: Object.freeze({
      ...input.context,
      ...(snapshot && snapshot.state !== "provider_unavailable" ? { careersSummary: careersSummary(snapshot, roleTruth, applicationUrl) } : {}),
      evidenceItems: Object.freeze([...input.context.evidenceItems, ...(evidence ? [evidence] : [])]),
      sourceReadiness: Object.freeze([...baseReadiness, careersReadiness]),
    }),
    brain: input.brain, operations: input.operations,
    operationsRequired: input.operationsRequired, operationsIdentity: input.operationsIdentity,
  });
  if (careersState === "provider_unavailable" && canonical.brain.canonicalCycle.approvalGradeReady) throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_READINESS_WIDENED");
  if (roleTruth?.maySayNotHiring) throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_GLOBAL_NOT_HIRING_AUTHORITY_FORBIDDEN");
  if (snapshot && snapshot.state !== "provider_unavailable" && !canonical.brain.canonicalCycle.decisionContext.evidenceRefs.includes(snapshot.evidenceRef)) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_EVIDENCE_NOT_BOUND");
  }
  if (candidateRoleAuthorityDerived) {
    const expectedOpen = roleTruth?.maySayRoleExists === true;
    const actualOpen = canonical.brain.canonicalCycle.cycle.decision.candidateStage === "active_process";
    if (expectedOpen !== actualOpen) throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CANDIDATE_ROLE_DERIVATION_MISMATCH");
  }
  if (applicationUrl && roleTruth?.maySayRoleExists !== true) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CAREERS_APPLICATION_PATH_WITHOUT_ROLE_AUTHORITY");
  }

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_CAREERS_CONTEXT_RUNTIME_CONTRACT,
    careersState,
    careersEvidenceRef: snapshot?.evidenceRef ?? null,
    roleTruth,
    applicationUrl,
    candidateRoleAuthorityDerived,
    canonical,
    externalEffectPerformed: false,
  });
}
