import assert from "node:assert/strict";
import test from "node:test";

import { buildBusinessRelationship360Context } from "../src/core/businessRelationship360Context";

function baseInput() {
  return {
    relationshipId: "rel-ashley",
    personId: "person-ashley",
    threadId: "gmail-thread-1",
    identitySummary: "Ashley Wong <ashley@example.com> is verified against the active Gmail thread.",
    communicationSummary: "Ashley sent a personalised graduate enquiry and asked whether EVAVO has opportunities.",
    priorDecisionSummaries: ["Keep async unless a real role/process creates incremental value for a meeting."],
    obligations: [{
      id: "obl-1",
      relationshipId: "rel-ashley",
      owner: "evavo" as const,
      statement: "Respond to Ashley's graduate enquiry.",
      status: "open" as const,
      importance: "normal" as const,
      createdAt: "2026-09-04T00:00:00Z",
      sourceEvidenceIds: ["gmail:message:m1"],
      satisfactionEvidenceIds: [],
    }],
    evidenceItems: [{
      id: "e1",
      domain: "identity" as const,
      summary: "Exact sender address matched one person record.",
      status: "current" as const,
      authority: "canonical" as const,
      observedAt: "2026-09-04T00:00:00Z",
      sourceRefs: ["gmail:message:m1"],
    }],
    now: "2026-09-04T02:50:00Z",
  };
}

test("builds concise relationship context with obligations and evidence", () => {
  const result = buildBusinessRelationship360Context(baseInput());
  assert.equal(result.contract, "business_relationship_360_context_v2");
  assert.equal(result.missingCriticalContext.length, 0);
  assert.deepEqual(result.openEvavoObligations, ["Respond to Ashley's graduate enquiry."]);
  assert.ok(result.contextSummary.includes("Ashley Wong"));
  assert.ok(result.evidenceRefs.includes("gmail:message:m1"));
});

test("calls out conflicting and missing critical context", () => {
  const result = buildBusinessRelationship360Context({
    relationshipId: "rel-client",
    projectId: "project-1",
    threadId: "thread-1",
    identitySummary: null,
    projectSummary: null,
    communicationSummary: null,
    evidenceItems: [{
      id: "e2",
      domain: "document",
      summary: "Two proposal versions are both marked current.",
      status: "conflicting",
      authority: "authoritative",
      observedAt: "2026-09-04T00:00:00Z",
      sourceRefs: ["docs:a", "docs:b"],
    }],
    now: "2026-09-04T02:50:00Z",
  });

  assert.ok(result.conflicts.length >= 1);
  assert.ok(result.missingCriticalContext.some((item) => /identity/i.test(item)));
  assert.ok(result.missingCriticalContext.some((item) => /project/i.test(item)));
  assert.ok(result.missingCriticalContext.some((item) => /thread/i.test(item)));
});

test("rejects duplicate evidence identities", () => {
  const input = baseInput();
  assert.throws(() => buildBusinessRelationship360Context({
    ...input,
    evidenceItems: [input.evidenceItems[0], { ...input.evidenceItems[0], summary: "Conflicting duplicate." }],
  }), /DUPLICATE_EVIDENCE_ID/);
});

test("rejects evidence without concrete source references", () => {
  const input = baseInput();
  assert.throws(() => buildBusinessRelationship360Context({
    ...input,
    evidenceItems: [{ ...input.evidenceItems[0], sourceRefs: [" ", ""] }],
  }), /SOURCE_REFS_REQUIRED/);
});

test("rejects materially future evidence observations", () => {
  const input = baseInput();
  assert.throws(() => buildBusinessRelationship360Context({
    ...input,
    evidenceItems: [{ ...input.evidenceItems[0], observedAt: "2026-09-04T03:00:01Z" }],
  }), /FUTURE_OBSERVATION/);
});

test("normalises evidence refs and prior decisions without preserving blank values", () => {
  const input = baseInput();
  const result = buildBusinessRelationship360Context({
    ...input,
    priorDecisionSummaries: [" Keep async. ", "", "Keep async."],
    evidenceItems: [{ ...input.evidenceItems[0], sourceRefs: [" gmail:message:m1 ", "gmail:message:m1"] }],
  });
  assert.deepEqual(result.evidenceRefs, ["gmail:message:m1"]);
  assert.deepEqual(result.priorDecisions, ["Keep async."]);
});
