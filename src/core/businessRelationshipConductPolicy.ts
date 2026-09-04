export const BUSINESS_RELATIONSHIP_CONDUCT_CONTRACT = "business_relationship_conduct_v1" as const;

export type CommunicationChannel = "email" | "direct_message" | "phone_call" | "video_call" | "in_person";

export type RelationshipConductPolicy = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_CONDUCT_CONTRACT;
  baseline: Readonly<{
    beKind: true;
    beRespectful: true;
    beHelpful: true;
    preserveDignity: true;
    assumeGoodFaithByDefault: true;
    beTruthful: true;
    doNotManufactureWarmth: true;
    doNotManipulate: true;
    doNotShame: true;
    doNotCreateFakeUrgency: true;
    doNotCreateUnnecessaryWorkForRecipient: true;
    kindnessDoesNotOverrideBoundaries: true;
  }>;
  channelStrategy: Readonly<{
    defaultMode: "async_first";
    preferredSimpleResolutionChannel: "email";
    meetingIsExceptionNotDefault: true;
    meetingRequiresIncrementalValue: true;
  }>;
}>;

export const DEFAULT_RELATIONSHIP_CONDUCT_POLICY: RelationshipConductPolicy = Object.freeze({
  contract: BUSINESS_RELATIONSHIP_CONDUCT_CONTRACT,
  baseline: Object.freeze({
    beKind: true,
    beRespectful: true,
    beHelpful: true,
    preserveDignity: true,
    assumeGoodFaithByDefault: true,
    beTruthful: true,
    doNotManufactureWarmth: true,
    doNotManipulate: true,
    doNotShame: true,
    doNotCreateFakeUrgency: true,
    doNotCreateUnnecessaryWorkForRecipient: true,
    kindnessDoesNotOverrideBoundaries: true,
  }),
  channelStrategy: Object.freeze({
    defaultMode: "async_first",
    preferredSimpleResolutionChannel: "email",
    meetingIsExceptionNotDefault: true,
    meetingRequiresIncrementalValue: true,
  }),
});

export type ChannelDecisionInput = Readonly<{
  currentChannel?: CommunicationChannel | null;
  recipientPrefersSynchronous?: boolean;
  explicitMeetingRequest?: boolean;
  needsRealTimeBackAndForth?: boolean;
  emotionallySensitive?: boolean;
  activeConflictOrRepair?: boolean;
  multiPartyDecision?: boolean;
  complexAmbiguity?: boolean;
  canResolveInWriting?: boolean;
  asynchronousDelayCreatesMaterialRisk?: boolean;
}>;

export type ChannelDecision = Readonly<{
  recommendedChannel: CommunicationChannel;
  synchronousRecommended: boolean;
  meetingJustified: boolean;
  reasons: readonly string[];
  avoid: readonly string[];
}>;

export function decideRelationshipCommunicationChannel(input: ChannelDecisionInput): ChannelDecision {
  const reasons: string[] = [];
  const avoid = [
    "Do not suggest a meeting or call merely because the issue requires thought.",
    "Do not use 'jump on a call' as a substitute for answering a question that can be resolved in writing.",
    "Do not create calendar overhead when a short asynchronous exchange can reach the same outcome.",
  ];

  const synchronousValue = Boolean(
    input.explicitMeetingRequest
    || input.recipientPrefersSynchronous
    || input.needsRealTimeBackAndForth
    || input.activeConflictOrRepair
    || input.multiPartyDecision
    || input.complexAmbiguity
    || input.asynchronousDelayCreatesMaterialRisk
  );

  if (input.canResolveInWriting !== false && !synchronousValue) {
    reasons.push("The matter can be resolved asynchronously without losing material context or decision quality.");
    return {
      recommendedChannel: input.currentChannel === "direct_message" ? "direct_message" : "email",
      synchronousRecommended: false,
      meetingJustified: false,
      reasons,
      avoid,
    };
  }

  if (input.explicitMeetingRequest) reasons.push("The counterparty explicitly requested synchronous discussion.");
  if (input.recipientPrefersSynchronous) reasons.push("A known recipient preference supports synchronous discussion.");
  if (input.needsRealTimeBackAndForth) reasons.push("The issue genuinely benefits from rapid two-way clarification.");
  if (input.activeConflictOrRepair) reasons.push("Relationship repair or active conflict may benefit from richer synchronous communication.");
  if (input.multiPartyDecision) reasons.push("A multi-party decision may be faster and clearer synchronously.");
  if (input.complexAmbiguity) reasons.push("Material ambiguity may require interactive clarification before a safe decision can be made.");
  if (input.asynchronousDelayCreatesMaterialRisk) reasons.push("Waiting for asynchronous replies creates a material timing or operational risk.");

  const recommendedChannel: CommunicationChannel = input.currentChannel === "phone_call"
    ? "phone_call"
    : input.currentChannel === "in_person"
      ? "in_person"
      : "video_call";

  return {
    recommendedChannel,
    synchronousRecommended: true,
    meetingJustified: true,
    reasons: reasons.length ? reasons : ["Synchronous discussion has clear incremental value over an asynchronous exchange."],
    avoid,
  };
}

export function relationshipConductInstructions(): readonly string[] {
  return Object.freeze([
    "Be kind, respectful and useful while remaining truthful and appropriately direct.",
    "Preserve the other person's dignity, including when correcting, declining, chasing payment, enforcing scope or disagreeing.",
    "Assume good faith by default unless evidence supports a different interpretation.",
    "Do not manufacture friendliness, praise, intimacy or enthusiasm that the situation does not warrant.",
    "Do not manipulate, shame, guilt or create fake urgency to obtain a response.",
    "Do not make the recipient do avoidable work; answer what can be answered and make the next step easy.",
    "Kindness does not mean agreeing to bad terms, avoiding a necessary boundary or hiding material facts.",
    "Prefer asynchronous resolution for ordinary questions, approvals, status updates and simple decisions.",
    "Suggest a call or meeting only when synchronous discussion has clear incremental value.",
  ]);
}
