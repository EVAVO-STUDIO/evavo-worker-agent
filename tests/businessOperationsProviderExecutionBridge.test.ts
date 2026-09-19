import assert from "node:assert/strict";
import test from "node:test";

import {
  businessObligationExecutionStateFromOperationsProviderTruth,
  operationsProviderExecutionBridgeSafetyContract,
  type OperationsProviderExecutionProjectionV1,
} from "../src/core/businessOperationsProviderExecutionBridge";
import { assessBusinessObligationExecutionState } from "../src/core/businessObligationExecutionState";

function projection(overrides: Partial<OperationsProviderExecutionProjectionV1> = {}): OperationsProviderExecutionProjectionV1 {
  return {
    contract: "evavo_provider_execution_truth_v1",
    handoffId: "naomi-vercel-v2",
    providerKey: "vercel",
    action: "vercel.desired-state.reconcile",
    capability: "vercel.configure",
    desiredStateRef: "EVAVO-STUDIO/evavo-agent-infrastructure:config/vercel-provider-desired-state-v1.json",
    planningEvidenceIds: ["operations:obligation:naomi-domain", "agent-infrastructure:desired-state:v1"],
    canonicalExecutionOwner: "EVAVO-STUDIO/evavo-development-studio",
    route: null,
    requestId: null,
    jobId: null,
    idempotencyKey: "vercel:desired-state:naomis30th:v2",
    status: "unrouted",
    observedAt: "2026-09-19T09:30:00+12:00",
    admissionEvidenceIds: [],
    executionEvidenceIds: [],
    postconditionEvidenceIds: [],
    replaySafetyEvidenceIds: [],
    executionAttempted: false,
    postconditionVerified: false,
    providerReadbackVerified: false,
    automaticReplayAllowed: false,
    blocker: "executor_route_not_selected",
    ...overrides,
  };
}

test("unrouted Operations provider plan remains blocked and cannot support progress language", () => {
  const state = businessObligationExecutionStateFromOperationsProviderTruth({
    obligationId: "obl-naomi-domain",
    storedObligationId: "obl-naomi-domain",
    projection: projection(),
  });
  const assessment = assessBusinessObligationExecutionState(
    state,
    new Date("2026-09-19T09:31:00+12:00"),
  );

  assert.equal(state.status, "unrouted");
  assert.equal(state.executorRoute, null);
  assert.equal(state.capability, "vercel.configure");
  assert.equal(state.desiredStateRef, "EVAVO-STUDIO/evavo-agent-infrastructure:config/vercel-provider-desired-state-v1.json");
  assert.deepEqual(state.planningEvidenceIds, ["operations:obligation:naomi-domain", "agent-infrastructure:desired-state:v1"]);
  assert.equal(state.executionAttempted, false);
  assert.equal(assessment.mayClaimActiveExecution, false);
  assert.equal(assessment.mayClaimCompletion, false);
  assert.equal(assessment.blocker, "executor_route_not_selected");
  assert.ok(assessment.evidenceIds.includes("operations:obligation:naomi-domain"));
  assert.equal(assessment.mayClaimActiveExecution, false);
});

test("queue acceptance from Operations remains non-active until actual admission evidence exists", () => {
  const state = businessObligationExecutionStateFromOperationsProviderTruth({
    obligationId: "obl-naomi-domain",
    projection: projection({
      status: "queued",
      route: "github-issue-queue",
      requestId: "provider-action-naomi",
      jobId: "2577",
      blocker: null,
    }),
  });
  const assessment = assessBusinessObligationExecutionState(
    state,
    new Date("2026-09-19T09:31:00+12:00"),
  );

  assert.equal(state.status, "queued");
  assert.equal(assessment.mayClaimActiveExecution, false);
  assert.equal(assessment.mayClaimCompletion, false);
  assert.equal(assessment.blocker, "execution_not_admitted");
});

test("Operations provider bridge never accepts credentials or treats queue state as execution", () => {
  assert.equal(operationsProviderExecutionBridgeSafetyContract.providerCredentialsAccepted, false);
  assert.equal(operationsProviderExecutionBridgeSafetyContract.planningEvidenceIsExecutionEvidence, false);
  assert.equal(operationsProviderExecutionBridgeSafetyContract.queuedIsActiveExecution, false);
  assert.equal(operationsProviderExecutionBridgeSafetyContract.providerReadbackRequiredForCompletion, true);
  assert.equal(operationsProviderExecutionBridgeSafetyContract.automaticReplayOfUnknownEffect, false);
});


test("stored Operations obligation identity cannot be rebound to another relationship obligation", () => {
  assert.throws(() => businessObligationExecutionStateFromOperationsProviderTruth({
    obligationId: "obl-naomi-domain",
    storedObligationId: "obl-other-domain",
    projection: projection(),
  }), /OBLIGATION_ID_MISMATCH/);
});
