import assert from "node:assert/strict";
import test from "node:test";

import { googleCalendarAvailabilityToSlotEvidence } from "../src/core/businessGoogleCalendarAvailabilityAdapter";

const base = {
  calendarId: "primary",
  proposedStart: "2026-09-07T10:00:00+10:00",
  proposedEnd: "2026-09-07T10:30:00+10:00",
  timezone: "Australia/Melbourne",
  providerEvidenceRef: "freebusy:primary:20260907T1000",
  querySucceeded: true,
  calendarAccessible: true,
  queryStart: "2026-09-07T09:30:00+10:00",
  queryEnd: "2026-09-07T11:00:00+10:00",
  observedAt: "2026-09-07T09:55:00+10:00",
} as const;

test("marks a slot available only after a successful covering provider query", () => {
  const result = googleCalendarAvailabilityToSlotEvidence({
    ...base,
    busyWindows: [{ start: "2026-09-07T11:00:00+10:00", end: "2026-09-07T11:30:00+10:00" }],
  });
  assert.equal(result.available, true);
  assert.equal(result.observedAt, "2026-09-06T23:55:00.000Z");
});

test("marks a slot unavailable when a busy window overlaps", () => {
  const result = googleCalendarAvailabilityToSlotEvidence({
    ...base,
    busyWindows: [{ start: "2026-09-07T10:15:00+10:00", end: "2026-09-07T10:45:00+10:00" }],
  });
  assert.equal(result.available, false);
});

test("empty busy windows do not imply availability when the provider query failed", () => {
  assert.throws(() => googleCalendarAvailabilityToSlotEvidence({
    ...base,
    querySucceeded: false,
    busyWindows: [],
  }), /QUERY_NOT_SUCCESSFUL/);
});

test("inaccessible calendar fails closed", () => {
  assert.throws(() => googleCalendarAvailabilityToSlotEvidence({
    ...base,
    calendarAccessible: false,
    busyWindows: [],
  }), /NOT_ACCESSIBLE/);
});

test("provider query must cover the entire proposed window", () => {
  assert.throws(() => googleCalendarAvailabilityToSlotEvidence({
    ...base,
    queryStart: "2026-09-07T10:05:00+10:00",
    busyWindows: [],
  }), /QUERY_WINDOW_DOES_NOT_COVER_PROPOSAL/);
});
