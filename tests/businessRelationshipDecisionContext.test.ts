import assert from "node:assert/strict";
import test from "node:test";

import { buildRelationshipDecisionContext } from "../src/core/businessRelationshipDecisionContext";

const relationship = {
  relationshipId: "rel-ashley",
  personId: "person-ashley",
  threadId: "thread-ashley",
  identitySummary: "Ashley Wong <ashley@example.com> verified from Gmail sender and relationship record.",
  communicationSummary: "One live graduate enquiry requesting a response.",
  evidenceItems: [
    {
      id: "identity-1",
      domain: "identity" as const,
      summary: "Exact sender identity verified.",
      status: "current" as const,
      authority: "authoritative" as const,
      observedAt: "2026-09-04T12:30:00+10:00",
      sourceRefs: ["gmail:m1", "identity:person-ashley"],
    },
    {
      id: "gmail-1",
      domain: "gmail" as const,
      summary: "Current Gmail thread read.",
      status: "current" as const,
      authority: "canonical" as const,
      observedAt: "2026-09-04T12:35:00+10:00",
      sourceRefs: ["gmail:thread:thread-ashley"],
    },
  ],
  now: "2026-09-04T12:40:00+10:00",
};

test("builds one approval-grade decision context from current relationship evidence", () => {
  const result = buildRelationshipDecisionContext({
    objective: "Respond respectfully to the graduate enquiry.",
    relationship,
    changes: {
      relationshipId: "rel-ashley",
      since: "2026-09-01T00:00:00+10:00",
      through: "2026-09-04T12:40:00+10:00",
      changes: [
        {
          id: "change-1",
          occurredAt: "2026-09-04T12:35:00+10:00",
          domain: "communication",
          changeType: "created",
          summary: "Ashley sent a new graduate enquiry.",
          material: true,
          sourceRefs: ["gmail:m1"],
        },
      ],
    },
  });
  assert.equal(result.approvalGradeReady, true);
  assert.equal(result.staffBrief.materialChanges.length, 1);
  assert.equal(result.resolutionPlan.ready, true);
  assert.ok(result.evidenceRefs.includes("gmail:m1"));
});

test("stale approval-critical evidence makes the canonical decision context not ready", () => {
  const result = buildRelationshipDecisionContext({
    objective: "Respond safely.",
    relationship: {
      ...relationship,
      evidenceItems: [
        relationship.evidenceItems[0]!,
        {
          ...relationship.evidenceItems[1]!,
          observedAt: "2026-09-04T09:00:00+10:00",
        },
      ],
    },
  });
  assert.equal(result.approvalGradeReady, false);
  assert.ok(result.staffBrief.mustVerify.some((item) => /refresh stale gmail/i.test(item)));
  assert.ok(result.resolutionPlan.orderedSources.includes("gmail"));
});
