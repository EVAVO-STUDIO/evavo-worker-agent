import { buildBusinessRelationship360Context, type Relationship360Context, type Relationship360Input } from "./businessRelationship360Context";
import {
  assessRelationshipContextFreshness,
  type ContextFreshnessAssessment,
  type ContextFreshnessDomain,
} from "./businessRelationshipContextFreshness";
import { buildRelationshipChangeDigest, type RelationshipChangeDigest } from "./businessRelationshipChangeDigest";
import { buildRelationshipStaffBrief, type RelationshipStaffBrief } from "./businessRelationshipStaffBrief";
import { buildRelationshipContextResolutionPlan, type RelationshipContextResolutionPlan } from "./businessRelationshipContextResolutionPlan";
import {
  assessRelationshipSourceReadiness,
  type RelationshipSourceReadinessAssessment,
  type RelationshipSourceReadinessItem,
} from "./businessRelationshipSourceReadiness";

export const BUSINESS_RELATIONSHIP_DECISION_CONTEXT_CONTRACT = "business_relationship_decision_context_v3" as const;

export type RelationshipChangeDigestInput = Parameters<typeof buildRelationshipChangeDigest>[0];

export type RelationshipDecisionContext = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_DECISION_CONTEXT_CONTRACT;
  relationshipId: string;
  generatedAt: string;
  context360: Relationship360Context;
  freshness: ContextFreshnessAssessment;
  sourceReadiness: RelationshipSourceReadinessAssessment | null;
  changes: RelationshipChangeDigest | null;
  staffBrief: RelationshipStaffBrief;
  resolutionPlan: RelationshipContextResolutionPlan;
  approvalGradeReady: boolean;
  evidenceRefs: readonly string[];
}>;

function defaultRequiredFreshnessDomains(input: Relationship360Input): readonly ContextFreshnessDomain[] {
  const domains = new Set<ContextFreshnessDomain>();
  for (const item of input.evidenceItems) {
    if (item.status !== "current") continue;
    if (item.domain === "calendar") continue;
    domains.add(item.domain);
  }
  return Object.freeze([...domains]);
}

export function buildRelationshipDecisionContext(input: Readonly<{
  objective: string;
  relationship: Relationship360Input;
  changes?: RelationshipChangeDigestInput | null;
  requiredFreshnessDomains?: readonly ContextFreshnessDomain[];
  sourceReadiness?: readonly RelationshipSourceReadinessItem[] | null;
}>): RelationshipDecisionContext {
  const context360 = buildBusinessRelationship360Context(input.relationship);
  const freshness = assessRelationshipContextFreshness({
    now: input.relationship.now,
    evidence: input.relationship.evidenceItems,
    requiredDomains: input.requiredFreshnessDomains ?? defaultRequiredFreshnessDomains(input.relationship),
  });
  const sourceReadiness = input.sourceReadiness
    ? assessRelationshipSourceReadiness({ now: input.relationship.now, sources: input.sourceReadiness })
    : null;
  const changes = input.changes ? buildRelationshipChangeDigest(input.changes) : null;
  const staffBrief = buildRelationshipStaffBrief({
    objective: input.objective,
    context: context360,
    changes,
    freshness,
  });
  const resolutionPlan = buildRelationshipContextResolutionPlan({
    relationshipId: context360.relationshipId,
    missingContext: [...context360.missingCriticalContext, ...(sourceReadiness?.issues ?? [])],
    conflicts: context360.conflicts,
    mustVerify: staffBrief.mustVerify,
  });
  const evidenceRefs = [...new Set([
    ...context360.evidenceRefs,
    ...staffBrief.sourceRefs,
    ...(changes?.evidenceRefs ?? []),
    ...freshness.findings.flatMap((finding) => finding.sourceRefs),
    ...(sourceReadiness?.evidenceRefs ?? []),
  ])];
  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_DECISION_CONTEXT_CONTRACT,
    relationshipId: context360.relationshipId,
    generatedAt: context360.generatedAt,
    context360,
    freshness,
    sourceReadiness,
    changes,
    staffBrief,
    resolutionPlan,
    approvalGradeReady: staffBrief.approvalGradeReady
      && (sourceReadiness?.ready ?? true)
      && resolutionPlan.ready
      && evidenceRefs.length > 0,
    evidenceRefs: Object.freeze(evidenceRefs),
  });
}
