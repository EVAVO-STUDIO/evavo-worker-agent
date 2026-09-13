import assert from "node:assert/strict";
import test from "node:test";

import { ingestGmailThreadForRelationship } from "../src/core/businessGmailThreadIngestion";

function gmail(body: string, id = "m1") {
  return {
    id,
    threadId: "t1",
    sentAt: "2026-09-04T01:00:00Z",
    from: { name: "Ashley", address: "ASHLEY@example.com" },
    to: [{ name: "Greg", address: "greg@evavo.com.au" }],
    subject: "Graduate enquiry",
    body,
    attachmentNames: [],
  };
}

test("normalises a Gmail thread and creates material memory candidates with real evidence timestamps", () => {
  const result = ingestGmailThreadForRelationship({
    threadId: "t1",
    relationshipId: "rel-ashley",
    personId: "person-ashley",
    messages: [gmail("Could you please let me know if there are any graduate opportunities at EVAVO?")],
  });
  assert.equal(result.normalizedMessages[0]?.sender.address, "ashley@example.com");
  assert.equal(result.analysis.replyNeeded, true);
  assert.ok(result.memoryCandidates.some((candidate) => candidate.kind === "message" && candidate.material));
  const obligation = result.memoryCandidates.find((candidate) => candidate.kind === "obligation");
  assert.ok(obligation);
  assert.equal(obligation?.occurredAt, "2026-09-04T01:00:00.000Z");
  assert.notEqual(obligation?.occurredAt, "1970-01-01T00:00:00.000Z");
});

test("quoted history is removed before latest-message analysis", () => {
  const result = ingestGmailThreadForRelationship({
    threadId: "t1",
    messages: [gmail("Thanks, that answers it.\n\nOn Thu, Greg wrote:\n> Could you send your portfolio?")],
  });
  assert.equal(result.normalizedMessages[0]?.body, "Thanks, that answers it.");
  assert.equal(result.analysis.unansweredQuestions.length, 0);
});

test("simple acknowledgement does not become durable message memory by default", () => {
  const result = ingestGmailThreadForRelationship({ threadId: "t1", messages: [gmail("Thanks!")] });
  const latest = result.memoryCandidates.find((candidate) => candidate.kind === "message");
  assert.equal(latest?.material, false);
});

test("provider messages from another thread are ignored", () => {
  const other = { ...gmail("Can you reply?"), threadId: "other" };
  const result = ingestGmailThreadForRelationship({ threadId: "t1", messages: [other] });
  assert.equal(result.normalizedMessages.length, 0);
});
