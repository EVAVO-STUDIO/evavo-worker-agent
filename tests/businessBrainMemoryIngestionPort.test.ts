import assert from "node:assert/strict";
import test from "node:test";

import {
  brainMemoryIngestionProofPayload,
  createBrainMemoryIngestionPort,
  type BrainMemoryIngestionFetch,
} from "../src/core/businessBrainMemoryIngestionPort";
import { businessHmacSha256 } from "../src/core/businessSha256";
import type { RelationshipManagerMemoryIngestionRequest } from "../src/core/businessRelationshipManagerMemoryPersistence";

const API_TOKEN = "b".repeat(32);
const WRITE_TOKEN = "w".repeat(32);

function request(): RelationshipManagerMemoryIngestionRequest {
  return {
    contract: "evavo-memory-ingestion-request-v2",
    requestId: "memory-ingest:abc123",
    idempotencyKey: `relationship-cycle-memory:${"a".repeat(64)}`,
    requestedAt: "2026-09-04T12:00:00.000Z",
    cycleId: "cycle-brain-port-1",
    observation: {
      contract: "evavo-memory-ingestion-observation-v2",
      sourceSystem: "gmail",
      sourceRef: "gmail:message:m1",
      observedAt: "2026-09-04T11:59:30.000Z",
      occurredAt: "2026-09-04T11:59:00.000Z",
      kind: "message",
      summary: "Client asked for the current project status.",
      entities: [
        { kind: "relationship", id: "relationship-1" },
        { kind: "communication_thread", id: "thread-1" },
      ],
      tags: ["relationship", "communication", "gmail"],
      authority: "authoritative",
      confidence: "verified",
      classification: "internal",
      material: true,
      actorId: "evavo-worker-agent",
    },
  };
}

function config() {
  return {
    baseUrl: "http://127.0.0.1:8789",
    apiToken: API_TOKEN,
    scopedWriteToken: WRITE_TOKEN,
  } as const;
}

function successFetch(observed: { url?: string; init?: RequestInit }, status: "appended" | "idempotent_replay" = "appended"): BrainMemoryIngestionFetch {
  return async (url, init) => {
    observed.url = url;
    observed.init = init;
    const body = JSON.parse(String(init.body)) as {
      name: string;
      input: RelationshipManagerMemoryIngestionRequest & { writerProof: string };
      autonomy: string;
    };
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          callId: "brain-call-1",
          name: body.name,
          ok: true,
          output: {
            contract: "evavo-memory-ingestion-receipt-v2",
            requestId: body.input.requestId,
            idempotencyKey: body.input.idempotencyKey,
            sourceRef: body.input.observation.sourceRef,
            status,
            durable: true,
            recordId: "mem2_relationship_record_1",
            reasons: [status === "appended" ? "explicitly_material" : "idempotent_replay"],
          },
          durationMs: 3,
        };
      },
    };
  };
}

test("writes exact Relationship Manager request with scoped HMAC proof", async () => {
  const observed: { url?: string; init?: RequestInit } = {};
  const port = createBrainMemoryIngestionPort({ ...config(), baseUrl: "http://127.0.0.1:8789/", timeoutMs: 1000 }, successFetch(observed));

  const input = request();
  const result = await port.write(input);
  assert.equal(port.contract, "business_brain_memory_ingestion_port_v2");
  assert.equal(observed.url, "http://127.0.0.1:8789/v1/tools/call");
  assert.equal(observed.init?.method, "POST");
  assert.equal((observed.init?.headers as Record<string, string>).Authorization, `Bearer ${API_TOKEN}`);
  assert.equal(observed.init?.cache, "no-store");
  assert.equal(observed.init?.redirect, "error");

  const body = JSON.parse(String(observed.init?.body));
  assert.equal(body.name, "brain_memory_ingest_v2");
  assert.equal(body.autonomy, "auto_low_risk");
  assert.equal(body.input.writerProof, businessHmacSha256(WRITE_TOKEN, brainMemoryIngestionProofPayload(input)));
  assert.match(body.input.writerProof, /^[a-f0-9]{64}$/);
  const { writerProof: _proof, ...unsignedInput } = body.input;
  assert.deepEqual(unsignedInput, input);

  assert.equal(result.status, "appended");
  assert.equal(result.durable, true);
  assert.equal(result.recordId, "mem2_relationship_record_1");
});

test("idempotent replay remains a durable accepted receipt", async () => {
  const port = createBrainMemoryIngestionPort(config(), successFetch({}, "idempotent_replay"));
  const result = await port.write(request());
  assert.equal(result.status, "idempotent_replay");
  assert.equal(result.durable, true);
  assert.ok(result.recordId);
});

test("weak general or scoped tokens are rejected before any Brain call", () => {
  let calls = 0;
  const fetchFn: BrainMemoryIngestionFetch = async () => {
    calls += 1;
    throw new Error("should not execute");
  };
  assert.throws(() => createBrainMemoryIngestionPort({ ...config(), apiToken: "weak" }, fetchFn), /API_TOKEN_INVALID/);
  assert.throws(() => createBrainMemoryIngestionPort({ ...config(), scopedWriteToken: "weak" }, fetchFn), /SCOPED_WRITE_TOKEN_INVALID/);
  assert.equal(calls, 0);
});

test("remote errors do not leak Brain error payload details", async () => {
  const port = createBrainMemoryIngestionPort(config(), async () => ({
    ok: false,
    status: 403,
    async json() {
      return { error: { message: "sensitive internal path or token detail" } };
    },
  }));

  await assert.rejects(
    () => port.write(request()),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /WRITE_FAILED:403/);
      assert.doesNotMatch(error.message, /sensitive internal path|token detail/);
      return true;
    },
  );
});

test("unexpected Brain approval requirement fails closed", async () => {
  const port = createBrainMemoryIngestionPort(config(), async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        name: "brain_memory_ingest_v2",
        ok: false,
        approvalRequired: { approvalId: "approval-1" },
      };
    },
  }));
  await assert.rejects(() => port.write(request()), /UNEXPECTED_APPROVAL_REQUIRED/);
});

test("receipt identity drift or missing durable record ID is rejected", async () => {
  const input = request();
  const wrongIdentity = createBrainMemoryIngestionPort(config(), async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        name: "brain_memory_ingest_v2",
        ok: true,
        output: {
          contract: "evavo-memory-ingestion-receipt-v2",
          requestId: "other-request",
          idempotencyKey: input.idempotencyKey,
          sourceRef: input.observation.sourceRef,
          status: "appended",
          durable: true,
          recordId: "mem2_x",
          reasons: [],
        },
      };
    },
  }));
  await assert.rejects(() => wrongIdentity.write(input), /RECEIPT_IDENTITY_MISMATCH/);

  const missingRecord = createBrainMemoryIngestionPort(config(), async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        name: "brain_memory_ingest_v2",
        ok: true,
        output: {
          contract: "evavo-memory-ingestion-receipt-v2",
          requestId: input.requestId,
          idempotencyKey: input.idempotencyKey,
          sourceRef: input.observation.sourceRef,
          status: "appended",
          durable: true,
          reasons: [],
        },
      };
    },
  }));
  await assert.rejects(() => missingRecord.write(input), /RECEIPT_DURABILITY_INVALID/);
});
