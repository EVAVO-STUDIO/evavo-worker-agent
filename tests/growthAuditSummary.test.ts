import assert from "node:assert/strict";
import test from "node:test";

import {
  toGrowthAuditEventSummary,
  type GrowthAuditEventRow,
} from "../src/core/growthAudit";

const SECRET_INPUT = "input-secret-must-not-project";
const SECRET_OUTPUT = "output-secret-must-not-project";
const SECRET_SAFETY = "safety-secret-must-not-project";
const SECRET_BUDGET = "budget-secret-must-not-project";

function row(overrides: Partial<GrowthAuditEventRow> = {}): GrowthAuditEventRow {
  return {
    id: "audit-0001",
    event_type: "growth_strategy_saved",
    entity_type: "growth_goal",
    entity_id: "goal-0001",
    actor: "admin",
    automation_mode: "observe",
    reason: "Confirmed internal metadata save.",
    input_snapshot: JSON.stringify({ requestBodySha256: "a".repeat(64), secret: SECRET_INPUT }),
    output_snapshot: JSON.stringify({ goal: { id: "goal-0001", secret: SECRET_OUTPUT } }),
    safety_result: JSON.stringify({ externalStateChange: false, secret: SECRET_SAFETY }),
    budget_result: JSON.stringify({ aiCalls: 0, secret: SECRET_BUDGET }),
    created_at: "2026-07-26T10:00:00.000Z",
    ...overrides,
  };
}

test("Growth audit summaries preserve references while discarding snapshots", () => {
  const summary = toGrowthAuditEventSummary(row());
  assert.deepEqual(summary, {
    id: "audit-0001",
    eventType: "growth_strategy_saved",
    entityType: "growth_goal",
    entityId: "goal-0001",
    actor: "admin",
    automationMode: "observe",
    reason: "Confirmed internal metadata save.",
    createdAt: "2026-07-26T10:00:00.000Z",
    hasInputSnapshot: true,
    hasOutputSnapshot: true,
    hasSafetyResult: true,
    hasBudgetResult: true,
  });
  const serialised = JSON.stringify(summary);
  for (const secret of [SECRET_INPUT, SECRET_OUTPUT, SECRET_SAFETY, SECRET_BUDGET]) {
    assert(!serialised.includes(secret));
  }
  assert(!serialised.includes("requestBodySha256"));
  assert(!serialised.includes("input_snapshot"));
  assert(!serialised.includes("output_snapshot"));
  assert.equal(Object.isFrozen(summary), true);
});

test("empty stored snapshot objects become false presence flags", () => {
  const summary = toGrowthAuditEventSummary(row({
    input_snapshot: "{}",
    output_snapshot: "[]",
    safety_result: "null",
    budget_result: "",
  }));
  assert.equal(summary.hasInputSnapshot, false);
  assert.equal(summary.hasOutputSnapshot, false);
  assert.equal(summary.hasSafetyResult, false);
  assert.equal(summary.hasBudgetResult, false);
});
