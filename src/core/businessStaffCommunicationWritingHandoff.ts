import { buildStaffCommunicationHandoffV1, type StaffCommunicationHandoffV1Built, type StaffHandoffAttachmentExpectation, type StaffHandoffParticipant } from "./businessStaffCommunicationHandoffV1";
import { buildStaffCommunicationHandoffV2, type StaffCommunicationHandoffV2Like } from "./businessStaffCommunicationHandoffV2";
import type { CommunicationDecisionPackage } from "./businessCommunicationDecisionPackage";
import type { CommunicationEvidenceBundle } from "./businessCommunicationEvidenceBundle";
import type { ReplyBrief } from "./businessCommunicationReplyBrief";
import type { BusinessObligation } from "./businessObligationLedger";
import type { RelationshipDecisionContext } from "./businessRelationshipDecisionContext";

export const BUSINESS_STAFF_COMMUNICATION_WRITING_HANDOFF_CONTRACT = "business_staff_communication_writing_handoff_v1" as const;

export type StaffCommunicationWritingHandoff = Readonly<{
  contract: typeof BUSINESS_STAFF_COMMUNICATION_WRITING_HANDOFF_CONTRACT;
  v1: StaffCommunicationHandoffV1Built;
  v2: StaffCommunicationHandoffV2Like;
  readyForWritingStudio: true;
  evidenceRefs: readonly string[];
}>;

export function buildStaffCommunicationWritingHandoff(input: Readonly<{
  handoffId: string;
  createdAt: string;
  communicationKind: StaffCommunicationHandoffV1Built["communicationKind"];
  participants: readonly StaffHandoffParticipant[];
  threadSummary: string;
  previousResponseSummary?: string | null;
  relationshipSummary?: string | null;
  relationshipId?: string | null;
  organizationId?: string | null;
  personId?: string | null;
  threadId?: string | null;
  communicationDecision: CommunicationDecisionPackage;
  relationshipContext: RelationshipDecisionContext;
  evidenceBundle: CommunicationEvidenceBundle;
  replyBrief: ReplyBrief;
  obligations?: readonly BusinessObligation[];
  attachmentExpectations?: readonly StaffHandoffAttachmentExpectation[];
  desiredOutcome?: string | null;
  emotionalSensitivity?: "low" | "medium" | "high";
  reputationalSensitivity?: "low" | "medium" | "high";
  urgency?: "normal" | "time_sensitive" | "urgent";
  urgencyReason?: string | null;
  riskTier?: 0 | 1 | 2 | 3;
}>): StaffCommunicationWritingHandoff {
  const relationshipId = input.relationshipId ?? input.relationshipContext.relationshipId;
  if (relationshipId !== input.relationshipContext.relationshipId) throw new Error("STAFF_WRITING_HANDOFF_RELATIONSHIP_MISMATCH");
  const v1 = buildStaffCommunicationHandoffV1({
    handoffId: input.handoffId,
    createdAt: input.createdAt,
    communicationKind: input.communicationKind,
    participants: input.participants,
    threadSummary: input.threadSummary,
    previousResponseSummary: input.previousResponseSummary,
    relationshipSummary: input.relationshipSummary,
    relationshipId,
    organizationId: input.organizationId,
    personId: input.personId,
    threadId: input.threadId,
    decision: input.communicationDecision,
    evidenceBundle: input.evidenceBundle,
    replyBrief: input.replyBrief,
    obligations: input.obligations,
    attachmentExpectations: input.attachmentExpectations,
    desiredOutcome: input.desiredOutcome,
    emotionalSensitivity: input.emotionalSensitivity,
    reputationalSensitivity: input.reputationalSensitivity,
    urgency: input.urgency,
    urgencyReason: input.urgencyReason,
    riskTier: input.riskTier,
  });
  const v2 = buildStaffCommunicationHandoffV2({
    handoffV1: v1,
    relationshipContext: input.relationshipContext,
    communicationDecision: input.communicationDecision,
  });
  const evidenceRefs = [...new Set([
    ...input.relationshipContext.evidenceRefs,
    ...input.communicationDecision.evidenceIds,
    ...input.evidenceBundle.items.map((item) => item.sourceRef),
  ])];
  return Object.freeze({
    contract: BUSINESS_STAFF_COMMUNICATION_WRITING_HANDOFF_CONTRACT,
    v1,
    v2,
    readyForWritingStudio: true,
    evidenceRefs: Object.freeze(evidenceRefs),
  });
}
