import assert from "node:assert/strict";
import test from "node:test";

import { verifyCalendarCommitment } from "../src/core/businessCalendarCommitmentVerifier";

const slot = {
  start: "2026-09-07T00:00:00Z",
  end: "2026-09-07T00:30:00Z",
  timezone: "Australia/Melbourne",
  available: true,
  sourceEvidenceIds: ["calendar:freebusy:greg:2026-09-07T10:00+10:00"],
};

test("exact authoritative slot can be promised", () => {
  const result = verifyCalendarCommitment({ proposedStart: slot.start, proposedEnd: slot.end, timezone: slot.timezone, slotEvidence: slot });
  assert.equal(result.status, "verified_available");
  assert.equal(result.canPromise, true);
});

test("missing calendar evidence blocks a time promise", () => {
  const result = verifyCalendarCommitment({ proposedStart: slot.start, proposedEnd: slot.end, timezone: slot.timezone });
  assert.equal(result.status, "unverified");
  assert.equal(result.canPromise, false);
});

test("mismatched slot evidence cannot authorise a promise", () => {
  const result = verifyCalendarCommitment({
    proposedStart: slot.start,
    proposedEnd: slot.end,
    timezone: slot.timezone,
    slotEvidence: { ...slot, end: "2026-09-07T01:00:00Z" },
  });
  assert.equal(result.status, "unverified");
});

test("verified busy slot is explicitly unavailable", () => {
  const result = verifyCalendarCommitment({ proposedStart: slot.start, proposedEnd: slot.end, timezone: slot.timezone, slotEvidence: { ...slot, available: false } });
  assert.equal(result.status, "verified_unavailable");
  assert.equal(result.canPromise, false);
});
