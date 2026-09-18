import assert from "node:assert/strict";
import test from "node:test";

import {
  createOperationsCoreProviderExecutionSnapshotPort,
  type OperationsCoreProviderExecutionSnapshotFetch,
} from "../src/core/businessOperationsCoreProviderExecutionSnapshotPort";

const READ_TOKEN = "r".repeat(32);
const WORKSPACE_ID = "evavo-main";
const HANDOFF_ID = "relationship-provider:task-naomi-vercel:ensure-project";
const OBSERVED_AT = "2026-09-19T01:00:30.000Z";
const EVIDENCE_REF = `operations:provider-execution:${"a".repeat(64)}`;

function payload(status: "queued" | "executing" | "succeeded" = "queued") {
  const executing = status === "executing" || status === "succeeded";
  const succeeded = status === "succeeded";
  return {
    contract: "evavo-relationship-manager-provider-execution-snapshot-v1",
    state: "verified",
    workspaceId: WORKSPACE_ID,
    handoffId: HANDOFF_ID,
    observedAt: OBSERVED_AT,
    evidenceRef: EVIDENCE_REF,
    projection: {
      contract: "evavo_provider_execution_truth_v1",
      handoffId: HANDOFF_ID,
      providerKey: "vercel",
      action: "project.ensure",
      canonicalExecutionOwner: "EVAVO-STUDIO/evavo-agent-infrastructure",
      route: "vercel-provider-cloud-mcp",
      requestId: "request:naomi",
      jobId: "job:naomi",
      idempotencyKey: "naomi:vercel:project.ensure",
      status,
      observedAt: "2026-09-19T01:00:00.000Z",
      admissionEvidenceIds: executing ? ["admission:1"] : [],
      executionEvidenceIds: executing ? ["execution:1"] : [],
      postconditionEvidenceIds: succeeded ? ["vercel:readback:1"] : [],
      replaySafetyEvidenceIds: [],
      executionAttempted: executing,
      postconditionVerified: succeeded,
      providerReadbackVerified: succeeded,
      automaticReplayAllowed: false,
      blocker: null,
    },
    assessment: {
      contract: "evavo_provider_execution_truth_v1",
      handoffId: HANDOFF_ID,
      status,
      current: true,
      queuedOnly: status === "queued",
      activeExecutionProven: status === "executing",
      completionProven: succeeded,
      requiresReconciliation: false,
      automaticReplayAllowed: false,
      blocker: status === "queued" ? "provider_execution_not_admitted" : null,
      evidenceIds: executing
        ? succeeded
          ? ["admission:1", "execution:1", "vercel:readback:1"]
          : ["admission:1", "execution:1"]
        : [],
    },
    providerReads: 1,
    providerWrites: 0,
    outsideEffects: 0,
  };
}

function fetchWith(data: unknown, observed?: { url?: string; init?: RequestInit }): OperationsCoreProviderExecutionSnapshotFetch {
  return async (url, init) => {
    if (observed) {
      observed.url = url;
      observed.init = init;
    }
    return {
      ok: true,
      status: 200,
      async json() {
        return { ok: true, data };
      },
    };
  };
}

function port(data: unknown) {
  return createOperationsCoreProviderExecutionSnapshotPort(
    { baseUrl: "https://operations.example.test/", readToken: READ_TOKEN, timeoutMs: 1000 },
    fetchWith(data),
  );
}

test("reads one exact provider handoff with authenticated no-store POST", async () => {
  const observed: { url?: string; init?: RequestInit } = {};
  const snapshotPort = createOperationsCoreProviderExecutionSnapshotPort(
    { baseUrl: "https://operations.example.test/", readToken: READ_TOKEN, timeoutMs: 1000 },
    fetchWith(payload(), observed),
  );

  const result = await snapshotPort.read({ workspaceId: WORKSPACE_ID, handoffId: HANDOFF_ID });
  assert.equal(observed.url, "https://operations.example.test/api/v1/internal/relationship-manager/provider-execution-snapshot");
  assert.equal(observed.init?.method, "POST");
  assert.equal((observed.init?.headers as Record<string, string>).Authorization, `Bearer ${READ_TOKEN}`);
  assert.equal(observed.init?.cache, "no-store");
  assert.equal(observed.init?.redirect, "error");
  assert.deepEqual(JSON.parse(String(observed.init?.body)), { workspaceId: WORKSPACE_ID, handoffId: HANDOFF_ID });
  assert.equal(result.state, "verified");
  assert.equal(result.projection?.handoffId, HANDOFF_ID);
  assert.equal(result.assessment?.queuedOnly, true);
});

test("rejects projection identity mismatch", async () => {
  const invalid = payload();
  invalid.projection.handoffId = "relationship-provider:another-task:ensure-project";
  await assert.rejects(
    () => port(invalid).read({ workspaceId: WORKSPACE_ID, handoffId: HANDOFF_ID }),
    /PROJECTION_IDENTITY_MISMATCH/,
  );
});

test("rejects remote completion claim that disagrees with the projection status", async () => {
  const invalid = payload("queued");
  invalid.assessment.status = "succeeded";
  invalid.assessment.completionProven = true;
  await assert.rejects(
    () => port(invalid).read({ workspaceId: WORKSPACE_ID, handoffId: HANDOFF_ID }),
    /ASSESSMENT_IDENTITY_MISMATCH/,
  );
});

test("valid not_found returns no execution truth", async () => {
  const missing = {
    ...payload(),
    state: "not_found",
    projection: null,
    assessment: null,
    reason: "No exact provider-execution handoff matched the supplied identity.",
  };
  const result = await port(missing).read({ workspaceId: WORKSPACE_ID, handoffId: HANDOFF_ID });
  assert.equal(result.state, "not_found");
  assert.equal(result.projection, null);
  assert.equal(result.assessment, null);
});

test("remote HTTP error exposes status only", async () => {
  const snapshotPort = createOperationsCoreProviderExecutionSnapshotPort(
    { baseUrl: "https://operations.example.test", readToken: READ_TOKEN },
    async () => ({
      ok: false,
      status: 503,
      async json() {
        return { ok: false, error: { message: "secret database path" } };
      },
    }),
  );
  await assert.rejects(
    () => snapshotPort.read({ workspaceId: WORKSPACE_ID, handoffId: HANDOFF_ID }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /READ_FAILED:503/);
      assert.doesNotMatch(error.message, /database path/);
      return true;
    },
  );
});
