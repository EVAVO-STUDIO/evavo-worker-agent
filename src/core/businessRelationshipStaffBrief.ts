import type { Relationship360Context } from "./businessRelationship360Context";

export const BUSINESS_RELATIONSHIP_STAFF_BRIEF_CONTRACT = "business_relationship_staff_brief_v1" as const;

export type RelationshipStaffBrief = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_STAFF_BRIEF_CONTRACT;
  relationshipId: string;
  objective: string;
  situation: string;
  priorities: readonly string[];
  mustVerify: readonly string[];
  mustNotAssume: readonly string[];
  obligationsToRespect: readonly string[];
  priorDecisionsToRespect: readonly string[];
  relationshipRisks: readonly string[];
  sourceRefs: readonly string[];
  approvalGradeReady: boolean;
}>;

export function buildRelationshipStaffBrief(input: Readonly<{
  objective: string;
  context: Relationship360Context;
}>): RelationshipStaffBrief {
  const objective = input.objective.trim();
  if (!objective) throw new Error("RELATIONSHIP_STAFF_BRIEF_OBJECTIVE_REQUIRED");
  const context = input.context;
  const priorities: string[] = [];
  const mustVerify: string[] = [];
  const mustNotAssume: string[] = [];
  const risks: string[] = [];

  if (context.openEvavoObligations.length) {
    priorities.push("Address EVAVO-owned obligations before creating avoidable new communication or chasing the counterparty.");
  }
  if (context.support) priorities.push("Account for active support/service context before selecting tone or making commitments.");
  if (context.commercial) priorities.push("Use current commercial truth and stay within explicit commitment authority.");
  if (context.communications) priorities.push("Answer only the live thread state; do not resurrect resolved or quoted-history items.");
  if (!priorities.length) priorities.push("Resolve the current objective with the lightest useful action supported by evidence.");

  for (const missing of context.missingCriticalContext) mustVerify.push(missing);
  for (const conflict of context.conflicts) mustVerify.push(`Resolve conflict: ${conflict}`);
  if (!context.identity) mustNotAssume.push("Do not assume the sender/person identity from name similarity alone.");
  if (!context.project && context.missingCriticalContext.some((item) => /project/i.test(item))) mustNotAssume.push("Do not invent current project status, scope or delivery position.");
  if (!context.commercial) mustNotAssume.push("Do not invent pricing, hiring, scope, payment, contract or other commercial authority.");
  if (!context.documents) mustNotAssume.push("Do not claim a document was reviewed, attached, current or controlling unless separately verified.");

  if (context.conflicts.length) risks.push("Conflicting evidence can make a polished answer wrong; resolve it before consequential external action.");
  if (context.missingCriticalContext.length) risks.push("Critical context is incomplete.");
  if (context.openEvavoObligations.length) risks.push("EVAVO already owes the relationship an action; avoid adding unnecessary communication debt.");

  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_STAFF_BRIEF_CONTRACT,
    relationshipId: context.relationshipId,
    objective,
    situation: context.contextSummary,
    priorities: Object.freeze(priorities),
    mustVerify: Object.freeze([...new Set(mustVerify)]),
    mustNotAssume: Object.freeze([...new Set(mustNotAssume)]),
    obligationsToRespect: context.openEvavoObligations,
    priorDecisionsToRespect: context.priorDecisions,
    relationshipRisks: Object.freeze(risks),
    sourceRefs: context.evidenceRefs,
    approvalGradeReady: context.missingCriticalContext.length === 0 && context.conflicts.length === 0 && context.evidenceRefs.length > 0,
  });
}
