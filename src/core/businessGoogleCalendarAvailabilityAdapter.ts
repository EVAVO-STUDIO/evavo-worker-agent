import type { CalendarSlotEvidence } from "./businessCalendarCommitmentVerifier";

export const BUSINESS_GOOGLE_CALENDAR_AVAILABILITY_ADAPTER_CONTRACT = "business_google_calendar_availability_adapter_v2" as const;

export type GoogleCalendarBusyWindow = Readonly<{ start: string; end: string }>;

function validDate(value: string, field: string): Date {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(`GOOGLE_CALENDAR_${field.toUpperCase()}_INVALID`);
  return parsed;
}

export function googleCalendarAvailabilityToSlotEvidence(input: Readonly<{
  calendarId: string;
  proposedStart: string;
  proposedEnd: string;
  timezone: string;
  busyWindows: readonly GoogleCalendarBusyWindow[];
  providerEvidenceRef: string;
  querySucceeded: boolean;
  calendarAccessible: boolean;
  queryStart: string;
  queryEnd: string;
  observedAt: string;
}>): CalendarSlotEvidence {
  const start = validDate(input.proposedStart, "proposed_start");
  const end = validDate(input.proposedEnd, "proposed_end");
  if (start >= end) throw new Error("GOOGLE_CALENDAR_PROPOSED_WINDOW_INVALID");
  if (!input.calendarId.trim()) throw new Error("GOOGLE_CALENDAR_ID_REQUIRED");
  if (!input.timezone.trim()) throw new Error("GOOGLE_CALENDAR_TIMEZONE_REQUIRED");
  if (!input.providerEvidenceRef.trim()) throw new Error("GOOGLE_CALENDAR_EVIDENCE_REF_REQUIRED");
  if (!input.querySucceeded) throw new Error("GOOGLE_CALENDAR_QUERY_NOT_SUCCESSFUL");
  if (!input.calendarAccessible) throw new Error("GOOGLE_CALENDAR_NOT_ACCESSIBLE");

  const queryStart = validDate(input.queryStart, "query_start");
  const queryEnd = validDate(input.queryEnd, "query_end");
  if (queryStart >= queryEnd || queryStart > start || queryEnd < end) {
    throw new Error("GOOGLE_CALENDAR_QUERY_WINDOW_DOES_NOT_COVER_PROPOSAL");
  }
  const observedAt = validDate(input.observedAt, "observed_at");

  const overlaps = input.busyWindows.some((window) => {
    const busyStart = validDate(window.start, "busy_start");
    const busyEnd = validDate(window.end, "busy_end");
    if (busyStart >= busyEnd) throw new Error("GOOGLE_CALENDAR_BUSY_WINDOW_INVALID");
    return start < busyEnd && end > busyStart;
  });

  return Object.freeze({
    start: start.toISOString(),
    end: end.toISOString(),
    timezone: input.timezone.trim(),
    available: !overlaps,
    observedAt: observedAt.toISOString(),
    sourceEvidenceIds: Object.freeze([`google_calendar:${input.providerEvidenceRef.trim()}`]),
  });
}
