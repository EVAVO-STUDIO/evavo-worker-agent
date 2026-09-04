import type { CalendarSlotEvidence } from "./businessCalendarCommitmentVerifier";

export const BUSINESS_GOOGLE_CALENDAR_AVAILABILITY_ADAPTER_CONTRACT = "business_google_calendar_availability_adapter_v1" as const;

export type GoogleCalendarBusyWindow = Readonly<{ start: string; end: string }>;

export function googleCalendarAvailabilityToSlotEvidence(input: Readonly<{
  calendarId: string;
  proposedStart: string;
  proposedEnd: string;
  timezone: string;
  busyWindows: readonly GoogleCalendarBusyWindow[];
  providerEvidenceRef: string;
}>): CalendarSlotEvidence {
  const start = new Date(input.proposedStart);
  const end = new Date(input.proposedEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) throw new Error("GOOGLE_CALENDAR_PROPOSED_WINDOW_INVALID");
  if (!input.calendarId.trim()) throw new Error("GOOGLE_CALENDAR_ID_REQUIRED");
  if (!input.timezone.trim()) throw new Error("GOOGLE_CALENDAR_TIMEZONE_REQUIRED");
  if (!input.providerEvidenceRef.trim()) throw new Error("GOOGLE_CALENDAR_EVIDENCE_REF_REQUIRED");

  const overlaps = input.busyWindows.some((window) => {
    const busyStart = new Date(window.start);
    const busyEnd = new Date(window.end);
    if (Number.isNaN(busyStart.getTime()) || Number.isNaN(busyEnd.getTime()) || busyStart >= busyEnd) {
      throw new Error("GOOGLE_CALENDAR_BUSY_WINDOW_INVALID");
    }
    return start < busyEnd && end > busyStart;
  });

  return Object.freeze({
    start: start.toISOString(),
    end: end.toISOString(),
    timezone: input.timezone.trim(),
    available: !overlaps,
    sourceEvidenceIds: Object.freeze([`google_calendar:${input.providerEvidenceRef.trim()}`]),
  });
}
