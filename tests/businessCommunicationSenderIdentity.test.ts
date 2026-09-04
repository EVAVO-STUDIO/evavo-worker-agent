import assert from "node:assert/strict";
import test from "node:test";

import {
  renderSenderSignature,
  selectCommunicationSender,
} from "../src/core/businessCommunicationSenderIdentity";

test("preserves sender continuity on an existing thread", () => {
  const result = selectCommunicationSender({ existingThreadSender: "greg" });
  assert.equal(result.sender.key, "greg");
  assert.equal(result.fallbackUsed, false);
});

test("uses Eva for a graduate enquiry when the mailbox is available", () => {
  const result = selectCommunicationSender({
    candidateOrGraduateEnquiry: true,
    senderMailboxAvailable: { eva: true, hello: true, greg: true },
  });
  assert.equal(result.sender.key, "eva");
  assert.equal(result.sender.canCreateCommercialCommitment, false);
  assert.equal(result.sender.transparentDigitalIdentity, true);
});

test("uses Greg for sensitive commitment-bearing communication", () => {
  const result = selectCommunicationSender({
    communicationIsSensitive: true,
    commercialCommitmentRequired: true,
    senderMailboxAvailable: { greg: true, eva: true },
  });
  assert.equal(result.sender.key, "greg");
  assert.equal(result.requiresHumanReview, true);
});

test("falls back instead of inventing a mailbox", () => {
  const result = selectCommunicationSender({
    candidateOrGraduateEnquiry: true,
    senderMailboxAvailable: { eva: false, hello: false, greg: true },
  });
  assert.equal(result.sender.key, "greg");
  assert.equal(result.fallbackUsed, true);
});

test("Eva signature is transparent about the digital relationship role", () => {
  const result = selectCommunicationSender({ candidateOrGraduateEnquiry: true });
  const signature = renderSenderSignature(result.sender);
  assert.match(signature, /Client Relationships/);
  assert.match(signature, /digital relationship manager/i);
});
