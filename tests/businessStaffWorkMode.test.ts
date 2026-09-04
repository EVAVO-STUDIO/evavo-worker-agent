import assert from "node:assert/strict";
import test from "node:test";

import { decideStaffWorkMode } from "../src/core/businessStaffWorkMode";

const criticalPriority = {
  contract: "business_staff_priority_v1" as const,
  id: "priority-1",
  score: 90,
  band: "critical" as const,
  reasons: [],
  deprioritisationReasons: [],
};

const normalPriority = {
  contract: "business_staff_priority_v1" as const,
  id: "priority-2",
  score: 35,
  band: "normal" as const,
  reasons: [],
  deprioritisationReasons: [],
};

test("critical actionable work interrupts lower-priority work", () => {
  const decision = decideStaffWorkMode({
    priority: criticalPriority,
    requiresHumanDecision: false,
    waitingOnCounterparty: false,
    actionableNow: true,
    duplicateOrSuperseded: false,
    suppressionActive: false,
    acknowledgedOnly: false,
    materialNewInformation: true,
  });

  assert.equal(decision.mode, "interrupt_now");
});

test("acknowledgement-only noise is ignored", () => {
  const decision = decideStaffWorkMode({
    priority: normalPriority,
    requiresHumanDecision: false,
    waitingOnCounterparty: false,
    actionableNow: false,
    duplicateOrSuperseded: false,
    suppressionActive: false,
    acknowledgedOnly: true,
    materialNewInformation: false,
  });

  assert.equal(decision.mode, "ignore");
});

test("waiting without a useful action becomes monitor rather than pointless follow-up", () => {
  const decision = decideStaffWorkMode({
    priority: normalPriority,
    requiresHumanDecision: false,
    waitingOnCounterparty: true,
    actionableNow: false,
    duplicateOrSuperseded: false,
    suppressionActive: false,
    acknowledgedOnly: false,
    materialNewInformation: false,
  });

  assert.equal(decision.mode, "monitor");
});

test("normal actionable work is queued without stealing focus", () => {
  const decision = decideStaffWorkMode({
    priority: normalPriority,
    requiresHumanDecision: false,
    waitingOnCounterparty: false,
    actionableNow: true,
    duplicateOrSuperseded: false,
    suppressionActive: false,
    acknowledgedOnly: false,
    materialNewInformation: true,
  });

  assert.equal(decision.mode, "scheduled_queue");
});
