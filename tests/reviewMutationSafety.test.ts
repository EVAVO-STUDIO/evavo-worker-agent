import assert from "node:assert/strict";
import test from "node:test";

import {
  REVIEW_MUTATION_CONTRACT,
  boundedReviewRating,
  boundedReviewText,
  reviewLeaseKey,
  validReviewRecordId,
} from "../src/core/reviewMutationSafety.ts";

test("review record identifiers are narrow and path safe", () => {
  assert.equal(validReviewRecordId("draft_12345678"), true);
  assert.equal(validReviewRecordId("abc"), false);
  assert.equal(validReviewRecordId("../draft-secret"), false);
  assert.equal(validReviewRecordId("draft id with spaces"), false);
  assert.equal(validReviewRecordId("x".repeat(129)), false);
});

test("review text is bounded, typed and control-character safe", () => {
  assert.deepEqual(boundedReviewText("  useful   reason  ", "reason", 100), {
    ok: true,
    value: "useful reason",
  });
  assert.deepEqual(boundedReviewText("line one\r\nline two", "notes", 100, { preserveLineBreaks: true }), {
    ok: true,
    value: "line one\nline two",
  });
  assert.equal(boundedReviewText(5, "reason", 100).ok, false);
  assert.equal(boundedReviewText("x".repeat(101), "reason", 100).ok, false);
  assert.equal(boundedReviewText("unsafe\u0000text", "reason", 100).ok, false);
});

test("review ratings require exact integer values between one and five", () => {
  assert.deepEqual(boundedReviewRating(3, "fitRating"), { ok: true, value: 3 });
  assert.deepEqual(boundedReviewRating(null, "fitRating"), { ok: true, value: null });
  assert.equal(boundedReviewRating("3", "fitRating").ok, false);
  assert.equal(boundedReviewRating(0, "fitRating").ok, false);
  assert.equal(boundedReviewRating(6, "fitRating").ok, false);
  assert.equal(boundedReviewRating(2.5, "fitRating").ok, false);
});

test("review lease keys are deterministic, bounded and scope separated", async () => {
  const first = await reviewLeaseKey("draft-strategy", ["general", "AU"]);
  const repeated = await reviewLeaseKey("draft-strategy", ["general", "AU"]);
  const different = await reviewLeaseKey("opportunity-strategy", ["general", "AU"]);

  assert.equal(first, repeated);
  assert.notEqual(first, different);
  assert.match(first, /^draft-strategy:[a-f0-9]{32}$/);
  assert.ok(first.length < 160);
  assert.equal(REVIEW_MUTATION_CONTRACT, "review_mutation_boundary_v1");
});
