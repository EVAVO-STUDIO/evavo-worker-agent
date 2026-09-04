export const BUSINESS_RELATIONSHIP_STAFF_INSTINCTS_CONTRACT = "business_relationship_staff_instincts_v1" as const;

export type StaffInstinctDecision = Readonly<{
  action: "reply" | "acknowledge" | "follow_up" | "repair" | "hold_boundary" | "do_not_reply" | "escalate";
  reasons: readonly string[];
  mustDo: readonly string[];
  mustAvoid: readonly string[];
}>;

export type StaffInstinctInput = Readonly<{
  explicitQuestion?: boolean;
  explicitRequest?: boolean;
  acknowledgementOnly?: boolean;
  senderThanksOnly?: boolean;
  senderSaysNoReplyNeeded?: boolean;
  evavoOwesAction?: boolean;
  evavoMadeError?: boolean;
  evavoCausedDelay?: boolean;
  recipientUpset?: boolean;
  unresolvedIssue?: boolean;
  requestOutsideScope?: boolean;
  requestCreatesUnapprovedCommitment?: boolean;
  paymentOverdue?: boolean;
  followUpDue?: boolean;
  priorFollowUps?: number;
  hardSuppression?: boolean;
  legalOrContractualAmbiguity?: boolean;
  materialRelationshipRisk?: boolean;
}>;

export function decideRelationshipStaffInstinct(input: StaffInstinctInput): StaffInstinctDecision {
  const mustAvoid = [
    "Do not reply merely to prove responsiveness when the message needs no response.",
    "Do not apologise for facts or boundaries that are not EVAVO's fault.",
    "Do not accept new scope, price, liability or deadlines without authority.",
    "Do not use guilt, artificial urgency or escalating emotional pressure to obtain a response.",
    "Do not hide an EVAVO mistake behind vague passive wording.",
  ];

  if (input.hardSuppression) {
    return {
      action: "do_not_reply",
      reasons: ["A suppression or do-not-contact rule is active."],
      mustDo: ["Keep the relationship suppressed until an authorised operator changes the rule."],
      mustAvoid,
    };
  }

  if (input.legalOrContractualAmbiguity && (input.requestCreatesUnapprovedCommitment || input.requestOutsideScope)) {
    return {
      action: "escalate",
      reasons: ["The request has contractual or legal ambiguity and could create an unapproved commitment."],
      mustDo: ["Clarify authority and the underlying commercial position before replying substantively."],
      mustAvoid,
    };
  }

  if (input.evavoMadeError || input.evavoCausedDelay) {
    return {
      action: "repair",
      reasons: ["EVAVO appears to have contributed to the problem or delay."],
      mustDo: [
        "Acknowledge the specific issue plainly.",
        "Own EVAVO's part without over-apologising or assigning blame elsewhere.",
        "State the practical correction or next step.",
        "Only give a recovery timing or commitment if it is verified and authorised.",
      ],
      mustAvoid,
    };
  }

  if (input.requestOutsideScope || input.requestCreatesUnapprovedCommitment) {
    return {
      action: "hold_boundary",
      reasons: ["The request is outside current scope or would create a commitment that is not authorised."],
      mustDo: [
        "Be helpful about what can be done within current authority.",
        "State the boundary clearly and without defensiveness.",
        "Where useful, identify the smallest next step needed to assess or approve the additional request.",
      ],
      mustAvoid,
    };
  }

  if (input.paymentOverdue || input.followUpDue) {
    const prior = Math.max(0, input.priorFollowUps ?? 0);
    return {
      action: "follow_up",
      reasons: [input.paymentOverdue ? "A payment obligation is overdue." : "A documented follow-up is due."],
      mustDo: [
        prior === 0
          ? "Send a calm, practical reminder that makes the required next step easy."
          : "Increase clarity before increasing pressure; refer to the outstanding item and its impact rather than expressing frustration.",
        "Use a real deadline or dependency only when supported by evidence.",
      ],
      mustAvoid,
    };
  }

  if (input.explicitQuestion || input.explicitRequest || input.evavoOwesAction || input.unresolvedIssue) {
    return {
      action: "reply",
      reasons: ["The sender needs information, action or resolution from EVAVO."],
      mustDo: [
        "Answer the live question or request directly.",
        "Resolve every item EVAVO can resolve now rather than pushing avoidable work back to the sender.",
        "Make any remaining next step explicit.",
      ],
      mustAvoid,
    };
  }

  if (input.senderSaysNoReplyNeeded) {
    return {
      action: "do_not_reply",
      reasons: ["The sender explicitly said no reply is needed."],
      mustDo: ["Record any useful relationship or obligation update internally without generating email noise."],
      mustAvoid,
    };
  }

  if (input.senderThanksOnly || input.acknowledgementOnly) {
    return {
      action: "do_not_reply",
      reasons: ["The message is acknowledgement-only and does not create a new obligation or useful conversational next step."],
      mustDo: ["Do not prolong the thread unless relationship context creates a genuine reason to respond."],
      mustAvoid,
    };
  }

  if (input.recipientUpset || input.materialRelationshipRisk) {
    return {
      action: "acknowledge",
      reasons: ["The relationship context warrants a proportionate acknowledgement even though no explicit task is present."],
      mustDo: ["Acknowledge the concern without becoming defensive, theatrical or prematurely admitting facts that are not verified."],
      mustAvoid,
    };
  }

  return {
    action: "do_not_reply",
    reasons: ["No useful external communication action is evidenced."],
    mustDo: ["Prefer silence to unnecessary email traffic."],
    mustAvoid,
  };
}
