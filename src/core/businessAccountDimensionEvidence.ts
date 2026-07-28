import { validatePublicResearchUrl } from "./publicResearchFetch";

export const BUSINESS_ACCOUNT_DIMENSION_EVIDENCE_CONTRACT =
  "business_account_360_dimension_evidence_v1" as const;
export const BUSINESS_ACCOUNT_DIMENSION_ITEM_LIMIT = 5;
export const BUSINESS_ACCOUNT_DIMENSION_KEYS = Object.freeze([
  "products",
  "competitors",
  "technology",
  "hiring",
  "news",
  "funding",
  "procurement",
  "digitalMaturity",
  "painPoints",
  "budgetSignals",
  "buyingSignals",
] as const);

export type BusinessAccountDimensionKey =
  (typeof BUSINESS_ACCOUNT_DIMENSION_KEYS)[number];

type SignalRecord = Record<string, unknown>;

type DimensionEvidenceItem = Readonly<{
  signalId: string | null;
  signalType: string;
  evidenceSummary: string | null;
  evidenceUrl: string | null;
  signalStrength: number | null;
  confidenceScore: number | null;
  riskFlags: readonly string[];
  observedAt: string | null;
}>;

export type BusinessAccountDimensionEvidence = Readonly<{
  status: "stored_evidence_present" | "not_evidenced";
  evidenceCount: number;
  matchedSignalTypes: readonly string[];
  latestEvidenceAt: string | null;
  maximumSignalStrengthScore: number | null;
  maximumConfidenceScore: number | null;
  evidenceItems: readonly DimensionEvidenceItem[];
  evidenceItemsMayBeTruncated: boolean;
  uncertainty: string;
}>;

const DIMENSION_KEYWORDS: Readonly<
  Record<BusinessAccountDimensionKey, readonly string[]>
> = Object.freeze({
  products: Object.freeze(["product", "service", "offering", "solution"]),
  competitors: Object.freeze(["competitor", "competition", "alternative", "market_position"]),
  technology: Object.freeze(["technology", "tech", "platform", "stack", "cms", "analytics", "automation"]),
  hiring: Object.freeze(["hiring", "recruitment", "job", "vacancy", "headcount"]),
  news: Object.freeze(["news", "announcement", "press", "launch", "event"]),
  funding: Object.freeze(["funding", "capital_raise", "grant_award", "seed_round", "series_round"]),
  procurement: Object.freeze(["procurement", "tender", "rfp", "rfq", "supplier_panel"]),
  digitalMaturity: Object.freeze([
    "digital_maturity",
    "digital_capability",
    "digital_transformation",
    "digital_experience",
    "website_maturity",
    "analytics_maturity",
  ]),
  painPoints: Object.freeze(["pain", "problem", "friction", "risk", "defect", "gap", "issue"]),
  budgetSignals: Object.freeze(["budget", "spend", "capex", "opex"]),
  buyingSignals: Object.freeze(["buying", "intent", "trigger", "need", "project", "replacement", "redesign"]),
});

const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

function text(value: unknown, maximum: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return !normalized || normalized.length > maximum || CONTROL.test(normalized)
    ? null
    : normalized;
}

function normalizedSignalType(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function signalTypeContainsKeyword(signalType: string, keyword: string): boolean {
  const normalized = normalizedSignalType(signalType);
  if (!normalized) return false;
  return `_${normalized}_`.includes(`_${keyword}_`);
}

function nullableScore(value: unknown): number | null {
  return typeof value === "number"
    && Number.isFinite(value)
    && value >= 0
    && value <= 100
    ? value
    : null;
}

function publicUrl(value: unknown): string | null {
  const candidate = text(value, 2_048);
  if (!candidate) return null;
  const decision = validatePublicResearchUrl(candidate);
  return decision.ok ? decision.url : null;
}

function stringArray(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return Object.freeze([]);
  return Object.freeze([...new Set(value
    .map((item) => text(item, 160))
    .filter((item): item is string => Boolean(item)))].slice(0, 25));
}

function canonicalObservedAt(signal: SignalRecord, observedAt: number): string | null {
  let latest: number | null = null;
  for (const value of [signal.updatedAt, signal.createdAt]) {
    const candidate = text(value, 80);
    if (!candidate) continue;
    const parsed = Date.parse(candidate);
    if (!Number.isFinite(parsed) || parsed > observedAt) continue;
    if (latest === null || parsed > latest) latest = parsed;
  }
  return latest === null ? null : new Date(latest).toISOString();
}

function signalMatchesDimension(
  signalType: string,
  dimension: BusinessAccountDimensionKey,
): boolean {
  return DIMENSION_KEYWORDS[dimension].some((keyword) =>
    signalTypeContainsKeyword(signalType, keyword));
}

function evidenceItem(
  signal: SignalRecord,
  observedAt: number,
): DimensionEvidenceItem | null {
  const signalType = text(signal.signalType, 128);
  if (!signalType) return null;
  return Object.freeze({
    signalId: text(signal.id, 128),
    signalType,
    evidenceSummary: text(signal.evidenceSummary, 2_000),
    evidenceUrl: publicUrl(signal.evidenceUrl),
    signalStrength: nullableScore(signal.signalStrength),
    confidenceScore: nullableScore(signal.confidenceScore),
    riskFlags: stringArray(signal.riskFlags),
    observedAt: canonicalObservedAt(signal, observedAt),
  });
}

function descendingEvidence(
  left: DimensionEvidenceItem,
  right: DimensionEvidenceItem,
): number {
  const leftTime = left.observedAt ? Date.parse(left.observedAt) : Number.NEGATIVE_INFINITY;
  const rightTime = right.observedAt ? Date.parse(right.observedAt) : Number.NEGATIVE_INFINITY;
  if (leftTime !== rightTime) return rightTime - leftTime;
  return (left.signalId ?? left.signalType).localeCompare(
    right.signalId ?? right.signalType,
  );
}

function maximumScore(
  items: readonly DimensionEvidenceItem[],
  field: "signalStrength" | "confidenceScore",
): number | null {
  const values = items
    .map((item) => item[field])
    .filter((value): value is number => typeof value === "number");
  return values.length ? Math.max(...values) : null;
}

export function buildBusinessAccountDimensionEvidence(
  signals: readonly SignalRecord[],
  observedAt = Date.now(),
): Readonly<Record<BusinessAccountDimensionKey, BusinessAccountDimensionEvidence>> {
  const safeObservedAt = Number.isFinite(observedAt) ? observedAt : Date.now();
  const projectedSignals = signals
    .map((signal) => evidenceItem(signal, safeObservedAt))
    .filter((item): item is DimensionEvidenceItem => Boolean(item));

  const register = Object.fromEntries(
    BUSINESS_ACCOUNT_DIMENSION_KEYS.map((dimension) => {
      const matched = projectedSignals
        .filter((item) => signalMatchesDimension(item.signalType, dimension))
        .sort(descendingEvidence);
      const evidenceCount = matched.length;
      const evidenceItems = Object.freeze(
        matched.slice(0, BUSINESS_ACCOUNT_DIMENSION_ITEM_LIMIT),
      );
      const matchedSignalTypes = Object.freeze(
        [...new Set(matched.map((item) => item.signalType))].sort(),
      );
      const status = evidenceCount
        ? "stored_evidence_present"
        : "not_evidenced";
      const value: BusinessAccountDimensionEvidence = Object.freeze({
        status,
        evidenceCount,
        matchedSignalTypes,
        latestEvidenceAt: matched.find((item) => item.observedAt)?.observedAt ?? null,
        maximumSignalStrengthScore: maximumScore(matched, "signalStrength"),
        maximumConfidenceScore: maximumScore(matched, "confidenceScore"),
        evidenceItems,
        evidenceItemsMayBeTruncated:
          evidenceCount > BUSINESS_ACCOUNT_DIMENSION_ITEM_LIMIT,
        uncertainty: evidenceCount
          ? "Stored evidence is bounded and supports review only; it does not prove the organization’s current state."
          : "No matching stored signal type exists in this bounded snapshot; no conclusion is available.",
      });
      return [dimension, value] as const;
    }),
  ) as Record<BusinessAccountDimensionKey, BusinessAccountDimensionEvidence>;

  return Object.freeze(register);
}

export function businessAccountDimensionCoverage(
  register: Readonly<Record<BusinessAccountDimensionKey, BusinessAccountDimensionEvidence>>,
): Readonly<Record<BusinessAccountDimensionKey, Readonly<{
  status: BusinessAccountDimensionEvidence["status"];
  matchedSignalTypes: readonly string[];
}>>> {
  return Object.freeze(Object.fromEntries(
    BUSINESS_ACCOUNT_DIMENSION_KEYS.map((dimension) => [
      dimension,
      Object.freeze({
        status: register[dimension].status,
        matchedSignalTypes: register[dimension].matchedSignalTypes,
      }),
    ]),
  ) as Record<BusinessAccountDimensionKey, Readonly<{
    status: BusinessAccountDimensionEvidence["status"];
    matchedSignalTypes: readonly string[];
  }>>);
}
