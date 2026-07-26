import assert from "node:assert/strict";
import test from "node:test";

import {
  GROWTH_ACTIVITY_SETTINGS_VERSION,
  resolveGrowthActivitySettings,
} from "../src/core/growthActivityBudgetSettings";

const BASE = Object.freeze({
  mode: "free_safe_autonomy",
  engineEnabled: true,
  opportunityDiscoveryEnabled: true,
  dailySourceLimit: 10,
  maxNetworkCallsPerRun: 20,
  minOpportunityScore: 45,
});

test("disabled engine or discovery resolves to paused with no source capacity", () => {
  for (const settings of [
    { ...BASE, engineEnabled: false },
    { ...BASE, opportunityDiscoveryEnabled: false },
  ]) {
    const resolved = resolveGrowthActivitySettings(settings);
    assert.equal(resolved.contractVersion, GROWTH_ACTIVITY_SETTINGS_VERSION);
    assert.equal(resolved.intensity, "paused");
    assert.equal(resolved.selectedBy, "engine_disabled");
    assert.equal(resolved.manualResearchConfigured, false);
    assert.equal(resolved.effectiveSourceLimitPerRun, 0);
  }
});

test("observe-only stays paused even when legacy network values are nonzero", () => {
  const resolved = resolveGrowthActivitySettings({ ...BASE, mode: "observe_only" });
  assert.equal(resolved.intensity, "paused");
  assert.equal(resolved.selectedBy, "observe_only");
  assert.equal(resolved.manualResearchConfigured, false);
});

test("free-safe autonomy maps to Light and legacy values cannot enlarge the profile", () => {
  const resolved = resolveGrowthActivitySettings(BASE);
  assert.equal(resolved.intensity, "light");
  assert.equal(resolved.selectedBy, "free_safe_autonomy");
  assert.equal(resolved.manualResearchConfigured, true);
  assert.equal(resolved.effectiveSourceLimitPerRun, 3);
  assert.equal(resolved.profile.limits.manualResearchRunsPerDay, 1);
  assert.equal(resolved.profile.limits.externalFetchesPerRun, 3);
  assert.equal(resolved.effectiveMinimumOpportunityScore, 65);
  assert.equal(resolved.legacyControlsAreSecondaryCaps, true);
  assert.equal(resolved.scheduledExternalResearchEnabled, false);
  assert.equal(resolved.externalExecutionEnabled, false);
});

test("assisted discovery uses Balanced only inside the balanced legacy envelope", () => {
  const balanced = resolveGrowthActivitySettings({
    ...BASE,
    mode: "assisted_discovery",
    dailySourceLimit: 15,
    maxNetworkCallsPerRun: 8,
    minOpportunityScore: 55,
  });
  assert.equal(balanced.intensity, "balanced");
  assert.equal(balanced.effectiveSourceLimitPerRun, 8);
  assert.equal(balanced.profile.limits.manualResearchRunsPerDay, 2);
  assert.equal(balanced.profile.limits.externalFetchesPerRun, 8);
  assert.equal(balanced.effectiveMinimumOpportunityScore, 55);

  for (const [settings, expectedLimit] of [
    [
      { ...BASE, mode: "assisted_discovery", dailySourceLimit: 16, maxNetworkCallsPerRun: 8, minOpportunityScore: 55 },
      8,
    ],
    [
      { ...BASE, mode: "assisted_discovery", dailySourceLimit: 15, maxNetworkCallsPerRun: 9, minOpportunityScore: 55 },
      9,
    ],
    [
      { ...BASE, mode: "assisted_discovery", dailySourceLimit: 15, maxNetworkCallsPerRun: 8, minOpportunityScore: 54 },
      8,
    ],
  ] as const) {
    const high = resolveGrowthActivitySettings(settings);
    assert.equal(high.intensity, "high");
    assert.equal(high.effectiveSourceLimitPerRun, expectedLimit);
    assert.equal(high.effectiveMinimumOpportunityScore, 45);
  }
});

test("run frequency never masquerades as per-run source capacity", () => {
  const high = resolveGrowthActivitySettings({
    ...BASE,
    mode: "assisted_discovery",
    dailySourceLimit: 100,
    maxNetworkCallsPerRun: 250,
    minOpportunityScore: 1,
  });
  assert.equal(high.intensity, "high");
  assert.equal(high.profile.limits.manualResearchRunsPerDay, 4);
  assert.equal(high.profile.limits.externalFetchesPerRun, 15);
  assert.equal(high.effectiveSourceLimitPerRun, 15);
});

test("legacy caps may reduce but never increase named profile capacity", () => {
  const reduced = resolveGrowthActivitySettings({
    ...BASE,
    dailySourceLimit: 0,
    maxNetworkCallsPerRun: 250,
  });
  assert.equal(reduced.intensity, "light");
  assert.equal(reduced.effectiveSourceLimitPerRun, 0);
  assert.equal(reduced.manualResearchConfigured, false);

  const networkReduced = resolveGrowthActivitySettings({
    ...BASE,
    maxNetworkCallsPerRun: 2,
  });
  assert.equal(networkReduced.effectiveSourceLimitPerRun, 2);

  const score = resolveGrowthActivitySettings({ ...BASE, minOpportunityScore: 90 });
  assert.equal(score.effectiveMinimumOpportunityScore, 90);
});

test("unknown historical modes fall back to Light rather than escalating", () => {
  const resolved = resolveGrowthActivitySettings({ ...BASE, mode: "controlled_outreach" });
  assert.equal(resolved.intensity, "light");
  assert.equal(resolved.selectedBy, "free_safe_autonomy");
  assert.equal(resolved.profile.posture.externalExecutionEnabled, false);
});
