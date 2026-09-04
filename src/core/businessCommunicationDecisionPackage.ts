import { decideCandidateRelationship, type CandidateRelationshipInput } from "./businessCandidateRelationship";
import type { CommunicationEvidenceReadiness } from "./businessCommunicationEvidenceReadiness";
import { decideRelationshipCommunicationChannel, relationshipConductInstructions, type ChannelDecisionInput } from "./businessRelationshipConductPolicy";
import type { RelationshipStaffBrief } from "./businessRelationshipStaffBrief";
import type { RelationshipContextResolutionPlan } from "./businessRelationshipContextResolutionPlan";
import { buildBusinessThreadDelta, type ThreadDeltaInput } from "./businessThreadDelta";
import { assessBusinessObligation, type BusinessObligation } from "./businessObligationLedger";

export const BUSINESS_COMMUNICATION_DECISION_PACKAGE_CONTRACT = "business_communication_decision_package_v2" as const;

export type CommunicationScenario = "general" | "graduate_or_candidate";

export type CommunicationDecisionPackageInput = Readonly<{
  packageId: string;
  scenario: CommunicationScenario;
  objective: string;
  thread: ThreadDeltaInput;
  obligations: readonly BusinessObligation[];
  channel: ChannelDecisionInput;
  candidate?: CandidateRelationshipInput | null;
  evidenceIds: readonly string[];
  evidenceConfidence: number;
  evidenceReadiness?: CommunicationEvidenceReadiness | null;
  staffBrief?: RelationshipStaffBrief | null;
  contextResolutionPlan?: RelationshipContextResolutionPlan | null;
}>;

export type CommunicationDecisionPackage = Readonly<{
  contract: typeof BUSINESS_COMMUNICATION_DECISION_PACKAGE_CONTRACT;
  packageId: string;
  scenario: CommunicationScenario;
  objective: string;
  disposition: "reply" | "do_not_reply" | "review_then_reply" | "escalate";
  recommendedChannel: ReturnType<typeof decideRelationshipCommunicationChannel>["recommendedChannel"];
  meetingJustified: boolean;
  conductInstructions: readonly string[];
  liveResponseTargets: readonly string[];
  activeEvavoObligations: readonly string[];
  candidateStage?: ReturnType<typeof decideCandidateRelationship>["stage"];
  prohibitedImplications: readonly string[];
  evidenceIds: readonly string[];
  evidenceConfidence: number;
  evidenceReadinessStatus?: CommunicationEvidenceReadiness["status"];
  approvalGradeReady: boolean;
  nextContextSources: readonly RelationshipContextResolutionPlan["orderedSources"][number][];
  staffPriorities: readonly string[];
  mustVerify: readonly string[];
  mustNotAssume: readonly string[];
  reasons: readonly string[];
}>;

export function buildCommunicationDecisionPackage(input: CommunicationDecisionPackageInput): CommunicationDecisionPackage {
  if (!input.evidenceIds.length) throw new Error("COMMUNICATION_DECISION_EVIDENCE_REQUIRED");
  if (input.evidenceConfidence < 0 || input.evidenceConfidence > 100) throw new Error("COMMUNICATION_DECISION_CONFIDENCE_INVALID");

  const delta = buildBusinessThreadDelta(input.thread);
  const channel = decideRelationshipCommunicationChannel(input.channel);
  const obligationAssessments = input.obligations.map((item) => assessBusinessObligation(item));
  const activeEvavoObligations = obligationAssessments
    .filter((assessment) => assessment.obligation.owner === "evavo" && (assessment.obligation.status === "open" || assessment.obligation.status === "uncertain"))
    .map((assessment) => assessment.obligation.statement);

  const reasons: string[] = [];
  const prohibitedImplications: string[] = [];
  const mustVerify = [...(input.staffBrief?.mustVerify ?? [])];
  const mustNotAssume = [...(input.staffBrief?.mustNotAssume ?? [])];
  const staffPriorities = [...(input.staffBrief?.priorities ?? [])];
  let disposition: CommunicationDecisionPackage["disposition"] = "reply";
  let candidateStage: CommunicationDecisionPackage["candidateStage"];

  if (input.scenario === "graduate_or_candidate") {
    if (!input.candidate) throw new Error("COMMUNICATION_DECISION_CANDIDATE_CONTEXT_REQUIRED");
    const candidate = decideCandidateRelationship(input.candidate);
    candidateStage = candidate.stage;
    prohibitedImplications.push(...candidate.prohibitedImplications);
    reasons.push(...candidate.reasons);

    if (!candidate.shouldReply) disposition = "do_not_reply";
    else if (candidate.stage === "review_warranted" && !candidate.maySayMaterialsReviewed) disposition = "review_then_reply";
  }

  if (input.evidenceConfidence < 60) {
    disposition = "escalate";
    reasons.push("Evidence confidence is too low for a reliable external communication decision.");
  }

  if (input.evidenceReadiness?.status === "blocked") {
    disposition = "escalate";
    reasons.push(...input.evidenceReadiness.blockers.map((blocker) => `Evidence readiness blocker: ${blocker}`));
  }

  if (input.staffBrief && !input.staffBrief.approvalGradeReady) {
    disposition = "escalate";
    reasons.push("The evidence-backed relationship staff brief is not approval-grade ready.");
  }

  if (input.contextResolutionPlan && !input.contextResolutionPlan.ready) {
    disposition = "escalate";
    reasons.push(...input.contextResolutionPlan.blockingIssues.map((issue) => `Context resolution required: ${issue}`));
  }

  if (delta.liveResponseTargets.length === 0 && activeEvavoObligations.length === 0 && input.scenario === "general") {
    disposition = "do_not_reply";
    reasons.push("There is no live response target or EVAVO-owned obligation requiring communication.");
  }

  if (!channel.meetingJustified) reasons.push("The matter should stay asynchronous; a meeting adds no clear incremental value.");
  else reasons.push(...channel.reasons);

  const evidenceIds = new Set(input.evidenceIds);
  for (const id of input.evidenceReadiness?.evidenceIds ?? []) evidenceIds.add(id);
  for (const id of input.staffBrief?.sourceRefs ?? []) evidenceIds.add(id);

  const nextContextSources = Object.freeze([...(input.contextResolutionPlan?.orderedSources ?? [])]);
  const approvalGradeReady = input.evidenceConfidence >= 60
    && input.evidenceReadiness?.status !== "blocked"
    && (input.staffBrief?.approvalGradeReady ?? true)
    && (input.contextResolutionPlan?.ready ?? true)
    && evidenceIds.size > 0;

  return Object.freeze({
    contract: BUSINESS_COMMUNICATION_DECISION_PACKAGE_CONTRACT,
    packageId: input.packageId,
    scenario: input.scenario,
    objective: input.objective,
    disposition,
    recommendedChannel: channel.recommendedChannel,
    meetingJustified: channel.meetingJustified,
    conductInstructions: relationshipConductInstructions(),
    liveResponseTargets: Object.freeze(delta.liveResponseTargets.map((item) => item.statement)),
    activeEvavoObligations: Object.freeze(activeEvavoObligations),
    ...(candidateStage ? { candidateStage } : {}),
    prohibitedImplications: Object.freeze([...new Set(prohibitedImplications)]),
    evidenceIds: Object.freeze([...evidenceIds]),
    evidenceConfidence: input.evidenceConfidence,
    ...(input.evidenceReadiness ? { evidenceReadinessStatus: input.evidenceReadiness.status } : {}),
    approvalGradeReady,
    nextContextSources,
    staffPriorities: Object.freeze([...new Set(staffPriorities)]),
    mustVerify: Object.freeze([...new Set(mustVerify)]),
    mustNotAssume: Object.freeze([...new Set(mustNotAssume)]),
    reasons: Object.freeze([...new Set(reasons)]),
  });
}
