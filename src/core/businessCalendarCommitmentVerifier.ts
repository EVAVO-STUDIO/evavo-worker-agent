export const BUSINESS_CALENDAR_COMMITMENT_VERIFIER_CONTRACT = "business_calendar_commitment_verifier_v1" as const;

export type CalendarSlotEvidence = Readonly<{
  start: string;
  end: string;
  timezone: string;
  available: boolean;
  sourceEvidenceIds: readonly string[];
}>;

export type CalendarCommitmentVerification = Readonly<{
  contract: typeof BUSINESS_CALENDAR_COMMITMENT_VERIFIER_CONTRACT;
  status: "verified_available" | "verified_unavailable" | "unverified";
  canPromise: boolean;
  reasons: readonly string[];
  evidenceIds: readonly string[];
}>;

function validIso(value: string, field: string): string {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) throw new Error(`CALENDAR_${field.toUpperCase()}_INVALID`);
  return parsed.toISOString();
}

export function verifyCalendarCommitment(input: Readonly<{
  proposedStart: string;
  proposedEnd: string;
  timezone: string;
  slotEvidence?: CalendarSlotEvidence | null;
}>): CalendarCommitmentVerification {
  const start = validIso(input.proposedStart, "proposed_start");
  const end = validIso(input.proposedEnd, "proposed_end");
  if (start >= end) throw new Error("CALENDAR_PROPOSED_WINDOW_INVALID");
  if (!input.timezone.trim()) throw new Error("CALENDAR_TIMEZONE_REQUIRED");

  const evidence = input.slotEvidence;
  if (!evidence || !evidence.sourceEvidenceIds.length) {
    return Object.freeze({
      contract: BUSINESS_CALENDAR_COMMITMENT_VERIFIER_CONTRACT,
      status: "unverified",
      canPromise: false,
      reasons: Object.freeze(["No authoritative calendar availability evidence was supplied; do not promise the proposed time from memory or inference."]),
      evidenceIds: Object.freeze([]),
    });
  }

  const evidenceStart = validIso(evidence.start, "evidence_start");
  const evidenceEnd = validIso(evidence.end, "evidence_end");
  const sameWindow = evidenceStart === start && evidenceEnd === end && evidence.timezone.trim() === input.timezone.trim();
  if (!sameWindow) {
    return Object.freeze({
      contract: BUSINESS_CALENDAR_COMMITMENT_VERIFIER_CONTRACT,
      status: "unverified",
      canPromise: false,
      reasons: Object.freeze(["Calendar evidence does not match the exact proposed time window and timezone."]),
      evidenceIds: Object.freeze(evidence.sourceEvidenceIds),
    });
  }

  return Object.freeze({
    contract: BUSINESS_CALENDAR_COMMITMENT_VERIFIER_CONTRACT,
    status: evidence.available ? "verified_available" : "verified_unavailable",
    canPromise: evidence.available,
    reasons: Object.freeze([evidence.available
      ? "The exact proposed time window is verified available by authoritative calendar evidence."
      : "The exact proposed time window is verified unavailable; do not promise it."]),
    evidenceIds: Object.freeze(evidence.sourceEvidenceIds),
  });
}
