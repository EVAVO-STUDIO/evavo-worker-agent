export const BUSINESS_RELATIONSHIP_DECISION_TRACE_CONTRACT = "business_relationship_decision_trace_v1" as const;

export type RelationshipDecisionTrace = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_DECISION_TRACE_CONTRACT;
  traceId: string;
  createdAt: string;
  relationshipId?: string | null;
  threadId?: string | null;
  objective: string;
  evidenceIds: readonly string[];
  evidenceConfidence: number;
  factsBelieved: readonly string[];
  uncertainties: readonly string[];
  conductRulesApplied: readonly string[];
  staffInstinctsApplied: readonly string[];
  alternativesConsidered: readonly Readonly<{
    action: string;
    rejectedBecause: string;
  }>[];
  channelDecision?: Readonly<{
    channel: "email" | "direct_message" | "phone_call" | "video_call" | "in_person";
    meetingConsidered: boolean;
    meetingJustified: boolean;
    reasons: readonly string[];
  }> | null;
  finalDecision: Readonly<{
    disposition: "reply" | "acknowledge" | "follow_up" | "repair" | "hold_boundary" | "do_not_reply" | "escalate" | "defer";
    reason: string;
    confidence: number;
    requiresHumanApproval: boolean;
  }>;
}>;

function clean(values: readonly string[], limit: number): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit));
}

export function buildRelationshipDecisionTrace(input: Omit<RelationshipDecisionTrace, "contract" | "evidenceIds" | "factsBelieved" | "uncertainties" | "conductRulesApplied" | "staffInstinctsApplied"> & Readonly<{
  evidenceIds: readonly string[];
  factsBelieved: readonly string[];
  uncertainties: readonly string[];
  conductRulesApplied: readonly string[];
  staffInstinctsApplied: readonly string[];
}>): RelationshipDecisionTrace {
  if (!input.traceId.trim()) throw new Error("RELATIONSHIP_DECISION_TRACE_ID_REQUIRED");
  if (!input.objective.trim()) throw new Error("RELATIONSHIP_DECISION_TRACE_OBJECTIVE_REQUIRED");
  if (input.evidenceConfidence < 0 || input.evidenceConfidence > 100) throw new Error("RELATIONSHIP_DECISION_TRACE_EVIDENCE_CONFIDENCE_INVALID");
  if (input.finalDecision.confidence < 0 || input.finalDecision.confidence > 100) throw new Error("RELATIONSHIP_DECISION_TRACE_DECISION_CONFIDENCE_INVALID");

  return Object.freeze({
    ...input,
    contract: BUSINESS_RELATIONSHIP_DECISION_TRACE_CONTRACT,
    evidenceIds: clean(input.evidenceIds, 200),
    factsBelieved: clean(input.factsBelieved, 100),
    uncertainties: clean(input.uncertainties, 100),
    conductRulesApplied: clean(input.conductRulesApplied, 50),
    staffInstinctsApplied: clean(input.staffInstinctsApplied, 50),
    alternativesConsidered: Object.freeze(input.alternativesConsidered.slice(0, 20).map((item) => Object.freeze({ ...item }))),
    channelDecision: input.channelDecision ? Object.freeze({
      ...input.channelDecision,
      reasons: clean(input.channelDecision.reasons, 20),
    }) : null,
    finalDecision: Object.freeze({ ...input.finalDecision }),
  });
}
