import assert from "node:assert/strict";
import test from "node:test";

import { communicationDecisionToMemoryCandidate } from "../src/core/businessCommunicationDecisionMemory";
import { buildCommunicationDecisionPackage } from "../src/core/businessCommunicationDecisionPackage";
import { projectGmailThreadToCanonicalRelationshipState } from "../src/core/businessGmailRelationshipStateProjection";
import {
  communicationDecisionCandidateToMemoryObservation,
  gmailRelationshipProjectionToMemoryObservations,
} from "../src/core/businessMemoryIngestionObservation";

const message = {
  id: "gmail-message-1",
  threadId: "gmail-thread-1",
  sentAt: "2026-09-04T00:30:00Z",
  from: { name: "Client", address: "client@example.com" },
  to: [{ name: "Greg", address: "greg@evavo.com.au" }],
  subject: "Delivery status",
  body: "Could you please confirm the delivery status?",
} as const;

test("Gmail provider content stays authoritative while extracted obligation is supporting", () => {
  const projection = projectGmailThreadToCanonicalRelationshipState({
    threadId: "gmail-thread-1",
    messages: [message],
    relationshipId: "relationship-client",
    observedAt: "2026-09-04T00:31:00Z",
  });
  const observations = gmailRelationshipProjectionToMemoryObservations(projection);
  const messageObservation = observations.find((item) => item.kind === "message");
  const obligationObservation = observations.find((item) => item.kind === "obligation");

  assert.equal(messageObservation?.authority, "authoritative");
  assert.equal(messageObservation?.confidence, "verified");
  assert.equal(messageObservation?.sourceRef, "gmail:message:gmail-message-1");
  assert.equal(obligationObservation?.authority, "supporting");
  assert.equal(obligationObservation?.confidence, "supported");
  assert.ok(observations.every((item) => item.entities.some((entity) => entity.kind === "relationship")));
});

test("decision memory becomes a canonical Memory Fabric ingestion observation", () => {
  const decision = buildCommunicationDecisionPackage({
    packageId: "decision-memory-1",
    scenario: "general",
    objective: "Answer current delivery status.",
    thread: {
      threadId: "gmail-thread-1",
      previousState: [],
      latestObservedState: [{
        id: "question-1",
        kind: "question",
        statement: "Could you please confirm the delivery status?",
        status: "open",
        owner: "evavo",
        sourceEvidenceIds: ["gmail:message:gmail-message-1"],
      }],
    },
    obligations: [],
    channel: { currentChannel: "email", canResolveInWriting: true },
    evidenceIds: ["gmail:message:gmail-message-1"],
    evidenceConfidence: 95,
    decisionAt: "2026-09-04T00:32:00Z",
  });
  const candidate = communicationDecisionToMemoryCandidate({
    decision,
    decidedAt: decision.decisionAt,
    relationshipId: "relationship-client",
    threadId: "gmail-thread-1",
  });
  const observation = communicationDecisionCandidateToMemoryObservation(candidate);

  assert.equal(observation.kind, "decision");
  assert.equal(observation.authority, "canonical");
  assert.equal(observation.confidence, "verified");
  assert.equal(observation.material, true);
  assert.ok(observation.entities.some((entity) => entity.kind === "agent" && entity.id === "evavo-worker-agent"));
});
