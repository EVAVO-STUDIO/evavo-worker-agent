import assert from "node:assert/strict";
import test from "node:test";

import {
  assertMemoryContextUsable,
  buildBusinessMemoryContextRequest,
  memoryContextEvidenceRefs,
} from "../src/core/businessMemoryContextBridge";

test("builds a bounded relationship communication context request", () => {
  const context = buildBusinessMemoryContextRequest({
    intent: "communication",
    relationshipId: "relationship-ashley-wong",
    personId: "ashley-wong",
    threadId: "gmail-thread-1",
    text: "graduate enquiry portfolio reply",
  });
  assert.equal(context.request.protocol, "evavo-memory-fabric-v2");
  assert.equal(context.request.maximumRecords, 40);
  assert.equal(context.request.includeInferred, false);
  assert.equal(context.request.entityRefs.length, 3);
});

test("historical conflict is opt-in instead of polluting ordinary current context", () => {
  const current = buildBusinessMemoryContextRequest({ intent: "relationship", personId: "ashley-wong" });
  const historical = buildBusinessMemoryContextRequest({ intent: "relationship", personId: "ashley-wong", includeHistoricalConflict: true });
  assert.equal(current.request.includeSuperseded, false);
  assert.equal(historical.request.includeSuperseded, true);
  assert.equal(historical.request.includeDisputed, true);
});

test("requires at least one durable entity anchor", () => {
  assert.throws(() => buildBusinessMemoryContextRequest({ intent: "general" }), /ENTITY_REQUIRED/);
});

test("rejects unsourced context records", () => {
  assert.throws(() => assertMemoryContextUsable({
    protocol: "evavo-memory-fabric-v2",
    generatedAt: "2026-09-04T01:00:00Z",
    asOf: "2026-09-04T01:00:00Z",
    summary: "context",
    omittedRecordCount: 0,
    records: [{
      id: "mem-1",
      kind: "fact",
      summary: "Ashley supplied a portfolio.",
      occurredAt: "2026-09-04T00:00:00Z",
      confidence: "verified",
      status: "current",
      sourceRefs: [],
      score: 100,
      whyIncluded: ["exact person match"],
    }],
  }), /UNSOURCED/);
});

test("collects evidence refs for downstream decision traces", () => {
  const refs = memoryContextEvidenceRefs({
    protocol: "evavo-memory-fabric-v2",
    generatedAt: "2026-09-04T01:00:00Z",
    asOf: "2026-09-04T01:00:00Z",
    summary: "context",
    omittedRecordCount: 0,
    records: [
      { id: "a", kind: "fact", summary: "A", occurredAt: "2026-09-04T00:00:00Z", confidence: "verified", status: "current", sourceRefs: ["gmail:1"], score: 10, whyIncluded: [] },
      { id: "b", kind: "decision", summary: "B", occurredAt: "2026-09-04T00:10:00Z", confidence: "verified", status: "current", sourceRefs: ["gmail:1", "operations:2"], score: 9, whyIncluded: [] },
    ],
  });
  assert.deepEqual(refs, ["gmail:1", "operations:2"]);
});
