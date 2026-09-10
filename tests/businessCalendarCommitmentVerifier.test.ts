import assert from "node:assert/strict";
import test from "node:test";

import { verifyCalendarCommitment } from "../src/core/businessCalendarCommitmentVerifier";

const NOW = new Date("2026-09-06T23:59:00Z");
const slot = {
  start: "2026-09-07T00:00:00Z",
  end: "2026-09-07T00:30:00Z",
  timezone: "Australia/Melbourne",
  available: true,
  observedAt: "2026-09-06T23:58:00Z",
  sourceEvidenceIds: ["calendar:freebusy:greg:2026-09-07T10:00+10:00"],
};

test("exact fresh authoritative slot can be promised", () => {
  const result = verifyCalendarCommitment({ proposedStart: slot.start, proposedEnd: slot.end, timezone: slot.timezone, slotEvidence: slot, now: NOW });
  assert.equal(result.status, "verified_available");
  assert.equal(result.canPromise, true);
});

test("missing calendar evidence blocks a time promise", () => {
  const result = verifyCalendarCommitment({ proposedStart: slot.start, proposedEnd: slot.end, timezone: slot.timezone, now: NOW });
  assert.equal(result.status, "unverified");
  assert.equal(result.canPromise, false);
});

test("mismatched slot evidence cannot authorise a promise", () => {
  const result = verifyCalendarCommitment({
    proposedStart: slot.start,
    proposedEnd: slot.end,
    timezone: slot.timezone,
    slotEvidence: { ...slot, end: "2026-09-07T01:00:00Z" },
    now: NOW,
  });
  assert.equal(result.status, "unverified");
});

test("verified busy slot is explicitly unavailable", () => {
  const result = verifyCalendarCommitment({ proposedStart: slot.start, proposedEnd: slot.end, timezone: slot.timezone, slotEvidence: { ...slot, available: false }, now: NOW });
  assert.equal(result.status, "verified_unavailable");
  assert.equal(result.canPromise, false);
});

test("stale availability evidence cannot authorise a promise", () => {
  const result = verifyCalendarCommitment({
    proposedStart: slot.start,
    proposedEnd: slot.end,
    timezone: slot.timezone,
    slotEvidence: { ...slot, observedAt: "2026-09-06T23:30:00Z" },
    now: NOW,
  });
  assert.equal(result.status, "unverified");
  assert.ok(result.reasons.some((reason) => /stale/i.test(reason)));
});

test("availability without an observation timestamp cannot authorise a promise", () => {
  const result = verifyCalendarCommitment({
    proposedStart: slot.start,
    proposedEnd: slot.end,
    timezone: slot.timezone,
    slotEvidence: { ...slot, observedAt: undefined },
    now: NOW,
  });
  assert.equal(result.status, "unverified");
});

test("past or already-started proposed slot cannot be promised", () => {
  const result = verifyCalendarCommitment({
    proposedStart: slot.start,
    proposedEnd: slot.end,
    timezone: slot.timezone,
    slotEvidence: slot,
    now: new Date("2026-09-07T00:01:00Z"),
  });
  assert.equal(result.status, "unverified");
  assert.equal(result.canPromise, false);
});
