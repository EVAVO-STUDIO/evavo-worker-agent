import assert from "node:assert/strict";
import test from "node:test";

import { buildRelationshipDecisionTrace } from "../src/core/businessRelationshipDecisionTrace";

test("records evidence, conduct, alternatives and channel reasoning without duplicates", () => {
  const trace = buildRelationshipDecisionTrace({
    traceId: "trace-ashley-1",
    createdAt: "2026-09-04T11:30:00+10:00",
    relationshipId: "relationship-ashley",
    threadId: "thread-ashley",
    objective: "Decide how EVAVO should respond to a graduate enquiry.",
    evidenceIds: ["email-1", "email-1", "context-1"],
    evidenceConfidence: 94,
    factsBelieved: ["The sender is a graduate seeking an opportunity.", "The sender is a graduate seeking an opportunity."],
    uncertainties: ["No confirmed open role is known."],
    conductRulesApplied: ["be_kind", "async_first", "be_kind"],
    staffInstinctsApplied: ["answer_directly", "avoid_unapproved_commitment"],
    alternativesConsidered: [
      { action: "set_up_meeting", rejectedBecause: "No evidence that a meeting adds value yet." },
      { action: "ignore", rejectedBecause: "A sincere direct enquiry warrants a useful response." },
    ],
    channelDecision: {
      channel: "email",
      meetingConsidered: true,
      meetingJustified: false,
      reasons: ["The enquiry can be handled clearly in writing."],
    },
    finalDecision: {
      disposition: "reply",
      reason: "A kind, useful email can answer the enquiry without promising a role or creating a meeting.",
      confidence: 92,
      requiresHumanApproval: true,
    },
  });

  assert.equal(trace.contract, "business_relationship_decision_trace_v1");
  assert.deepEqual(trace.evidenceIds, ["email-1", "context-1"]);
  assert.deepEqual(trace.conductRulesApplied, ["be_kind", "async_first"]);
  assert.equal(trace.channelDecision?.meetingJustified, false);
  assert.equal(trace.finalDecision.disposition, "reply");
});

test("rejects invalid confidence", () => {
  assert.throws(() => buildRelationshipDecisionTrace({
    traceId: "trace-1",
    createdAt: "2026-09-04T11:30:00+10:00",
    objective: "Test",
    evidenceIds: [],
    evidenceConfidence: 101,
    factsBelieved: [],
    uncertainties: [],
    conductRulesApplied: [],
    staffInstinctsApplied: [],
    alternativesConsidered: [],
    channelDecision: null,
    finalDecision: { disposition: "defer", reason: "Insufficient evidence.", confidence: 50, requiresHumanApproval: true },
  }), /EVIDENCE_CONFIDENCE_INVALID/);
});
