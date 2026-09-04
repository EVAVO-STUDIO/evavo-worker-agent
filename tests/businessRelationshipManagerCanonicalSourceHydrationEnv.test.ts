import assert from "node:assert/strict";
import test from "node:test";

import { runCanonicalRelationshipManagerCycleWithSourcesFromEnv } from "../src/core/businessRelationshipManagerCanonicalSourceHydrationEnv";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";

function base(operationsRequired = true) {
  return {
    operationsRequired,
    operationsIdentity: operationsRequired ? {
      workspaceId: "evavo",
      commercialClientId: CLIENT_ID,
      projectId: PROJECT_ID,
    } : null,
    cycle: {
      cycleId: "cycle-source-env-1",
      observedAt: "2026-09-05T00:00:30.000Z",
      decisionAt: "2026-09-05T00:01:00.000Z",
      scenario: "general" as const,
      objective: operationsRequired
        ? "Answer the client about current delivery status."
        : "Acknowledge the current message without making an operational claim.",
      gmail: {
        threadId: "thread-source-env-1",
        relationshipId: "relationship-source-env-1",
        personId: "person-source-env-1",
        messages: [{
          id: "m1",
          threadId: "thread-source-env-1",
          sentAt: "2026-09-05T00:00:00.000Z",
          from: { name: "Client", address: "client@example.com" },
          to: [{ name: "Greg", address: "greg@evavo.com.au" }],
          subject: "Status",
          body: operationsRequired ? "Where is the delivery up to?" : "Thanks, noted.",
        }],
      },
      identity: {
        contract: "business_relationship_identity_resolver_v2" as const,
        status: "verified" as const,
        selected: {
          personId: "person-source-env-1",
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
      communicationSummary: "Current Gmail thread read.",
      evidenceItems: [
        {
          id: "identity-current",
          domain: "identity" as const,
          summary: "Exact sender identity verified.",
          status: "current" as const,
          authority: "authoritative" as const,
          observedAt: "2026-09-05T00:00:30.000Z",
          sourceRefs: ["gmail:message:m1"],
        },
        {
          id: "gmail-current",
          domain: "gmail" as const,
          summary: "Current Gmail thread read.",
          status: "current" as const,
          authority: "canonical" as const,
          observedAt: "2026-09-05T00:00:30.000Z",
          sourceRefs: ["gmail:thread:thread-source-env-1"],
        },
      ],
    },
  };
}

test("missing Brain and required Operations config remain explicit provider_unavailable sources", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithSourcesFromEnv({
    env: {},
    ...base(true),
  });
  assert.equal(result.contract, "business_relationship_manager_canonical_source_hydration_env_v1");
  assert.equal(result.brainConfigured, false);
  assert.equal(result.operationsConfigured, false);
  assert.equal(result.cycle.operationsState, "provider_unavailable");
  assert.equal(result.cycle.brain.brainState, "provider_unavailable");
  assert.equal(result.cycle.brain.canonicalCycle.approvalGradeReady, false);
  assert.ok(result.cycle.brain.canonicalCycle.decisionContext.sourceReadiness?.blockingDomains.includes("operations"));
  assert.ok(result.cycle.brain.canonicalCycle.decisionContext.sourceReadiness?.blockingDomains.includes("memory"));
  assert.equal(result.externalEffectPerformed, false);
});

test("Operations configuration is not required or queried when operational truth is irrelevant", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithSourcesFromEnv({
    env: {},
    ...base(false),
  });
  assert.equal(result.operationsConfigured, false);
  assert.equal(result.cycle.operationsState, "not_required");
  assert.equal(result.cycle.operationsEvidenceRef, null);
  assert.equal(result.cycle.brain.brainState, "provider_unavailable");
});

test("partial Brain read configuration fails before any canonical decision", async () => {
  await assert.rejects(
    () => runCanonicalRelationshipManagerCycleWithSourcesFromEnv({
      env: { BRAIN_BASE_URL: "http://127.0.0.1:4317" },
      ...base(false),
    }),
    /BRAIN_READ_ENV_INCOMPLETE/,
  );
  await assert.rejects(
    () => runCanonicalRelationshipManagerCycleWithSourcesFromEnv({
      env: { BRAIN_API_TOKEN: "b".repeat(32) },
      ...base(false),
    }),
    /BRAIN_READ_ENV_INCOMPLETE/,
  );
});

test("partial Operations read configuration fails as deployment misconfiguration even before it can be trusted", async () => {
  await assert.rejects(
    () => runCanonicalRelationshipManagerCycleWithSourcesFromEnv({
      env: { OPERATIONS_CORE_BASE_URL: "http://127.0.0.1:3000" },
      ...base(true),
    }),
    /OPERATIONS_READ_ENV_INCOMPLETE/,
  );
  await assert.rejects(
    () => runCanonicalRelationshipManagerCycleWithSourcesFromEnv({
      env: { OPERATIONS_RELATIONSHIP_READ_TOKEN: "o".repeat(32) },
      ...base(true),
    }),
    /OPERATIONS_READ_ENV_INCOMPLETE/,
  );
});
