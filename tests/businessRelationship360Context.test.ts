import assert from "node:assert/strict";
import test from "node:test";

import { buildBusinessRelationship360Context } from "../src/core/businessRelationship360Context";

test("builds concise relationship context with obligations and evidence", () => {
  const result = buildBusinessRelationship360Context({
    relationshipId: "rel-ashley",
    personId: "person-ashley",
    threadId: "gmail-thread-1",
    identitySummary: "Ashley Wong <ashley@example.com> is verified against the active Gmail thread.",
    communicationSummary: "Ashley sent a personalised graduate enquiry and asked whether EVAVO has opportunities.",
    priorDecisionSummaries: ["Keep async unless a real role/process creates incremental value for a meeting."],
    obligations: [{
      id: "obl-1",
      relationshipId: "rel-ashley",
      owner: "evavo",
      statement: "Respond to Ashley's graduate enquiry.",
      status: "open",
      importance: "normal",
      createdAt: "2026-09-04T00:00:00Z",
      sourceEvidenceIds: ["gmail:message:m1"],
      satisfactionEvidenceIds: [],
    }],
    evidenceItems: [{
      id: "e1",
      domain: "identity",
      summary: "Exact sender address matched one person record.",
      status: "current",
      authority: "canonical",
      observedAt: "2026-09-04T00:00:00Z",
      sourceRefs: ["gmail:message:m1"],
    }],
    now: "2026-09-04T02:50:00Z",
  });

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
