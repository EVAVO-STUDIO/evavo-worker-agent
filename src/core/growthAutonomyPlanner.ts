import {
  GROWTH_ACTIVITY_BUDGETS,
  GROWTH_OPERATING_POLICY_VERSION,
  effectiveGrowthActivityLevel,
  evaluateGrowthOperatingAction,
  type GrowthActionClass,
  type GrowthActionEstimate,
  type GrowthActivityLevel,
  type GrowthOperatingPolicy,
  type GrowthUsageCounters,
} from "./growthOperatingPolicy";

export const GROWTH_AUTONOMY_PLAN_VERSION = "growth_autonomy_plan_v1" as const;

export const GROWTH_AUTONOMY_ROLES = Object.freeze([
  "growth_manager",
  "business_development_manager",
  "sales_manager",
  "account_manager",
  "business_analyst",
  "marketing_manager",
] as const);

export const GROWTH_AUTONOMY_TASK_KINDS = Object.freeze([
  "discover_sources",
  "explore_new_source",
  "refresh_high_value_source",
  "review_source_quality",
  "research_account",
  "research_opportunity",
  "score_candidates",
  "deduplicate_candidates",
  "inspect_pipeline_exceptions",
  "review_account_health",
  "prepare_follow_up_drafts",
  "review_communication_feedback",
  "prepare_meeting_briefs",
  "propose_meeting_slots",
  "prepare_content_briefs",
  "prepare_social_drafts",
  "generate_daily_brief",
  "generate_weekly_review",
  "evaluate_experiments",
] as const);

export type GrowthAutonomyRole = (typeof GROWTH_AUTONOMY_ROLES)[number];
export type GrowthAutonomyTaskKind = (typeof GROWTH_AUTONOMY_TASK_KINDS)[number];

export type GrowthAutonomyPlannerSignals = Readonly<{
  sourceCount: number;
  staleHighValueSourceCount: number;
  unexploredSourceHintCount: number;
  unreviewedCandidateCount: number;
  lowConfidenceCandidateCount: number;
  duplicateCandidateCount: number;
  overdueOpportunityCount: number;
  stalledAccountCount: number;
  followUpDraftCount: number;
  meetingPreparationCount: number;
  meetingSlotProposalCount: number;
  contentGapCount: number;
  socialDraftOpportunityCount: number;
  experimentReviewCount: number;
  dailyBriefDue: boolean;
  weeklyReviewDue: boolean;
  sourceNoveltyRate: number | null;
  candidateAcceptanceRate: number | null;
  draftAcceptanceRate: number | null;
  ownerUsefulnessRate: number | null;
}>;

export type GrowthAutonomyTask = Readonly<{
  taskId: string;
  taskKind: GrowthAutonomyTaskKind;
  role: GrowthAutonomyRole;
  actionClass: GrowthActionClass;
  priority: number;
  rationale: string;
  successMetric: string;
  stopCondition: string;
  approvalPosture: "internal_only" | "draft_only";
  estimate: GrowthActionEstimate;
  maximumAttempts: 1 | 2;
  requiresSourceSelection: boolean;
}>;

export type GrowthAutonomyDeferredTask = Readonly<{
  taskKind: GrowthAutonomyTaskKind;
  reason: string;
}>;

export type GrowthAutonomyPlan = Readonly<{
  contractVersion: typeof GROWTH_AUTONOMY_PLAN_VERSION;
  operatingPolicyVersion: typeof GROWTH_OPERATING_POLICY_VERSION;
  createdAt: string;
  localDay: string;
  effectiveActivityLevel: GrowthActivityLevel;
  taskLimit: number;
  tasks: readonly GrowthAutonomyTask[];
  deferred: readonly GrowthAutonomyDeferredTask[];
  nextEligibleAt: string;
  externalExecutionEnabled: false;
  canonicalPromotionEnabled: false;
  advertisingSpendEnabled: false;
}>;

export type CreateGrowthAutonomyPlanInput = Readonly<{
  policy: GrowthOperatingPolicy;
  usage: GrowthUsageCounters;
  signals: GrowthAutonomyPlannerSignals;
  now: Date;
  manualInvocation: boolean;
}>;

type TaskCandidate = Omit<GrowthAutonomyTask, "taskId">;

const MAX_SIGNAL_COUNT = 1_000_000;
const RATE_PATTERN = /^(?:0(?:\.\d+)?|1(?:\.0+)?)$/;
const TASK_LIMITS: Readonly<Record<GrowthActivityLevel, number>> = Object.freeze({
  paused: 0,
  light: 4,
  balanced: 10,
  active: 18,
  lab: 8,
});
const EXTERNAL_ACTION_CLASSES = new Set<GrowthActionClass>([
  "communication.send_email",
  "calendar.create_meeting",
  "social.publish_post",
  "social.publish_comment",
  "content.publish_asset",
  "provider.execute_writeback",
  "advertising.spend",
]);

function fail(code: string): never {
  throw new Error(code);
}

function signalCount(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0 || Number(value) > MAX_SIGNAL_COUNT) {
    fail(`GROWTH_AUTONOMY_SIGNAL_INVALID:${field}`);
  }
  return Number(value);
}

function signalRate(value: unknown, field: string): number | null {
  if (value === null) return null;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1 ||
    !RATE_PATTERN.test(String(value))
  ) {
    fail(`GROWTH_AUTONOMY_SIGNAL_INVALID:${field}`);
  }
  return value;
}

function canonicalNow(value: Date): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    fail("GROWTH_AUTONOMY_TIME_INVALID");
  }
  return new Date(value.getTime());
}

function localDay(now: Date, timezone: string): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(now);
  } catch {
    fail("GROWTH_AUTONOMY_TIMEZONE_INVALID");
  }
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  if (!values.year || !values.month || !values.day) fail("GROWTH_AUTONOMY_TIMEZONE_INVALID");
  return `${values.year}-${values.month}-${values.day}`;
}

function estimate(overrides: Partial<GrowthActionEstimate> = {}): GrowthActionEstimate {
  return Object.freeze({
    workerInvocations: 1,
    externalFetches: 0,
    d1RowsRead: 100,
    d1RowsWritten: 10,
    queueOperations: 0,
    browserRenderingSeconds: 0,
    paidModelCalls: 0,
    paidApiCalls: 0,
    adSpendCents: 0,
    candidatesCreated: 0,
    outboundDraftsCreated: 0,
    externalActionsExecuted: 0,
    ...overrides,
  });
}

function task(input: TaskCandidate): TaskCandidate {
  if (!GROWTH_AUTONOMY_TASK_KINDS.includes(input.taskKind)) fail("GROWTH_AUTONOMY_TASK_INVALID");
  if (!GROWTH_AUTONOMY_ROLES.includes(input.role)) fail("GROWTH_AUTONOMY_ROLE_INVALID");
  if (EXTERNAL_ACTION_CLASSES.has(input.actionClass)) fail("GROWTH_AUTONOMY_EXTERNAL_TASK_FORBIDDEN");
  if (!Number.isSafeInteger(input.priority) || input.priority < 1 || input.priority > 100) {
    fail("GROWTH_AUTONOMY_PRIORITY_INVALID");
  }
  return Object.freeze({ ...input, estimate: Object.freeze({ ...input.estimate }) });
}

function boundedSignals(value: GrowthAutonomyPlannerSignals): GrowthAutonomyPlannerSignals {
  return Object.freeze({
    sourceCount: signalCount(value.sourceCount, "sourceCount"),
    staleHighValueSourceCount: signalCount(value.staleHighValueSourceCount, "staleHighValueSourceCount"),
    unexploredSourceHintCount: signalCount(value.unexploredSourceHintCount, "unexploredSourceHintCount"),
    unreviewedCandidateCount: signalCount(value.unreviewedCandidateCount, "unreviewedCandidateCount"),
    lowConfidenceCandidateCount: signalCount(value.lowConfidenceCandidateCount, "lowConfidenceCandidateCount"),
    duplicateCandidateCount: signalCount(value.duplicateCandidateCount, "duplicateCandidateCount"),
    overdueOpportunityCount: signalCount(value.overdueOpportunityCount, "overdueOpportunityCount"),
    stalledAccountCount: signalCount(value.stalledAccountCount, "stalledAccountCount"),
    followUpDraftCount: signalCount(value.followUpDraftCount, "followUpDraftCount"),
    meetingPreparationCount: signalCount(value.meetingPreparationCount, "meetingPreparationCount"),
    meetingSlotProposalCount: signalCount(value.meetingSlotProposalCount, "meetingSlotProposalCount"),
    contentGapCount: signalCount(value.contentGapCount, "contentGapCount"),
    socialDraftOpportunityCount: signalCount(value.socialDraftOpportunityCount, "socialDraftOpportunityCount"),
    experimentReviewCount: signalCount(value.experimentReviewCount, "experimentReviewCount"),
    dailyBriefDue: value.dailyBriefDue === true,
    weeklyReviewDue: value.weeklyReviewDue === true,
    sourceNoveltyRate: signalRate(value.sourceNoveltyRate, "sourceNoveltyRate"),
    candidateAcceptanceRate: signalRate(value.candidateAcceptanceRate, "candidateAcceptanceRate"),
    draftAcceptanceRate: signalRate(value.draftAcceptanceRate, "draftAcceptanceRate"),
    ownerUsefulnessRate: signalRate(value.ownerUsefulnessRate, "ownerUsefulnessRate"),
  });
}

function candidateTasks(
  signals: GrowthAutonomyPlannerSignals,
  activityLevel: GrowthActivityLevel,
): readonly TaskCandidate[] {
  const candidates: TaskCandidate[] = [];
  const noveltyLow = signals.sourceNoveltyRate !== null && signals.sourceNoveltyRate < 0.25;
  const candidateAcceptanceLow =
    signals.candidateAcceptanceRate !== null && signals.candidateAcceptanceRate < 0.25;
  const draftAcceptanceLow = signals.draftAcceptanceRate !== null && signals.draftAcceptanceRate < 0.35;
  const usefulnessLow = signals.ownerUsefulnessRate !== null && signals.ownerUsefulnessRate < 0.4;

  if (signals.dailyBriefDue) {
    candidates.push(task({
      taskKind: "generate_daily_brief",
      role: "growth_manager",
      actionClass: "analysis.generate_report",
      priority: 100,
      rationale: "The owner brief is due and should remain the first decision surface.",
      successMetric: "One bounded exception-first brief is produced from current evidence.",
      stopCondition: "Stop after the brief contains the highest-value exceptions or there is no new evidence.",
      approvalPosture: "internal_only",
      estimate: estimate({ d1RowsRead: 2_000, d1RowsWritten: 5 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  if (signals.weeklyReviewDue) {
    candidates.push(task({
      taskKind: "generate_weekly_review",
      role: "business_analyst",
      actionClass: "analysis.generate_report",
      priority: 96,
      rationale: "A weekly commercial and evidence-quality review is due.",
      successMetric: "One report reconciles pipeline, source quality, experiments and unresolved decisions.",
      stopCondition: "Stop after the bounded weekly template is complete.",
      approvalPosture: "internal_only",
      estimate: estimate({ d1RowsRead: 5_000, d1RowsWritten: 10 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  if (signals.overdueOpportunityCount > 0) {
    candidates.push(task({
      taskKind: "inspect_pipeline_exceptions",
      role: "sales_manager",
      actionClass: "analysis.score_candidate",
      priority: 94,
      rationale: `${signals.overdueOpportunityCount} opportunities are overdue or stalled and may need a next safe action.`,
      successMetric: "Each reviewed exception has evidence, risk and a reversible next action or a do-nothing decision.",
      stopCondition: "Stop after the highest-priority 25 exceptions or when evidence is insufficient.",
      approvalPosture: "internal_only",
      estimate: estimate({ d1RowsRead: 3_000, d1RowsWritten: 50 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  if (signals.stalledAccountCount > 0) {
    candidates.push(task({
      taskKind: "review_account_health",
      role: "account_manager",
      actionClass: "analysis.score_candidate",
      priority: 91,
      rationale: `${signals.stalledAccountCount} accounts have a health or commitment exception.`,
      successMetric: "Each selected account has an evidence-backed health summary and owner-review recommendation.",
      stopCondition: "Stop after 20 accounts or when no decision-changing evidence remains.",
      approvalPosture: "internal_only",
      estimate: estimate({ d1RowsRead: 2_500, d1RowsWritten: 40 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  if (signals.meetingPreparationCount > 0) {
    candidates.push(task({
      taskKind: "prepare_meeting_briefs",
      role: "account_manager",
      actionClass: "analysis.generate_report",
      priority: 90,
      rationale: `${signals.meetingPreparationCount} meetings need a concise objective, context, agenda or pre-read.`,
      successMetric: "Each selected meeting has a factual agenda, attendee context and unresolved decision list.",
      stopCondition: "Stop after the next five meetings; never invent attendee availability or commitments.",
      approvalPosture: "internal_only",
      estimate: estimate({ d1RowsRead: 1_500, d1RowsWritten: 25 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  if (signals.meetingSlotProposalCount > 0) {
    candidates.push(task({
      taskKind: "propose_meeting_slots",
      role: "account_manager",
      actionClass: "calendar.propose_slots",
      priority: 89,
      rationale: `${signals.meetingSlotProposalCount} meeting requests need candidate slots for owner approval.`,
      successMetric: "Two or three conflict-checked candidate slots are prepared without creating a calendar event.",
      stopCondition: "Stop before contacting attendees or confirming a meeting.",
      approvalPosture: "internal_only",
      estimate: estimate({ d1RowsRead: 1_000, d1RowsWritten: 10 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  if (signals.duplicateCandidateCount > 0 || noveltyLow) {
    candidates.push(task({
      taskKind: "review_source_quality",
      role: "business_analyst",
      actionClass: "analysis.generate_report",
      priority: noveltyLow ? 92 : 84,
      rationale: noveltyLow
        ? "Recent source work has low novelty; source selection should improve before crawl volume increases."
        : `${signals.duplicateCandidateCount} candidate duplicates indicate avoidable source or matching work.`,
      successMetric: "Low-yield sources receive deterministic backoff and one bounded replacement hypothesis is recorded.",
      stopCondition: "Stop after the lowest-yield sources and duplicate families are explained.",
      approvalPosture: "internal_only",
      estimate: estimate({ d1RowsRead: 2_000, d1RowsWritten: 20 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  if (signals.duplicateCandidateCount > 0) {
    candidates.push(task({
      taskKind: "deduplicate_candidates",
      role: "business_analyst",
      actionClass: "analysis.score_candidate",
      priority: 88,
      rationale: `${signals.duplicateCandidateCount} candidates may represent the same account, signal or evidence family.`,
      successMetric: "Duplicate families are linked without deleting provenance or inventing merges.",
      stopCondition: "Stop when similarity evidence is insufficient for a safe family assignment.",
      approvalPosture: "internal_only",
      estimate: estimate({ d1RowsRead: 4_000, d1RowsWritten: 100 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  if (signals.unreviewedCandidateCount > 0) {
    candidates.push(task({
      taskKind: "score_candidates",
      role: "business_development_manager",
      actionClass: "analysis.score_candidate",
      priority: candidateAcceptanceLow ? 82 : 87,
      rationale: candidateAcceptanceLow
        ? "Candidate acceptance is low, so qualification should tighten before discovering more volume."
        : `${signals.unreviewedCandidateCount} candidates need evidence-backed qualification.`,
      successMetric: "Candidates receive confidence, evidence quality, relevance, risk and do-nothing scores.",
      stopCondition: "Stop after 30 candidates or when required evidence is missing.",
      approvalPosture: "internal_only",
      estimate: estimate({ d1RowsRead: 3_500, d1RowsWritten: 100, candidatesCreated: 0 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  if (signals.lowConfidenceCandidateCount > 0) {
    candidates.push(task({
      taskKind: "research_opportunity",
      role: "business_development_manager",
      actionClass: "research.public_fetch",
      priority: 86,
      rationale: `${signals.lowConfidenceCandidateCount} candidates need one bounded evidence refresh before owner review.`,
      successMetric: "Each selected candidate gains one attributable evidence update or a clear insufficient-evidence result.",
      stopCondition: "Stop after two high-value public sources per candidate or no decision-changing evidence.",
      approvalPosture: "internal_only",
      estimate: estimate({ workerInvocations: 8, externalFetches: 12, d1RowsRead: 1_500, d1RowsWritten: 80 }),
      maximumAttempts: 2,
      requiresSourceSelection: true,
    }));
  }

  if (signals.staleHighValueSourceCount > 0) {
    candidates.push(task({
      taskKind: "refresh_high_value_source",
      role: "growth_manager",
      actionClass: "research.public_fetch",
      priority: 83,
      rationale: `${signals.staleHighValueSourceCount} historically useful sources are stale.`,
      successMetric: "Each selected source records a fresh success, a bounded failure, or an evidence-neutral result.",
      stopCondition: "Stop after 10 source fetches or when the source governor requests backoff.",
      approvalPosture: "internal_only",
      estimate: estimate({ workerInvocations: 6, externalFetches: 10, d1RowsRead: 1_000, d1RowsWritten: 50 }),
      maximumAttempts: 2,
      requiresSourceSelection: true,
    }));
  }

  const shouldDiscover =
    signals.sourceCount === 0 ||
    (!noveltyLow && !candidateAcceptanceLow && signals.unreviewedCandidateCount < 20);
  if (shouldDiscover) {
    candidates.push(task({
      taskKind: "discover_sources",
      role: "growth_manager",
      actionClass: "research.source_discovery",
      priority: signals.sourceCount === 0 ? 90 : 74,
      rationale: signals.sourceCount === 0
        ? "No usable source inventory exists for the current scope."
        : "Current sources are productive enough to justify a small discovery pass.",
      successMetric: "One bounded list of attributable source candidates is produced with selection reasons.",
      stopCondition: "Stop after 20 source candidates or when marginal novelty falls below the source threshold.",
      approvalPosture: "internal_only",
      estimate: estimate({ workerInvocations: 4, externalFetches: 8, d1RowsRead: 500, d1RowsWritten: 40 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  const explorationSlots = activityLevel === "active" ? 2 : activityLevel === "balanced" ? 1 : activityLevel === "lab" ? 3 : 0;
  if (signals.unexploredSourceHintCount > 0 && explorationSlots > 0) {
    candidates.push(task({
      taskKind: "explore_new_source",
      role: "growth_manager",
      actionClass: "research.public_fetch",
      priority: 68,
      rationale: `${signals.unexploredSourceHintCount} new source hints qualify for at most ${explorationSlots} bounded exploration fetches.`,
      successMetric: "Each explored source records novelty, policy posture and a use/backoff/block decision.",
      stopCondition: `Stop after ${explorationSlots} source fetches regardless of result.`,
      approvalPosture: "internal_only",
      estimate: estimate({ workerInvocations: explorationSlots, externalFetches: explorationSlots, d1RowsRead: 200, d1RowsWritten: 20 }),
      maximumAttempts: 1,
      requiresSourceSelection: true,
    }));
  }

  if (signals.followUpDraftCount > 0 && !draftAcceptanceLow) {
    candidates.push(task({
      taskKind: "prepare_follow_up_drafts",
      role: "business_development_manager",
      actionClass: "communication.draft_email",
      priority: 80,
      rationale: `${signals.followUpDraftCount} approved relationships or opportunities need private follow-up drafts.`,
      successMetric: "Each draft is specific, evidence-backed and contains no unsupported claim or automatic send instruction.",
      stopCondition: "Stop after 10 drafts and never send them.",
      approvalPosture: "draft_only",
      estimate: estimate({ d1RowsRead: 1_500, d1RowsWritten: 30, outboundDraftsCreated: 10 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  if (draftAcceptanceLow && signals.followUpDraftCount > 0) {
    candidates.push(task({
      taskKind: "review_communication_feedback",
      role: "business_analyst",
      actionClass: "analysis.generate_report",
      priority: 85,
      rationale: "Recent draft acceptance is low; the system should analyse owner edits before producing more outreach volume.",
      successMetric: "A reversible voice-change proposal identifies specific edit patterns without silently changing the active profile.",
      stopCondition: "Stop after the latest 20 reviewed drafts or when no consistent pattern exists.",
      approvalPosture: "internal_only",
      estimate: estimate({ d1RowsRead: 2_000, d1RowsWritten: 15 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  if (signals.contentGapCount > 0) {
    candidates.push(task({
      taskKind: "prepare_content_briefs",
      role: "marketing_manager",
      actionClass: "content.prepare_asset",
      priority: 72,
      rationale: `${signals.contentGapCount} audience or campaign evidence gaps need a private content brief.`,
      successMetric: "Each brief links audience need, evidence, channel constraint, claim support and measurement plan.",
      stopCondition: "Stop after five briefs and do not publish assets.",
      approvalPosture: "draft_only",
      estimate: estimate({ d1RowsRead: 1_500, d1RowsWritten: 25, outboundDraftsCreated: 5 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  if (signals.socialDraftOpportunityCount > 0) {
    candidates.push(task({
      taskKind: "prepare_social_drafts",
      role: "marketing_manager",
      actionClass: "social.draft_post",
      priority: 66,
      rationale: `${signals.socialDraftOpportunityCount} evidence-backed channel opportunities can be prepared for owner review.`,
      successMetric: "Drafts are channel-specific, attributable and policy-labelled without publishing or commenting.",
      stopCondition: "Stop after five drafts; never publish or reply publicly.",
      approvalPosture: "draft_only",
      estimate: estimate({ d1RowsRead: 1_000, d1RowsWritten: 20, outboundDraftsCreated: 5 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  if (signals.experimentReviewCount > 0 || usefulnessLow) {
    candidates.push(task({
      taskKind: "evaluate_experiments",
      role: "growth_manager",
      actionClass: "analysis.generate_report",
      priority: usefulnessLow ? 89 : 70,
      rationale: usefulnessLow
        ? "Owner usefulness is low; activity should contract until experiment value is explained."
        : `${signals.experimentReviewCount} bounded experiments need a decision.`,
      successMetric: "Each experiment is continued, changed, paused or stopped using attributable outcomes and cost evidence.",
      stopCondition: "Stop after 10 experiments or when outcome evidence is insufficient.",
      approvalPosture: "internal_only",
      estimate: estimate({ d1RowsRead: 2_000, d1RowsWritten: 20 }),
      maximumAttempts: 1,
      requiresSourceSelection: false,
    }));
  }

  return Object.freeze(candidates);
}

function taskId(day: string, kind: GrowthAutonomyTaskKind, index: number): string {
  return `growth-task:${day}:${kind}:${String(index + 1).padStart(2, "0")}`;
}

function nextEligibleAt(now: Date, activityLevel: GrowthActivityLevel): string {
  const minutes = GROWTH_ACTIVITY_BUDGETS[activityLevel].minimumMinutesBetweenRuns;
  return new Date(now.getTime() + minutes * 60_000).toISOString();
}

export function createGrowthAutonomyPlan(input: CreateGrowthAutonomyPlanInput): GrowthAutonomyPlan {
  const now = canonicalNow(input.now);
  const signals = boundedSignals(input.signals);
  const effectiveActivityLevel = effectiveGrowthActivityLevel(input.policy, input.usage);
  const day = localDay(now, input.policy.timezone);
  const limit = TASK_LIMITS[effectiveActivityLevel];
  const candidates = candidateTasks(signals, input.policy.activityLevel)
    .slice()
    .sort((left, right) => right.priority - left.priority || left.taskKind.localeCompare(right.taskKind));
  const tasks: GrowthAutonomyTask[] = [];
  const deferred: GrowthAutonomyDeferredTask[] = [];

  for (const candidate of candidates) {
    if (tasks.length >= limit) {
      deferred.push(Object.freeze({ taskKind: candidate.taskKind, reason: "activity_task_limit" }));
      continue;
    }
    const operatingDecision = evaluateGrowthOperatingAction({
      policy: input.policy,
      usage: input.usage,
      action: {
        actionClass: candidate.actionClass,
        manualInvocation: input.manualInvocation,
        explicitApproval: false,
        trustedScope: false,
        targetAllowlisted: false,
        platformPolicyConfirmed: false,
        estimate: candidate.estimate,
      },
    });
    if (operatingDecision.outcome !== "allow") {
      deferred.push(Object.freeze({
        taskKind: candidate.taskKind,
        reason: operatingDecision.reason,
      }));
      continue;
    }
    tasks.push(Object.freeze({
      ...candidate,
      taskId: taskId(day, candidate.taskKind, tasks.length),
    }));
  }

  return Object.freeze({
    contractVersion: GROWTH_AUTONOMY_PLAN_VERSION,
    operatingPolicyVersion: GROWTH_OPERATING_POLICY_VERSION,
    createdAt: now.toISOString(),
    localDay: day,
    effectiveActivityLevel,
    taskLimit: limit,
    tasks: Object.freeze(tasks),
    deferred: Object.freeze(deferred),
    nextEligibleAt: nextEligibleAt(now, input.policy.activityLevel),
    externalExecutionEnabled: false,
    canonicalPromotionEnabled: false,
    advertisingSpendEnabled: false,
  });
}
