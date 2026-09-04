import assert from "node:assert/strict";
import test from "node:test";

import { rankStaffWork, prioritiseStaffWork } from "../src/core/businessStaffPriorityEngine";

const now = Date.parse("2026-09-04T00:00:00Z");

test("relationship repair outranks a fresh speculative lead", () => {
  const ranked = rankStaffWork([
    {
      id: "lead",
      kind: "new_lead",
      relationshipRisk: "low",
      stakeholderImpact: "medium",
      evavoOwesNextMove: false,
      explicitCommitment: false,
      overdue: false,
      blocksDelivery: false,
      blocksRevenue: false,
      createdAt: "2026-09-04T00:00:00Z",
      evidenceConfidence: 90,
      reversibleDelay: true,
      commercialValueAud: 50000,
    },
    {
      id: "repair",
      kind: "relationship_repair",
      relationshipRisk: "high",
      stakeholderImpact: "high",
      evavoOwesNextMove: true,
      explicitCommitment: true,
      overdue: true,
      blocksDelivery: false,
      blocksRevenue: false,
      createdAt: "2026-09-03T00:00:00Z",
      evidenceConfidence: 95,
      reversibleDelay: false,
    },
  ], now);

  assert.equal(ranked[0].id, "repair");
  assert.equal(ranked[0].band, "critical");
});

test("existing client commitments outrank routine admin and new leads by default", () => {
  const ranked = rankStaffWork([
    {
      id: "admin",
      kind: "routine_admin",
      relationshipRisk: "low",
      stakeholderImpact: "low",
      evavoOwesNextMove: false,
      explicitCommitment: false,
      overdue: false,
      blocksDelivery: false,
      blocksRevenue: false,
      createdAt: "2026-09-04T00:00:00Z",
      evidenceConfidence: 100,
      reversibleDelay: true,
    },
    {
      id: "commitment",
      kind: "existing_client_commitment",
      relationshipRisk: "medium",
      stakeholderImpact: "medium",
      evavoOwesNextMove: true,
      explicitCommitment: true,
      overdue: false,
      blocksDelivery: false,
      blocksRevenue: false,
      deadlineAt: "2026-09-05T00:00:00Z",
      createdAt: "2026-09-03T00:00:00Z",
      evidenceConfidence: 98,
      reversibleDelay: false,
    },
    {
      id: "lead",
      kind: "new_lead",
      relationshipRisk: "low",
      stakeholderImpact: "medium",
      evavoOwesNextMove: false,
      explicitCommitment: false,
      overdue: false,
      blocksDelivery: false,
      blocksRevenue: false,
      createdAt: "2026-09-04T00:00:00Z",
      evidenceConfidence: 95,
      reversibleDelay: true,
      commercialValueAud: 100000,
    },
  ], now);

  assert.equal(ranked[0].id, "commitment");
  assert.equal(ranked.at(-1)?.id, "admin");
});

test("low-confidence evidence reduces urgency rather than fabricating priority", () => {
  const decision = prioritiseStaffWork({
    id: "uncertain",
    kind: "proposal_or_scope",
    relationshipRisk: "high",
    stakeholderImpact: "high",
    evavoOwesNextMove: false,
    explicitCommitment: false,
    overdue: false,
    blocksDelivery: false,
    blocksRevenue: false,
    createdAt: "2026-09-04T00:00:00Z",
    evidenceConfidence: 40,
    reversibleDelay: true,
  }, now);

  assert.ok(decision.deprioritisationReasons.some((item) => /Evidence confidence is low/i.test(item)));
});

test("real deadlines and delivery blockers raise priority", () => {
  const decision = prioritiseStaffWork({
    id: "blocker",
    kind: "delivery_blocker",
    relationshipRisk: "medium",
    stakeholderImpact: "high",
    evavoOwesNextMove: true,
    explicitCommitment: true,
    overdue: false,
    blocksDelivery: true,
    blocksRevenue: false,
    deadlineAt: "2026-09-04T12:00:00Z",
    createdAt: "2026-09-03T00:00:00Z",
    evidenceConfidence: 99,
    reversibleDelay: false,
  }, now);

  assert.equal(decision.band, "critical");
  assert.ok(decision.reasons.some((item) => /blocks delivery/i.test(item)));
  assert.ok(decision.reasons.some((item) => /within 24 hours/i.test(item)));
});
