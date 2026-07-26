import assert from "node:assert/strict";
import test from "node:test";

import {
  GROWTH_ACTIVITY_BUDGET_VERSION,
  GROWTH_ACTIVITY_HARD_LIMITS,
  emptyGrowthActivityUsageSnapshot,
  evaluateGrowthActivityBudget,
  listGrowthActivityProfiles,
  resolveGrowthActivityProfile,
  type GrowthActivityCounters,
  type GrowthActivityLimits,
  type GrowthActivityUsageSnapshot,
} from "../src/core/growthActivityBudget";

const NOW = new Date("2026-07-26T04:00:00.000Z");

function snapshot(input: Partial<GrowthActivityUsageSnapshot> & {
  counters?: Partial<GrowthActivityCounters>;
} = {}): GrowthActivityUsageSnapshot {
  const base = emptyGrowthActivityUsageSnapshot(NOW);
  return {
    ...base,
    ...input,
    counters: {
      ...base.counters,
      ...(input.counters ?? {}),
    },
  } as GrowthActivityUsageSnapshot;
}

function customLimits(overrides: Partial<GrowthActivityLimits> = {}): GrowthActivityLimits {
  return {
    manualResearchRunsPerDay: 2,
    scheduledExternalResearchRunsPerDay: 0,
    externalFetchesPerDay: 8,
    externalFetchesPerRun: 4,
    distinctDomainsPerDay: 6,
    fetchesPerDomainPerDay: 2,
    consecutiveFetchFailuresPerRun: 2,
    candidateWritesPerDay: 50,
    proposalWritesPerDay: 20,
    reportsPerDay: 5,
    workerRequestsPerDay: 500,
    d1RowsReadPerDay: 50_000,
    d1RowsWrittenPerDay: 1_000,
    queueOperationsPerDay: 0,
    browserMinutesPerDay: 0,
    aiCallsPerDay: 0,
    paidServiceCallsPerDay: 0,
    externalActionsPerDay: 0,
    minimumResearchCooldownMinutes: 120,
    minimumOpportunityScore: 60,
    ...overrides,
  };
}

test("named profiles are frozen, ordered and stay inside the hard zero-cost envelope", () => {
  const profiles = listGrowthActivityProfiles();
  assert.deepEqual(profiles.map((profile) => profile.intensity), [
    "paused",
    "light",
    "balanced",
    "high",
  ]);
  for (const profile of profiles) {
    assert.equal(profile.contractVersion, GROWTH_ACTIVITY_BUDGET_VERSION);
    assert.equal(Object.isFrozen(profile), true);
    assert.equal(Object.isFrozen(profile.limits), true);
    assert.equal(Object.isFrozen(profile.posture), true);
    assert.equal(profile.posture.zeroPaidServiceBudget, true);
    assert.equal(profile.posture.scheduledExternalResearchEnabled, false);
    assert.equal(profile.posture.aiEnabled, false);
    assert.equal(profile.posture.browserEnabled, false);
    assert.equal(profile.posture.externalExecutionEnabled, false);
    assert.equal(profile.limits.scheduledExternalResearchRunsPerDay, 0);
    assert.equal(profile.limits.aiCallsPerDay, 0);
    assert.equal(profile.limits.browserMinutesPerDay, 0);
    assert.equal(profile.limits.paidServiceCallsPerDay, 0);
    assert.equal(profile.limits.externalActionsPerDay, 0);
    assert.ok(profile.limits.workerRequestsPerDay <= GROWTH_ACTIVITY_HARD_LIMITS.workerRequestsPerDay);
    assert.ok(profile.limits.d1RowsReadPerDay <= GROWTH_ACTIVITY_HARD_LIMITS.d1RowsReadPerDay);
    assert.ok(profile.limits.d1RowsWrittenPerDay <= GROWTH_ACTIVITY_HARD_LIMITS.d1RowsWrittenPerDay);
  }
});

test("a light confirmed manual public research action is admitted and projected conservatively", () => {
  const decision = evaluateGrowthActivityBudget({
    intensity: "light",
    action: "public_research_run",
    invocation: "manual",
    ownerApproved: true,
    explicitlyConfirmed: true,
    targetDomain: "example.com",
    usage: snapshot(),
    now: NOW,
  });
  assert.equal(decision.allowed, true);
  assert.deepEqual(decision.reasons, []);
  assert.equal(decision.projectedUsage.manualResearchRuns, 1);
  assert.equal(decision.projectedUsage.externalFetches, 1);
  assert.equal(decision.projectedUsage.distinctDomains, 1);
  assert.equal(decision.projectedUsage.d1RowsWritten, 50);
  assert.equal(decision.requirements.ownerApproval, true);
  assert.equal(decision.requirements.explicitConfirmation, true);
  assert.equal(decision.requirements.targetDomain, true);
  assert.equal(decision.requirements.persistentUsageAccounting, true);
});

test("manual public research cannot silently bypass owner approval or exact confirmation", () => {
  const decision = evaluateGrowthActivityBudget({
    intensity: "balanced",
    action: "public_research_run",
    invocation: "manual",
    targetDomain: "example.com",
    usage: snapshot(),
    now: NOW,
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes("owner_approval_required"));
  assert.ok(decision.reasons.includes("explicit_confirmation_required"));
});

test("scheduled external research remains denied at every intensity", () => {
  for (const intensity of ["light", "balanced", "high"] as const) {
    const decision = evaluateGrowthActivityBudget({
      intensity,
      action: "public_directory_scan",
      invocation: "scheduled",
      ownerApproved: true,
      explicitlyConfirmed: true,
      targetDomain: "directory.example",
      usage: snapshot(),
      now: NOW,
    });
    assert.equal(decision.allowed, false);
    assert.ok(decision.reasons.includes("scheduled_external_research_forbidden"));
    assert.ok(decision.reasons.includes("manual_invocation_required"));
  }
});

test("light mode blocks oversized runs, daily exhaustion and repeated-domain exhaustion", () => {
  const oversized = evaluateGrowthActivityBudget({
    intensity: "light",
    action: "public_research_run",
    invocation: "manual",
    requestedUnits: 4,
    ownerApproved: true,
    explicitlyConfirmed: true,
    targetDomain: "example.com",
    usage: snapshot(),
    now: NOW,
  });
  assert.equal(oversized.allowed, false);
  assert.ok(oversized.reasons.includes("per_run_budget_exceeded"));
  assert.ok(oversized.reasons.includes("domain_budget_exceeded"));

  const daily = evaluateGrowthActivityBudget({
    intensity: "light",
    action: "public_research_run",
    invocation: "manual",
    ownerApproved: true,
    explicitlyConfirmed: true,
    targetDomain: "other.example",
    usage: snapshot({
      targetDomainFetches: 0,
      counters: {
        manualResearchRuns: 1,
        externalFetches: 5,
        distinctDomains: 4,
      },
    }),
    now: NOW,
  });
  assert.equal(daily.allowed, false);
  assert.ok(daily.reasons.includes("daily_budget_exceeded"));

  const domain = evaluateGrowthActivityBudget({
    intensity: "light",
    action: "public_research_run",
    invocation: "manual",
    ownerApproved: true,
    explicitlyConfirmed: true,
    targetDomain: "example.com",
    usage: snapshot({ targetDomainFetches: 2 }),
    now: NOW,
  });
  assert.equal(domain.allowed, false);
  assert.ok(domain.reasons.includes("domain_budget_exceeded"));
});

test("research cooldown and failure circuit stop wasteful retry loops", () => {
  const cooldown = evaluateGrowthActivityBudget({
    intensity: "balanced",
    action: "public_research_run",
    invocation: "manual",
    ownerApproved: true,
    explicitlyConfirmed: true,
    targetDomain: "example.com",
    usage: snapshot({ lastExternalResearchAt: "2026-07-26T03:00:00.000Z" }),
    now: NOW,
  });
  assert.equal(cooldown.allowed, false);
  assert.ok(cooldown.reasons.includes("research_cooldown_active"));
  assert.equal(cooldown.nextEligibleAt, "2026-07-26T06:00:00.000Z");

  const circuit = evaluateGrowthActivityBudget({
    intensity: "balanced",
    action: "public_research_run",
    invocation: "manual",
    ownerApproved: true,
    explicitlyConfirmed: true,
    targetDomain: "example.com",
    usage: snapshot({ consecutiveFetchFailures: 2 }),
    now: NOW,
  });
  assert.equal(circuit.allowed, false);
  assert.ok(circuit.reasons.includes("failure_circuit_open"));
});

test("paused mode denies even otherwise safe internal work", () => {
  const decision = evaluateGrowthActivityBudget({
    intensity: "paused",
    action: "internal_signal_score",
    invocation: "scheduled",
    usage: snapshot(),
    now: NOW,
  });
  assert.equal(decision.allowed, false);
  assert.ok(decision.reasons.includes("activity_profile_paused"));
  assert.ok(decision.reasons.includes("daily_budget_exceeded"));
});

test("high mode does not enable AI, browser, paid services or external actions", () => {
  const ai = evaluateGrowthActivityBudget({
    intensity: "high",
    action: "ai_draft",
    invocation: "manual",
    ownerApproved: true,
    explicitlyConfirmed: true,
    usage: snapshot(),
    now: NOW,
  });
  assert.equal(ai.allowed, false);
  assert.ok(ai.reasons.includes("action_not_implemented"));
  assert.ok(ai.reasons.includes("ai_calls_forbidden"));
  assert.ok(ai.reasons.includes("paid_service_calls_forbidden"));

  const browser = evaluateGrowthActivityBudget({
    intensity: "high",
    action: "browser_research",
    invocation: "manual",
    ownerApproved: true,
    explicitlyConfirmed: true,
    targetDomain: "example.com",
    usage: snapshot(),
    now: NOW,
  });
  assert.equal(browser.allowed, false);
  assert.ok(browser.reasons.includes("browser_runtime_forbidden"));

  for (const action of [
    "email_send",
    "social_post",
    "social_comment",
    "form_submit",
    "calendar_create",
    "provider_write",
  ] as const) {
    const decision = evaluateGrowthActivityBudget({
      intensity: "high",
      action,
      invocation: "manual",
      ownerApproved: true,
      explicitlyConfirmed: true,
      targetDomain: action === "form_submit" ? "example.com" : null,
      usage: snapshot(),
      now: NOW,
    });
    assert.equal(decision.allowed, false, action);
    assert.ok(decision.reasons.includes("action_not_implemented"), action);
    assert.ok(decision.reasons.includes("external_state_change_forbidden"), action);
  }
});

test("unimplemented report, document and meeting preparation are modelled honestly", () => {
  for (const action of [
    "report_generate",
    "document_prepare",
    "meeting_agenda_prepare",
  ] as const) {
    const decision = evaluateGrowthActivityBudget({
      intensity: "balanced",
      action,
      invocation: "manual",
      usage: snapshot(),
      now: NOW,
    });
    assert.equal(decision.allowed, false, action);
    assert.deepEqual(decision.reasons, ["action_not_implemented"], action);
  }
});

test("custom mode permits tuning only inside immutable zero-cost limits", () => {
  const profile = resolveGrowthActivityProfile("custom", customLimits());
  assert.equal(profile.intensity, "custom");
  assert.equal(profile.limits.externalFetchesPerDay, 8);
  assert.equal(profile.limits.minimumOpportunityScore, 60);
  assert.equal(profile.limits.externalActionsPerDay, 0);

  assert.throws(
    () => resolveGrowthActivityProfile("light", customLimits()),
    /GROWTH_ACTIVITY_NAMED_PROFILE_OVERRIDES_FORBIDDEN/,
  );
  assert.throws(
    () => resolveGrowthActivityProfile("custom", customLimits({ externalActionsPerDay: 1 as 0 })),
    /GROWTH_ACTIVITY_CUSTOM_LIMIT_INVALID:externalActionsPerDay|GROWTH_ACTIVITY_CUSTOM_LIMIT_FORBIDDEN:externalActionsPerDay/,
  );
  assert.throws(
    () => resolveGrowthActivityProfile("custom", customLimits({ externalFetchesPerDay: 51 })),
    /GROWTH_ACTIVITY_CUSTOM_LIMIT_INVALID:externalFetchesPerDay/,
  );
  assert.throws(
    () => resolveGrowthActivityProfile("custom", { ...customLimits(), unexpected: 1 }),
    /GROWTH_ACTIVITY_CUSTOM_LIMITS_INVALID/,
  );
});

test("stale or malformed usage snapshots fail closed", () => {
  const stale = evaluateGrowthActivityBudget({
    intensity: "balanced",
    action: "internal_signal_score",
    invocation: "scheduled",
    usage: snapshot({ capturedAt: "2026-07-26T03:30:00.000Z" }),
    now: NOW,
  });
  assert.equal(stale.allowed, false);
  assert.ok(stale.reasons.includes("usage_snapshot_stale"));

  const malformed = evaluateGrowthActivityBudget({
    intensity: "balanced",
    action: "internal_signal_score",
    invocation: "scheduled",
    usage: {
      ...snapshot(),
      counters: { ...snapshot().counters, externalFetches: -1 },
    },
    now: NOW,
  });
  assert.equal(malformed.allowed, false);
  assert.ok(malformed.reasons.includes("usage_snapshot_invalid"));
});

test("target domains and request units use strict bounded shapes", () => {
  assert.throws(
    () => evaluateGrowthActivityBudget({
      intensity: "light",
      action: "public_research_run",
      invocation: "manual",
      ownerApproved: true,
      explicitlyConfirmed: true,
      targetDomain: "Example.com",
      usage: snapshot(),
      now: NOW,
    }),
    /GROWTH_ACTIVITY_TARGET_DOMAIN_INVALID/,
  );
  assert.throws(
    () => evaluateGrowthActivityBudget({
      intensity: "light",
      action: "public_research_run",
      invocation: "manual",
      requestedUnits: 0,
      ownerApproved: true,
      explicitlyConfirmed: true,
      targetDomain: "example.com",
      usage: snapshot(),
      now: NOW,
    }),
    /GROWTH_ACTIVITY_REQUESTED_UNITS_INVALID/,
  );
});
