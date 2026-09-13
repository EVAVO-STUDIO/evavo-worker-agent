import assert from "node:assert/strict";
import test from "node:test";

import { runCanonicalRelationshipManagerCycleWithSourcesFromEnv } from "../src/core/businessRelationshipManagerCanonicalSourceHydrationEnv";

const CLIENT_ID = "11111111-1111-4111-8111-111111111111";
const PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const ROLE_ID = "33333333-3333-4333-8333-333333333333";

function base(operationsRequired = true, careersRequired = false) {
  return {
    operationsRequired,
    operationsIdentity: operationsRequired ? {
      workspaceId: "evavo",
      commercialClientId: CLIENT_ID,
      projectId: PROJECT_ID,
    } : null,
    careersRequired,
    careersIdentity: careersRequired ? { workspaceId: "evavo", targetRoleId: ROLE_ID } : null,
    cycle: {
      cycleId: "cycle-source-env-1",
      observedAt: "2026-09-04T22:00:30.000Z",
      decisionAt: "2026-09-04T22:01:00.000Z",
      scenario: careersRequired ? "graduate_or_candidate" as const : "general" as const,
      objective: careersRequired
        ? "Answer whether a current role exists."
        : operationsRequired
          ? "Answer the client about current delivery status."
          : "Acknowledge the current message without making an operational claim.",
      gmail: {
        threadId: "thread-source-env-1",
        relationshipId: "relationship-source-env-1",
        personId: "person-source-env-1",
        messages: [{
          id: "m1",
          threadId: "thread-source-env-1",
          sentAt: "2026-09-04T22:00:00.000Z",
          from: { name: careersRequired ? "Candidate" : "Client", address: "person@example.com" },
          to: [{ name: "Greg", address: "greg@evavo.com.au" }],
          subject: careersRequired ? "Graduate role" : "Status",
          body: careersRequired ? "Is the graduate role open?" : operationsRequired ? "Where is the delivery up to?" : "Thanks, noted.",
        }],
      },
      identity: {
        contract: "business_relationship_identity_resolver_v2" as const,
        status: "verified" as const,
        selected: {
          personId: "person-source-env-1",
          name: careersRequired ? "Candidate" : "Client",
          addresses: ["person@example.com"],
          evidence: [{ source: "gmail" as const, ref: "gmail:message:m1", confidence: 100 }],
        },
        confidence: 100,
        exactAddressMatch: true,
        reasons: ["Exact evidence-backed address match."],
        competingPersonIds: [],
      },
      channel: { currentChannel: "email" as const, canResolveInWriting: true },
      ...(careersRequired ? {
        candidate: {
          relationshipId: "relationship-source-env-1",
          personId: "person-source-env-1",
          explicitRoleOpen: false,
          activeRecruitmentProcess: false,
          materialsSupplied: false,
          materialsActuallyReviewed: false,
          relevantSkillsEvidence: false,
          futureRelevanceEvidence: false,
          personalizedEffort: true,
          clearFitEvidence: false,
        },
      } : {}),
      evidenceConfidence: 98,
    },
    context: {
      identitySummary: "Identity verified.",
      communicationSummary: "Current Gmail thread read.",
      evidenceItems: [
        {
          id: "identity-current",
          domain: "identity" as const,
          summary: "Exact sender identity verified.",
          status: "current" as const,
          authority: "authoritative" as const,
          observedAt: "2026-09-04T22:00:30.000Z",
          sourceRefs: ["gmail:message:m1"],
        },
        {
          id: "gmail-current",
          domain: "gmail" as const,
          summary: "Current Gmail thread read.",
          status: "current" as const,
          authority: "canonical" as const,
          observedAt: "2026-09-04T22:00:30.000Z",
          sourceRefs: ["gmail:thread:thread-source-env-1"],
        },
      ],
    },
  };
}

test("missing Brain and required Operations config remain explicit provider_unavailable sources", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithSourcesFromEnv({ env: {}, ...base(true, false) });
  assert.equal(result.contract, "business_relationship_manager_canonical_source_hydration_env_v3");
  assert.equal(result.brainConfigured, false);
  assert.equal(result.operationsConfigured, false);
  assert.equal(result.careersConfigured, false);
  assert.equal(result.cycle.canonical.operationsState, "provider_unavailable");
  assert.equal(result.cycle.canonical.brain.brainState, "provider_unavailable");
  assert.equal(result.cycle.canonical.brain.canonicalCycle.approvalGradeReady, false);
  assert.ok(result.cycle.canonical.brain.canonicalCycle.decisionContext.sourceReadiness?.blockingDomains.includes("operations"));
  assert.ok(result.cycle.canonical.brain.canonicalCycle.decisionContext.sourceReadiness?.blockingDomains.includes("memory"));
  assert.equal(result.externalEffectPerformed, false);
});

test("missing careers config blocks only when careers truth is required", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithSourcesFromEnv({ env: {}, ...base(false, true) });
  assert.equal(result.careersConfigured, false);
  assert.equal(result.cycle.careersState, "provider_unavailable");
  assert.equal(result.cycle.roleTruth, null);
  assert.ok(result.cycle.canonical.brain.canonicalCycle.decisionContext.sourceReadiness?.blockingDomains.includes("careers"));
});

test("Operations and careers configuration are not required when their truth is irrelevant", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithSourcesFromEnv({ env: {}, ...base(false, false) });
  assert.equal(result.operationsConfigured, false);
  assert.equal(result.careersConfigured, false);
  assert.equal(result.cycle.canonical.operationsState, "not_required");
  assert.equal(result.cycle.careersState, "not_required");
  assert.equal(result.cycle.canonical.operationsEvidenceRef, null);
  assert.equal(result.cycle.canonical.brain.brainState, "provider_unavailable");
});

test("partial Brain read configuration fails before any canonical decision", async () => {
  await assert.rejects(() => runCanonicalRelationshipManagerCycleWithSourcesFromEnv({
    env: { BRAIN_BASE_URL: "http://127.0.0.1:4317" }, ...base(false, false),
  }), /BRAIN_READ_ENV_INCOMPLETE/);
  await assert.rejects(() => runCanonicalRelationshipManagerCycleWithSourcesFromEnv({
    env: { BRAIN_API_TOKEN: "b".repeat(32) }, ...base(false, false),
  }), /BRAIN_READ_ENV_INCOMPLETE/);
});

test("source token without shared Operations base URL is deployment misconfiguration", async () => {
  await assert.rejects(() => runCanonicalRelationshipManagerCycleWithSourcesFromEnv({
    env: { OPERATIONS_RELATIONSHIP_READ_TOKEN: "o".repeat(32) }, ...base(true, false),
  }), /OPERATIONS_READ_ENV_INCOMPLETE/);
  await assert.rejects(() => runCanonicalRelationshipManagerCycleWithSourcesFromEnv({
    env: { OPERATIONS_CAREERS_READ_TOKEN: "c".repeat(32) }, ...base(false, true),
  }), /CAREERS_READ_ENV_INCOMPLETE/);
});

test("shared Operations base URL alone does not force unused source credentials", async () => {
  const result = await runCanonicalRelationshipManagerCycleWithSourcesFromEnv({
    env: { OPERATIONS_CORE_BASE_URL: "http://127.0.0.1:3000" }, ...base(false, false),
  });
  assert.equal(result.operationsConfigured, false);
  assert.equal(result.careersConfigured, false);
  assert.equal(result.cycle.canonical.operationsState, "not_required");
  assert.equal(result.cycle.careersState, "not_required");
});
