import assert from "node:assert/strict";
import test from "node:test";

import { createSupportRelationshipSnapshotPort } from "../src/core/businessSupportRelationshipSnapshotPort";

const TOKEN = "s".repeat(32);
const ORG = "org_12345678";
const TICKET = "ticket_12345678";
const REF = `support:relationship-snapshot:${"a".repeat(64)}`;

function snapshot() {
  return {
    contract: "evavo-relationship-manager-support-snapshot-v1",
    state: "verified",
    organisationId: ORG,
    ticketId: TICKET,
    conversationId: "conv_12345678",
    observedAt: "2026-09-05T01:00:00.000Z",
    evidenceRef: REF,
    ticket: {
      status: "OPEN",
      priority: "HIGH",
      category: "COMPLAINT",
      title: "Still waiting",
      internalSummary: "Customer is waiting on a response.",
      suggestedAction: "Review and respond.",
      dueAt: null,
      updatedAt: "2026-09-05T00:59:00.000Z",
    },
    latestCustomerMessage: "I'm frustrated that I'm still waiting.",
    latestCustomerMessageAt: "2026-09-05T00:58:00.000Z",
    emotionRisk: {
      emotionState: "frustrated",
      urgency: "high",
      humanInterventionHint: "soon",
      signals: ["emotion:frustrated", "priority:high", "category:complaint"],
    },
    providerReads: 1,
    providerWrites: 0,
    outboundMessages: 0,
    ticketMutations: 0,
    outsideEffects: 0,
  };
}

test("reads exact scoped support snapshot without mutation authority", async () => {
  let seenUrl = "";
  let seenInit: RequestInit | undefined;
  const port = createSupportRelationshipSnapshotPort({
    baseUrl: "http://support.local/",
    readToken: TOKEN,
  }, async (url, init) => {
    seenUrl = String(url);
    seenInit = init;
    return new Response(JSON.stringify({ ok: true, data: snapshot() }), { status: 200 });
  });
  const result = await port.read({ organisationId: ORG, ticketId: TICKET });
  assert.equal(seenUrl, "http://support.local/api/internal/relationship-manager/support-snapshot");
  assert.equal((seenInit?.headers as Record<string, string>).Authorization, `Bearer ${TOKEN}`);
  assert.deepEqual(JSON.parse(String(seenInit?.body)), { organisationId: ORG, ticketId: TICKET });
  assert.equal(result.state, "verified");
  assert.equal(result.emotionRisk?.emotionState, "frustrated");
  assert.equal(result.emotionRisk?.humanInterventionHint, "soon");
  assert.equal(result.providerWrites, 0);
  assert.equal(result.outboundMessages, 0);
  assert.equal(result.ticketMutations, 0);
});

test("provider effect counters fail closed", async () => {
  const port = createSupportRelationshipSnapshotPort({ baseUrl: "http://support.local", readToken: TOKEN }, async () => {
    return new Response(JSON.stringify({ ok: true, data: { ...snapshot(), outboundMessages: 1 } }), { status: 200 });
  });
  await assert.rejects(() => port.read({ organisationId: ORG, ticketId: TICKET }), /EFFECT_COUNTER_INVALID/);
});

test("future or internally inconsistent support chronology fails closed", async () => {
  const port = createSupportRelationshipSnapshotPort({ baseUrl: "http://support.local", readToken: TOKEN }, async () => {
    const value = snapshot();
    return new Response(JSON.stringify({
      ok: true,
      data: { ...value, ticket: { ...value.ticket, updatedAt: "2026-09-05T01:00:01.000Z" } },
    }), { status: 200 });
  });
  await assert.rejects(() => port.read({ organisationId: ORG, ticketId: TICKET }), /UPDATED_AFTER_SNAPSHOT/);
});

test("remote support error detail is not surfaced", async () => {
  const port = createSupportRelationshipSnapshotPort({ baseUrl: "http://support.local", readToken: TOKEN }, async () => {
    return new Response(JSON.stringify({ ok: false, error: { message: "sensitive database path" } }), { status: 500 });
  });
  await assert.rejects(
    () => port.read({ organisationId: ORG, ticketId: TICKET }),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.match(error.message, /READ_FAILED:500/);
      assert.doesNotMatch(error.message, /database path/);
      return true;
    },
  );
});