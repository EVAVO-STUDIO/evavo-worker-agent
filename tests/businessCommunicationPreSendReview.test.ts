import assert from "node:assert/strict";
import test from "node:test";

import { reviewBusinessCommunicationBeforeSend } from "../src/core/businessCommunicationPreSendReview";

const base = {
  channel: "email" as const,
  subject: "Updated scope",
  body: "Hi Naomi,\n\nI've attached the revised scope. It covers the agreed website audit and analytics review.\n\nThanks,\nGreg",
  recipients: [{ name: "Naomi", address: "naomi@example.com", expected: true }],
  expectedRecipientAddresses: ["naomi@example.com"],
  attachments: ["revised-scope.pdf"],
  referencedAttachmentNames: ["revised-scope.pdf"],
  verifiedFacts: ["Scope includes website audit", "Scope includes analytics review"],
  requiredPoints: ["revised scope", "analytics review"],
  sendingEnabled: true,
};

test("passes a complete verified draft", () => {
  const review = reviewBusinessCommunicationBeforeSend(base);
  assert.equal(review.passed, true);
  assert.equal(review.sendAllowed, true);
  assert.equal(review.checks.recipient, true);
  assert.equal(review.checks.attachment, true);
});

test("blocks wrong recipient set", () => {
  const review = reviewBusinessCommunicationBeforeSend({
    ...base,
    recipients: [{ address: "wrong@example.com" }],
  });
  assert.equal(review.sendAllowed, false);
  assert.ok(review.findings.some((item) => item.code === "recipient_mismatch" && item.severity === "blocker"));
});

test("blocks attachment claims when the attachment is missing", () => {
  const review = reviewBusinessCommunicationBeforeSend({
    ...base,
    attachments: [],
    referencedAttachmentNames: ["revised-scope.pdf"],
  });
  assert.equal(review.sendAllowed, false);
  assert.ok(review.findings.some((item) => item.code === "attachment_missing"));
});

test("blocks unresolved placeholders", () => {
  const review = reviewBusinessCommunicationBeforeSend({
    ...base,
    body: "Hi [name],\n\nPlease see the attached file. TODO add final fee.\n\nThanks,\nGreg",
  });
  assert.equal(review.sendAllowed, false);
  assert.ok(review.findings.some((item) => item.code === "placeholder_present"));
});

test("flags generic AI and guarantee language", () => {
  const review = reviewBusinessCommunicationBeforeSend({
    ...base,
    body: "I hope this email finds you well. This revolutionary solution will definitely unlock the power of your business.",
    attachments: [],
    referencedAttachmentNames: [],
    requiredPoints: [],
  });
  assert.equal(review.checks.tone, false);
  assert.equal(review.checks.factual, false);
  assert.ok(review.findings.some((item) => item.code === "generic_ai_tone"));
  assert.ok(review.findings.some((item) => item.code === "overclaim_language"));
});

test("active runtime sending boundary still blocks external delivery", () => {
  const review = reviewBusinessCommunicationBeforeSend({ ...base, sendingEnabled: false });
  assert.equal(review.sendAllowed, false);
  assert.equal(review.checks.policy, false);
  assert.ok(review.findings.some((item) => item.code === "sending_disabled"));
});

test("suppression is a hard send blocker", () => {
  const review = reviewBusinessCommunicationBeforeSend({ ...base, suppressionActive: true });
  assert.equal(review.sendAllowed, false);
  assert.ok(review.findings.some((item) => item.code === "suppression_active"));
});
