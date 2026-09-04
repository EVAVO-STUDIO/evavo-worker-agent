import assert from "node:assert/strict";
import test from "node:test";

import {
  createCommunicationSendEnvelope,
  verifyCommunicationApprovalBinding,
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
    senderKey: "greg",
    mailboxKey: "greg",
    decisionPackageId: "decision-package-1",
    evidenceIds: ["gmail:message-1", "worker:decision-package-1"],
  });
}

test("exact approved material verifies", () => {
  assert.equal(verifyCommunicationSendEnvelope(envelope(), base, new Date("2026-09-04T01:30:00Z")).ok, true);
  assert.equal(verifyCommunicationApprovalBinding(envelope()).ok, true);
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

test("attachment identity, version or hash change invalidates approval", () => {
  const approved = createCommunicationSendEnvelope({
    envelopeId: "approval-2",
    approvedAt: "2026-09-04T01:00:00Z",
    expiresAt: "2026-09-04T02:00:00Z",
    approvedBy: "greg",
    material: {
      ...base,
      attachments: [{ artifactId: "doc-1", filename: "portfolio.pdf", sha256: "a".repeat(64), versionRef: "v1" }],
    },
    senderKey: "greg",
    mailboxKey: "greg",
    decisionPackageId: "decision-package-2",
    evidenceIds: ["docs:portfolio:v1"],
  });
  const candidate = {
    ...approved.material,
    attachments: [{ artifactId: "doc-1", filename: "portfolio.pdf", sha256: "b".repeat(64), versionRef: "v2" }],
  };
  assert.equal(verifyCommunicationSendEnvelope(approved, candidate, new Date("2026-09-04T01:30:00Z")).ok, false);
});

test("approval is expired at the exact expiry instant", () => {
  const result = verifyCommunicationSendEnvelope(envelope(), base, new Date("2026-09-04T02:00:00Z"));
  assert.equal(result.ok, false);
  assert.ok(result.reasons.includes("approval_expired"));
});

test("legacy material-only envelope remains readable but has no approval-grade binding", () => {
  const legacy = createCommunicationSendEnvelope({
    envelopeId: "legacy",
    approvedAt: "2026-09-04T01:00:00Z",
    expiresAt: "2026-09-04T02:00:00Z",
    approvedBy: "greg",
    material: base,
  });
  assert.equal(verifyCommunicationSendEnvelope(legacy, base, new Date("2026-09-04T01:30:00Z")).ok, true);
  assert.deepEqual(verifyCommunicationApprovalBinding(legacy), { ok: false, reasons: ["approval_binding_missing"] });
});

test("recipient order and case normalize without changing the semantic approval", () => {
  const material = {
    ...base,
    to: ["Second@Example.com", "ashley@example.com"],
  };
  const approved = createCommunicationSendEnvelope({
    envelopeId: "approval-order",
    approvedAt: "2026-09-04T01:00:00Z",
    expiresAt: "2026-09-04T02:00:00Z",
    approvedBy: "greg",
    material,
    senderKey: "greg",
    mailboxKey: "greg",
    decisionPackageId: "decision-package-order",
    evidenceIds: ["gmail:message-1"],
  });
  const reordered = { ...material, to: ["ASHLEY@EXAMPLE.COM", "second@example.com"] };
  assert.equal(verifyCommunicationSendEnvelope(approved, reordered, new Date("2026-09-04T01:30:00Z")).ok, true);
});
