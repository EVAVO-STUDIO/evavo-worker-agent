export const BUSINESS_SCORE_PROVENANCE_CONTRACT =
  "business_score_observation_flags_v1" as const;

export type BusinessScoreWrite = Readonly<{
  value: number;
  observed: 0 | 1;
  supplied: boolean;
}>;

export type BusinessOpportunityScoreInputs = Readonly<{
  fitScore?: unknown;
  needScore?: unknown;
  urgencyScore?: unknown;
  budgetLikelihoodScore?: unknown;
  contactabilityScore?: unknown;
  evidenceQualityScore?: unknown;
  riskScore?: unknown;
}>;

function finiteCanonicalNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string" || !value || value.trim() !== value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildBusinessScoreWrite(value: unknown): BusinessScoreWrite {
  const supplied = value !== undefined;
  const parsed = typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
  if (parsed === null || parsed < 0 || parsed > 100) {
    return { value: 0, observed: 0, supplied };
  }
  return { value: parsed, observed: 1, supplied };
}

export function businessScoreObserved(value: unknown): boolean {
  return value === true || value === 1 || value === "1";
}

export function readBusinessObservedScore(
  value: unknown,
  observed: unknown,
): number | null {
  if (!businessScoreObserved(observed)) return null;
  const parsed = finiteCanonicalNumber(value);
  return parsed !== null && parsed >= 0 && parsed <= 100 ? parsed : null;
}

export function businessOpportunityPriorityFromScores(
  input: BusinessOpportunityScoreInputs,
): "A" | "B" | "C" | "D" {
  const fit = buildBusinessScoreWrite(input.fitScore).value;
  const need = buildBusinessScoreWrite(input.needScore).value;
  const urgency = buildBusinessScoreWrite(input.urgencyScore).value;
  const budget = buildBusinessScoreWrite(input.budgetLikelihoodScore).value;
  const contactability = buildBusinessScoreWrite(input.contactabilityScore).value;
  const evidence = buildBusinessScoreWrite(input.evidenceQualityScore).value;
  const risk = buildBusinessScoreWrite(input.riskScore).value;
  const weighted = (fit * 0.3)
    + (need * 0.25)
    + (urgency * 0.15)
    + (budget * 0.1)
    + (contactability * 0.1)
    + (evidence * 0.1)
    - (risk * 0.2);
  if (weighted >= 75) return "A";
  if (weighted >= 55) return "B";
  if (weighted >= 35) return "C";
  return "D";
}
