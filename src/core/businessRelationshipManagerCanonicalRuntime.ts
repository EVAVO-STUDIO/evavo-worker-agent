import type { RelationshipManagerCommunicationCycleInput, RelationshipManagerCommunicationCycle } from "./businessRelationshipManagerRuntime";
import { runRelationshipManagerCommunicationCycle } from "./businessRelationshipManagerRuntime";
import {
  buildRelationshipDecisionContext,
  type RelationshipChangeDigestInput,
  type RelationshipDecisionContext,
} from "./businessRelationshipDecisionContext";
import type { Relationship360EvidenceItem } from "./businessRelationship360Context";
import type { ContextFreshnessDomain } from "./businessRelationshipContextFreshness";
import type { RelationshipSourceReadinessItem } from "./businessRelationshipSourceReadiness";
import type { BrainMemoryContextResponse } from "./businessMemoryContextBridge";
import { projectGmailThreadToCanonicalRelationshipState } from "./businessGmailRelationshipStateProjection";

export const BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_RUNTIME_CONTRACT =
  "business_relationship_manager_canonical_runtime_v2" as const;

export type CanonicalRelationshipContextInput = Readonly<{
  identitySummary: string;
  organizationSummary?: string | null;
  projectSummary?: string | null;
  commercialSummary?: string | null;
  careersSummary?: string | null;
  supportSummary?: string | null;
  communicationSummary: string;
  documentsSummary?: string | null;
  priorDecisionSummaries?: readonly string[];
  evidenceItems: readonly Relationship360EvidenceItem[];
  memory?: BrainMemoryContextResponse | null;
  changes?: RelationshipChangeDigestInput | null;
  requiredFreshnessDomains?: readonly ContextFreshnessDomain[];
  sourceReadiness?: readonly RelationshipSourceReadinessItem[] | null;
}>;

export type CanonicalRelationshipManagerCycleInput = Readonly<{
  cycle: Omit<RelationshipManagerCommunicationCycleInput, "staffBrief" | "contextResolutionPlan" | "memoryContext">;
  context: CanonicalRelationshipContextInput;
}>;

export type CanonicalRelationshipManagerCycle = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_RUNTIME_CONTRACT;
  decisionContext: RelationshipDecisionContext;
  cycle: RelationshipManagerCommunicationCycle;
  approvalGradeReady: boolean;
  externalEffectPerformed: false;
}>;

function required(value: string | null | undefined, code: string): string {
  const clean = value?.trim() ?? "";
  if (!clean) throw new Error(code);
  return clean;
}

export function runCanonicalRelationshipManagerCommunicationCycle(
  input: CanonicalRelationshipManagerCycleInput,
): CanonicalRelationshipManagerCycle {
  const cycleInput = input.cycle;
  const relationshipId = required(cycleInput.gmail.relationshipId, "RELATIONSHIP_MANAGER_CANONICAL_RELATIONSHIP_ID_REQUIRED");
  const personId = required(cycleInput.gmail.personId, "RELATIONSHIP_MANAGER_CANONICAL_PERSON_ID_REQUIRED");
  const observedAt = new Date(cycleInput.observedAt);
  const decisionAt = new Date(cycleInput.decisionAt);
  if (Number.isNaN(observedAt.getTime()) || Number.isNaN(decisionAt.getTime()) || decisionAt < observedAt) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_DECISION_CLOCK_INVALID");
  }
  if (cycleInput.identity.status !== "verified" || cycleInput.identity.selected?.personId !== personId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_IDENTITY_NOT_VERIFIED");
  }
  if (cycleInput.identity.contract !== "business_relationship_identity_resolver_v2") {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_IDENTITY_CONTRACT_INVALID");
  }

  const projection = projectGmailThreadToCanonicalRelationshipState({
    threadId: cycleInput.gmail.threadId,
    messages: cycleInput.gmail.messages,
    previousThreadState: cycleInput.gmail.previousThreadState,
    previousObligations: cycleInput.gmail.previousObligations,
    relationshipId,
    personId,
    organizationId: cycleInput.gmail.organizationId,
    projectId: cycleInput.gmail.projectId,
    knownRelationshipSensitive: cycleInput.gmail.knownRelationshipSensitive,
    senderSuppressed: cycleInput.gmail.senderSuppressed,
    observedAt: observedAt.toISOString(),
  });

  const decisionContext = buildRelationshipDecisionContext({
    objective: cycleInput.objective,
    relationship: {
      relationshipId,
      personId,
      organizationId: cycleInput.gmail.organizationId,
      projectId: cycleInput.gmail.projectId,
      threadId: projection.threadId,
      identitySummary: input.context.identitySummary,
      organizationSummary: input.context.organizationSummary,
      projectSummary: input.context.projectSummary,
      commercialSummary: input.context.commercialSummary,
      careersSummary: input.context.careersSummary,
      supportSummary: input.context.supportSummary,
      communicationSummary: input.context.communicationSummary,
      documentsSummary: input.context.documentsSummary,
      priorDecisionSummaries: input.context.priorDecisionSummaries,
      obligations: projection.obligations,
      evidenceItems: input.context.evidenceItems,
      memory: input.context.memory,
      now: decisionAt.toISOString(),
    },
    changes: input.context.changes,
    requiredFreshnessDomains: input.context.requiredFreshnessDomains,
    sourceReadiness: input.context.sourceReadiness,
  });
  if (decisionContext.relationshipId !== relationshipId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_CONTEXT_RELATIONSHIP_MISMATCH");
  }

  const additionalEvidenceIds = Object.freeze([...new Set([
    ...(cycleInput.additionalEvidenceIds ?? []).map((item) => item.trim()).filter(Boolean),
    ...decisionContext.evidenceRefs,
  ])]);

  const cycle = runRelationshipManagerCommunicationCycle({
    ...cycleInput,
    gmail: {
      ...cycleInput.gmail,
      relationshipId,
      personId,
    },
    additionalEvidenceIds,
    staffBrief: decisionContext.staffBrief,
    contextResolutionPlan: decisionContext.resolutionPlan,
    memoryContext: input.context.memory,
  });

  if (cycle.projection.relationshipId !== relationshipId || cycle.projection.personId !== personId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_PROJECTION_IDENTITY_MISMATCH");
  }
  if (cycle.decision.relationshipCycleId !== cycle.cycleId) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_DECISION_CYCLE_MISMATCH");
  }
  if (cycle.decision.approvalGradeReady && !decisionContext.approvalGradeReady) {
    throw new Error("RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_READINESS_WIDENED");
  }
  const approvalGradeReady = decisionContext.approvalGradeReady && cycle.decision.approvalGradeReady;

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_MANAGER_CANONICAL_RUNTIME_CONTRACT,
    decisionContext,
    cycle,
    approvalGradeReady,
    externalEffectPerformed: false,
  });
}
