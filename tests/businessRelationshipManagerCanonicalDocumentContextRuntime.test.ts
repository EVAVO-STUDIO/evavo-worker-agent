import assert from "node:assert/strict";
import test from "node:test";

import type { DocumentRelationshipSnapshotPort } from "../src/core/businessDocumentRelationshipSnapshotPort";
import { runCanonicalRelationshipManagerCycleWithDocumentContext } from "../src/core/businessRelationshipManagerCanonicalDocumentContextRuntime";
import type { SupportRelationshipSnapshotPort } from "../src/core/businessSupportRelationshipSnapshotPort";

const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const REF = `operations:document-snapshot:${"d".repeat(64)}`;

function documents(mode: "current" | "not_found" | "superseded" | "unavailable"): DocumentRelationshipSnapshotPort {
  return {
    contract: "business_document_relationship_snapshot_port_v2",
    async read() {
      if (mode === "unavailable") throw new Error("DOCUMENT_RELATIONSHIP_READ_UNAVAILABLE");
      if (mode === "not_found") return {
        contract: "evavo-relationship-manager-document-snapshot-v1",
        state: "not_found",
        workspaceId: "evavo",
        documentId: DOCUMENT_ID,
        observedAt: "2026-09-05T01:00:20.000Z",
        evidenceRef: REF,
        document: null,
        currentVersion: null,
        reasons: ["No exact document."],
        providerReads: 2,
        providerWrites: 0,
        editorSessions: 0,
        rendersCompleted: 0,
        exportsCreated: 0,
        externalSends: 0,
        outsideEffects: 0,
      };
      const reviewState = mode === "current" ? "approved" as const : "superseded" as const;
      return {
        contract: "evavo-relationship-manager-document-snapshot-v1",
        state: "verified",
        workspaceId: "evavo",
        documentId: DOCUMENT_ID,
        observedAt: "2026-09-05T01:00:20.000Z",
        evidenceRef: REF,
        document: {
          id: DOCUMENT_ID,
          title: "Proposal",
          purpose: "proposal",
          reviewState,
          clientName: "Example Client",
          sourceEntityType: "proposal",
          sourceEntityId: "proposal-1",
          commercialClientId: null,
          deliveryProjectId: null,
          versionCount: 2,
          currentVersionNumber: 2,
          payloadReady: true,
          outputFormats: ["pdf"],
          updatedAt: "2026-09-05T01:00:00.000Z",
        },
        currentVersion: {
          id: VERSION_ID,
          versionNumber: 2,
          reviewState,
          changeSummary: "Current version.",
          sourceEvidenceCount: 3,
          outputFormats: ["pdf"],
          payloadReady: true,
          createdAt: "2026-09-05T00:59:00.000Z",
        },
        reasons: ["Exact persistent document/version truth resolved."],
        providerReads: 2,
        providerWrites: 0,
        editorSessions: 0,
        rendersCompleted: 0,
        exportsCreated: 0,
        externalSends: 0,
        outsideEffects: 0,
      };
    },
  };
}

function support(): SupportRelationshipSnapshotPort {
  return {
    contract: "business_support_relationship_snapshot_port_v1",
    async read() { throw new Error("support must not be called"); },
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
      cycleId: "document-cycle-1",
      observedAt: "2026-09-05T01:00:30.000Z",
      decisionAt: "2026-09-05T01:01:00.000Z",
      scenario: "general" as const,
      objective: "Answer a question about the current proposal version.",
      gmail: {
        threadId: "document-thread-1",
        relationshipId: "document-relationship-1",
        personId: "document-person-1",
        messages: [{
          id: "m1",
          threadId: "document-thread-1",
          sentAt: "2026-09-05T01:00:00.000Z",
          from: { name: "Client", address: "client@example.com" },
          to: [{ name: "Greg", address: "greg@evavo.com.au" }],
          subject: "Proposal",
          body: "Is the proposal I have the current version?",
        }],
      },
      identity: {
        contract: "business_relationship_identity_resolver_v2" as const,
        status: "verified" as const,
        selected: {
          personId: "document-person-1",
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
      communicationSummary: "Client asks about the current proposal version.",
      evidenceItems: [
        {
          id: "document-gmail",
          domain: "gmail" as const,
          summary: "Current Gmail thread read.",
          status: "current" as const,
          authority: "canonical" as const,
          observedAt: "2026-09-05T01:00:30.000Z",
          sourceRefs: ["gmail:thread:document-thread-1"],
        },
        {
          id: "document-identity",
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

function run(port: DocumentRelationshipSnapshotPort, required = true) {
  return runCanonicalRelationshipManagerCycleWithDocumentContext({
    supportContext: {
      sourceHydration: sourceHydration(),
      supportRequired: false,
      supportIdentity: null,
    },
    support: support(),
    documents: port,
    documentRequired: required,
    documentIdentity: required ? { workspaceId: "evavo", documentId: DOCUMENT_ID } : null,
  });
}

test("current exact document/version metadata binds into canonical context", async () => {
  const result = await run(documents("current"));
  assert.equal(result.contract, "business_relationship_manager_canonical_document_context_runtime_v2");
  assert.equal(result.documentState, "verified");
  assert.equal(result.documentEvidenceRef, REF);
  const cycle = result.support.canonical.cycle.canonical.brain.canonicalCycle;
  assert.ok(cycle.decisionContext.evidenceRefs.includes(REF));
  assert.match(cycle.decisionContext.context360.documents ?? "", /current version 2\/2/i);
  assert.match(cycle.decisionContext.context360.documents ?? "", /attachment bytes remain separately verified/i);
});

test("required exact document not-found remains unresolved", async () => {
  const result = await run(documents("not_found"));
  assert.equal(result.documentState, "not_found");
  assert.ok(result.support.canonical.cycle.canonical.brain.canonicalCycle.decisionContext.sourceReadiness?.blockingDomains.includes("document"));
});

test("superseded document is not accepted as current", async () => {
  const result = await run(documents("superseded"));
  assert.equal(result.documentState, "not_current");
  assert.equal(result.support.canonical.cycle.canonical.brain.canonicalCycle.approvalGradeReady, false);
});

test("document provider is not called when document truth is irrelevant", async () => {
  let calls = 0;
  const port: DocumentRelationshipSnapshotPort = {
    contract: "business_document_relationship_snapshot_port_v2",
    async read() { calls += 1; throw new Error("must not run"); },
  };
  const result = await run(port, false);
  assert.equal(result.documentState, "not_required");
  assert.equal(calls, 0);
});
