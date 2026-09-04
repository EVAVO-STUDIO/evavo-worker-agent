import assert from "node:assert/strict";
import test from "node:test";

import { buildCommunicationDecisionPackage } from "../src/core/businessCommunicationDecisionPackage";

const NOW = "2026-09-04T12:00:00+10:00";

function baseInput() {
  return {
    packageId: "pkg-memory",
    scenario: "general" as const,
    objective: "Reply using durable relationship context.",
    thread: {
      threadId: "thread-memory",
      previousState: [],
      latestObservedState: [
        {
          id: "q1",
          kind: "question" as const,
          statement: "Can you confirm the current delivery status?",
          status: "open" as const,
          owner: "evavo" as const,
          sourceEvidenceIds: ["gmail:message-1"],
        },
      ],
    },
    obligations: [],
    channel: { currentChannel: "email" as const, canResolveInWriting: true },
    evidenceIds: ["gmail:message-1"],
    evidenceConfidence: 95,
    decisionAt: NOW,
  };
}

function memoryContext(status = "current") {
  return {
    protocol: "evavo-memory-fabric-v2" as const,
    generatedAt: "2026-09-04T01:59:00Z",
    asOf: "2026-09-04T01:59:00Z",
    summary: "Current relationship delivery context.",
    omittedRecordCount: 0,
    records: [
      {
        id: "mem2-delivery-status",
        kind: "fact",
        summary: "Delivery is awaiting client review.",
        occurredAt: "2026-09-04T01:30:00Z",
        confidence: "verified",
        status,
        canonicalOwner: "operations_core",
        sourceRefs: ["operations:project-123:status"],
        score: 100,
        whyIncluded: ["Exact project and relationship match."],
      },
    ],
  };
}

test("sourced durable memory becomes first-class decision evidence", () => {
  const result = buildCommunicationDecisionPackage({
    ...baseInput(),
    memoryContext: memoryContext(),
  });

  assert.equal(result.memoryContextUsed, true);
  assert.deepEqual(result.memoryRecordIds, ["mem2-delivery-status"]);
  assert.deepEqual(result.memorySourceRefs, ["operations:project-123:status"]);
  assert.ok(result.evidenceIds.includes("operations:project-123:status"));
  assert.equal(result.memoryConflictRecordIds.length, 0);
  assert.equal(result.approvalGradeReady, true);
});

test("disputed durable memory blocks approval-grade external communication", () => {
  const result = buildCommunicationDecisionPackage({
    ...baseInput(),
    memoryContext: memoryContext("disputed"),
  });

  assert.equal(result.disposition, "escalate");
  assert.equal(result.approvalGradeReady, false);
  assert.deepEqual(result.memoryConflictRecordIds, ["mem2-delivery-status"]);
  assert.ok(result.mustVerify.some((item) => /durable memory/i.test(item)));
});

test("unsourced durable memory fails closed", () => {
  const context = memoryContext();
  assert.throws(() => buildCommunicationDecisionPackage({
    ...baseInput(),
    memoryContext: {
      ...context,
      records: [{ ...context.records[0], sourceRefs: [] }],
    },
  }), /BUSINESS_MEMORY_CONTEXT_UNSOURCED_RECORD/);
});
