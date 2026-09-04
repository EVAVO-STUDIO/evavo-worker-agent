import assert from "node:assert/strict";
import test from "node:test";

import { deriveCommunicationLearningCandidates, relationshipDecisionCorrectionRequired } from "../src/core/businessCommunicationHumanFeedback";

test("routes prose feedback to Writing Studio and judgement feedback to Worker", () => {
  const feedback = {
    decisionId: "decision-1",
    approved: true,
    originalDisposition: "reply",
    finalDisposition: "reply",
    editDistance: 0.22,
    reasons: [
      { dimension: "warmth" as const, summary: "Open more warmly for sincere graduate enquiries.", generalisable: true },
      { dimension: "meeting" as const, summary: "Do not suggest a call when email fully resolves the matter.", generalisable: true },
    ],
    evidenceIds: ["gmail:m1", "approval:a1"],
    recordedAt: "2026-09-04T02:50:00Z",
  };
  const candidates = deriveCommunicationLearningCandidates(feedback);
  assert.equal(candidates.length, 2);
  assert.equal(candidates.find((item) => item.dimension === "warmth")?.owner, "evavo-writing-studio");
  assert.equal(candidates.find((item) => item.dimension === "meeting")?.owner, "evavo-worker-agent");
  assert.equal(relationshipDecisionCorrectionRequired(feedback), true);
});

test("non-generalisable one-off edits do not become policy", () => {
  const candidates = deriveCommunicationLearningCandidates({
    decisionId: "decision-2",
    approved: true,
    originalDisposition: "reply",
    finalDisposition: "reply",
    reasons: [{ dimension: "wording", summary: "Use this exact project nickname in this one thread.", generalisable: false }],
    evidenceIds: ["gmail:m2"],
    recordedAt: "2026-09-04T02:50:00Z",
  });
  assert.equal(candidates.length, 0);
});

test("disposition changes always count as decision corrections", () => {
  const feedback = {
    decisionId: "decision-3",
    approved: false,
    originalDisposition: "reply",
    finalDisposition: "do_not_reply",
    reasons: [],
    evidenceIds: ["review:r1"],
    recordedAt: "2026-09-04T02:50:00Z",
  };
  assert.equal(relationshipDecisionCorrectionRequired(feedback), true);
});
