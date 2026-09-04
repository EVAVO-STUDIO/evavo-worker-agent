import assert from "node:assert/strict";
import test from "node:test";

import { runCanonicalRelationshipManagerCycleWithBrainContextFromEnv } from "../src/core/businessRelationshipManagerCanonicalBrainContextEnv";

function baseInput() {
  return {
    cycle: {
      cycleId: "cycle-brain-env-1",
      observedAt: "2026-09-04T12:00:30.000Z",
      decisionAt: "2026-09-04T12:01:00.000Z",
      scenario: "general" as const,
      objective: "Answer the current client question.",
      gmail: {
        threadId: "thread-brain-env-1",
        relationshipId: "relationship-brain-env-1",
        personId: "person-brain-env-1",
        messages: [{
          id: "m1",
          threadId: "thread-brain-env-1",
          sentAt: "2026-09-04T12:00:00.000Z",
          from: { name: "Client", address: "client@example.com" },
          to: [{ name: "Greg", address: "greg@evavo.com.au" }],
          subject: "Question",
          body: "Could you confirm the current status?",
        }],
      },
      identity: {
        contract: "business_relationship_identity_resolver_v2" as const,
        status: "verified" as const,
        selected: {
          personId: "person-brain-env-1",
          name: "Client",
          addresses: ["client@example.com"],
          evidence: [{ source: "gmail" as const, ref: "gmail:message:m1", confidence: 100 }],
        },
        confidence: 100,
        exactAddressMatch: true,
        reasons: ["Exact evidence-backed address match."],
        competingPersonIds: [],
      },
      channel: { currentChannel: "email" as const, canResolveInWriting: true },
      evidenceConfidence: 98,
    },
    context: {
      identitySummary: "Client identity verified.",
      communicationSummary: "One current client question requires a response.",
      evidenceItems: [
        {
          id: "identity-current",
          domain: "identity" as const,
          summary: "Exact sender identity verified.",
          status: "current" as const,
          authority: "authoritative" as const,
          observedAt: "2026-09-04T12:00:30.000Z",
          sourceRefs: ["gmail:message:m1"],
        },
        {
          id: "gmail-current",
          domain: "gmail" as const,
          summary: "Current Gmail thread read.",
          status: "current" as const,
          authority: "canonical" as const,
          observedAt: "2026-09-04T12:00:30.000Z",
          sourceRefs: ["gmail:thread:thread-brain-env-1"],
        },
      ],
    },
  };
}

test("missing Brain read configuration becomes provider_unavailable and blocks canonical approval", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithBrainContextFromEnv({
    env: {},
    ...baseInput(),
  });
  assert.equal(result.brainState, "provider_unavailable");
  assert.equal(result.canonicalCycle.approvalGradeReady, false);
  assert.ok(result.canonicalCycle.decisionContext.sourceReadiness?.blockingDomains.includes("memory"));
});

test("partial Brain read configuration fails as deployment misconfiguration", async () => {
  await assert.rejects(
    () => runCanonicalRelationshipManagerCycleWithBrainContextFromEnv({
      env: { BRAIN_BASE_URL: "http://127.0.0.1:4317" },
      ...baseInput(),
    }),
    /BRAIN_READ_ENV_INCOMPLETE/,
  );
  await assert.rejects(
    () => runCanonicalRelationshipManagerCycleWithBrainContextFromEnv({
      env: { BRAIN_API_TOKEN: "b".repeat(32) },
      ...baseInput(),
    }),
    /BRAIN_READ_ENV_INCOMPLETE/,
  );
});
