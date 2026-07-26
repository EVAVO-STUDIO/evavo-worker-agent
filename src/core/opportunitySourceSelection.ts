export const OPPORTUNITY_SOURCE_SELECTION_VERSION =
  "opportunity_source_selection_v1" as const;

export type OpportunitySourceSelectionCandidate = Readonly<{
  id: string;
  priority: number;
  successCount: number;
  failureCount: number;
  opportunityCount: number;
  lastRunAtIso: string | null;
}>;

export type OpportunitySourceSelectionMetrics = Readonly<{
  attempts: number;
  reliability: number;
  opportunityYield: number;
  failurePressure: number;
  staleness: number;
}>;

export type OpportunitySourceSelectionItem<T extends OpportunitySourceSelectionCandidate> = Readonly<{
  source: T;
  mode: "explore" | "exploit";
  score: number;
  metrics: OpportunitySourceSelectionMetrics;
}>;

export type OpportunitySourceSelectionResult<T extends OpportunitySourceSelectionCandidate> = Readonly<{
  contractVersion: typeof OPPORTUNITY_SOURCE_SELECTION_VERSION;
  considered: number;
  requested: number;
  explorationSlots: number;
  explorationSelected: number;
  exploitationSelected: number;
  selected: readonly OpportunitySourceSelectionItem<T>[];
}>;

const MAX_CANDIDATES = 200;
const MAX_SELECTION = 50;
const MAX_COUNTER = 1_000_000_000;
const IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9:._-]{0,158}[A-Za-z0-9]$/;

function fail(code: string): never {
  throw new Error(code);
}

function integer(value: unknown, minimum: number, maximum: number, code: string): number {
  if (!Number.isSafeInteger(value) || Number(value) < minimum || Number(value) > maximum) {
    fail(code);
  }
  return Number(value);
}

function canonicalNow(value: Date | undefined): Date {
  const now = value ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("OPPORTUNITY_SOURCE_SELECTION_TIME_INVALID");
  }
  return new Date(now.getTime());
}

function timestamp(value: unknown, now: Date): string | null {
  if (value === null) return null;
  if (typeof value !== "string" || value.length > 80) {
    fail("OPPORTUNITY_SOURCE_SELECTION_SOURCE_INVALID");
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    fail("OPPORTUNITY_SOURCE_SELECTION_SOURCE_INVALID");
  }
  const canonical = new Date(milliseconds).toISOString();
  if (canonical !== value || milliseconds > now.getTime() + 60_000) {
    fail("OPPORTUNITY_SOURCE_SELECTION_SOURCE_INVALID");
  }
  return canonical;
}

function candidate<T extends OpportunitySourceSelectionCandidate>(
  value: T,
  now: Date,
): T {
  if (!value || typeof value !== "object") {
    fail("OPPORTUNITY_SOURCE_SELECTION_SOURCE_INVALID");
  }
  if (
    typeof value.id !== "string" ||
    !IDENTIFIER_PATTERN.test(value.id) ||
    value.id.includes("..")
  ) {
    fail("OPPORTUNITY_SOURCE_SELECTION_SOURCE_INVALID");
  }
  integer(value.priority, 0, 100, "OPPORTUNITY_SOURCE_SELECTION_SOURCE_INVALID");
  integer(value.successCount, 0, MAX_COUNTER, "OPPORTUNITY_SOURCE_SELECTION_SOURCE_INVALID");
  integer(value.failureCount, 0, MAX_COUNTER, "OPPORTUNITY_SOURCE_SELECTION_SOURCE_INVALID");
  integer(value.opportunityCount, 0, MAX_COUNTER, "OPPORTUNITY_SOURCE_SELECTION_SOURCE_INVALID");
  timestamp(value.lastRunAtIso, now);
  return value;
}

function boundedRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function metrics(
  source: OpportunitySourceSelectionCandidate,
  now: Date,
): OpportunitySourceSelectionMetrics {
  const attempts = source.successCount + source.failureCount;
  const reliability = (source.successCount + 1) / (attempts + 2);
  const failurePressure = source.failureCount / (attempts + 2);
  const opportunityYield = boundedRatio(
    Math.log1p(source.opportunityCount) / Math.log(21),
  );
  const lastRunMs = source.lastRunAtIso === null
    ? null
    : Date.parse(source.lastRunAtIso);
  const staleness = lastRunMs === null
    ? 1
    : boundedRatio((now.getTime() - lastRunMs) / (7 * 24 * 60 * 60 * 1_000));
  return Object.freeze({
    attempts,
    reliability,
    opportunityYield,
    failurePressure,
    staleness,
  });
}

function score(
  source: OpportunitySourceSelectionCandidate,
  observed: OpportunitySourceSelectionMetrics,
): number {
  const priority = source.priority / 100;
  const value =
    priority * 45 +
    observed.reliability * 25 +
    observed.opportunityYield * 20 +
    observed.staleness * 10 -
    observed.failurePressure * 20;
  return Math.round(value * 10_000) / 10_000;
}

function compare<T extends OpportunitySourceSelectionCandidate>(
  left: OpportunitySourceSelectionItem<T>,
  right: OpportunitySourceSelectionItem<T>,
): number {
  if (left.score !== right.score) return right.score - left.score;
  if (left.source.priority !== right.source.priority) {
    return right.source.priority - left.source.priority;
  }
  if (left.metrics.attempts !== right.metrics.attempts) {
    return left.metrics.attempts - right.metrics.attempts;
  }
  return left.source.id.localeCompare(right.source.id);
}

export function opportunitySourceExplorationSlots(
  intensity: "paused" | "light" | "balanced" | "high",
  limit: number,
): number {
  const observedLimit = integer(
    limit,
    0,
    MAX_SELECTION,
    "OPPORTUNITY_SOURCE_SELECTION_LIMIT_INVALID",
  );
  if (intensity === "paused" || observedLimit === 0) return 0;
  if (intensity === "light") return Math.min(1, observedLimit);
  if (intensity === "balanced") return Math.min(2, Math.ceil(observedLimit / 4));
  if (intensity === "high") return Math.min(3, Math.ceil(observedLimit / 5));
  fail("OPPORTUNITY_SOURCE_SELECTION_INTENSITY_INVALID");
}

export function selectOpportunitySources<T extends OpportunitySourceSelectionCandidate>(input: Readonly<{
  sources: readonly T[];
  limit: number;
  explorationSlots: number;
  now?: Date;
}>): OpportunitySourceSelectionResult<T> {
  if (!Array.isArray(input.sources) || input.sources.length > MAX_CANDIDATES) {
    fail("OPPORTUNITY_SOURCE_SELECTION_SOURCES_INVALID");
  }
  const limit = integer(
    input.limit,
    0,
    MAX_SELECTION,
    "OPPORTUNITY_SOURCE_SELECTION_LIMIT_INVALID",
  );
  const explorationSlots = integer(
    input.explorationSlots,
    0,
    limit,
    "OPPORTUNITY_SOURCE_SELECTION_EXPLORATION_INVALID",
  );
  const now = canonicalNow(input.now);
  const seen = new Set<string>();
  const ranked = input.sources.map((source) => {
    const valid = candidate(source, now);
    if (seen.has(valid.id)) fail("OPPORTUNITY_SOURCE_SELECTION_DUPLICATE_SOURCE");
    seen.add(valid.id);
    const observed = metrics(valid, now);
    return Object.freeze({
      source: valid,
      mode: "exploit" as const,
      score: score(valid, observed),
      metrics: observed,
    });
  }).sort(compare);

  if (limit === 0 || ranked.length === 0) {
    return Object.freeze({
      contractVersion: OPPORTUNITY_SOURCE_SELECTION_VERSION,
      considered: ranked.length,
      requested: limit,
      explorationSlots,
      explorationSelected: 0,
      exploitationSelected: 0,
      selected: Object.freeze([]),
    });
  }

  const selected: OpportunitySourceSelectionItem<T>[] = [];
  const selectedIds = new Set<string>();
  const exploration = ranked
    .filter((item) => item.metrics.attempts === 0)
    .sort((left, right) => {
      if (left.source.priority !== right.source.priority) {
        return right.source.priority - left.source.priority;
      }
      return left.source.id.localeCompare(right.source.id);
    })
    .slice(0, explorationSlots);

  for (const item of exploration) {
    selected.push(Object.freeze({ ...item, mode: "explore" }));
    selectedIds.add(item.source.id);
  }
  for (const item of ranked) {
    if (selected.length >= limit) break;
    if (selectedIds.has(item.source.id)) continue;
    selected.push(item);
    selectedIds.add(item.source.id);
  }

  const frozenSelection = Object.freeze(selected);
  const explorationSelected = frozenSelection.filter((item) => item.mode === "explore").length;
  return Object.freeze({
    contractVersion: OPPORTUNITY_SOURCE_SELECTION_VERSION,
    considered: ranked.length,
    requested: limit,
    explorationSlots,
    explorationSelected,
    exploitationSelected: frozenSelection.length - explorationSelected,
    selected: frozenSelection,
  });
}
