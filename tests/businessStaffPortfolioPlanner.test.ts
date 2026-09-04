import assert from "node:assert/strict";
import test from "node:test";

import { planStaffPortfolio } from "../src/core/businessStaffPortfolioPlanner";

const now = Date.parse("2026-09-04T00:00:00Z");

function priority(id: string, score: number, band: "critical" | "high" | "normal" | "low") {
  return {
    contract: "business_staff_priority_v1" as const,
    id,
    score,
    band,
    reasons: [],
    deprioritisationReasons: [],
  };
}

test("caps interrupts to avoid attention thrashing", () => {
  const plan = planStaffPortfolio([
    { id: "a", priority: priority("a", 95, "critical"), mode: "interrupt_now", createdAt: "2026-09-04T00:00:00Z", estimatedMinutes: 30, existingClientOrPartner: true, routineAdmin: false },
    { id: "b", priority: priority("b", 90, "critical"), mode: "interrupt_now", createdAt: "2026-09-04T00:00:00Z", estimatedMinutes: 30, existingClientOrPartner: true, routineAdmin: false },
    { id: "c", priority: priority("c", 85, "critical"), mode: "interrupt_now", createdAt: "2026-09-04T00:00:00Z", estimatedMinutes: 30, existingClientOrPartner: true, routineAdmin: false },
  ], { maxInterrupts: 2, todayBudgetMinutes: 180 }, now);

  assert.deepEqual(plan.interrupts, ["a", "b"]);
  assert.ok(plan.today.includes("c"));
  assert.ok(plan.reasons.c.some((reason) => /interrupt cap/i.test(reason)));
});

test("keeps monitored and ignored work out of active queues", () => {
  const plan = planStaffPortfolio([
    { id: "waiting", priority: priority("waiting", 60, "high"), mode: "monitor", createdAt: "2026-09-01T00:00:00Z", estimatedMinutes: 20, existingClientOrPartner: true, routineAdmin: false },
    { id: "noise", priority: priority("noise", 10, "low"), mode: "ignore", createdAt: "2026-09-04T00:00:00Z", estimatedMinutes: 5, existingClientOrPartner: false, routineAdmin: true },
  ], {}, now);

  assert.deepEqual(plan.monitored, ["waiting"]);
  assert.deepEqual(plan.ignored, ["noise"]);
  assert.equal(plan.today.length, 0);
  assert.equal(plan.queued.length, 0);
});

test("bounded fairness helps aging work without letting routine admin dominate", () => {
  const plan = planStaffPortfolio([
    { id: "old-client", priority: priority("old-client", 50, "normal"), mode: "scheduled_queue", createdAt: "2026-08-20T00:00:00Z", estimatedMinutes: 30, existingClientOrPartner: true, routineAdmin: false },
    { id: "new-lead", priority: priority("new-lead", 54, "normal"), mode: "scheduled_queue", createdAt: "2026-09-04T00:00:00Z", estimatedMinutes: 30, existingClientOrPartner: false, routineAdmin: false },
    { id: "old-admin", priority: priority("old-admin", 20, "low"), mode: "scheduled_queue", createdAt: "2026-08-01T00:00:00Z", estimatedMinutes: 30, existingClientOrPartner: false, routineAdmin: true },
  ], {}, now);

  assert.equal(plan.queued[0], "old-client");
  assert.equal(plan.queued.at(-1), "old-admin");
});

test("today budget prevents unrealistic overcommitment", () => {
  const plan = planStaffPortfolio([
    { id: "one", priority: priority("one", 70, "high"), mode: "handle_today", createdAt: "2026-09-04T00:00:00Z", estimatedMinutes: 120, existingClientOrPartner: true, routineAdmin: false },
    { id: "two", priority: priority("two", 68, "high"), mode: "handle_today", createdAt: "2026-09-04T00:00:00Z", estimatedMinutes: 120, existingClientOrPartner: true, routineAdmin: false },
    { id: "three", priority: priority("three", 66, "high"), mode: "handle_today", createdAt: "2026-09-04T00:00:00Z", estimatedMinutes: 120, existingClientOrPartner: true, routineAdmin: false },
  ], { todayBudgetMinutes: 180 }, now);

  assert.deepEqual(plan.today, ["one"]);
  assert.ok(plan.queued.includes("two"));
  assert.ok(plan.queued.includes("three"));
});
