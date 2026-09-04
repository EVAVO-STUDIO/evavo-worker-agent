import assert from "node:assert/strict";
import test from "node:test";

import {
  createCommunicationSendEnvelope,
  verifyCommunicationSendEnvelope,
} from "../src/core/businessCommunicationSendEnvelope";

const base = {
  sender: "greg@evavo.com.au",
  to: ["ashley@example.com"],
  cc: [],
  bcc: [],
  threadId: "thread-1",
  replyMessageId: "message-1",
  subject: "Re: Graduate enquiry",
  body: "Hi Ashley,\n\nThanks for reaching out.\n\nKind regards,\nGreg",
  attachments: [],
} as const;

function envelope() {
  return createCommunicationSendEnvelope({
    envelopeId: "approval-1",
    approvedAt: "2026-09-04T01:00:00Z",
    expiresAt: "2026-09-04T02:00:00Z",
    approvedBy: "greg",
    material: base,
  });
}

test("exact approved material verifies", () => {
  assert.equal(verifyCommunicationSendEnvelope(envelope(), base, new Date("2026-09-04T01:30:00Z")).ok, true);
});

test("body change invalidates approval", () => {
  const result = verifyCommunicationSendEnvelope(envelope(), { ...base, body: `${base.body}\nExtra sentence.` }, new Date("2026-09-04T01:30:00Z"));
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes("approved_material_changed"));
});

test("recipient change invalidates approval", () => {
  const result = verifyCommunicationSendEnvelope(envelope(), { ...base, to: ["different@example.com"] }, new Date("2026-09-04T01:30:00Z"));
  assert.equal(result.ok, false);
});

test("attachment identity or hash change invalidates approval", () => {
  const approved = createCommunicationSendEnvelope({
    envelopeId: "approval-2",
    approvedAt: "2026-09-04T01:00:00Z",
    expiresAt: "2026-09-04T02:00:00Z",
    approvedBy: "greg",
    material: {
      ...base,
      attachments: [{ artifactId: "doc-1", filename: "portfolio.pdf", sha256: "a".repeat(64) }],
    },
  });
  const candidate = {
    ...approved.material,
    attachments: [{ artifactId: "doc-1", filename: "portfolio.pdf", sha256: "b".repeat(64) }],
  };
  assert.equal(verifyCommunicationSendEnvelope(approved, candidate, new Date("2026-09-04T01:30:00Z")).ok, false);
});

test("expired approval cannot be used", () => {
  const result = verifyCommunicationSendEnvelope(envelope(), base, new Date("2026-09-04T03:00:00Z"));
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes("approval_expired"));
});
