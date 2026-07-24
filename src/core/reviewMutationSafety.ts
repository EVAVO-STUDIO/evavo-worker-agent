export const REVIEW_MUTATION_CONTRACT = "review_mutation_boundary_v1";

const RECORD_ID_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const FORBIDDEN_TEXT_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const encoder = new TextEncoder();

export type BoundedReviewTextResult =
  | { ok: true; value: string | null }
  | { ok: false; error: "invalid_field_type" | "field_too_long" | "forbidden_control_character"; field: string; maxLength: number };

export function validReviewRecordId(value: unknown): value is string {
  return typeof value === "string" && RECORD_ID_PATTERN.test(value);
}

export function boundedReviewText(
  value: unknown,
  field: string,
  maxLength: number,
  options: { preserveLineBreaks?: boolean } = {},
): BoundedReviewTextResult {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false, error: "invalid_field_type", field, maxLength };

  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.length > maxLength) return { ok: false, error: "field_too_long", field, maxLength };
  if (FORBIDDEN_TEXT_CONTROL.test(trimmed)) {
    return { ok: false, error: "forbidden_control_character", field, maxLength };
  }

  const normalized = options.preserveLineBreaks
    ? trimmed.replace(/\r\n?/g, "\n")
    : trimmed.replace(/\s+/g, " ");
  return { ok: true, value: normalized };
}

export function boundedReviewRating(
  value: unknown,
  field: string,
): { ok: true; value: number | null } | { ok: false; error: "invalid_rating"; field: string; allowed: { min: 1; max: 5 } } {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  const parsed = typeof value === "number" ? value : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 5) {
    return { ok: false, error: "invalid_rating", field, allowed: { min: 1, max: 5 } };
  }
  return { ok: true, value: parsed };
}

export async function reviewLeaseKey(prefix: string, parts: readonly unknown[]): Promise<string> {
  const canonical = JSON.stringify(parts.map((part) => part === undefined ? null : part));
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(canonical));
  const hex = Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
  return `${prefix}:${hex.slice(0, 32)}`;
}
