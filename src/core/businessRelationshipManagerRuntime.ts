import type { ArtifactResolution } from "./businessArtifactResolver";
import type { CalendarCommitmentVerification } from "./businessCalendarCommitmentVerifier";
import type { CandidateRelationshipInput } from "./businessCandidateRelationship";
import { communicationDecisionToMemoryCandidate } from "./businessCommunicationDecisionMemory";
import {
  buildCommunicationDecisionPackage,
  type CommunicationDecisionPackage,
  type CommunicationScenario,
} from "./businessCommunicationDecisionPackage";
import {
  assessCommunicationEvidenceReadiness,
  type CommunicationEvidenceReadiness,
} from "./businessCommunicationEvidenceReadiness";
import type { ChannelDecisionInput } from "./businessRelationshipConductPolicy";
import type { RelationshipStaffBrief } from "./businessRelationshipStaffBrief";
import type { RelationshipContextResolutionPlan } from "./businessRelationshipContextResolutionPlan";
import type { BrainMemoryContextResponse } from "./businessMemoryContextBridge";
import type { IdentityResolution } from "./businessRelationshipIdentityResolver";
import type { BusinessObligation } from "./businessObligationLedger";
import type { ThreadStateItem } from "./businessThreadDelta";
import type { GmailProviderMessage } from "./businessGmailThreadIngestion";
import {
  projectGmailThreadToCanonicalRelationshipState,
  type GmailRelationshipStateProjection,
} from "./businessGmailRelationshipStateProjection";
import {
  gmailRelationshipProjectionToMemoryObservations,
  communicationDecisionCandidateToMemoryObservation,
  type BusinessMemoryIngestionObservation,
} from "./businessMemoryIngestionObservation";

export const BUSINESS_RELATIONSHIP_MANAGER_RUNTIME_CONTRACT = "business_relationship_manager_runtime_v1" as const;

export type RelationshipManagerCommunicationCycleInput = Readonly<{
  cycleId: string;
  observedAt: string;
  decisionAt: string;
  scenario: CommunicationScenario;
  objective: string;
  gmail: Readonly<{
    threadId: string;
    messages: readonly GmailProviderMessage[];
    previousThreadState?: readonly ThreadStateItem[];
    previousObligations?: readonly BusinessObligation[];
    relationshipId?: string | null;
    personId?: string | null;
    organizationId?: string | null;
    projectId?: string | null;
    knownRelationshipSensitive?: boolean;
    senderSuppressed?: boolean;
  }>;
  identity: IdentityResolution;
  channel: ChannelDecisionInput;
  candidate?: CandidateRelationshipInput | null;
  artifactResolutions?: readonly ArtifactResolution[];
  calendarCommitments?: readonly CalendarCommitmentVerification[];
  attachmentsRequired?: boolean;
  calendarPromiseRequired?: boolean;
  evidenceConfidence: number;
  additionalEvidenceIds?: readonly string[];
  staffBrief?: RelationshipStaffBrief | null;
  contextResolutionPlan?: RelationshipContextResolutionPlan | null;
  memoryContext?: BrainMemoryContextResponse | null;
}>;

export type RelationshipManagerCommunicationCycle = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_RUNTIME_CONTRACT;
  cycleId: string;
  observedAt: string;
  projection: GmailRelationshipStateProjection;
  evidenceReadiness: CommunicationEvidenceReadiness;
  decision: CommunicationDecisionPackage;
  memoryObservations: readonly BusinessMemoryIngestionObservation[];
  externalEffectPerformed: false;
}>;

function requiredText(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`RELATIONSHIP_MANAGER_RUNTIME_${field.toUpperCase()}_REQUIRED`);
  return normalized;
}

function iso(value: string, field: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(`RELATIONSHIP_MANAGER_RUNTIME_${field.toUpperCase()}_INVALID`);
  return parsed.toISOString();
}

export function runRelationshipManagerCommunicationCycle(
  input: RelationshipManagerCommunicationCycleInput,
): RelationshipManagerCommunicationCycle {
  const cycleId = requiredText(input.cycleId, "cycle_id");
  const observedAt = iso(input.observedAt, "observed_at");
  const decisionAt = iso(input.decisionAt, "decision_at");
  if (decisionAt < observedAt) throw new Error("RELATIONSHIP_MANAGER_RUNTIME_DECISION_BEFORE_OBSERVATION");

  const projection = projectGmailThreadToCanonicalRelationshipState({
    threadId: input.gmail.threadId,
    messages: input.gmail.messages,
    previousThreadState: input.gmail.previousThreadState,
    previousObligations: input.gmail.previousObligations,
    relationshipId: input.gmail.relationshipId,
    personId: input.gmail.personId,
    organizationId: input.gmail.organizationId,
    projectId: input.gmail.projectId,
    knownRelationshipSensitive: input.gmail.knownRelationshipSensitive,
    senderSuppressed: input.gmail.senderSuppressed,
    observedAt,
  });

  const evidenceReadiness = assessCommunicationEvidenceReadiness({
    identity: input.identity,
    artifactResolutions: input.artifactResolutions,
    calendarCommitments: input.calendarCommitments,
    attachmentsRequired: input.attachmentsRequired,
    calendarPromiseRequired: input.calendarPromiseRequired,
  });

  const evidenceIds = Object.freeze([...new Set([
    ...projection.sourceEvidenceIds,
    ...(input.additionalEvidenceIds ?? []).map((item) => item.trim()).filter(Boolean),
    ...evidenceReadiness.evidenceIds,
  ])]);
  if (!evidenceIds.length) throw new Error("RELATIONSHIP_MANAGER_RUNTIME_EVIDENCE_REQUIRED");

  const decision = buildCommunicationDecisionPackage({
    packageId: `relationship-cycle:${cycleId}`,
    scenario: input.scenario,
    objective: input.objective,
    thread: {
      threadId: projection.threadId,
      previousState: input.gmail.previousThreadState ?? [],
      latestObservedState: projection.latestObservedThreadState,
    },
    obligations: projection.obligations,
    channel: input.channel,
    candidate: input.candidate,
    evidenceIds,
    evidenceConfidence: input.evidenceConfidence,
    evidenceReadiness,
    staffBrief: input.staffBrief,
    contextResolutionPlan: input.contextResolutionPlan,
    memoryContext: input.memoryContext,
    decisionAt,
  });

  const gmailObservations = gmailRelationshipProjectionToMemoryObservations(projection);
  const decisionCandidate = communicationDecisionToMemoryCandidate({
    decision,
    decidedAt: decision.decisionAt,
    relationshipId: input.gmail.relationshipId,
    personId: input.gmail.personId,
    organizationId: input.gmail.organizationId,
    projectId: input.gmail.projectId,
    threadId: projection.threadId,
  });
  const decisionObservation = communicationDecisionCandidateToMemoryObservation(decisionCandidate);

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_RUNTIME_CONTRACT,
    cycleId,
    observedAt,
    projection,
    evidenceReadiness,
    decision,
    memoryObservations: Object.freeze([...gmailObservations, decisionObservation]),
    externalEffectPerformed: false,
  });
}
