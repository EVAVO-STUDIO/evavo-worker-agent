import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_RELATIONSHIP_CONDUCT_POLICY,
  decideRelationshipCommunicationChannel,
  relationshipConductInstructions,
} from "../src/core/businessRelationshipConductPolicy";

test("core conduct makes kindness and respect non-optional", () => {
  assert.equal(DEFAULT_RELATIONSHIP_CONDUCT_POLICY.baseline.beKind, true);
  assert.equal(DEFAULT_RELATIONSHIP_CONDUCT_POLICY.baseline.beRespectful, true);
  assert.equal(DEFAULT_RELATIONSHIP_CONDUCT_POLICY.baseline.beHelpful, true);
  assert.equal(DEFAULT_RELATIONSHIP_CONDUCT_POLICY.baseline.preserveDignity, true);
  assert.equal(DEFAULT_RELATIONSHIP_CONDUCT_POLICY.baseline.kindnessDoesNotOverrideBoundaries, true);
  assert.ok(relationshipConductInstructions().some((item) => /kind, respectful and useful/i.test(item)));
});

test("ordinary resolvable matters stay asynchronous by default", () => {
  const decision = decideRelationshipCommunicationChannel({
    currentChannel: "email",
    canResolveInWriting: true,
  });
  assert.equal(decision.recommendedChannel, "email");
  assert.equal(decision.synchronousRecommended, false);
  assert.equal(decision.meetingJustified, false);
});

test("does not turn a difficult question into an unnecessary meeting", () => {
  const decision = decideRelationshipCommunicationChannel({
    currentChannel: "email",
    complexAmbiguity: false,
    needsRealTimeBackAndForth: false,
    canResolveInWriting: true,
  });
  assert.equal(decision.meetingJustified, false);
  assert.ok(decision.avoid.some((item) => /substitute for answering a question/i.test(item)));
});

test("allows synchronous discussion when it has clear incremental value", () => {
  const decision = decideRelationshipCommunicationChannel({
    currentChannel: "email",
    canResolveInWriting: false,
    activeConflictOrRepair: true,
    needsRealTimeBackAndForth: true,
  });
  assert.equal(decision.synchronousRecommended, true);
  assert.equal(decision.meetingJustified, true);
  assert.ok(decision.reasons.some((item) => /relationship repair/i.test(item)));
});

test("respects an explicit meeting request without making meetings the default", () => {
  const decision = decideRelationshipCommunicationChannel({
    explicitMeetingRequest: true,
    canResolveInWriting: true,
  });
  assert.equal(decision.meetingJustified, true);
  assert.equal(DEFAULT_RELATIONSHIP_CONDUCT_POLICY.channelStrategy.defaultMode, "async_first");
});
