import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import {
  GROWTH_DISCOVERY_ALLOWED_DECISIONS,
  type GrowthAgentDecisionType,
} from "../core/growthAutonomousDiscovery";
import {
  enqueueGrowthFetchWork,
  listGrowthAgentDecisions,
  listGrowthDiscoveryFeedback,
  listGrowthExtractedSignals,
  listGrowthOpportunityScores,
  listGrowthResearchRuns,
  listGrowthSourceCandidates,
  saveGrowthAgentDecision,
  saveGrowthDiscoveryFeedback,
  saveGrowthResearchRun,
  saveGrowthSourceCandidate,
} from "../core/growthAutonomousDiscoveryRecords";
import {
  growthInternalWriteFailurePayload,
  readGrowthInternalWriteRequest,
} from "../core/growthInternalWriteRequest";

export type JsonResponse = (data: any, init?: ResponseInit) => Response;
type UnknownRecord = Record<string, unknown>;

const READ_SAFETY = Object.freeze({
  readOnly: true,
  internalMetadataOnly: true,
  externalStateChange: false,
  callsAI: false,
  callsNetwork: false,
  canSendEmail: false,
  canPostSocial: false,
  canSubmitForms: false,
  rawErrorExposed: false,
});
const WRITE_SAFETY = Object.freeze({
  ...READ_SAFETY,
  readOnly: false,
  boundedJsonRequired: true,
  exactBooleanConfirmationRequired: true,
  confirmationCoercionAllowed: false,
  queryConfirmationAllowed: false,
  sensitiveInputKeysAllowed: false,
  savesReviewItemsOnly: true,
});

const DISCOVERY_STATUSES = new Set([
  "planned",
  "discovered",
  "rejected",
  "queued_for_policy_check",
  "queued_for_research",
  "researched",
  "scored",
  "needs_operator_review",
]);
const ALLOWED_DECISIONS = new Set<GrowthAgentDecisionType>(GROWTH_DISCOVERY_ALLOWED_DECISIONS);
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const RESEARCH_RUN_KEYS = new Set([
  "id",
  "status",
  "objective",
  "industryFocus",
  "industry_focus",
  "geoFocus",
  "geo_focus",
  "serviceFocus",
  "service_focus",
  "candidateLimit",
  "candidate_limit",
  "crawlBudget",
  "crawl_budget",
  "blockedActions",
  "blocked_actions",
  "scoringRubric",
  "scoring_rubric",
  "notes",
]);
const RESEARCH_RUN_BODY_KEYS = new Set(["researchRun", "run", "id"]);
const SOURCE_CANDIDATE_KEYS = new Set([
  "id",
  "researchRunId",
  "research_run_id",
  "status",
  "domain",
  "url",
  "canonicalUrl",
  "canonical_url",
  "sourceType",
  "source_type",
  "discoveryMethod",
  "discovery_method",
  "discoveryQuery",
  "discovery_query",
  "industryHint",
  "industry_hint",
  "geoHint",
  "geo_hint",
  "serviceMatchHint",
  "service_match_hint",
  "robotsStatus",
  "robots_status",
  "crawlAllowed",
  "crawl_allowed",
  "fitScore",
  "fit_score",
  "needScore",
  "need_score",
  "confidenceScore",
  "confidence_score",
  "riskFlags",
  "risk_flags",
  "evidenceSummary",
  "evidence_summary",
]);
const SOURCE_CANDIDATE_BODY_KEYS = new Set(["candidate", "sourceCandidate", "id"]);
const FETCH_QUEUE_KEYS = new Set([
  "id",
  "candidateId",
  "candidate_id",
  "url",
  "purpose",
  "maxBytes",
  "max_bytes",
  "maxRedirects",
  "max_redirects",
]);
const FETCH_QUEUE_BODY_KEYS = new Set(["fetch", "queueItem", "id"]);
const AGENT_DECISION_KEYS = new Set([
  "id",
  "candidateId",
  "candidate_id",
  "researchRunId",
  "research_run_id",
  "decisionType",
  "decision_type",
  "reason",
  "evidence",
  "blockedActions",
  "blocked_actions",
  "nextInternalStep",
  "next_internal_step",
  "confidence",
]);
const AGENT_DECISION_BODY_KEYS = new Set(["decision", "id"]);
const FEEDBACK_KEYS = new Set([
  "id",
  "candidateId",
  "candidate_id",
  "researchRunId",
  "research_run_id",
  "feedbackType",
  "feedback_type",
  "feedbackNote",
  "feedback_note",
  "reviewer",
  "learning",
  "learning_json",
]);
const FEEDBACK_BODY_KEYS = new Set(["feedback", "id"]);

function intParam(url: URL, key: string, fallback: number, min: number, max: number): number {
  const raw = url.searchParams.get(key);
  if (raw === null || raw === "") return fallback;
  if (!/^\d+$/.test(raw)) throw new Error("GROWTH_DISCOVERY_QUERY_INVALID");
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error("GROWTH_DISCOVERY_QUERY_INVALID");
  return Math.max(min, Math.min(max, value));
}

function optionalQueryText(url: URL, key: string, maximum: number): string | undefined {
  const raw = url.searchParams.get(key);
  if (raw === null || raw === "") return undefined;
  if (raw.trim() !== raw || raw.length > maximum || /\p{Cc}/u.test(raw)) {
    throw new Error("GROWTH_DISCOVERY_QUERY_INVALID");
  }
  return raw;
}

function recordValue(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as UnknownRecord;
}

function exactKeys(record: UnknownRecord, allowed: ReadonlySet<string>, code: string): void {
  if (Object.keys(record).some((key) => !allowed.has(key))) throw new Error(code);
}

function boundedRequiredText(value: unknown, code: string, maximum = 1_000): string {
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    !value ||
    value.length > maximum ||
    /\p{Cc}/u.test(value)
  ) throw new Error(code);
  return value;
}

function boundedOptionalText(value: unknown, code: string, maximum: number): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  return boundedRequiredText(value, code, maximum);
}

function optionalIdentifier(value: unknown, code: string): string | undefined {
  const text = boundedOptionalText(value, code, 160);
  if (text && text.includes("..")) throw new Error(code);
  return text;
}

function equivalent(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function aliasedValue(record: UnknownRecord, camel: string, snake: string, code: string): unknown {
  const camelPresent = Object.prototype.hasOwnProperty.call(record, camel);
  const snakePresent = Object.prototype.hasOwnProperty.call(record, snake);
  if (camelPresent && snakePresent && !equivalent(record[camel], record[snake])) {
    throw new Error(code);
  }
  return camelPresent ? record[camel] : record[snake];
}

function wrappedRecord(
  body: UnknownRecord,
  wrapperKeys: readonly string[],
  bodyKeys: ReadonlySet<string>,
  inputKeys: ReadonlySet<string>,
  code: string,
): Readonly<{ record: UnknownRecord; id: string | undefined }> {
  const wrappers = wrapperKeys.filter((key) => body[key] !== undefined);
  if (wrappers.length > 1) throw new Error(`${code}_WRAPPER_CONFLICT`);
  const wrapped = wrappers.length === 1;
  exactKeys(body, wrapped ? bodyKeys : inputKeys, `${code}_KEYS_INVALID`);
  const record = wrapped
    ? recordValue(body[wrappers[0]!], `${code}_BODY_INVALID`)
    : body;
  exactKeys(record, inputKeys, `${code}_FIELDS_INVALID`);
  const outerId = optionalIdentifier(body.id, `${code}_ID_INVALID`);
  const innerId = optionalIdentifier(record.id, `${code}_ID_INVALID`);
  if (outerId && innerId && outerId !== innerId) throw new Error(`${code}_ID_CONFLICT`);
  return Object.freeze({ record, id: outerId ?? innerId });
}

function boundedNumber(
  value: unknown,
  code: string,
  minimum: number,
  maximum: number,
): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(code);
  }
  return value;
}

function boundedInteger(
  value: unknown,
  code: string,
  minimum: number,
  maximum: number,
): number | undefined {
  const number = boundedNumber(value, code, minimum, maximum);
  if (number !== undefined && !Number.isSafeInteger(number)) throw new Error(code);
  return number;
}

function boundedBoolean(value: unknown, code: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "boolean") throw new Error(code);
  return value;
}

function optionalPublicUrl(value: unknown, code: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const text = boundedRequiredText(value, code, 2_048);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    throw new Error(code);
  }
  const localHttp = parsed.protocol === "http:" && LOCAL_HOSTS.has(parsed.hostname);
  if (
    (parsed.protocol !== "https:" && !localHttp) ||
    parsed.username ||
    parsed.password ||
    parsed.hash
  ) throw new Error(code);
  return parsed.toString();
}

function publicUrl(value: unknown, code: string): string {
  const url = optionalPublicUrl(value, code);
  if (!url) throw new Error(code);
  return url;
}

function domain(value: unknown): string {
  const text = boundedRequiredText(value, "GROWTH_DISCOVERY_DOMAIN_INVALID", 255).toLowerCase();
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(text)) {
    throw new Error("GROWTH_DISCOVERY_DOMAIN_INVALID");
  }
  return text;
}

function arrayValue(value: unknown, code: string, maximum = 100): readonly unknown[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!Array.isArray(value) || value.length > maximum) throw new Error(code);
  return Object.freeze([...value]);
}

function objectValue(value: unknown, code: string): Readonly<UnknownRecord> | undefined {
  if (value === undefined || value === null) return undefined;
  return Object.freeze({ ...recordValue(value, code) });
}

function researchRunInput(body: UnknownRecord) {
  const { record, id } = wrappedRecord(
    body,
    ["researchRun", "run"],
    RESEARCH_RUN_BODY_KEYS,
    RESEARCH_RUN_KEYS,
    "GROWTH_DISCOVERY_RESEARCH_RUN",
  );
  const status = boundedOptionalText(record.status, "GROWTH_DISCOVERY_STATUS_INVALID", 64);
  if (status && !DISCOVERY_STATUSES.has(status)) throw new Error("GROWTH_DISCOVERY_STATUS_INVALID");
  return Object.freeze({
    id,
    input: Object.freeze({
      ...(status ? { status } : {}),
      objective: boundedRequiredText(record.objective, "GROWTH_DISCOVERY_OBJECTIVE_INVALID", 1_000),
      industryFocus: boundedOptionalText(
        aliasedValue(record, "industryFocus", "industry_focus", "GROWTH_DISCOVERY_INDUSTRY_CONFLICT"),
        "GROWTH_DISCOVERY_INDUSTRY_INVALID",
        300,
      ),
      geoFocus: boundedOptionalText(
        aliasedValue(record, "geoFocus", "geo_focus", "GROWTH_DISCOVERY_GEO_CONFLICT"),
        "GROWTH_DISCOVERY_GEO_INVALID",
        300,
      ),
      serviceFocus: boundedOptionalText(
        aliasedValue(record, "serviceFocus", "service_focus", "GROWTH_DISCOVERY_SERVICE_CONFLICT"),
        "GROWTH_DISCOVERY_SERVICE_INVALID",
        300,
      ),
      candidateLimit: boundedInteger(
        aliasedValue(record, "candidateLimit", "candidate_limit", "GROWTH_DISCOVERY_CANDIDATE_LIMIT_CONFLICT"),
        "GROWTH_DISCOVERY_CANDIDATE_LIMIT_INVALID",
        1,
        250,
      ),
      crawlBudget: objectValue(
        aliasedValue(record, "crawlBudget", "crawl_budget", "GROWTH_DISCOVERY_CRAWL_BUDGET_CONFLICT"),
        "GROWTH_DISCOVERY_CRAWL_BUDGET_INVALID",
      ),
      blockedActions: arrayValue(
        aliasedValue(record, "blockedActions", "blocked_actions", "GROWTH_DISCOVERY_BLOCKED_ACTIONS_CONFLICT"),
        "GROWTH_DISCOVERY_BLOCKED_ACTIONS_INVALID",
        32,
      ),
      scoringRubric: objectValue(
        aliasedValue(record, "scoringRubric", "scoring_rubric", "GROWTH_DISCOVERY_SCORING_RUBRIC_CONFLICT"),
        "GROWTH_DISCOVERY_SCORING_RUBRIC_INVALID",
      ),
      notes: boundedOptionalText(record.notes, "GROWTH_DISCOVERY_NOTES_INVALID", 2_000),
    }),
  });
}

function sourceCandidateInput(body: UnknownRecord) {
  const { record, id } = wrappedRecord(
    body,
    ["candidate", "sourceCandidate"],
    SOURCE_CANDIDATE_BODY_KEYS,
    SOURCE_CANDIDATE_KEYS,
    "GROWTH_DISCOVERY_SOURCE_CANDIDATE",
  );
  const status = boundedOptionalText(record.status, "GROWTH_DISCOVERY_STATUS_INVALID", 64);
  if (status && !DISCOVERY_STATUSES.has(status)) throw new Error("GROWTH_DISCOVERY_STATUS_INVALID");
  return Object.freeze({
    id,
    input: Object.freeze({
      researchRunId: optionalIdentifier(
        aliasedValue(record, "researchRunId", "research_run_id", "GROWTH_DISCOVERY_RESEARCH_RUN_ID_CONFLICT"),
        "GROWTH_DISCOVERY_RESEARCH_RUN_ID_INVALID",
      ),
      ...(status ? { status } : {}),
      domain: domain(record.domain),
      url: publicUrl(record.url, "GROWTH_DISCOVERY_SOURCE_URL_INVALID"),
      canonicalUrl: optionalPublicUrl(
        aliasedValue(record, "canonicalUrl", "canonical_url", "GROWTH_DISCOVERY_CANONICAL_URL_CONFLICT"),
        "GROWTH_DISCOVERY_CANONICAL_URL_INVALID",
      ),
      sourceType: boundedRequiredText(
        aliasedValue(record, "sourceType", "source_type", "GROWTH_DISCOVERY_SOURCE_TYPE_CONFLICT"),
        "GROWTH_DISCOVERY_SOURCE_TYPE_INVALID",
        128,
      ),
      discoveryMethod: boundedRequiredText(
        aliasedValue(record, "discoveryMethod", "discovery_method", "GROWTH_DISCOVERY_METHOD_CONFLICT"),
        "GROWTH_DISCOVERY_METHOD_INVALID",
        128,
      ),
      discoveryQuery: boundedOptionalText(
        aliasedValue(record, "discoveryQuery", "discovery_query", "GROWTH_DISCOVERY_QUERY_CONFLICT"),
        "GROWTH_DISCOVERY_QUERY_TEXT_INVALID",
        1_000,
      ),
      industryHint: boundedOptionalText(
        aliasedValue(record, "industryHint", "industry_hint", "GROWTH_DISCOVERY_INDUSTRY_HINT_CONFLICT"),
        "GROWTH_DISCOVERY_INDUSTRY_HINT_INVALID",
        300,
      ),
      geoHint: boundedOptionalText(
        aliasedValue(record, "geoHint", "geo_hint", "GROWTH_DISCOVERY_GEO_HINT_CONFLICT"),
        "GROWTH_DISCOVERY_GEO_HINT_INVALID",
        300,
      ),
      serviceMatchHint: boundedOptionalText(
        aliasedValue(record, "serviceMatchHint", "service_match_hint", "GROWTH_DISCOVERY_SERVICE_HINT_CONFLICT"),
        "GROWTH_DISCOVERY_SERVICE_HINT_INVALID",
        500,
      ),
      robotsStatus: boundedOptionalText(
        aliasedValue(record, "robotsStatus", "robots_status", "GROWTH_DISCOVERY_ROBOTS_CONFLICT"),
        "GROWTH_DISCOVERY_ROBOTS_INVALID",
        64,
      ),
      crawlAllowed: boundedBoolean(
        aliasedValue(record, "crawlAllowed", "crawl_allowed", "GROWTH_DISCOVERY_CRAWL_ALLOWED_CONFLICT"),
        "GROWTH_DISCOVERY_CRAWL_ALLOWED_INVALID",
      ),
      fitScore: boundedNumber(
        aliasedValue(record, "fitScore", "fit_score", "GROWTH_DISCOVERY_FIT_SCORE_CONFLICT"),
        "GROWTH_DISCOVERY_FIT_SCORE_INVALID",
        0,
        100,
      ),
      needScore: boundedNumber(
        aliasedValue(record, "needScore", "need_score", "GROWTH_DISCOVERY_NEED_SCORE_CONFLICT"),
        "GROWTH_DISCOVERY_NEED_SCORE_INVALID",
        0,
        100,
      ),
      confidenceScore: boundedNumber(
        aliasedValue(record, "confidenceScore", "confidence_score", "GROWTH_DISCOVERY_CONFIDENCE_SCORE_CONFLICT"),
        "GROWTH_DISCOVERY_CONFIDENCE_SCORE_INVALID",
        0,
        100,
      ),
      riskFlags: arrayValue(
        aliasedValue(record, "riskFlags", "risk_flags", "GROWTH_DISCOVERY_RISK_FLAGS_CONFLICT"),
        "GROWTH_DISCOVERY_RISK_FLAGS_INVALID",
        32,
      ),
      evidenceSummary: boundedOptionalText(
        aliasedValue(record, "evidenceSummary", "evidence_summary", "GROWTH_DISCOVERY_EVIDENCE_SUMMARY_CONFLICT"),
        "GROWTH_DISCOVERY_EVIDENCE_SUMMARY_INVALID",
        2_000,
      ),
    }),
  });
}

function fetchQueueInput(body: UnknownRecord) {
  const { record, id } = wrappedRecord(
    body,
    ["fetch", "queueItem"],
    FETCH_QUEUE_BODY_KEYS,
    FETCH_QUEUE_KEYS,
    "GROWTH_DISCOVERY_FETCH_QUEUE",
  );
  return Object.freeze({
    id,
    input: Object.freeze({
      candidateId: optionalIdentifier(
        aliasedValue(record, "candidateId", "candidate_id", "GROWTH_DISCOVERY_CANDIDATE_ID_CONFLICT"),
        "GROWTH_DISCOVERY_CANDIDATE_ID_INVALID",
      ) ?? (() => { throw new Error("GROWTH_DISCOVERY_CANDIDATE_ID_INVALID"); })(),
      url: publicUrl(record.url, "GROWTH_DISCOVERY_FETCH_URL_INVALID"),
      purpose: boundedRequiredText(record.purpose, "GROWTH_DISCOVERY_FETCH_PURPOSE_INVALID", 128),
      maxBytes: boundedInteger(
        aliasedValue(record, "maxBytes", "max_bytes", "GROWTH_DISCOVERY_MAX_BYTES_CONFLICT"),
        "GROWTH_DISCOVERY_MAX_BYTES_INVALID",
        1_000,
        1_000_000,
      ),
      maxRedirects: boundedInteger(
        aliasedValue(record, "maxRedirects", "max_redirects", "GROWTH_DISCOVERY_MAX_REDIRECTS_CONFLICT"),
        "GROWTH_DISCOVERY_MAX_REDIRECTS_INVALID",
        0,
        5,
      ),
    }),
  });
}

function agentDecisionInput(body: UnknownRecord) {
  const { record, id } = wrappedRecord(
    body,
    ["decision"],
    AGENT_DECISION_BODY_KEYS,
    AGENT_DECISION_KEYS,
    "GROWTH_DISCOVERY_AGENT_DECISION",
  );
  const decisionType = boundedRequiredText(
    aliasedValue(record, "decisionType", "decision_type", "GROWTH_DISCOVERY_DECISION_TYPE_CONFLICT"),
    "GROWTH_DISCOVERY_DECISION_TYPE_INVALID",
    128,
  ) as GrowthAgentDecisionType;
  if (!ALLOWED_DECISIONS.has(decisionType)) throw new Error("GROWTH_DISCOVERY_DECISION_TYPE_INVALID");
  const evidence = arrayValue(record.evidence, "GROWTH_DISCOVERY_DECISION_EVIDENCE_INVALID", 100) ?? Object.freeze([]);
  return Object.freeze({
    id,
    input: Object.freeze({
      candidateId: optionalIdentifier(
        aliasedValue(record, "candidateId", "candidate_id", "GROWTH_DISCOVERY_CANDIDATE_ID_CONFLICT"),
        "GROWTH_DISCOVERY_CANDIDATE_ID_INVALID",
      ),
      researchRunId: optionalIdentifier(
        aliasedValue(record, "researchRunId", "research_run_id", "GROWTH_DISCOVERY_RESEARCH_RUN_ID_CONFLICT"),
        "GROWTH_DISCOVERY_RESEARCH_RUN_ID_INVALID",
      ),
      decisionType,
      reason: boundedRequiredText(record.reason, "GROWTH_DISCOVERY_DECISION_REASON_INVALID", 2_000),
      evidence,
      blockedActions: arrayValue(
        aliasedValue(record, "blockedActions", "blocked_actions", "GROWTH_DISCOVERY_BLOCKED_ACTIONS_CONFLICT"),
        "GROWTH_DISCOVERY_BLOCKED_ACTIONS_INVALID",
        32,
      ),
      nextInternalStep: boundedOptionalText(
        aliasedValue(record, "nextInternalStep", "next_internal_step", "GROWTH_DISCOVERY_NEXT_STEP_CONFLICT"),
        "GROWTH_DISCOVERY_NEXT_STEP_INVALID",
        500,
      ),
      confidence: boundedNumber(record.confidence, "GROWTH_DISCOVERY_CONFIDENCE_INVALID", 0, 1),
    }),
  });
}

function feedbackInput(body: UnknownRecord) {
  const { record, id } = wrappedRecord(
    body,
    ["feedback"],
    FEEDBACK_BODY_KEYS,
    FEEDBACK_KEYS,
    "GROWTH_DISCOVERY_FEEDBACK",
  );
  return Object.freeze({
    id,
    input: Object.freeze({
      candidateId: optionalIdentifier(
        aliasedValue(record, "candidateId", "candidate_id", "GROWTH_DISCOVERY_CANDIDATE_ID_CONFLICT"),
        "GROWTH_DISCOVERY_CANDIDATE_ID_INVALID",
      ),
      researchRunId: optionalIdentifier(
        aliasedValue(record, "researchRunId", "research_run_id", "GROWTH_DISCOVERY_RESEARCH_RUN_ID_CONFLICT"),
        "GROWTH_DISCOVERY_RESEARCH_RUN_ID_INVALID",
      ),
      feedbackType: boundedRequiredText(
        aliasedValue(record, "feedbackType", "feedback_type", "GROWTH_DISCOVERY_FEEDBACK_TYPE_CONFLICT"),
        "GROWTH_DISCOVERY_FEEDBACK_TYPE_INVALID",
        128,
      ),
      feedbackNote: boundedRequiredText(
        aliasedValue(record, "feedbackNote", "feedback_note", "GROWTH_DISCOVERY_FEEDBACK_NOTE_CONFLICT"),
        "GROWTH_DISCOVERY_FEEDBACK_NOTE_INVALID",
        2_000,
      ),
      reviewer: boundedRequiredText(record.reviewer, "GROWTH_DISCOVERY_REVIEWER_INVALID", 128),
      learning: objectValue(
        aliasedValue(record, "learning", "learning_json", "GROWTH_DISCOVERY_LEARNING_CONFLICT"),
        "GROWTH_DISCOVERY_LEARNING_INVALID",
      ) ?? Object.freeze({}),
    }),
  });
}

async function confirmedBody(request: Request, json: JsonResponse) {
  const parsed = await readGrowthInternalWriteRequest(request);
  if (parsed.ok) return parsed;
  return {
    ...parsed,
    response: json({
      ...growthInternalWriteFailurePayload(parsed),
      safety: WRITE_SAFETY,
    }, { status: parsed.status }),
  } as const;
}

function requestReceipt(contractVersion: string) {
  return Object.freeze({
    contractVersion,
    bodySha256Available: true,
    exactBooleanConfirmation: true,
  });
}

function normalizedFailure(error: unknown): Readonly<{
  status: 400 | 503;
  payload: Readonly<Record<string, unknown>>;
}> {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const missingTable = /no such table: growth_(research_runs|source_candidates|fetch_queue|extracted_signals|opportunity_scores|agent_decisions|discovery_feedback)/i.test(message);
  const inputFailure = message.startsWith("GROWTH_DISCOVERY_");
  return Object.freeze({
    status: inputFailure ? 400 : 503,
    payload: Object.freeze({
      ok: false,
      mode: "growth_autonomous_discovery_error",
      error: missingTable
        ? "growth_autonomous_discovery_schema_missing"
        : inputFailure
          ? "growth_autonomous_discovery_invalid_request"
          : "growth_autonomous_discovery_failed",
      requiredMigration: missingTable ? "0020_growth_autonomous_discovery.sql" : null,
      rawErrorExposed: false,
      safety: inputFailure ? WRITE_SAFETY : READ_SAFETY,
    }),
  });
}

export async function handleGrowthAutonomousDiscoveryAdmin(
  request: Request,
  env: Env,
  pathname: string,
  json: JsonResponse,
): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) {
    return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  if (request.method === "OPTIONS") {
    return json(
      { ok: false, error: "method_not_allowed" },
      { status: 405, headers: { allow: "GET, POST" } },
    );
  }
  const url = new URL(request.url);
  if (request.method === "POST" && [...url.searchParams.keys()].length !== 0) {
    return json({
      ok: false,
      error: "query_not_supported",
      queryConfirmationAllowed: false,
      safety: WRITE_SAFETY,
    }, { status: 400 });
  }

  try {
    if (request.method === "GET" && pathname === "/admin/growth/discovery/research-runs") {
      const runs = await listGrowthResearchRuns(
        env,
        intParam(url, "limit", 25, 1, 100),
        optionalQueryText(url, "status", 64),
      );
      return json({ ok: true, mode: "growth_research_runs", runs, count: runs.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/discovery/source-candidates") {
      const candidates = await listGrowthSourceCandidates(
        env,
        intParam(url, "limit", 50, 1, 200),
        optionalQueryText(url, "status", 64),
      );
      return json({ ok: true, mode: "growth_source_candidates", candidates, count: candidates.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/discovery/signals") {
      const signals = await listGrowthExtractedSignals(env, intParam(url, "limit", 50, 1, 200));
      return json({ ok: true, mode: "growth_extracted_signals", signals, count: signals.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/discovery/opportunity-scores") {
      const scores = await listGrowthOpportunityScores(env, intParam(url, "limit", 50, 1, 200));
      return json({ ok: true, mode: "growth_opportunity_scores", scores, count: scores.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/discovery/agent-decisions") {
      const decisions = await listGrowthAgentDecisions(env, intParam(url, "limit", 50, 1, 200));
      return json({ ok: true, mode: "growth_agent_decisions", decisions, count: decisions.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/discovery/feedback") {
      const feedback = await listGrowthDiscoveryFeedback(env, intParam(url, "limit", 50, 1, 200));
      return json({ ok: true, mode: "growth_discovery_feedback", feedback, count: feedback.length, safety: READ_SAFETY });
    }

    if (request.method === "POST" && pathname === "/admin/growth/discovery/research-runs/plan") {
      const parsed = await confirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = researchRunInput(parsed.body);
      const run = await saveGrowthResearchRun(env, input, id);
      return json({
        ok: true,
        mode: "growth_research_run_planned",
        run,
        requestReceipt: requestReceipt(parsed.contractVersion),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/discovery/source-candidates") {
      const parsed = await confirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = sourceCandidateInput(parsed.body);
      const candidate = await saveGrowthSourceCandidate(env, input, id);
      return json({
        ok: true,
        mode: "growth_source_candidate_saved",
        candidate,
        requestReceipt: requestReceipt(parsed.contractVersion),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/discovery/fetch-queue") {
      const parsed = await confirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = fetchQueueInput(parsed.body);
      const queued = await enqueueGrowthFetchWork(env, input, id);
      return json({
        ok: true,
        mode: "growth_fetch_queue_enqueued_metadata_only",
        queued,
        requestReceipt: requestReceipt(parsed.contractVersion),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/discovery/agent-decisions") {
      const parsed = await confirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = agentDecisionInput(parsed.body);
      const decision = await saveGrowthAgentDecision(env, input, id);
      return json({
        ok: true,
        mode: "growth_agent_decision_recorded",
        decision,
        requestReceipt: requestReceipt(parsed.contractVersion),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/discovery/feedback") {
      const parsed = await confirmedBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = feedbackInput(parsed.body);
      const feedback = await saveGrowthDiscoveryFeedback(env, input, id);
      return json({
        ok: true,
        mode: "growth_discovery_feedback_saved",
        feedback,
        requestReceipt: requestReceipt(parsed.contractVersion),
        safety: WRITE_SAFETY,
      });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const failure = normalizedFailure(error);
    return json(failure.payload, { status: failure.status });
  }
}
