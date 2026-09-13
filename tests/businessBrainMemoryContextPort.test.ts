import assert from "node:assert/strict";
import test from "node:test";

import {
  createBrainMemoryContextPort,
  type BrainMemoryContextFetch,
} from "../src/core/businessBrainMemoryContextPort";
import { buildBusinessMemoryContextRequest } from "../src/core/businessMemoryContextBridge";

const API_TOKEN = "a".repeat(32);
const STATE_REF = `brain:memory-context-state:${"a".repeat(64)}`;
const QUERY_REF = `brain:memory-context-query:${"b".repeat(64)}`;

function request() {
  return buildBusinessMemoryContextRequest({
    intent: "relationship",
    relationshipId: "relationship-1",
    personId: "person-1",
    threadId: "thread-1",
    maximumRecords: 20,
    maximumCharacters: 20_000,
  }).request;
}

function successFetch(observed: { url?: string; init?: RequestInit }, empty = false): BrainMemoryContextFetch {
  return async (url, init) => {
    observed.url = url;
    observed.init = init;
    const body = JSON.parse(String(init.body));
    return {
      ok: true,
      status: 200,
      async json() {
        return {
          name: body.name,
          ok: true,
          output: {
            protocol: "evavo-memory-fabric-v2",
            generatedAt: "2026-09-04T12:00:00.000Z",
            asOf: "2026-09-04T12:00:00.000Z",
            stateEvidenceRef: STATE_REF,
            queryEvidenceRef: QUERY_REF,
            summary: empty ? "No durable EVAVO memory matched this context request." : "Prior relationship decision found.",
            records: empty ? [] : [{
              id: "mem2-1",
              kind: "decision",
              summary: "Keep the status exchange asynchronous.",
              occurredAt: "2026-09-03T10:00:00.000Z",
              confidence: "verified",
              status: "current",
              canonicalOwner: "evavo-worker-agent",
              sourceRefs: ["gmail:message:m1"],
              score: 92,
              whyIncluded: ["1 exact entity match", "authoritative source"],
            }],
            omittedRecordCount: 0,
            restrictedRecordsExcluded: 0,
          },
        };
      },
    };
  };
}

test("reads bounded relationship context with separate state and query evidence", async () => {
  const observed: { url?: string; init?: RequestInit } = {};
  const port = createBrainMemoryContextPort({
    baseUrl: "http://127.0.0.1:4317/",
    apiToken: API_TOKEN,
    timeoutMs: 1000,
  }, successFetch(observed));
  const input = request();
  const result = await port.read(input);

  assert.equal(port.contract, "business_brain_memory_context_port_v2");
  assert.equal(observed.url, "http://127.0.0.1:4317/v1/tools/call");
  assert.equal(observed.init?.method, "POST");
  assert.equal((observed.init?.headers as Record<string, string>).Authorization, `Bearer ${API_TOKEN}`);
  const body = JSON.parse(String(observed.init?.body));
  assert.equal(body.name, "brain_memory_context_v2");
  assert.equal(body.autonomy, "auto_low_risk");
  assert.deepEqual(body.input, input);
  assert.equal(result.context.records.length, 1);
  assert.equal(result.stateEvidenceRef, STATE_REF);
  assert.equal(result.queryEvidenceRef, QUERY_REF);
});

test("empty context remains successful and evidence-backed", async () => {
  const port = createBrainMemoryContextPort({ baseUrl: "http://127.0.0.1:4317", apiToken: API_TOKEN }, successFetch({}, true));
  const result = await port.read(request());
  assert.deepEqual(result.context.records, []);
  assert.equal(result.stateEvidenceRef, STATE_REF);
  assert.equal(result.queryEvidenceRef, QUERY_REF);
});

test("request must be relationship-scoped before any Brain call", async () => {
  let calls = 0;
  const port = createBrainMemoryContextPort({ baseUrl: "http://127.0.0.1:4317", apiToken: API_TOKEN }, async () => {
    calls += 1;
    throw new Error("should not execute");
  });
  const bad = { ...request(), entityRefs: [{ kind: "person" as const, id: "person-1" }] };
  await assert.rejects(() => port.read(bad), /RELATIONSHIP_ENTITY_REQUIRED/);
  assert.equal(calls, 0);
});

test("remote error payload details are not surfaced", async () => {
  const port = createBrainMemoryContextPort({ baseUrl: "http://127.0.0.1:4317", apiToken: API_TOKEN }, async () => ({
    ok: false,
    status: 500,
    async json() { return { error: { message: "sensitive local journal path" } }; },
  }));
  await assert.rejects(() => port.read(request()), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.match(error.message, /READ_FAILED:500/);
    assert.doesNotMatch(error.message, /journal path/);
    return true;
  });
});

test("missing or malformed state evidence fails closed", async () => {
  const port = createBrainMemoryContextPort({ baseUrl: "http://127.0.0.1:4317", apiToken: API_TOKEN }, async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        name: "brain_memory_context_v2",
        ok: true,
        output: {
          protocol: "evavo-memory-fabric-v2",
          generatedAt: "2026-09-04T12:00:00Z",
          asOf: "2026-09-04T12:00:00Z",
          stateEvidenceRef: "bad",
          queryEvidenceRef: QUERY_REF,
          summary: "empty",
          records: [],
          omittedRecordCount: 0,
          restrictedRecordsExcluded: 0,
        },
      };
    },
  }));
  await assert.rejects(() => port.read(request()), /STATE_EVIDENCE_INVALID/);
});

test("unsourced returned memory records fail closed", async () => {
  const port = createBrainMemoryContextPort({ baseUrl: "http://127.0.0.1:4317", apiToken: API_TOKEN }, async () => ({
    ok: true,
    status: 200,
    async json() {
      return {
        name: "brain_memory_context_v2",
        ok: true,
        output: {
          protocol: "evavo-memory-fabric-v2",
          generatedAt: "2026-09-04T12:00:00Z",
          asOf: "2026-09-04T12:00:00Z",
          stateEvidenceRef: STATE_REF,
          queryEvidenceRef: QUERY_REF,
          summary: "bad record",
          records: [{
            id: "mem-bad", kind: "fact", summary: "Unsourced fact.",
            occurredAt: "2026-09-03T12:00:00Z", confidence: "verified", status: "current",
            sourceRefs: [], score: 90, whyIncluded: [],
          }],
          omittedRecordCount: 0,
          restrictedRecordsExcluded: 0,
        },
      };
    },
  }));
  await assert.rejects(() => port.read(request()), /UNSOURCED_RECORD/);
});
