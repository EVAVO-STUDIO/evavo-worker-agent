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
  assert.equal(result.contract, "business_relationship_decision_context_v2");
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

test("stale calendar evidence does not block an ordinary email decision by default", () => {
  const result = buildRelationshipDecisionContext({
    objective: "Respond to the graduate enquiry without proposing a meeting.",
    relationship: {
      ...relationship,
      evidenceItems: [
        ...relationship.evidenceItems,
        {
          id: "calendar-old",
          domain: "calendar" as const,
          summary: "Old calendar snapshot unrelated to this response.",
          status: "current" as const,
          authority: "canonical" as const,
          observedAt: "2026-09-04T09:00:00+10:00",
          sourceRefs: ["calendar:snapshot:old"],
        },
      ],
    },
  });
  assert.equal(result.approvalGradeReady, true);
  const calendar = result.freshness.findings.find((item) => item.domain === "calendar");
  assert.equal(calendar?.stale, true);
  assert.equal(calendar?.relevant, false);
  assert.equal(calendar?.blocking, false);
});

test("calendar freshness blocks when scheduling is explicitly part of the decision", () => {
  const result = buildRelationshipDecisionContext({
    objective: "Offer a verified meeting time.",
    requiredFreshnessDomains: ["identity", "gmail", "calendar"],
    relationship: {
      ...relationship,
      evidenceItems: [
        ...relationship.evidenceItems,
        {
          id: "calendar-old",
          domain: "calendar" as const,
          summary: "Calendar availability snapshot.",
          status: "current" as const,
          authority: "canonical" as const,
          observedAt: "2026-09-04T09:00:00+10:00",
          sourceRefs: ["calendar:snapshot:old"],
        },
      ],
    },
  });
  assert.equal(result.approvalGradeReady, false);
  assert.ok(result.freshness.refreshDomains.includes("calendar"));
  assert.ok(result.staffBrief.mustVerify.some((item) => /refresh stale calendar/i.test(item)));
});
