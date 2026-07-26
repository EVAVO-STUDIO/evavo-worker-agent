export const GROWTH_INTERNAL_OPERATOR_PACK_VERSION =
  "growth_internal_operator_pack_v1" as const;

const MAX_SIGNALS = 20;
const MAX_ACTIONS = 20;
const MAX_FOCUS = 8;
const MAX_MARKDOWN_BYTES = 64_000;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export type GrowthInternalOperatorPackIntensity =
  | "paused"
  | "light"
  | "balanced"
  | "high";

export type GrowthInternalOperatorPackSignal = Readonly<{
  id: string;
  sourceUrl: string;
  sourceTitle: string | null;
  signalType: string;
  evidence: string;
  urgency: number;
  fitScore: number;
  riskScore: number;
  status: string;
  discoveredAt: string;
}>;

export type GrowthInternalOperatorPackAction = Readonly<{
  id: string;
  signalId: string | null;
  actionType: string;
  reason: string;
  contextEvidence: string | null;
  evavoFitExplanation: string | null;
  riskFlags: readonly unknown[];
  status: string;
  blockedReason: string | null;
  updatedAt: string;
}>;

export type GrowthInternalOperatorPackInput = Readonly<{
  generatedAt: string;
  intensity: GrowthInternalOperatorPackIntensity;
  suggestedFocus: readonly string[];
  signals: readonly GrowthInternalOperatorPackSignal[];
  actions: readonly GrowthInternalOperatorPackAction[];
  externalExecutionRequested: false;
  canonicalPromotionRequested: false;
}>;

export type GrowthInternalOperatorFocusItem = Readonly<{
  id: string;
  kind: "signal" | "action" | "system";
  urgency: "now" | "next" | "monitor";
  title: string;
  context: string;
  nextSafeDecision: string;
}>;

export type GrowthInternalSignalBrief = Readonly<{
  signalId: string;
  title: string;
  sourceUrl: string;
  status: string;
  evidence: string;
  fitScore: number;
  urgency: number;
  riskScore: number;
  questions: readonly string[];
}>;

export type GrowthInternalFollowUpPlan = Readonly<{
  actionId: string;
  actionType: string;
  status: string;
  objective: string;
  talkingPoints: readonly string[];
  blockedReason: string | null;
  deliveryAllowed: false;
}>;

export type GrowthInternalOperatorPackDto = Readonly<{
  contractVersion: typeof GROWTH_INTERNAL_OPERATOR_PACK_VERSION;
  generatedAt: string;
  source: "worker_d1_review_models";
  intensity: GrowthInternalOperatorPackIntensity;
  deterministic: true;
  aiGenerated: false;
  callsNetwork: false;
  externalExecutionEnabled: false;
  canonicalPromotionEnabled: false;
  summary: Readonly<{
    signalsReviewed: number;
    actionsReviewed: number;
    focusItems: number;
    followUpPlans: number;
    missingEvidenceItems: number;
    blockedActions: number;
  }>;
  focusItems: readonly GrowthInternalOperatorFocusItem[];
  signalBriefs: readonly GrowthInternalSignalBrief[];
  meetingAgenda: readonly string[];
  followUpPlans: readonly GrowthInternalFollowUpPlan[];
  markdown: string;
  safety: Readonly<{
    sendsEmail: false;
    createsCalendarEvent: false;
    postsExternally: false;
    submitsForms: false;
    writesProvider: false;
    promotesCanonicalRecord: false;
    automaticRetryAllowed: false;
  }>;
}>;

function fail(code: string): never {
  throw new Error(code);
}

function canonicalTimestamp(value: unknown): string {
  if (typeof value !== "string" || value.length > 80) {
    fail("GROWTH_INTERNAL_OPERATOR_PACK_TIME_INVALID");
  }
  const milliseconds = Date.parse(value);
  if (!Number.isFinite(milliseconds)) {
    fail("GROWTH_INTERNAL_OPERATOR_PACK_TIME_INVALID");
  }
  const canonical = new Date(milliseconds).toISOString();
  if (canonical !== value) fail("GROWTH_INTERNAL_OPERATOR_PACK_TIME_INVALID");
  return canonical;
}

function boundedText(value: unknown, code: string, maximum = 2_000): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length < 1 ||
    value.length > maximum ||
    /\p{Cc}/u.test(value)
  ) fail(code);
  return value;
}

function optionalText(value: unknown, code: string, maximum = 2_000): string | null {
  if (value === null || value === undefined || value === "") return null;
  return boundedText(value, code, maximum);
}

function identifier(value: unknown, code: string): string {
  const text = boundedText(value, code, 160);
  if (!/^[A-Za-z0-9][A-Za-z0-9:._-]{1,158}[A-Za-z0-9]$/.test(text) || text.includes("..")) {
    fail(code);
  }
  return text;
}

function boundedScore(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
    fail(code);
  }
  return value;
}

function sourceUrl(value: unknown): string {
  const text = boundedText(value, "GROWTH_INTERNAL_OPERATOR_PACK_SOURCE_URL_INVALID", 2_048);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    fail("GROWTH_INTERNAL_OPERATOR_PACK_SOURCE_URL_INVALID");
  }
  const localHttp = parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname);
  if (
    (parsed.protocol !== "https:" && !localHttp) ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) fail("GROWTH_INTERNAL_OPERATOR_PACK_SOURCE_URL_INVALID");
  return parsed.toString();
}

function frozenStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...values]);
}

function titleForSignal(signal: GrowthInternalOperatorPackSignal): string {
  return signal.sourceTitle || `${signal.signalType} signal`;
}

function normalizeSignal(value: GrowthInternalOperatorPackSignal): GrowthInternalOperatorPackSignal {
  return Object.freeze({
    id: identifier(value.id, "GROWTH_INTERNAL_OPERATOR_PACK_SIGNAL_INVALID"),
    sourceUrl: sourceUrl(value.sourceUrl),
    sourceTitle: optionalText(value.sourceTitle, "GROWTH_INTERNAL_OPERATOR_PACK_SIGNAL_INVALID", 500),
    signalType: boundedText(value.signalType, "GROWTH_INTERNAL_OPERATOR_PACK_SIGNAL_INVALID", 120),
    evidence: boundedText(value.evidence, "GROWTH_INTERNAL_OPERATOR_PACK_SIGNAL_INVALID", 4_000),
    urgency: boundedScore(value.urgency, "GROWTH_INTERNAL_OPERATOR_PACK_SIGNAL_INVALID"),
    fitScore: boundedScore(value.fitScore, "GROWTH_INTERNAL_OPERATOR_PACK_SIGNAL_INVALID"),
    riskScore: boundedScore(value.riskScore, "GROWTH_INTERNAL_OPERATOR_PACK_SIGNAL_INVALID"),
    status: boundedText(value.status, "GROWTH_INTERNAL_OPERATOR_PACK_SIGNAL_INVALID", 80),
    discoveredAt: canonicalTimestamp(value.discoveredAt),
  });
}

function normalizeAction(value: GrowthInternalOperatorPackAction): GrowthInternalOperatorPackAction {
  if (!Array.isArray(value.riskFlags) || value.riskFlags.length > 20) {
    fail("GROWTH_INTERNAL_OPERATOR_PACK_ACTION_INVALID");
  }
  const riskFlags = value.riskFlags.map((flag) => {
    if (typeof flag === "string") return boundedText(flag, "GROWTH_INTERNAL_OPERATOR_PACK_ACTION_INVALID", 500);
    if (typeof flag === "number" || typeof flag === "boolean") return flag;
    fail("GROWTH_INTERNAL_OPERATOR_PACK_ACTION_INVALID");
  });
  return Object.freeze({
    id: identifier(value.id, "GROWTH_INTERNAL_OPERATOR_PACK_ACTION_INVALID"),
    signalId: value.signalId === null ? null : identifier(value.signalId, "GROWTH_INTERNAL_OPERATOR_PACK_ACTION_INVALID"),
    actionType: boundedText(value.actionType, "GROWTH_INTERNAL_OPERATOR_PACK_ACTION_INVALID", 120),
    reason: boundedText(value.reason, "GROWTH_INTERNAL_OPERATOR_PACK_ACTION_INVALID", 2_000),
    contextEvidence: optionalText(value.contextEvidence, "GROWTH_INTERNAL_OPERATOR_PACK_ACTION_INVALID", 2_000),
    evavoFitExplanation: optionalText(value.evavoFitExplanation, "GROWTH_INTERNAL_OPERATOR_PACK_ACTION_INVALID", 2_000),
    riskFlags: Object.freeze(riskFlags),
    status: boundedText(value.status, "GROWTH_INTERNAL_OPERATOR_PACK_ACTION_INVALID", 80),
    blockedReason: optionalText(value.blockedReason, "GROWTH_INTERNAL_OPERATOR_PACK_ACTION_INVALID", 1_000),
    updatedAt: canonicalTimestamp(value.updatedAt),
  });
}

function urgencyForAction(action: GrowthInternalOperatorPackAction): "now" | "next" | "monitor" {
  if (action.blockedReason || ["needs_review", "blocked"].includes(action.status)) return "now";
  if (["queued", "approved"].includes(action.status)) return "next";
  return "monitor";
}

function focusItems(
  suggestedFocus: readonly string[],
  signals: readonly GrowthInternalOperatorPackSignal[],
  actions: readonly GrowthInternalOperatorPackAction[],
): readonly GrowthInternalOperatorFocusItem[] {
  const items: GrowthInternalOperatorFocusItem[] = [];
  for (const action of actions) {
    items.push(Object.freeze({
      id: action.id,
      kind: "action",
      urgency: urgencyForAction(action),
      title: action.actionType,
      context: action.reason,
      nextSafeDecision: action.blockedReason
        ? `Resolve the blocking reason before any further work: ${action.blockedReason}`
        : "Confirm evidence, risk and owner intent before changing the action status.",
    }));
  }
  for (const signal of signals) {
    const urgency = signal.urgency >= 75 || signal.fitScore >= 75 ? "next" : "monitor";
    items.push(Object.freeze({
      id: signal.id,
      kind: "signal",
      urgency,
      title: titleForSignal(signal),
      context: signal.evidence,
      nextSafeDecision: "Decide whether to investigate, watch, convert to an internal action or mark the signal inactive.",
    }));
  }
  suggestedFocus.forEach((focus, index) => {
    items.push(Object.freeze({
      id: `system-focus-${String(index + 1).padStart(2, "0")}`,
      kind: "system",
      urgency: "next",
      title: "System focus",
      context: focus,
      nextSafeDecision: "Review the underlying records before changing any internal state.",
    }));
  });
  const rank = { now: 0, next: 1, monitor: 2 } as const;
  return Object.freeze(items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => rank[left.item.urgency] - rank[right.item.urgency] || left.index - right.index)
    .slice(0, MAX_FOCUS)
    .map(({ item }) => item));
}

function signalBriefs(signals: readonly GrowthInternalOperatorPackSignal[]): readonly GrowthInternalSignalBrief[] {
  return Object.freeze(signals.slice(0, 8).map((signal) => Object.freeze({
    signalId: signal.id,
    title: titleForSignal(signal),
    sourceUrl: signal.sourceUrl,
    status: signal.status,
    evidence: signal.evidence,
    fitScore: signal.fitScore,
    urgency: signal.urgency,
    riskScore: signal.riskScore,
    questions: frozenStrings([
      "Is the public evidence current, attributable and directly relevant to EVAVO?",
      "What active need, timing, budget or decision-maker signal is actually present?",
      "What would disconfirm this signal or make it unsuitable for follow-up?",
    ]),
  })));
}

function meetingAgenda(
  signals: readonly GrowthInternalOperatorPackSignal[],
  actions: readonly GrowthInternalOperatorPackAction[],
): readonly string[] {
  return frozenStrings([
    `Review ${signals.length} saved signal(s), prioritising evidence quality, fit, urgency and downside.`,
    `Review ${actions.length} saved action(s), starting with blocked and needs-review items.`,
    "Resolve missing evidence, stale assumptions, duplicate records and suppression concerns.",
    "Choose the smallest safe internal next action for each item that should remain active.",
    "Assign owners and review dates without sending, posting, creating meetings or writing providers.",
  ]);
}

function followUpPlans(actions: readonly GrowthInternalOperatorPackAction[]): readonly GrowthInternalFollowUpPlan[] {
  return Object.freeze(actions.slice(0, 8).map((action) => Object.freeze({
    actionId: action.id,
    actionType: action.actionType,
    status: action.status,
    objective: `Prepare an owner-reviewed internal follow-up plan for ${action.actionType}.`,
    talkingPoints: frozenStrings([
      `Why this is being considered: ${action.reason}`,
      action.contextEvidence
        ? `Evidence context: ${action.contextEvidence}`
        : "Evidence context is missing and must be supplied before communication.",
      action.evavoFitExplanation
        ? `EVAVO fit: ${action.evavoFitExplanation}`
        : "EVAVO fit has not been explained and should be reviewed.",
      action.riskFlags.length
        ? `Risk flags: ${action.riskFlags.map(String).join(", ")}`
        : "No risk flags were recorded; treat this as incomplete risk analysis rather than zero risk.",
    ]),
    blockedReason: action.blockedReason,
    deliveryAllowed: false,
  })));
}

function markdownFor(
  generatedAt: string,
  intensity: GrowthInternalOperatorPackIntensity,
  focus: readonly GrowthInternalOperatorFocusItem[],
  signalItems: readonly GrowthInternalSignalBrief[],
  agenda: readonly string[],
  followUps: readonly GrowthInternalFollowUpPlan[],
): string {
  const lines = [
    "# EVAVO Growth internal operator pack",
    "",
    `Generated: ${generatedAt}`,
    `Activity profile: ${intensity}`,
    "",
    "> Deterministic Worker output. No AI, outbound network call, email, calendar event, social post, form submission, provider write or canonical promotion.",
    "",
    "## Focus queue",
  ];
  if (!focus.length) lines.push("- No focus item is currently available from the saved review models.");
  for (const item of focus) lines.push(`- **${item.urgency.toUpperCase()} · ${item.title}** — ${item.nextSafeDecision}`);
  lines.push("", "## Signal review");
  if (!signalItems.length) lines.push("- No saved Growth signal is currently available.");
  for (const signal of signalItems) lines.push(`- **${signal.title}** — fit ${signal.fitScore}, urgency ${signal.urgency}, risk ${signal.riskScore}. ${signal.evidence}`);
  lines.push("", "## Meeting agenda");
  agenda.forEach((item, index) => lines.push(`${index + 1}. ${item}`));
  lines.push("", "## Follow-up plans");
  if (!followUps.length) lines.push("- No saved Growth action is currently available.");
  for (const plan of followUps) lines.push(`- **${plan.actionType}** — ${plan.objective} Delivery remains blocked.`);
  const markdown = `${lines.join("\n")}\n`;
  if (new TextEncoder().encode(markdown).byteLength > MAX_MARKDOWN_BYTES) {
    fail("GROWTH_INTERNAL_OPERATOR_PACK_TOO_LARGE");
  }
  return markdown;
}

export function composeGrowthInternalOperatorPack(
  input: GrowthInternalOperatorPackInput,
): GrowthInternalOperatorPackDto {
  if (
    !input ||
    input.externalExecutionRequested !== false ||
    input.canonicalPromotionRequested !== false ||
    !["paused", "light", "balanced", "high"].includes(input.intensity) ||
    !Array.isArray(input.suggestedFocus) ||
    input.suggestedFocus.length > 10 ||
    !Array.isArray(input.signals) ||
    input.signals.length > MAX_SIGNALS ||
    !Array.isArray(input.actions) ||
    input.actions.length > MAX_ACTIONS
  ) fail("GROWTH_INTERNAL_OPERATOR_PACK_INPUT_INVALID");

  const generatedAt = canonicalTimestamp(input.generatedAt);
  const suggestedFocus = input.suggestedFocus.map((value) =>
    boundedText(value, "GROWTH_INTERNAL_OPERATOR_PACK_FOCUS_INVALID", 1_000),
  );
  const signals = Object.freeze(input.signals.map(normalizeSignal));
  const actions = Object.freeze(input.actions.map(normalizeAction));
  const focus = focusItems(suggestedFocus, signals, actions);
  const signalItems = signalBriefs(signals);
  const agenda = meetingAgenda(signals, actions);
  const followUps = followUpPlans(actions);

  return Object.freeze({
    contractVersion: GROWTH_INTERNAL_OPERATOR_PACK_VERSION,
    generatedAt,
    source: "worker_d1_review_models",
    intensity: input.intensity,
    deterministic: true,
    aiGenerated: false,
    callsNetwork: false,
    externalExecutionEnabled: false,
    canonicalPromotionEnabled: false,
    summary: Object.freeze({
      signalsReviewed: signals.length,
      actionsReviewed: actions.length,
      focusItems: focus.length,
      followUpPlans: followUps.length,
      missingEvidenceItems: actions.filter((action) => !action.contextEvidence).length,
      blockedActions: actions.filter((action) => Boolean(action.blockedReason) || action.status === "blocked").length,
    }),
    focusItems: focus,
    signalBriefs: signalItems,
    meetingAgenda: agenda,
    followUpPlans: followUps,
    markdown: markdownFor(generatedAt, input.intensity, focus, signalItems, agenda, followUps),
    safety: Object.freeze({
      sendsEmail: false,
      createsCalendarEvent: false,
      postsExternally: false,
      submitsForms: false,
      writesProvider: false,
      promotesCanonicalRecord: false,
      automaticRetryAllowed: false,
    }),
  });
}
