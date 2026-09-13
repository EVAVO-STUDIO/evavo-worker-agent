import assert from "node:assert/strict";
import test from "node:test";

import { createDocumentRelationshipSnapshotPort } from "../src/core/businessDocumentRelationshipSnapshotPort";

const TOKEN = "d".repeat(32);
const DOCUMENT_ID = "11111111-1111-4111-8111-111111111111";
const VERSION_ID = "22222222-2222-4222-8222-222222222222";
const REF = `operations:document-snapshot:${"a".repeat(64)}`;

function verified() {
  return {
    contract: "evavo-relationship-manager-document-snapshot-v1",
    state: "verified",
    workspaceId: "evavo",
    documentId: DOCUMENT_ID,
    observedAt: "2026-09-05T01:00:00.000Z",
    evidenceRef: REF,
    document: {
      id: DOCUMENT_ID,
      title: "Current Proposal",
      purpose: "proposal",
      reviewState: "approved",
      clientName: "Example Client",
      sourceEntityType: "proposal",
      sourceEntityId: "proposal-1",
      commercialClientId: null,
      deliveryProjectId: null,
      versionCount: 2,
      currentVersionNumber: 2,
      payloadReady: true,
      outputFormats: ["pdf"],
      updatedAt: "2026-09-05T00:59:00.000Z",
    },
    currentVersion: {
      id: VERSION_ID,
      versionNumber: 2,
      reviewState: "approved",
      changeSummary: "Approved client version.",
      sourceEvidenceCount: 3,
      outputFormats: ["pdf"],
      payloadReady: true,
      createdAt: "2026-09-05T00:58:00.000Z",
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
}

test("reads exact document/version metadata without document execution authority", async () => {
  let url = "";
  let init: RequestInit | undefined;
  const port = createDocumentRelationshipSnapshotPort({ baseUrl: "http://operations.local/", readToken: TOKEN }, async (input, request) => {
    url = String(input);
    init = request;
    return new Response(JSON.stringify({ ok: true, data: verified() }), { status: 200 });
  });
  const result = await port.read({ workspaceId: "evavo", documentId: DOCUMENT_ID });
  assert.equal(url, "http://operations.local/api/v1/internal/relationship-manager/document-snapshot");
  assert.equal((init?.headers as Record<string, string>).Authorization, `Bearer ${TOKEN}`);
  assert.equal(result.document?.reviewState, "approved");
  assert.equal(result.currentVersion?.versionNumber, 2);
  assert.equal(result.providerWrites, 0);
  assert.equal(result.rendersCompleted, 0);
  assert.equal(result.exportsCreated, 0);
  assert.equal(result.externalSends, 0);
});

test("document/version chronology mismatch fails closed", async () => {
  const port = createDocumentRelationshipSnapshotPort({ baseUrl: "http://operations.local", readToken: TOKEN }, async () => {
    const value = verified();
    return new Response(JSON.stringify({ ok: true, data: { ...value, currentVersion: { ...value.currentVersion, versionNumber: 1 } } }), { status: 200 });
  });
  await assert.rejects(() => port.read({ workspaceId: "evavo", documentId: DOCUMENT_ID }), /CURRENT_VERSION_MISMATCH/);
});

test("provider mutation counters fail closed", async () => {
  const port = createDocumentRelationshipSnapshotPort({ baseUrl: "http://operations.local", readToken: TOKEN }, async () => {
    return new Response(JSON.stringify({ ok: true, data: { ...verified(), exportsCreated: 1 } }), { status: 200 });
  });
  await assert.rejects(() => port.read({ workspaceId: "evavo", documentId: DOCUMENT_ID }), /EFFECT_COUNTER_INVALID/);
});

test("remote document provider error detail is not surfaced", async () => {
  const port = createDocumentRelationshipSnapshotPort({ baseUrl: "http://operations.local", readToken: TOKEN }, async () => {
    return new Response(JSON.stringify({ ok: false, error: { message: "secret supabase detail" } }), { status: 500 });
  });
  await assert.rejects(
    () => port.read({ workspaceId: "evavo", documentId: DOCUMENT_ID }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /READ_FAILED:500/);
      assert.doesNotMatch(error.message, /supabase detail/);
      return true;
    },
  );
});