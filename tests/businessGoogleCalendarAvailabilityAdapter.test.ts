import assert from "node:assert/strict";
import test from "node:test";

import { googleCalendarAvailabilityToSlotEvidence } from "../src/core/businessGoogleCalendarAvailabilityAdapter";

test("marks a slot available when no busy window overlaps", () => {
  const result = googleCalendarAvailabilityToSlotEvidence({
    calendarId: "primary",
    proposedStart: "2026-09-07T10:00:00+10:00",
    proposedEnd: "2026-09-07T10:30:00+10:00",
    timezone: "Australia/Melbourne",
    busyWindows: [{ start: "2026-09-07T11:00:00+10:00", end: "2026-09-07T11:30:00+10:00" }],
    providerEvidenceRef: "freebusy:primary:20260907T1000",
  });
  assert.equal(result.available, true);
});

test("marks a slot unavailable when a busy window overlaps", () => {
  const result = googleCalendarAvailabilityToSlotEvidence({
    calendarId: "primary",
    proposedStart: "2026-09-07T10:00:00+10:00",
    proposedEnd: "2026-09-07T10:30:00+10:00",
    timezone: "Australia/Melbourne",
    busyWindows: [{ start: "2026-09-07T10:15:00+10:00", end: "2026-09-07T10:45:00+10:00" }],
    providerEvidenceRef: "freebusy:primary:20260907T1000",
  });
  assert.equal(result.available, false);
});
