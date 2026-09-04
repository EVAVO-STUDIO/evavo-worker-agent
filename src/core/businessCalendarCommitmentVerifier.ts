export const BUSINESS_CALENDAR_COMMITMENT_VERIFIER_CONTRACT = "business_calendar_commitment_verifier_v2" as const;

export type CalendarSlotEvidence = Readonly<{
  start: string;
  end: string;
  timezone: string;
  available: boolean;
  observedAt: string;
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
  now?: Date;
  maxEvidenceAgeMs?: number;
}>): CalendarCommitmentVerification {
  const start = validIso(input.proposedStart, "proposed_start");
  const end = validIso(input.proposedEnd, "proposed_end");
  if (start >= end) throw new Error("CALENDAR_PROPOSED_WINDOW_INVALID");
  if (!input.timezone.trim()) throw new Error("CALENDAR_TIMEZONE_REQUIRED");

  const now = input.now ?? new Date();
  if (Number.isNaN(now.getTime())) throw new Error("CALENDAR_NOW_INVALID");
  if (new Date(start).getTime() <= now.getTime()) {
    return Object.freeze({
      contract: BUSINESS_CALENDAR_COMMITMENT_VERIFIER_CONTRACT,
      status: "unverified",
      canPromise: false,
      reasons: Object.freeze(["The proposed meeting window has already started or passed; do not promise it."]),
      evidenceIds: Object.freeze([]),
    });
  }

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
  const evidenceObservedAt = validIso(evidence.observedAt, "evidence_observed_at");
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

  const observedAtMs = new Date(evidenceObservedAt).getTime();
  const maxEvidenceAgeMs = input.maxEvidenceAgeMs ?? 10 * 60 * 1000;
  if (!Number.isFinite(maxEvidenceAgeMs) || maxEvidenceAgeMs < 0) throw new Error("CALENDAR_MAX_EVIDENCE_AGE_INVALID");
  const evidenceAgeMs = now.getTime() - observedAtMs;
  if (evidenceAgeMs < 0 || evidenceAgeMs > maxEvidenceAgeMs) {
    return Object.freeze({
      contract: BUSINESS_CALENDAR_COMMITMENT_VERIFIER_CONTRACT,
      status: "unverified",
      canPromise: false,
      reasons: Object.freeze(["Calendar availability evidence is stale or has an invalid future observation time; refresh it before promising the slot."]),
      evidenceIds: Object.freeze(evidence.sourceEvidenceIds),
    });
  }

  return Object.freeze({
    contract: BUSINESS_CALENDAR_COMMITMENT_VERIFIER_CONTRACT,
    status: evidence.available ? "verified_available" : "verified_unavailable",
    canPromise: evidence.available,
    reasons: Object.freeze([evidence.available
      ? "The exact proposed time window is verified available by fresh authoritative calendar evidence."
      : "The exact proposed time window is verified unavailable; do not promise it."]),
    evidenceIds: Object.freeze(evidence.sourceEvidenceIds),
  });
}
