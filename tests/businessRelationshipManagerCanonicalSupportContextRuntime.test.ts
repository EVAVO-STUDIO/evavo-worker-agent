import assert from "node:assert/strict";
import test from "node:test";

import type { SupportRelationshipSnapshotPort } from "../src/core/businessSupportRelationshipSnapshotPort";
import { runCanonicalRelationshipManagerCycleWithSupportContext } from "../src/core/businessRelationshipManagerCanonicalSupportContextRuntime";

const REF = `support:relationship-snapshot:${"f".repeat(64)}`;

function support(mode: "verified" | "not_found" | "unavailable"): SupportRelationshipSnapshotPort {
  return {
    contract: "business_support_relationship_snapshot_port_v1",
    async read() {
      if (mode === "unavailable") throw new Error("SUPPORT_RELATIONSHIP_READ_UNAVAILABLE");
      const verified = mode === "verified";
      const state: "verified" | "not_found" = verified ? "verified" : "not_found";
      return {
        contract: "evavo-relationship-manager-support-snapshot-v1",
        state,
        organisationId: "org_12345678",
        ticketId: "ticket_12345678",
        conversationId: verified ? "conv_12345678" : null,
        observedAt: "2026-09-05T01:00:20.000Z",
        evidenceRef: REF,
        ticket: verified ? {
          status: "OPEN",
          priority: "HIGH",
          category: "COMPLAINT",
          title: "Still waiting",
          internalSummary: "Customer is waiting on a reply.",
          suggestedAction: "Respond after checking the live service state.",
          dueAt: null,
          updatedAt: "2026-09-05T01:00:00.000Z",
        } : null,
        latestCustomerMessage: verified ? "I'm frustrated that I'm still waiting." : null,
        latestCustomerMessageAt: verified ? "2026-09-05T00:59:00.000Z" : null,
        emotionRisk: verified ? {
          emotionState: "frustrated",
          urgency: "high",
          humanInterventionHint: "soon",
          signals: ["emotion:frustrated", "priority:high", "category:complaint"],
        } : null,
        providerReads: 1,
        providerWrites: 0,
        outboundMessages: 0,
        ticketMutations: 0,
        outsideEffects: 0,
      };
    },
  };
}

function sourceHydration() {
  return {
    env: {},
    operationsRequired: false,
    operationsIdentity: null,
    careersRequired: false,
    careersIdentity: null,
    cycle: {
      cycleId: "support-cycle-1",
      observedAt: "2026-09-05T01:00:30.000Z",
      decisionAt: "2026-09-05T01:01:00.000Z",
      scenario: "general" as const,
      objective: "Respond to the client without ignoring the live support complaint.",
      gmail: {
        threadId: "support-thread-1",
        relationshipId: "support-relationship-1",
        personId: "support-person-1",
        messages: [{
          id: "m1",
          threadId: "support-thread-1",
          sentAt: "2026-09-05T01:00:00.000Z",
          from: { name: "Client", address: "client@example.com" },
          to: [{ name: "Greg", address: "greg@evavo.com.au" }],
          subject: "Still waiting",
          body: "I'm still waiting for help with this.",
        }],
      },
      identity: {
        contract: "business_relationship_identity_resolver_v2" as const,
        status: "verified" as const,
        selected: {
          personId: "support-person-1",
          name: "Client",
          addresses: ["client@example.com"],
          evidence: [{ source: "gmail" as const, ref: "gmail:message:m1", confidence: 100 }],
        },
        confidence: 100,
        exactAddressMatch: true,
        reasons: ["Exact evidence-backed email match."],
        competingPersonIds: [],
      },
      channel: { currentChannel: "email" as const, canResolveInWriting: true },
      evidenceConfidence: 98,
    },
    context: {
      identitySummary: "Client identity verified.",
      communicationSummary: "Client is following up on a live support matter.",
      evidenceItems: [
        {
          id: "support-gmail-current",
          domain: "gmail" as const,
          summary: "Current Gmail thread read.",
          status: "current" as const,
          authority: "canonical" as const,
          observedAt: "2026-09-05T01:00:30.000Z",
          sourceRefs: ["gmail:thread:support-thread-1"],
        },
        {
          id: "support-identity-current",
          domain: "identity" as const,
          summary: "Exact sender identity verified.",
          status: "current" as const,
          authority: "authoritative" as const,
          observedAt: "2026-09-05T01:00:30.000Z",
          sourceRefs: ["gmail:message:m1"],
        },
      ],
    },
  };
}

test("verified live support state binds ticket emotion risk into canonical context", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithSupportContext({
    sourceHydration: sourceHydration(),
    support: support("verified"),
    supportRequired: true,
    supportIdentity: { organisationId: "org_12345678", ticketId: "ticket_12345678" },
  });
  assert.equal(result.supportState, "verified");
  assert.equal(result.supportEvidenceRef, REF);
  const cycle = result.canonical.cycle.canonical.brain.canonicalCycle;
  assert.ok(cycle.decisionContext.evidenceRefs.includes(REF));
  assert.match(cycle.decisionContext.context360.support ?? "", /frustrated/i);
  assert.match(cycle.decisionContext.context360.support ?? "", /urgency high/i);
  assert.ok(cycle.decisionContext.staffBrief.priorities.some((item) => /support\/service context/i.test(item)));
  assert.equal(result.externalEffectPerformed, false);
});

test("required exact support ticket not-found remains unresolved", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithSupportContext({
    sourceHydration: sourceHydration(),
    support: support("not_found"),
    supportRequired: true,
    supportIdentity: { organisationId: "org_12345678", ticketId: "ticket_12345678" },
  });
  assert.equal(result.supportState, "not_found");
  assert.equal(result.canonical.cycle.canonical.brain.canonicalCycle.approvalGradeReady, false);
  assert.ok(result.canonical.cycle.canonical.brain.canonicalCycle.decisionContext.sourceReadiness?.blockingDomains.includes("support"));
});

test("support provider outage remains unknown and blocks", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithSupportContext({
    sourceHydration: sourceHydration(),
    support: support("unavailable"),
    supportRequired: true,
    supportIdentity: { organisationId: "org_12345678", ticketId: "ticket_12345678" },
  });
  assert.equal(result.supportState, "provider_unavailable");
  assert.ok(result.canonical.cycle.canonical.brain.canonicalCycle.decisionContext.sourceReadiness?.blockingDomains.includes("support"));
});

test("support provider is not called when support truth is irrelevant", async () => {
  let calls = 0;
  const port: SupportRelationshipSnapshotPort = {
    contract: "business_support_relationship_snapshot_port_v1",
    async read() { calls += 1; throw new Error("must not run"); },
  };
  const result = await runCanonicalRelationshipManagerCycleWithSupportContext({
    sourceHydration: sourceHydration(),
    support: port,
    supportRequired: false,
    supportIdentity: null,
  });
  assert.equal(result.supportState, "not_required");
  assert.equal(calls, 0);
});