import type { CommunicationAnalysis } from "./businessCommunicationIntelligence";

export const BUSINESS_COMMUNICATION_REPLY_BRIEF_CONTRACT = "business_communication_reply_brief_v1" as const;

export type ReplyBrief = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_REPLY_BRIEF_CONTRACT;
  threadId: string;
  shouldDraft: boolean;
  objective: string;
  openingApproach: string;
  responsePoints: readonly string[];
  commitmentsToAvoid: readonly string[];
  factsToVerify: readonly string[];
  attachmentChecks: readonly string[];
  toneRules: readonly string[];
  closingApproach: string;
  targetLength: "one_line" | "short" | "normal" | "detailed";
  escalationReason: string | null;
}>;

export function buildBusinessCommunicationReplyBrief(analysis: CommunicationAnalysis): ReplyBrief {
  const responsePoints = [...analysis.responseGoals];
  for (const question of analysis.unansweredQuestions) {
    responsePoints.push(`Answer explicitly: ${question}`);
  }
  for (const obligation of analysis.obligations.filter((item) => item.owner === "evavo" || item.owner === "shared")) {
    responsePoints.push(`Address obligation: ${obligation.description}`);
  }

  const commitmentsToAvoid = [
    "Do not promise a date unless current project or calendar evidence supports it.",
    "Do not promise price, discount, scope or contract terms unless commercial evidence supports it.",
    "Do not claim work is complete, approved, sent or attached unless independently verified.",
    "Do not imply legal, contractual or compliance certainty when the source is not authoritative.",
  ];

  let objective = "Respond usefully and proportionately to the latest message.";
  let openingApproach = "Start directly with the answer or acknowledgement that matters most.";
  let closingApproach = "End with the concrete next step, or stop once the useful answer is complete.";
  let targetLength: ReplyBrief["targetLength"] = "short";

  switch (analysis.primaryIntent) {
    case "relationship_repair":
      objective = "Repair confidence by addressing the specific concern accurately and taking appropriate ownership.";
      openingApproach = "Acknowledge the concrete concern immediately; do not lead with pleasantries or sales language.";
      closingApproach = "End with the verified recovery action or the exact information still needed.";
      targetLength = "normal";
      break;
    case "support":
      objective = "Reduce uncertainty and move the issue toward resolution without speculating.";
      openingApproach = "Acknowledge the problem and state what is currently known.";
      closingApproach = "State the next diagnostic or resolution step and who owns it.";
      targetLength = "normal";
      break;
    case "commercial":
      objective = "Resolve the commercial question clearly without inventing scope, fee, approval or timing.";
      openingApproach = "Answer the commercial question early, using confirmed terms only.";
      closingApproach = "State the next commercial step and any dependency on approval or missing information.";
      targetLength = "normal";
      break;
    case "scheduling":
      objective = "Resolve scheduling with correct date, time, timezone and participants.";
      openingApproach = "Confirm what is actually available or ask for the missing scheduling detail.";
      closingApproach = "End with one clear confirmed option or concise next scheduling action.";
      targetLength = "short";
      break;
    case "acknowledgement":
      objective = "Acknowledge only if doing so adds relationship value.";
      openingApproach = "If replying, use a natural one-line acknowledgement.";
      closingApproach = "Do not add another unnecessary call to action.";
      targetLength = "one_line";
      break;
    case "information_only":
      objective = "Avoid unnecessary inbox noise unless acknowledgement or an outstanding obligation makes a reply useful.";
      openingApproach = "Do not draft by default.";
      closingApproach = "No closing is required when no reply is needed.";
      targetLength = "one_line";
      break;
    case "decision_required":
      objective = "Give or obtain the requested decision with conditions made explicit.";
      openingApproach = "State the decision first when authorised; otherwise state exactly what approval is still needed.";
      closingApproach = "End with the consequence or next action of the decision.";
      targetLength = "short";
      break;
    default:
      break;
  }

  const shouldDraft = analysis.recommendedAction === "draft_reply" || analysis.recommendedAction === "ask_for_review";
  const escalationReason = analysis.recommendedAction === "ask_for_review"
    ? analysis.risks[0] ?? "The thread requires human review before external communication."
    : analysis.recommendedAction === "defer"
      ? analysis.uncertainties[0] ?? "Thread confidence is insufficient for drafting."
      : null;

  return {
    contract: BUSINESS_COMMUNICATION_REPLY_BRIEF_CONTRACT,
    threadId: analysis.threadId,
    shouldDraft,
    objective,
    openingApproach,
    responsePoints: [...new Set(responsePoints)].slice(0, 24),
    commitmentsToAvoid,
    factsToVerify: analysis.factualClaimsToVerify,
    attachmentChecks: analysis.attachmentChecks,
    toneRules: analysis.toneGuidance,
    closingApproach,
    targetLength,
    escalationReason,
  };
}
