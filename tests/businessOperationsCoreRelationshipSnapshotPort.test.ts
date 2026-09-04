import assert from "node:assert/strict";
import test from "node:test";

import {
  createOperationsCoreRelationshipSnapshotPort,
  type OperationsCoreRelationshipSnapshotFetch,
} from "../src/core/businessOperationsCoreRelationshipSnapshotPort";

const READ_TOKEN = "r".repeat(32);
const WORKSPACE_ID = "evavo-main";
const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const EVIDENCE_REF = `operations:relationship-snapshot:${"a".repeat(64)}`;
const OBSERVED_AT = "2026-09-05T00:00:00.000Z";

function payload() {
  return {
    contract: "evavo-relationship-manager-operations-snapshot-v1",
    state: "verified",
    workspaceId: WORKSPACE_ID,
    commercialClientId: CLIENT_ID,
    projectId: PROJECT_ID,
    observedAt: OBSERVED_AT,
    evidenceRef: EVIDENCE_REF,
    commercial: {
      client: {
        id: CLIENT_ID,
        name: "Example Client",
        status: "active",
        relationshipStage: "active_delivery",
        summary: "Current client relationship.",
        activeProjectCount: 1,
        openBriefCount: 0,
        proposalCount: 2,
        readiness: "available",
        reviewRequired: false,
        updatedAt: "2026-09-04T23:55:00.000Z",
      },
      leadCount: 0,
      openBriefCount: 0,
      proposalCount: 2,
      acceptedProposalCount: 1,
      clientReadyProposalCount: 1,
      latestCommercialUpdatedAt: "2026-09-04T23:55:00.000Z",
    },
    project: {
      id: PROJECT_ID,
      commercialClientId: CLIENT_ID,
      code: "EV-001",
      clientName: "Example Client",
      title: "Website delivery",
      status: "active",
      phase: "build",
      progressPercent: 65,
      milestoneCount: 4,
      openWorkItemCount: 5,
      blockedWorkItemCount: 1,
      linkedWorkOrderCount: 1,
      invoiceReadiness: "not_ready",
      readiness: "available",
      reviewRequired: false,
      clientVisible: true,
      updatedAt: "2026-09-04T23:58:00.000Z",
    },
    reasons: ["Current persistent Operations Core records matched the supplied exact relationship/project identity."],
    providerReads: 6,
    providerWrites: 0,
    externalSends: 0,
    calendarChanges: 0,
    outsideEffects: 0,
  };
}

function fetchWith(data: unknown, observed?: { url?: string; init?: RequestInit }): OperationsCoreRelationshipSnapshotFetch {
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
  return createOperationsCoreRelationshipSnapshotPort(
    { baseUrl: "https://operations.example.test/", readToken: READ_TOKEN, timeoutMs: 1000 },
    fetchWith(data),
  );
}

const request = {
  workspaceId: WORKSPACE_ID,
  commercialClientId: CLIENT_ID,
  projectId: PROJECT_ID,
};

test("reads the exact scoped Operations snapshot with no-store authenticated POST", async () => {
  const observed: { url?: string; init?: RequestInit } = {};
  const snapshotPort = createOperationsCoreRelationshipSnapshotPort(
    { baseUrl: "https://operations.example.test/", readToken: READ_TOKEN, timeoutMs: 1000 },
    fetchWith(payload(), observed),
  );

  const result = await snapshotPort.read(request);
  assert.equal(snapshotPort.contract, "business_operations_core_relationship_snapshot_port_v1");
  assert.equal(observed.url, "https://operations.example.test/api/v1/internal/relationship-manager/operations-snapshot");
  assert.equal(observed.init?.method, "POST");
  assert.equal((observed.init?.headers as Record<string, string>).Authorization, `Bearer ${READ_TOKEN}`);
  assert.equal(observed.init?.cache, "no-store");
  assert.equal(observed.init?.redirect, "error");
  assert.deepEqual(JSON.parse(String(observed.init?.body)), request);
  assert.equal(result.state, "verified");
  assert.equal(result.project?.id, PROJECT_ID);
  assert.equal(result.commercial?.client?.id, CLIENT_ID);
});

test("rejects non-boolean review and visibility fields instead of coercing them", async () => {
  const invalidClient = payload();
  invalidClient.commercial.client.reviewRequired = "false" as unknown as boolean;
  await assert.rejects(() => port(invalidClient).read(request), /CLIENT_REVIEW_REQUIRED_INVALID/);

  const invalidProject = payload();
  invalidProject.project.clientVisible = 1 as unknown as boolean;
  await assert.rejects(() => port(invalidProject).read(request), /PROJECT_CLIENT_VISIBLE_INVALID/);
});

test("rejects malformed primary UUIDs even if other identity fields look plausible", async () => {
  const invalidClient = payload();
  invalidClient.commercial.client.id = "client-not-a-uuid";
  await assert.rejects(() => port(invalidClient).read(request), /CLIENT_ID_INVALID/);

  const invalidProject = payload();
  invalidProject.project.id = "project-not-a-uuid";
  await assert.rejects(() => port(invalidProject).read(request), /PROJECT_ID_INVALID/);
});

test("rejects inconsistent commercial proposal counts", async () => {
  const invalid = payload();
  invalid.commercial.proposalCount = 1;
  invalid.commercial.acceptedProposalCount = 2;
  await assert.rejects(() => port(invalid).read(request), /PROPOSAL_COUNTS_INCONSISTENT/);
});

test("rejects blocked work item counts greater than open work item counts", async () => {
  const invalid = payload();
  invalid.project.openWorkItemCount = 1;
  invalid.project.blockedWorkItemCount = 2;
  await assert.rejects(() => port(invalid).read(request), /WORK_ITEM_COUNTS_INCONSISTENT/);
});

test("rejects provider records newer than the server snapshot observation", async () => {
  const invalid = payload();
  invalid.project.updatedAt = "2026-09-05T00:00:01.000Z";
  await assert.rejects(() => port(invalid).read(request), /PROJECT_UPDATED_AFTER_SNAPSHOT/);
});

test("valid exact not_found remains evidence-backed absence", async () => {
  const missing = {
    ...payload(),
    state: "not_found",
    commercial: null,
    project: null,
    reasons: ["No current persistent Operations Core record matched the supplied exact client/project identity."],
  };
  const result = await port(missing).read(request);
  assert.equal(result.state, "not_found");
  assert.equal(result.commercial, null);
  assert.equal(result.project, null);
  assert.equal(result.evidenceRef, EVIDENCE_REF);
});

test("remote HTTP errors expose status only, not provider payload details", async () => {
  const snapshotPort = createOperationsCoreRelationshipSnapshotPort(
    { baseUrl: "https://operations.example.test", readToken: READ_TOKEN },
    async () => ({
      ok: false,
      status: 503,
      async json() {
        return { ok: false, error: { message: "sensitive provider configuration path" } };
      },
    }),
  );
  await assert.rejects(
    () => snapshotPort.read(request),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /READ_FAILED:503/);
      assert.doesNotMatch(error.message, /configuration path/);
      return true;
    },
  );
});
