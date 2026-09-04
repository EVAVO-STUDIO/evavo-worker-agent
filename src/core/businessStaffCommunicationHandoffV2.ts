import type { CommunicationDecisionPackage } from "./businessCommunicationDecisionPackage";
import type { RelationshipDecisionContext } from "./businessRelationshipDecisionContext";

export const BUSINESS_STAFF_COMMUNICATION_HANDOFF_V2_CONTRACT = "business_staff_communication_handoff_v2" as const;

export type StaffCommunicationHandoffV1Like = Readonly<{
  schema: "evavo-writing/staff-communication-handoff";
  version: 1;
  protocol: "evavo-staff-communication-handoff-v1";
  relationshipId?: string | null;
  [key: string]: unknown;
}>;

export type StaffCommunicationHandoffV2Like = Readonly<{
  schema: "evavo-writing/staff-communication-handoff-v2";
  version: 2;
  protocol: "evavo-staff-communication-handoff-v2";
  handoff: StaffCommunicationHandoffV1Like;
  staffContext: Readonly<{
    relationshipId: string;
    generatedAt: string;
    approvalGradeReady: true;
    blockingVerificationOutstanding: false;
    whatChanged: string;
    materialChanges: readonly string[];
    priorities: readonly string[];
    mustVerify: readonly string[];
    mustNotAssume: readonly string[];
    obligationsToRespect: readonly string[];
    priorDecisionsToRespect: readonly string[];
    relationshipRisks: readonly string[];
    staleDomains: readonly string[];
    nextContextSources: readonly string[];
    sourceRefs: readonly string[];
  }>;
}>;

export function buildStaffCommunicationHandoffV2(input: Readonly<{
  handoffV1: StaffCommunicationHandoffV1Like;
  relationshipContext: RelationshipDecisionContext;
  communicationDecision: CommunicationDecisionPackage;
}>): StaffCommunicationHandoffV2Like {
  const relationshipId = input.relationshipContext.relationshipId.trim();
  if (!relationshipId) throw new Error("STAFF_HANDOFF_V2_RELATIONSHIP_REQUIRED");
  if (input.handoffV1.relationshipId && input.handoffV1.relationshipId !== relationshipId) {
    throw new Error("STAFF_HANDOFF_V2_RELATIONSHIP_MISMATCH");
  }
  if (!input.relationshipContext.approvalGradeReady) throw new Error("STAFF_HANDOFF_V2_RELATIONSHIP_CONTEXT_NOT_READY");
  if (!input.communicationDecision.approvalGradeReady) throw new Error("STAFF_HANDOFF_V2_COMMUNICATION_DECISION_NOT_READY");
  if (input.communicationDecision.disposition === "escalate" || input.communicationDecision.disposition === "do_not_reply") {
    throw new Error(`STAFF_HANDOFF_V2_DISPOSITION_NOT_DRAFTABLE:${input.communicationDecision.disposition}`);
  }
  if (input.relationshipContext.resolutionPlan.blockingIssues.length) throw new Error("STAFF_HANDOFF_V2_BLOCKING_VERIFICATION_OUTSTANDING");

  const brief = input.relationshipContext.staffBrief;
  const sourceRefs = [...new Set([
    ...input.relationshipContext.evidenceRefs,
    ...input.communicationDecision.evidenceIds,
    ...brief.sourceRefs,
  ])];
  if (!sourceRefs.length) throw new Error("STAFF_HANDOFF_V2_SOURCE_REFS_REQUIRED");

  return Object.freeze({
    schema: "evavo-writing/staff-communication-handoff-v2",
    version: 2,
    protocol: "evavo-staff-communication-handoff-v2",
    handoff: input.handoffV1,
    staffContext: Object.freeze({
      relationshipId,
      generatedAt: input.relationshipContext.generatedAt,
      approvalGradeReady: true,
      blockingVerificationOutstanding: false,
      whatChanged: brief.whatChanged,
      materialChanges: Object.freeze([...brief.materialChanges]),
      priorities: Object.freeze([...brief.priorities]),
      mustVerify: Object.freeze([...brief.mustVerify]),
      mustNotAssume: Object.freeze([...brief.mustNotAssume]),
      obligationsToRespect: Object.freeze([...brief.obligationsToRespect]),
      priorDecisionsToRespect: Object.freeze([...brief.priorDecisionsToRespect]),
      relationshipRisks: Object.freeze([...brief.relationshipRisks]),
      staleDomains: Object.freeze([...brief.staleDomains]),
      nextContextSources: Object.freeze([...input.relationshipContext.resolutionPlan.orderedSources]),
      sourceRefs: Object.freeze(sourceRefs),
    }),
  });
}
