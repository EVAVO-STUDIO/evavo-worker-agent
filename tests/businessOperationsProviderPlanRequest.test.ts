import assert from "node:assert/strict";
import test from "node:test";

import {
  operationsProviderPlanRequestSafetyContract,
  prepareOperationsProviderPlanRequest,
} from "../src/core/businessOperationsProviderPlanRequest";

const obligation = {
  id: "obl-naomi-domain",
  relationshipId: "relationship:naomi",
  projectId: "project:naomis30th",
  owner: "evavo",
  statement: "Complete Naomi's canonical Vercel domain cutover.",
  status: "open",
  importance: "high",
  createdAt: "2026-09-18T19:09:30Z",
  sourceEvidenceIds: ["gmail:thread:naomi-domain", "development-studio:issue:443"],
  satisfactionEvidenceIds: [],
} as const;

test("active EVAVO obligation prepares one fixed provider-plan request with no external effect", () => {
  const request = prepareOperationsProviderPlanRequest({
    organisationId: "123e4567-e89b-42d3-a456-426614174000",
    workspaceId: "223e4567-e89b-42d3-a456-426614174000",
    obligation,
    actionKey: "vercel.desired-state.reconcile",
    handoffId: "naomi-vercel-v2",
    idempotencyKey: "vercel:desired-state:naomis30th:v2",
    requestedAt: "2026-09-19T09:30:00+12:00",
    reason: "Converge the canonical Git-backed Vercel desired state after route readiness is proven.",
    planningEvidenceIds: ["agent-infrastructure:desired-state:v1"],
  });

  assert.equal(request.endpointPath, "/api/v1/internal/provider-execution/plan");
  assert.equal(request.method, "POST");
  assert.equal(request.body.intent.actionKey, "vercel.desired-state.reconcile");
  assert.equal(request.body.binding.relationshipId, "relationship:naomi");
  assert.equal(request.body.binding.projectId, "project:naomis30th");
  assert.deepEqual(request.body.intent.planningEvidenceIds, [
    "gmail:thread:naomi-domain",
    "development-studio:issue:443",
    "agent-infrastructure:desired-state:v1",
  ]);
  assert.equal(request.submissionRequiresScopedOperationsCredential, true);
  assert.equal(request.providerEffectPerformed, false);
  assert.equal(request.externalEffectPerformed, false);
});

test("counterparty or completed obligations cannot create provider work", () => {
  assert.throws(() => prepareOperationsProviderPlanRequest({
    organisationId: "123e4567-e89b-42d3-a456-426614174000",
    workspaceId: "223e4567-e89b-42d3-a456-426614174000",
    obligation: { ...obligation, owner: "counterparty" },
    actionKey: "vercel.desired-state.reconcile",
    handoffId: "bad-owner",
    idempotencyKey: "bad-owner",
    requestedAt: "2026-09-19T09:30:00+12:00",
    reason: "Should fail.",
  }), /OBLIGATION_OWNER_INVALID/);

  assert.throws(() => prepareOperationsProviderPlanRequest({
    organisationId: "123e4567-e89b-42d3-a456-426614174000",
    workspaceId: "223e4567-e89b-42d3-a456-426614174000",
    obligation: { ...obligation, status: "satisfied" },
    actionKey: "vercel.desired-state.reconcile",
    handoffId: "bad-state",
    idempotencyKey: "bad-state",
    requestedAt: "2026-09-19T09:30:00+12:00",
    reason: "Should fail.",
  }), /OBLIGATION_NOT_ACTIVE/);
});

test("known relationship and project bindings cannot be silently switched", () => {
  assert.throws(() => prepareOperationsProviderPlanRequest({
    organisationId: "123e4567-e89b-42d3-a456-426614174000",
    workspaceId: "223e4567-e89b-42d3-a456-426614174000",
    obligation,
    actionKey: "vercel.desired-state.reconcile",
    handoffId: "wrong-project",
    idempotencyKey: "wrong-project",
    requestedAt: "2026-09-19T09:30:00+12:00",
    reason: "Should fail.",
    projectId: "project:other",
  }), /PROJECT_ID_MISMATCH/);
});

test("plan bridge exposes no raw-provider or credential escape hatch", () => {
  assert.equal(operationsProviderPlanRequestSafetyContract.scopedOperationsCredentialNotAcceptedInBody, true);
  assert.equal(operationsProviderPlanRequestSafetyContract.callerSelectedProviderRouteAccepted, false);
  assert.equal(operationsProviderPlanRequestSafetyContract.callerSelectedExecutionOwnerAccepted, false);
  assert.equal(operationsProviderPlanRequestSafetyContract.rawProviderPayloadAccepted, false);
  assert.equal(operationsProviderPlanRequestSafetyContract.rawProviderPathAccepted, false);
  assert.equal(operationsProviderPlanRequestSafetyContract.rawProviderMethodAccepted, false);
  assert.equal(operationsProviderPlanRequestSafetyContract.rawCommandAccepted, false);
  assert.equal(operationsProviderPlanRequestSafetyContract.providerEffectPerformed, false);
});
