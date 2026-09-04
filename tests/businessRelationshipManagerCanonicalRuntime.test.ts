import assert from "node:assert/strict";
import test from "node:test";

import { runCanonicalRelationshipManagerCommunicationCycle } from "../src/core/businessRelationshipManagerCanonicalRuntime";

function input() {
  return {
    cycle: {
      cycleId: "canonical-cycle-1",
      observedAt: "2026-09-04T01:00:30Z",
      decisionAt: "2026-09-04T01:01:00Z",
      scenario: "general" as const,
      objective: "Answer the client's current status question asynchronously.",
      gmail: {
        threadId: "thread-canonical-1",
        relationshipId: "relationship-canonical-1",
        personId: "person-canonical-1",
        messages: [{
          id: "message-canonical-1",
          threadId: "thread-canonical-1",
          sentAt: "2026-09-04T01:00:00Z",
          from: { name: "Client", address: "client@example.com" },
          to: [{ name: "Greg", address: "greg@evavo.com.au" }],
          subject: "Status",
          body: "Could you confirm the current status?",
        }],
      },
      identity: {
        contract: "business_relationship_identity_resolver_v2" as const,
        status: "verified" as const,
        selected: {
          personId: "person-canonical-1",
          name: "Client",
          addresses: ["client@example.com"],
          evidence: [{ source: "gmail" as const, ref: "gmail:message:message-canonical-1", confidence: 100 }],
        },
        confidence: 100,
        exactAddressMatch: true,
        reasons: ["Exact evidence-backed email match."],
        competingPersonIds: [],
      },
      channel: { currentChannel: "email" as const, canResolveInWriting: true },
      evidenceConfidence: 98,
      additionalEvidenceIds: ["operations:project-status:1"],
    },
    context: {
      identitySummary: "Client <client@example.com> is verified from the current Gmail thread.",
      communicationSummary: "The client has one live question asking for current status.",
      projectSummary: null,
      evidenceItems: [
        {
          id: "identity-current",
          domain: "identity" as const,
          summary: "Exact evidence-backed client identity.",
          status: "current" as const,
          authority: "authoritative" as const,
          observedAt: "2026-09-04T01:00:30Z",
          sourceRefs: ["gmail:message:message-canonical-1"],
        },
        {
          id: "gmail-current",
          domain: "gmail" as const,
          summary: "Current canonical Gmail thread read.",
          status: "current" as const,
          authority: "canonical" as const,
          observedAt: "2026-09-04T01:00:30Z",
          sourceRefs: ["gmail:thread:thread-canonical-1"],
        },
      ],
      sourceReadiness: [
        {
          domain: "gmail" as const,
          state: "verified" as const,
          required: true,
          observedAt: "2026-09-04T01:00:30Z",
          sourceRefs: ["gmail:thread:thread-canonical-1"],
        },
        {
          domain: "operations" as const,
          state: "not_found" as const,
          required: true,
          absenceAcceptable: true,
          observedAt: "2026-09-04T01:00:40Z",
          sourceRefs: ["operations:query:no-linked-project:1"],
        },
      ],
    },
  };
}

test("canonical cycle binds v3 decision context before an approval-grade decision", () => {
  const result = runCanonicalRelationshipManagerCommunicationCycle(input());
  assert.equal(result.contract, "business_relationship_manager_canonical_runtime_v1");
  assert.equal(result.externalEffectPerformed, false);
  assert.equal(result.decisionContext.contract, "business_relationship_decision_context_v3");
  assert.equal(result.decisionContext.approvalGradeReady, true);
  assert.equal(result.cycle.decision.approvalGradeReady, true);
  assert.equal(result.approvalGradeReady, true);
  assert.equal(result.cycle.decision.disposition, "reply");
  assert.equal(result.cycle.decision.relationshipCycleId, "canonical-cycle-1");
  assert.ok(result.cycle.decision.evidenceIds.includes("operations:query:no-linked-project:1"));
});

test("unavailable required source propagates into escalation and blocks approval", () => {
  const value = input();
  value.context.sourceReadiness = [
    value.context.sourceReadiness[0],
    {
      domain: "operations" as const,
      state: "provider_unavailable" as const,
      required: true,
      detail: "Operations Core is unavailable.",
    },
  ];
  const result = runCanonicalRelationshipManagerCommunicationCycle(value);
  assert.equal(result.decisionContext.approvalGradeReady, false);
  assert.equal(result.cycle.decision.approvalGradeReady, false);
  assert.equal(result.approvalGradeReady, false);
  assert.equal(result.cycle.decision.disposition, "escalate");
  assert.ok(result.cycle.decision.nextContextSources.includes("operations_core"));
  assert.ok(result.cycle.decision.reasons.some((reason) => /context resolution required/i.test(reason)));
});

test("canonical cycle refuses an identity that does not match the bound person", () => {
  const value = input();
  value.cycle.gmail.personId = "person-other";
  assert.throws(() => runCanonicalRelationshipManagerCommunicationCycle(value), /IDENTITY_NOT_VERIFIED/);
});
