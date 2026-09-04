import assert from "node:assert/strict";
import test from "node:test";

import { decideRelationshipStaffInstinct } from "../src/core/businessRelationshipStaffInstincts";

test("does not prolong acknowledgement-only email threads", () => {
  const decision = decideRelationshipStaffInstinct({ senderThanksOnly: true });
  assert.equal(decision.action, "do_not_reply");
  assert.ok(decision.mustDo.some((item) => /prolong the thread/i.test(item)));
});

test("owns and repairs EVAVO mistakes without invented commitments", () => {
  const decision = decideRelationshipStaffInstinct({ evavoMadeError: true });
  assert.equal(decision.action, "repair");
  assert.ok(decision.mustDo.some((item) => /own EVAVO's part/i.test(item)));
  assert.ok(decision.mustDo.some((item) => /verified and authorised/i.test(item)));
});

test("holds scope boundaries while remaining helpful", () => {
  const decision = decideRelationshipStaffInstinct({ requestOutsideScope: true });
  assert.equal(decision.action, "hold_boundary");
  assert.ok(decision.mustDo.some((item) => /helpful/i.test(item)));
  assert.ok(decision.mustAvoid.some((item) => /new scope/i.test(item)));
});

test("follows up with evidence-backed pressure rather than guilt", () => {
  const decision = decideRelationshipStaffInstinct({ paymentOverdue: true, priorFollowUps: 2 });
  assert.equal(decision.action, "follow_up");
  assert.ok(decision.mustDo.some((item) => /increase clarity before increasing pressure/i.test(item)));
  assert.ok(decision.mustAvoid.some((item) => /guilt/i.test(item)));
});

test("answers explicit questions instead of creating avoidable work", () => {
  const decision = decideRelationshipStaffInstinct({ explicitQuestion: true });
  assert.equal(decision.action, "reply");
  assert.ok(decision.mustDo.some((item) => /answer the live question/i.test(item)));
  assert.ok(decision.mustDo.some((item) => /resolve every item/i.test(item)));
});

test("suppression remains a hard do-not-reply rule", () => {
  const decision = decideRelationshipStaffInstinct({ hardSuppression: true, explicitQuestion: true });
  assert.equal(decision.action, "do_not_reply");
  assert.match(decision.reasons[0], /suppression/i);
});
