import assert from "node:assert/strict";
import test from "node:test";

import {
  createCareersRoleTruthPort,
  roleOpeningEvidenceFromCareersSnapshot,
  type CareersRoleTruthFetch,
} from "../src/core/businessCareersRoleTruthPort";

const TOKEN = "c".repeat(32);
const ROLE_ID = "33333333-3333-4333-8333-333333333333";
const EVIDENCE = `operations:careers-snapshot:${"d".repeat(64)}`;

function payload(state: "verified" | "not_found" | "provider_unavailable" = "verified") {
  return {
    contract: "evavo-relationship-manager-careers-snapshot-v1",
    state,
    workspaceId: "evavo",
    targetRoleId: ROLE_ID,
    targetRoleKey: null,
    observedAt: "2026-09-04T22:00:00.000Z",
    evidenceRef: EVIDENCE,
    roles: state === "verified" ? [{
      id: ROLE_ID,
      roleKey: "graduate-designer",
      title: "Graduate Designer",
      state: "open",
      authoritative: true,
      employmentType: "graduate",
      locationLabel: "Melbourne / remote",
      locationMode: "hybrid",
      summary: "Graduate design role.",
      applicationUrl: "https://example.com/careers/graduate-designer",
      openedAt: "2026-09-01T00:00:00.000Z",
      closesAt: null,
      roleOwnerLabel: "EVAVO",
      reviewRequired: false,
      updatedAt: "2026-09-04T21:59:00.000Z",
      stateReason: "stored_state",
    }] : [],
    reasons: [state === "verified" ? "Dedicated careers truth returned one role." : "No matching role."],
    providerReads: state === "provider_unavailable" ? 0 : 1,
    providerWrites: 0,
    externalPublications: 0,
    candidateMessages: 0,
    interviewCalendarChanges: 0,
    employmentCommitments: 0,
    outsideEffects: 0,
  };
}

function fetchWith(data: unknown, observed?: { url?: string; init?: RequestInit }): CareersRoleTruthFetch {
  return async (url, init) => {
    if (observed) { observed.url = url; observed.init = init; }
    return { ok: true, status: 200, async json() { return { ok: true, data }; } };
  };
}

function port(data: unknown) {
  return createCareersRoleTruthPort(
    { baseUrl: "https://operations.example.test", readToken: TOKEN, timeoutMs: 1000 },
    fetchWith(data),
  );
}

test("reads exact careers role truth through the dedicated scoped endpoint", async () => {
  const observed: { url?: string; init?: RequestInit } = {};
  const truthPort = createCareersRoleTruthPort(
    { baseUrl: "https://operations.example.test/", readToken: TOKEN },
    fetchWith(payload(), observed),
  );
  const result = await truthPort.read({ workspaceId: "evavo", targetRoleId: ROLE_ID });
  assert.equal(observed.url, "https://operations.example.test/api/v1/internal/relationship-manager/careers-snapshot");
  assert.equal(observed.init?.method, "POST");
  assert.equal((observed.init?.headers as Record<string, string>).Authorization, `Bearer ${TOKEN}`);
  assert.equal(observed.init?.cache, "no-store");
  assert.equal(result.state, "verified");
  assert.equal(result.roles[0]?.id, ROLE_ID);
  const evidence = roleOpeningEvidenceFromCareersSnapshot(result);
  assert.equal(evidence[0]?.source, "careers_registry");
  assert.equal(evidence[0]?.authoritative, true);
});

test("successful no-role result remains evidence-backed not_found", async () => {
  const result = await port(payload("not_found")).read({ workspaceId: "evavo", targetRoleId: ROLE_ID });
  assert.equal(result.state, "not_found");
  assert.deepEqual(result.roles, []);
  assert.equal(roleOpeningEvidenceFromCareersSnapshot(result).length, 0);
});

test("non-boolean authority flags fail closed", async () => {
  const invalid = payload();
  invalid.roles[0]!.authoritative = "true" as unknown as boolean;
  await assert.rejects(
    () => port(invalid).read({ workspaceId: "evavo", targetRoleId: ROLE_ID }),
    /ROLE_AUTHORITY_INVALID/,
  );
});

test("role record newer than snapshot fails closed", async () => {
  const invalid = payload();
  invalid.roles[0]!.updatedAt = "2026-09-04T22:00:01.000Z";
  await assert.rejects(
    () => port(invalid).read({ workspaceId: "evavo", targetRoleId: ROLE_ID }),
    /UPDATED_AFTER_SNAPSHOT/,
  );
});

test("HTTP failure does not leak remote provider details", async () => {
  const truthPort = createCareersRoleTruthPort(
    { baseUrl: "https://operations.example.test", readToken: TOKEN },
    async () => ({
      ok: false,
      status: 503,
      async json() { return { ok: false, error: { message: "secret database path" } }; },
    }),
  );
  await assert.rejects(
    () => truthPort.read({ workspaceId: "evavo", targetRoleId: ROLE_ID }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /READ_FAILED:503/);
      assert.doesNotMatch(error.message, /database path/);
      return true;
    },
  );
});
