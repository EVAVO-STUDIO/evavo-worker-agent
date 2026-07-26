import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  GROWTH_ZERO_COST_RUNTIME_ENVELOPE_VERSION,
  growthZeroCostRuntimeEnvelopeForProfile,
  listGrowthZeroCostRuntimeEnvelopes,
} from "../src/core/growthZeroCostRuntimeEnvelope";

test("Worker activity profiles project to the canonical zero-cost runtime fixture", () => {
  const fixtureText = fs.readFileSync(
    path.join(process.cwd(), "fixtures/growth-zero-cost-runtime-envelope-v1.json"),
    "utf8",
  );
  const profiles = listGrowthZeroCostRuntimeEnvelopes();
  assert.equal(
    fixtureText,
    `${JSON.stringify({
      contractVersion: GROWTH_ZERO_COST_RUNTIME_ENVELOPE_VERSION,
      profiles,
    }, null, 2)}\n`,
  );
  assert.equal(profiles.length, 4);
  assert.ok(Object.isFrozen(profiles));
  assert.ok(profiles.every((profile) => Object.isFrozen(profile)));
});

test("named profiles preserve the useful 3, 8 and 15 source capacity", () => {
  const light = growthZeroCostRuntimeEnvelopeForProfile("light");
  const balanced = growthZeroCostRuntimeEnvelopeForProfile("balanced");
  const high = growthZeroCostRuntimeEnvelopeForProfile("high");

  assert.equal(light.manualResearchRunsPerDay, 1);
  assert.equal(light.externalFetchesPerRun, 3);
  assert.equal(light.explorationSourcesPerRun, 1);
  assert.equal(balanced.manualResearchRunsPerDay, 2);
  assert.equal(balanced.externalFetchesPerRun, 8);
  assert.equal(balanced.explorationSourcesPerRun, 2);
  assert.equal(high.manualResearchRunsPerDay, 4);
  assert.equal(high.externalFetchesPerRun, 15);
  assert.equal(high.explorationSourcesPerRun, 3);
});

test("every runtime envelope retains the immutable no-paid-service posture", () => {
  for (const profile of listGrowthZeroCostRuntimeEnvelopes()) {
    assert.equal(profile.scheduledExternalResearchEnabled, false);
    assert.equal(profile.aiEnabled, false);
    assert.equal(profile.browserEnabled, false);
    assert.equal(profile.paidServicesAllowed, false);
    assert.equal(profile.externalExecutionEnabled, false);
    assert.equal(profile.automaticRetryEnabled, false);
    assert.equal(profile.accountWideCloudUsageKnown, false);
    assert.equal(profile.persistentUsageAccountingRequired, true);
  }
});

test("unknown runtime profiles fail closed", () => {
  assert.throws(
    () => growthZeroCostRuntimeEnvelopeForProfile("active" as never),
    /GROWTH_ZERO_COST_RUNTIME_PROFILE_INVALID/,
  );
});
