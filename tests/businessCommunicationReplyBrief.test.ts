import assert from "node:assert/strict";
import test from "node:test";

import { buildBusinessCommunicationReplyBrief } from "../src/core/businessCommunicationReplyBrief";
import type { CommunicationAnalysis } from "../src/core/businessCommunicationIntelligence";

function analysis(overrides: Partial<CommunicationAnalysis> = {}): CommunicationAnalysis {
  return {
    contract: "business_communication_intelligence_v1",
    threadId: "t1",
    latestMessageId: "m1",
    primaryIntent: "commercial",
    replyNeeded: true,
    replyUrgency: "normal",
    recipientConfidence: 95,
    threadConfidence: 90,
    relationshipSensitivity: "careful",
    obligations: [],
    unansweredQuestions: ["Can you confirm the revised fee?"],
    factualClaimsToVerify: ["The revised fee is AUD 5,000."],
    attachmentChecks: [],
    toneGuidance: ["Be concise and specific."],
    responseGoals: ["Separate confirmed scope, assumptions, exclusions, price and next step."],
    risks: [],
    uncertainties: [],
    recommendedAction: "draft_reply",
    ...overrides,
  };
}

test("builds a concise commercial reply brief with verification constraints", () => {
  const brief = buildBusinessCommunicationReplyBrief(analysis());
  assert.equal(brief.shouldDraft, true);
  assert.equal(brief.targetLength, "normal");
  assert.ok(brief.responsePoints.some((item) => /confirm the revised fee/i.test(item)));
  assert.ok(brief.commitmentsToAvoid.some((item) => /price/i.test(item)));
  assert.ok(brief.factsToVerify.some((item) => /5,000/i.test(item)));
});

test("information-only communication does not encourage drafting", () => {
  const brief = buildBusinessCommunicationReplyBrief(analysis({
    primaryIntent: "information_only",
    replyNeeded: false,
    recommendedAction: "no_reply",
    unansweredQuestions: [],
    responseGoals: ["Do not reply unless useful."],
  }));
  assert.equal(brief.shouldDraft, false);
  assert.equal(brief.targetLength, "one_line");
});
