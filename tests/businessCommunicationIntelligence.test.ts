import assert from "node:assert/strict";
import test from "node:test";

import { analyseBusinessCommunicationThread } from "../src/core/businessCommunicationIntelligence";

function message(body: string, overrides: Record<string, unknown> = {}) {
  return {
    id: "m1",
    sentAt: "2026-09-04T00:00:00Z",
    sender: { name: "Naomi Example", address: "naomi@example.com", organization: "Example Co" },
    to: [{ name: "Greg", address: "greg@evavo.com.au", organization: "EVAVO" }],
    subject: "Next steps",
    body,
    attachments: [],
    ...overrides,
  };
}

test("recognises a concrete action request and extracts obligations", () => {
  const result = analyseBusinessCommunicationThread({
    threadId: "t1",
    messages: [message("Could you please send the revised scope tomorrow and confirm the updated fee?")],
  });
  assert.equal(result.primaryIntent, "commercial");
  assert.equal(result.replyNeeded, true);
  assert.equal(result.recommendedAction, "draft_reply");
  assert.ok(result.obligations.length >= 1);
  assert.ok(result.unansweredQuestions.length >= 1);
  assert.ok(result.factualClaimsToVerify.some((item) => /fee/i.test(item)));
});

test("sensitive relationship language forces review", () => {
  const result = analyseBusinessCommunicationThread({
    threadId: "t2",
    messages: [message("We're disappointed this is late and need an explanation today.")],
  });
  assert.equal(result.primaryIntent, "relationship_repair");
  assert.equal(result.relationshipSensitivity, "sensitive");
  assert.equal(result.replyUrgency, "high");
  assert.equal(result.recommendedAction, "ask_for_review");
});

test("a simple thanks does not manufacture unnecessary work", () => {
  const result = analyseBusinessCommunicationThread({
    threadId: "t3",
    messages: [message("Thanks!")],
  });
  assert.equal(result.primaryIntent, "acknowledgement");
  assert.equal(result.replyNeeded, false);
  assert.equal(result.recommendedAction, "no_reply");
});

test("weak participant identity prevents confident drafting", () => {
  const result = analyseBusinessCommunicationThread({
    threadId: "t4",
    messages: [message("Can you confirm the quote?", { sender: { name: "Someone" }, to: [{}] })],
  });
  assert.ok(result.recipientConfidence < 70);
  assert.equal(result.recommendedAction, "ask_for_review");
  assert.ok(result.risks.some((item) => /identity/i.test(item)));
});

test("attachment references create explicit verification work", () => {
  const result = analyseBusinessCommunicationThread({
    threadId: "t5",
    messages: [message("Please review the attached proposal and let me know if the scope is approved.", { attachments: ["proposal.pdf"] })],
  });
  assert.ok(result.attachmentChecks.length >= 1);
  assert.ok(result.factualClaimsToVerify.some((item) => /scope/i.test(item)));
});
