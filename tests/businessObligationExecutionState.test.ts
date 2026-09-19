import assert from "node:assert/strict";
import test from "node:test";

import {
  assessBusinessObligationExecutionState,
  type BusinessObligationExecutionState,
} from "../src/core/businessObligationExecutionState";

const NOW = new Date("2026-09-19T08:45:00+12:00");

function state(overrides: Partial<BusinessObligationExecutionState> = {}): BusinessObligationExecutionState {
  return {
    contract: "business_obligation_execution_state_v1",
    obligationId: "obl-vercel-domain",
    actionClass: "vercel.domain.ensure",
    capability: "vercel.configure",
    desiredStateRef: "EVAVO-STUDIO/evavo-agent-infrastructure:config/vercel-provider-desired-state-v1.json",
    planningEvidenceIds: ["operations:obligation:naomi-domain"],
    provider: "vercel",
    canonicalExecutionOwner: "EVAVO-STUDIO/evavo-development-studio",
    requestId: "req-vercel-domain",
    jobId: "job-vercel-domain",
    idempotencyKey: "vercel-domain:naomis30th",
    executorRoute: "vercel-provider-cloud-mcp",
    status: "admission_pending",
    observedAt: "2026-09-19T08:44:00+12:00",
    routingEvidenceIds: ["route:github-issue-queue"],
    admissionEvidenceIds: [],
    executionEvidenceIds: [],
    postconditionEvidenceIds: [],
    executionAttempted: false,
    postconditionVerified: false,
    providerReadbackVerified: false,
    automaticReplayAllowed: false,
    blocker: null,
    ...overrides,
  };
}

test("queued or admission-pending work cannot be described as active or complete", () => {
  const result = assessBusinessObligationExecutionState(state(), NOW);
  assert.equal(result.mayClaimActiveExecution, false);
  assert.equal(result.mayClaimCompletion, false);
  assert.equal(result.obligationMayBeSatisfied, false);
  assert.equal(result.blocker, "execution_not_admitted");
});

test("fresh admitted execution evidence can support an in-progress claim but not completion", () => {
  const result = assessBusinessObligationExecutionState(state({
    status: "admitted",
    admissionEvidenceIds: ["admission:receipt:1"],
  }), NOW);
  assert.equal(result.mayClaimActiveExecution, true);
  assert.equal(result.mayClaimCompletion, false);
});

test("executing requires evidence that execution actually started", () => {
  const missing = assessBusinessObligationExecutionState(state({
    status: "executing",
    admissionEvidenceIds: ["admission:receipt:1"],
    executionAttempted: false,
  }), NOW);
  assert.equal(missing.mayClaimActiveExecution, false);
  assert.equal(missing.blocker, "active_execution_evidence_missing");

  const started = assessBusinessObligationExecutionState(state({
    status: "executing",
    admissionEvidenceIds: ["admission:receipt:1"],
    executionEvidenceIds: ["execution:receipt:1"],
    executionAttempted: true,
  }), NOW);
  assert.equal(started.mayClaimActiveExecution, true);
  assert.equal(started.mayClaimCompletion, false);
});

test("completion requires successful execution plus verified provider postcondition readback", () => {
  const result = assessBusinessObligationExecutionState(state({
    status: "succeeded",
    executionAttempted: true,
    executionEvidenceIds: ["execution:receipt:1"],
    postconditionEvidenceIds: ["vercel:readback:domains"],
    postconditionVerified: true,
    providerReadbackVerified: true,
  }), NOW);
  assert.equal(result.mayClaimCompletion, true);
  assert.equal(result.obligationMayBeSatisfied, true);
  assert.equal(result.requiresReconciliation, false);
  assert.equal(result.blocker, null);
});

test("unknown-after-effect forces reconciliation and never self-authorizes replay", () => {
  const result = assessBusinessObligationExecutionState(state({
    status: "unknown_after_effect",
    executionAttempted: true,
    executionEvidenceIds: ["execution:receipt:uncertain"],
    automaticReplayAllowed: true,
  }), NOW);
  assert.equal(result.requiresReconciliation, true);
  assert.equal(result.mayClaimCompletion, false);
  assert.equal(result.automaticReplayAllowed, false);
  assert.equal(result.blocker, "execution_outcome_unknown_reconciliation_required");
});

test("stale active evidence cannot support a current progress claim", () => {
  const result = assessBusinessObligationExecutionState(state({
    status: "executing",
    observedAt: "2026-09-19T08:00:00+12:00",
    admissionEvidenceIds: ["admission:receipt:1"],
    executionEvidenceIds: ["execution:receipt:1"],
    executionAttempted: true,
  }), NOW);
  assert.equal(result.current, false);
  assert.equal(result.mayClaimActiveExecution, false);
  assert.equal(result.blocker, "execution_evidence_stale");
});


test("planning evidence is retained without becoming admission evidence", () => {
  const result = assessBusinessObligationExecutionState(state({
    status: "unrouted",
    executorRoute: null,
    requestId: null,
    jobId: null,
    blocker: "executor_route_not_selected",
  }), NOW);
  assert.ok(result.evidenceIds.includes("operations:obligation:naomi-domain"));
  assert.equal(result.mayClaimActiveExecution, false);
  assert.equal(result.mayClaimCompletion, false);
  assert.equal(result.blocker, "executor_route_not_selected");
});


test("routing evidence does not authorize an active execution claim", () => {
  const result = assessBusinessObligationExecutionState(state({
    status: "executor_selected",
    executorRoute: "github-issue-queue",
    admissionEvidenceIds: [],
  }), NOW);
  assert.ok(result.evidenceIds.includes("route:github-issue-queue"));
  assert.equal(result.mayClaimActiveExecution, false);
  assert.equal(result.mayClaimCompletion, false);
  assert.equal(result.blocker, "execution_not_admitted");
});
