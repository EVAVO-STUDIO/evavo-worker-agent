import assert from "node:assert/strict";
import test from "node:test";

import { deriveCommunicationLearningCandidates, relationshipDecisionCorrectionRequired } from "../src/core/businessCommunicationHumanFeedback";

const base = {
  decisionId: "decision-1",
  approved: true,
  originalDisposition: "reply",
  finalDisposition: "reply",
  evidenceIds: ["gmail:m1", "approval:a1"],
  recordedAt: "2026-09-04T02:50:00Z",
} as const;

test("routes prose feedback to Writing Studio and judgement feedback to Worker", () => {
  const feedback = {
    ...base,
    editDistance: 0.22,
    reasons: [
      { dimension: "warmth" as const, summary: "Open more warmly for sincere graduate enquiries.", generalisable: true },
      { dimension: "meeting" as const, summary: "Do not suggest a call when email fully resolves the matter.", generalisable: true },
    ],
  };
  const candidates = deriveCommunicationLearningCandidates(feedback);
  assert.equal(candidates.length, 2);
  assert.equal(candidates.find((item) => item.dimension === "warmth")?.owner, "evavo-writing-studio");
  assert.equal(candidates.find((item) => item.dimension === "meeting")?.owner, "evavo-worker-agent");
  assert.equal(candidates[0]?.scope, "relationship");
  assert.equal(candidates[0]?.strength, "correction");
  assert.equal(candidates[0]?.eligibleForGlobalPromotion, false);
  assert.equal(relationshipDecisionCorrectionRequired(feedback), true);
});

test("non-generalisable one-off edits do not become policy", () => {
  const candidates = deriveCommunicationLearningCandidates({
    ...base,
    decisionId: "decision-2",
    reasons: [{ dimension: "wording", summary: "Use this exact project nickname in this one thread.", generalisable: false }],
    evidenceIds: ["gmail:m2"],
  });
  assert.equal(candidates.length, 0);
});

test("disposition changes always count as decision corrections", () => {
  const feedback = {
    ...base,
    decisionId: "decision-3",
    approved: false,
    finalDisposition: "do_not_reply",
    reasons: [],
    evidenceIds: ["review:r1"],
  };
  assert.equal(relationshipDecisionCorrectionRequired(feedback), true);
});

test("blank evidence and invalid edit distance fail closed", () => {
  assert.throws(() => deriveCommunicationLearningCandidates({
    ...base,
    evidenceIds: [" ", ""],
    reasons: [],
  }), /EVIDENCE_REQUIRED/);
  assert.throws(() => deriveCommunicationLearningCandidates({
    ...base,
    editDistance: 1.5,
    reasons: [],
  }), /EDIT_DISTANCE_INVALID/);
});

test("single correction cannot claim segment or global policy scope", () => {
  assert.throws(() => deriveCommunicationLearningCandidates({
    ...base,
    scope: "global",
    strength: "correction",
    reasons: [{ dimension: "tone", summary: "Always use this tone.", generalisable: true }],
  }), /BROAD_SCOPE_REQUIRES_STRONGER_EVIDENCE/);
});

test("explicit human rule may become globally promotable", () => {
  const [candidate] = deriveCommunicationLearningCandidates({
    ...base,
    scope: "global",
    strength: "explicit_rule",
    reasons: [{ dimension: "meeting", summary: "Do not suggest meetings when email resolves the matter.", generalisable: true }],
  });
  assert.equal(candidate?.eligibleForGlobalPromotion, true);
  assert.equal(candidate?.owner, "evavo-worker-agent");
});
