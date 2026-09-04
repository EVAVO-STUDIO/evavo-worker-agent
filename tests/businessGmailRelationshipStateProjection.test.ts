import assert from "node:assert/strict";
import test from "node:test";

import { projectGmailThreadToCanonicalRelationshipState } from "../src/core/businessGmailRelationshipStateProjection";

const message = {
  id: "message-1",
  threadId: "thread-1",
  sentAt: "2026-09-04T00:30:00Z",
  from: { name: "Ashley", address: "ashley@example.com" },
  to: [{ name: "Greg", address: "greg@evavo.com.au" }],
  subject: "Graduate enquiry",
  body: "Could you please confirm whether there is a current graduate opening? Please let me know if you need anything else from me.\n\nOn Thu, Greg wrote:\n> Earlier quoted question?",
  attachmentNames: [],
} as const;

test("Gmail question and request project into canonical thread and obligation state", () => {
  const result = projectGmailThreadToCanonicalRelationshipState({
    threadId: "thread-1",
    messages: [message],
    relationshipId: "relationship-ashley",
    personId: "person-ashley",
    observedAt: "2026-09-04T00:31:00Z",
  });

  assert.equal(result.contract, "business_gmail_relationship_state_projection_v1");
  assert.deepEqual(result.normalizedMessageIds, ["message-1"]);
  assert.ok(result.latestObservedThreadState.length >= 1);
  assert.ok(result.latestObservedThreadState.every((item) => item.sourceEvidenceIds.includes("gmail:message:message-1")));
  assert.ok(result.obligations.length >= 1);
  assert.ok(result.obligations.every((item) => item.relationshipId === "relationship-ashley"));
  assert.ok(result.sourceEvidenceIds.includes("gmail:message:message-1"));
  assert.equal(result.obligationLedger.nextActionOwner, "evavo");
});

test("projection IDs are deterministic on replay", () => {
  const first = projectGmailThreadToCanonicalRelationshipState({
    threadId: "thread-1",
    messages: [message],
    observedAt: "2026-09-04T00:31:00Z",
  });
  const replay = projectGmailThreadToCanonicalRelationshipState({
    threadId: "thread-1",
    messages: [message],
    observedAt: "2026-09-04T00:32:00Z",
  });

  assert.deepEqual(first.latestObservedThreadState.map((item) => item.id), replay.latestObservedThreadState.map((item) => item.id));
  assert.deepEqual(first.obligations.map((item) => item.id), replay.obligations.map((item) => item.id));
});

test("an earlier open item disappearing from latest observation is not falsely resolved", () => {
  const initial = projectGmailThreadToCanonicalRelationshipState({
    threadId: "thread-1",
    messages: [message],
    observedAt: "2026-09-04T00:31:00Z",
  });
  const followup = {
    ...message,
    id: "message-2",
    sentAt: "2026-09-04T01:00:00Z",
    body: "Thanks for the update.",
  };
  const later = projectGmailThreadToCanonicalRelationshipState({
    threadId: "thread-1",
    messages: [message, followup],
    previousThreadState: initial.latestObservedThreadState,
    previousObligations: initial.obligations,
    observedAt: "2026-09-04T01:01:00Z",
  });

  assert.equal(later.threadDelta.resolvedItems.length, 0);
  assert.ok(later.threadDelta.disappearedWithoutResolution.length >= 1);
  assert.ok(later.obligations.length >= initial.obligations.length);
});

test("quoted history does not become a new live question", () => {
  const quotedOnly = {
    ...message,
    id: "message-quoted",
    body: "Thanks.\n\nOn Thu, Greg wrote:\n> Could you confirm the budget?",
  };
  const result = projectGmailThreadToCanonicalRelationshipState({
    threadId: "thread-1",
    messages: [quotedOnly],
    observedAt: "2026-09-04T00:31:00Z",
  });
  assert.equal(result.latestObservedThreadState.length, 0);
});
