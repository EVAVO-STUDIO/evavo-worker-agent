import { Env, todayUTC } from "../db";
import { assessGrowthBudget, getOrCreateGrowthBudgetLedger } from "./growthAutonomy";
import { listGrowthAuditEventSummaries } from "./growthAudit";
import { listGrowthActions, listGrowthSignals } from "./growthEngagementReadModels";

function countByStatus<T extends { status?: string }>(items: T[], statuses: string[]): number {
  const wanted = new Set(statuses);
  return items.filter((item) => wanted.has(String(item.status || "").toLowerCase())).length;
}

export async function getGrowthBrief(env: Env, profileId = "free_safe") {
  const day = todayUTC();
  const budget = await getOrCreateGrowthBudgetLedger(env, profileId, day);
  const budgetAssessment = assessGrowthBudget(budget, budget.profile_id);
  const signals = await listGrowthSignals(env, 50);
  const actions = await listGrowthActions(env, 50);
  const auditEvents = await listGrowthAuditEventSummaries(env, 10);

  const signalSummary = {
    total: signals.length,
    new: countByStatus(signals, ["new"]),
    watch: countByStatus(signals, ["watch"]),
    triaged: countByStatus(signals, ["triaged"]),
    convertedToAction: countByStatus(signals, ["converted_to_action"]),
    blocked: countByStatus(signals, ["blocked"]),
    inactive: countByStatus(signals, ["ignored", "duplicate", "blocked"]),
  };

  const actionSummary = {
    total: actions.length,
    queued: countByStatus(actions, ["queued"]),
    needsReview: countByStatus(actions, ["needs_review"]),
    approved: countByStatus(actions, ["approved"]),
    rejected: countByStatus(actions, ["rejected"]),
    blocked: countByStatus(actions, ["blocked"]),
    archived: countByStatus(actions, ["archived"]),
  };

  const suggestedFocus: string[] = [];
  if (budgetAssessment.restRecommended) suggestedFocus.push("Budget or rest policy recommends pausing before additional queue work.");
  if (signalSummary.new > 0) suggestedFocus.push(`${signalSummary.new} new Growth signal(s) can be triaged or planned.`);
  if (actionSummary.needsReview > 0) suggestedFocus.push(`${actionSummary.needsReview} action(s) need operator review.`);
  if (actionSummary.queued > 0) suggestedFocus.push(`${actionSummary.queued} queued action(s) are waiting in the Growth queue.`);
  if (!suggestedFocus.length) suggestedFocus.push("No urgent Growth queue decisions detected from the current read model.");

  return {
    day,
    profileId: budget.profile_id,
    budget,
    budgetAssessment,
    signalSummary,
    actionSummary,
    latestAuditEvents: auditEvents,
    auditSnapshotsExposed: false,
    suggestedFocus,
    safety: {
      readOnly: true,
      callsAI: false,
      sendsEmail: false,
      postsPublicly: false,
      submitsForms: false,
      executesGrowthActions: false,
    },
  };
}
