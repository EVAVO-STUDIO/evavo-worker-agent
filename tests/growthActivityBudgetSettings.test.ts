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
  assert.equal(resolved.effectiveSourceLimitPerRun, 1);
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
  assert.equal(balanced.effectiveSourceLimitPerRun, 2);
  assert.equal(balanced.effectiveMinimumOpportunityScore, 55);

  for (const settings of [
    { ...BASE, mode: "assisted_discovery", dailySourceLimit: 16, maxNetworkCallsPerRun: 8, minOpportunityScore: 55 },
    { ...BASE, mode: "assisted_discovery", dailySourceLimit: 15, maxNetworkCallsPerRun: 9, minOpportunityScore: 55 },
    { ...BASE, mode: "assisted_discovery", dailySourceLimit: 15, maxNetworkCallsPerRun: 8, minOpportunityScore: 54 },
  ]) {
    const high = resolveGrowthActivitySettings(settings);
    assert.equal(high.intensity, "high");
    assert.equal(high.effectiveSourceLimitPerRun, 4);
    assert.equal(high.effectiveMinimumOpportunityScore, 45);
  }
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

  const score = resolveGrowthActivitySettings({ ...BASE, minOpportunityScore: 90 });
  assert.equal(score.effectiveMinimumOpportunityScore, 90);
});

test("unknown historical modes fall back to Light rather than escalating", () => {
  const resolved = resolveGrowthActivitySettings({ ...BASE, mode: "controlled_outreach" });
  assert.equal(resolved.intensity, "light");
  assert.equal(resolved.selectedBy, "free_safe_autonomy");
  assert.equal(resolved.profile.posture.externalExecutionEnabled, false);
});
