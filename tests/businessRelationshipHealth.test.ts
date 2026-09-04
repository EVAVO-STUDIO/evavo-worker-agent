import assert from "node:assert/strict";
import test from "node:test";

import {
  BUSINESS_RELATIONSHIP_HEALTH_CONTRACT,
  buildBusinessRelationshipHealth,
} from "../src/core/businessRelationshipHealth";

const now = Date.parse("2026-09-04T00:00:00Z");

test("withholds a confident relationship status when evidence coverage is limited", () => {
  const health = buildBusinessRelationshipHealth([
    {
      id: "event-1",
      kind: "meeting",
      occurredAt: "2026-09-03T00:00:00Z",
      confidence: 95,
      source: "calendar:meeting-1",
      summary: "Recent meeting occurred.",
    },
  ], now);

  assert.equal(health.contract, BUSINESS_RELATIONSHIP_HEALTH_CONTRACT);
  assert.equal(health.status, "insufficient_evidence");
  assert.equal(health.recency.status, "current");
  assert.ok(health.uncertainties.some((item) => /limited/i.test(item)));
});

test("recognises strong current evidence without inventing missing dimensions", () => {
  const health = buildBusinessRelationshipHealth([
    {
      id: "meeting",
      kind: "meeting",
      occurredAt: "2026-09-01T00:00:00Z",
      confidence: 95,
      source: "calendar:meeting-1",
      summary: "Account review meeting.",
    },
    {
      id: "kept",
      kind: "commitment_kept",
      occurredAt: "2026-09-02T00:00:00Z",
      confidence: 90,
      source: "operations:commitment-1",
      summary: "Requested scope was delivered on time.",
    },
    {
      id: "feedback",
      kind: "positive_feedback",
      occurredAt: "2026-09-02T03:00:00Z",
      confidence: 85,
      source: "gmail:message-1",
      summary: "Stakeholder gave positive feedback.",
    },
    {
      id: "progress",
      kind: "commercial_progress",
      occurredAt: "2026-09-03T00:00:00Z",
      confidence: 90,
      source: "proposal:state-1",
      summary: "Proposal moved to final review.",
    },
  ], now);

  assert.equal(health.status, "healthy");
  assert.equal(health.evidenceCoverage, "moderate");
  assert.equal(health.recency.status, "current");
  assert.ok((health.reliability.value ?? 0) >= 70);
  assert.equal(health.issuePressure.value, null);
});

test("flags stale and unresolved-problem evidence as at risk", () => {
  const health = buildBusinessRelationshipHealth([
    {
      id: "old-meeting",
      kind: "meeting",
      occurredAt: "2026-05-01T00:00:00Z",
      confidence: 95,
      source: "calendar:meeting-old",
      summary: "Last meaningful meeting.",
    },
    {
      id: "missed",
      kind: "commitment_missed",
      occurredAt: "2026-08-20T00:00:00Z",
      confidence: 90,
      source: "operations:commitment-2",
      summary: "A promised response was missed.",
    },
    {
      id: "problem",
      kind: "project_problem",
      occurredAt: "2026-08-25T00:00:00Z",
      confidence: 90,
      source: "project:issue-4",
      summary: "Project issue remains unresolved.",
    },
    {
      id: "negative",
      kind: "negative_feedback",
      occurredAt: "2026-08-26T00:00:00Z",
      confidence: 85,
      source: "support:conversation-3",
      summary: "Stakeholder expressed concern.",
    },
  ], now);

  assert.equal(health.status, "at_risk");
  assert.equal(health.recency.status, "stale");
  assert.equal(health.reliability.value, 0);
  assert.equal(health.issuePressure.value, 100);
  assert.ok(health.nextReviewFocus.some((item) => /unresolved issues/i.test(item)));
});

test("resolved issue evidence reduces issue pressure rather than deleting history", () => {
  const health = buildBusinessRelationshipHealth([
    {
      id: "meeting",
      kind: "meeting",
      occurredAt: "2026-09-01T00:00:00Z",
      confidence: 90,
      source: "calendar:meeting-1",
      summary: "Recent review.",
    },
    {
      id: "opened",
      kind: "issue_opened",
      occurredAt: "2026-08-29T00:00:00Z",
      confidence: 80,
      source: "support:issue-1",
      summary: "Issue opened.",
    },
    {
      id: "resolved",
      kind: "issue_resolved",
      occurredAt: "2026-09-02T00:00:00Z",
      confidence: 95,
      source: "support:issue-1-resolution",
      summary: "Issue resolved and confirmed.",
    },
    {
      id: "positive",
      kind: "positive_feedback",
      occurredAt: "2026-09-03T00:00:00Z",
      confidence: 90,
      source: "gmail:message-2",
      summary: "Stakeholder confirmed the resolution was helpful.",
    },
  ], now);

  assert.ok((health.issuePressure.value ?? 100) < 50);
  assert.notEqual(health.status, "at_risk");
  assert.deepEqual(health.issuePressure.evidenceIds, ["opened", "resolved"]);
});
