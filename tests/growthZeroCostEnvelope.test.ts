import assert from "node:assert/strict";
import test from "node:test";

import {
  GROWTH_ZERO_COST_ENVELOPE_VERSION,
  GROWTH_ZERO_COST_FREE_LIMITS,
  GROWTH_ZERO_COST_LIMIT_SNAPSHOT,
  GROWTH_ZERO_COST_RESERVATION_CEILINGS,
  growthZeroCostEnvelope,
} from "../src/core/growthZeroCostEnvelope";

test("zero-cost envelope records current Cloudflare free quotas and honest plan uncertainty", () => {
  const envelope = growthZeroCostEnvelope();
  assert.equal(envelope.contractVersion, GROWTH_ZERO_COST_ENVELOPE_VERSION);
  assert.equal(envelope.limitSnapshot, GROWTH_ZERO_COST_LIMIT_SNAPSHOT);
  assert.equal(envelope.requiredCloudflarePlan, "workers_free");
  assert.equal(envelope.zeroPaidServiceBudget, true);
  assert.equal(envelope.paidOverageAllowed, false);
  assert.equal(envelope.absoluteZeroCostGuaranteed, false);
  assert.equal(envelope.accountWideUsageKnown, false);
  assert.equal(envelope.accountPlanVerifiedAtRuntime, false);
  assert.equal(envelope.reservationWithinFreeLimits, true);
  assert.equal(envelope.profilesRemainNonExecuting, true);
  assert.equal(Object.isFrozen(envelope), true);
  assert.equal(Object.isFrozen(envelope.quotas), true);
  assert.equal(Object.isFrozen(envelope.profiles), true);
});

test("Growth hard limits reserve only a conservative share of account free quotas", () => {
  const envelope = growthZeroCostEnvelope();
  const quotas = Object.fromEntries(envelope.quotas.map((quota) => [quota.quota, quota]));

  assert.equal(quotas.workers_requests?.freeLimit, 100_000);
  assert.equal(quotas.workers_requests?.reservedLimit, 5_000);
  assert.equal(quotas.workers_requests?.reservationPercent, 5);
  assert.equal(quotas.external_subrequests_per_invocation?.freeLimit, 50);
  assert.equal(quotas.external_subrequests_per_invocation?.reservedLimit, 15);
  assert.equal(quotas.external_subrequests_per_invocation?.reservationPercent, 30);
  assert.equal(quotas.d1_rows_read?.freeLimit, 5_000_000);
  assert.equal(quotas.d1_rows_read?.reservedLimit, 500_000);
  assert.equal(quotas.d1_rows_read?.reservationPercent, 10);
  assert.equal(quotas.d1_rows_written?.freeLimit, 100_000);
  assert.equal(quotas.d1_rows_written?.reservedLimit, 10_000);
  assert.equal(quotas.d1_rows_written?.reservationPercent, 10);
  assert.equal(quotas.queue_operations?.freeLimit, 10_000);
  assert.equal(quotas.queue_operations?.reservedLimit, 1_000);
  assert.equal(quotas.queue_operations?.reservationPercent, 10);
  assert.equal(quotas.workers_ai_neurons?.reservedLimit, 0);
  assert.equal(quotas.browser_minutes?.reservedLimit, 0);
  assert.ok(envelope.quotas.every((quota) => quota.withinReservationCeiling));
});

test("free quota and reservation constants retain fail-closed values", () => {
  assert.deepEqual(GROWTH_ZERO_COST_FREE_LIMITS, {
    workersRequestsPerDay: 100_000,
    workersCpuMillisecondsPerInvocation: 10,
    externalSubrequestsPerInvocation: 50,
    cloudServiceSubrequestsPerInvocation: 1_000,
    cronTriggersPerAccount: 5,
    d1RowsReadPerDay: 5_000_000,
    d1RowsWrittenPerDay: 100_000,
    d1StorageBytesPerAccount: 5_000_000_000,
    d1StorageBytesPerDatabase: 500_000_000,
    queueOperationsPerDay: 10_000,
    queueRetentionHours: 24,
    kvReadsPerDay: 100_000,
    kvWritesPerDay: 1_000,
    workersAiNeuronsPerDay: 10_000,
    browserMinutesPerDay: 10,
    browserConcurrentSessions: 3,
  });
  assert.deepEqual(GROWTH_ZERO_COST_RESERVATION_CEILINGS, {
    workersRequestsPerDay: 10_000,
    externalSubrequestsPerInvocation: 15,
    d1RowsReadPerDay: 500_000,
    d1RowsWrittenPerDay: 10_000,
    queueOperationsPerDay: 1_000,
    workersAiNeuronsPerDay: 0,
    browserMinutesPerDay: 0,
    paidServiceCallsPerDay: 0,
    externalActionsPerDay: 0,
  });
});

test("light, balanced and high remain activity levels rather than execution permissions", () => {
  const envelope = growthZeroCostEnvelope();
  assert.deepEqual(envelope.profiles.map((profile) => profile.intensity), [
    "paused",
    "light",
    "balanced",
    "high",
  ]);
  for (const profile of envelope.profiles) {
    assert.equal(profile.withinHardLimits, true, profile.intensity);
    assert.equal(profile.paidServiceCallsPerDay, 0, profile.intensity);
    assert.equal(profile.externalActionsPerDay, 0, profile.intensity);
    assert.equal(profile.aiCallsPerDay, 0, profile.intensity);
    assert.equal(profile.browserMinutesPerDay, 0, profile.intensity);
    assert.equal(profile.scheduledExternalResearchRunsPerDay, 0, profile.intensity);
  }
});

test("AI and browser capacity remain disabled until account-wide metering can fail closed", () => {
  const envelope = growthZeroCostEnvelope();
  assert.equal(envelope.safety.workersAiEnabled, false);
  assert.equal(envelope.safety.browserEnabled, false);
  assert.equal(envelope.safety.paidServicesEnabled, false);
  assert.equal(envelope.safety.externalExecutionEnabled, false);
  assert.equal(envelope.safety.automaticRetryEnabled, false);
  assert.equal(envelope.safety.freePlanQuotaExhaustionMustFailClosed, true);
  assert.ok(envelope.requirementsBeforeAnyAiOrBrowserUse.length >= 5);
  assert.ok(envelope.untrackedSharedLimits.includes("Cloudflare account billing-plan state"));
  assert.ok(envelope.sourceReferences.every((reference) => reference.startsWith("https://developers.cloudflare.com/")));
});
