import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { analyzeGrowthCampaign, summarizeGrowthOperatorReadiness } from "../core/growthCampaignAnalysis";
import { planGrowthOperatorLoop } from "../core/growthOperatorLoop";
import { buildGrowthOperatorCycle } from "../core/growthOperatorCycle";
import { buildGrowthAutonomousRuntime } from "../core/growthAutonomousRuntime";
import { listGrowthOperatorCycleEvents, saveGrowthOperatorCycleEvent } from "../core/growthOperatorCycleEvents";
import { loadGrowthBlackboard } from "../core/growthBlackboard";
import { loadGrowthStrategyMemory } from "../core/growthStrategyMemory";
import {
  getLatestCampaignMetrics,
  listGrowthCampaigns,
  listGrowthExperiments,
  upsertGrowthCampaign,
  upsertGrowthExperiment,
  type GrowthCampaignInput,
  type GrowthExperimentInput,
} from "../core/growthCampaignIntelligence";
import { listGrowthDecisions, planGrowthCampaignDecision, saveGrowthDecision } from "../core/growthCampaignDecisions";
import {
  createGrowthEvidenceItem,
  createGrowthLearningNote,
  listGrowthCampaignMetrics,
  listGrowthEvidenceItems,
  listGrowthLearningNotes,
  upsertGrowthCampaignMetric,
  type GrowthCampaignMetricInput,
  type GrowthEvidenceInput,
  type GrowthLearningInput,
} from "../core/growthCampaignRecords";
import {
  growthInternalWriteFailurePayload,
  readGrowthInternalWriteRequest,
} from "../core/growthInternalWriteRequest";

type JsonResponse = (data: any, init?: ResponseInit) => Response;
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
});

const EMPTY_KEYS = new Set<string>();
const CAMPAIGN_INPUT_KEYS = new Set([
  "id",
  "name",
  "goal",
  "hypothesis",
  "targetSegment",
  "primaryOffer",
  "status",
  "priority",
  "riskLevel",
  "budgetProfile",
  "successMetric",
  "startDate",
  "endDate",
  "notes",
]);
const CAMPAIGN_BODY_KEYS = new Set(["campaign", "id"]);
const EXPERIMENT_INPUT_KEYS = new Set([
  "id",
  "campaignId",
  "name",
  "hypothesis",
  "variantA",
  "variantB",
  "variantC",
  "sampleSizeTarget",
  "decisionRule",
  "status",
  "winnerVariant",
  "confidenceScore",
]);
const EXPERIMENT_BODY_KEYS = new Set(["experiment", "id"]);
const METRIC_INPUT_KEYS = new Set([
  "id",
  "campaignId",
  "experimentId",
  "metricDate",
  "preparedCount",
  "reviewedCount",
  "positiveCount",
  "negativeCount",
  "meetingCount",
  "contentCount",
  "engagementCount",
  "costUnits",
  "healthState",
  "notes",
]);
const METRIC_BODY_KEYS = new Set(["metric", "id"]);
const EVIDENCE_INPUT_KEYS = new Set([
  "id",
  "campaignId",
  "experimentId",
  "targetRef",
  "evidenceType",
  "sourceUrl",
  "summary",
  "snapshot",
]);
const EVIDENCE_BODY_KEYS = new Set(["evidence", "id"]);
const LEARNING_INPUT_KEYS = new Set([
  "id",
  "campaignId",
  "experimentId",
  "noteType",
  "summary",
  "recommendation",
  "confidenceScore",
]);
const LEARNING_BODY_KEYS = new Set(["learning", "id"]);
const DECISION_PLAN_KEYS = new Set([
  "campaignId",
  "campaign",
  "pendingReviewCount",
  "evidenceCount",
]);
const DECISION_CAMPAIGN_KEYS = new Set(["id"]);

function intParam(url: URL, key: string, fallback: number, min: number, max: number): number {
  const raw = url.searchParams.get(key);
  if (raw === null || raw === "" || !/^\d+$/.test(raw)) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function recordValue(value: unknown, code: string): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as UnknownRecord;
}

function exactKeys(record: UnknownRecord, allowed: ReadonlySet<string>, code: string): void {
  if (Object.keys(record).some((key) => !allowed.has(key))) throw new Error(code);
}

function optionalIdentifier(value: unknown, code: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (
    typeof value !== "string" ||
    value.trim() !== value ||
    value.length < 2 ||
    value.length > 160 ||
    /\p{Cc}/u.test(value) ||
    value.includes("..")
  ) throw new Error(code);
  return value;
}

function boundedInteger(value: unknown, fallback: number, code: string, maximum = 10_000): number {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value > maximum) {
    throw new Error(code);
  }
  return value;
}

function wrappedInput(
  body: UnknownRecord,
  wrapperKey: string,
  bodyKeys: ReadonlySet<string>,
  inputKeys: ReadonlySet<string>,
  code: string,
): Readonly<{ input: Readonly<UnknownRecord>; id: string | undefined }> {
  const wrapped = body[wrapperKey] !== undefined;
  exactKeys(body, wrapped ? bodyKeys : inputKeys, `${code}_KEYS_INVALID`);
  const candidate = wrapped
    ? recordValue(body[wrapperKey], `${code}_BODY_INVALID`)
    : body;
  exactKeys(candidate, inputKeys, `${code}_FIELDS_INVALID`);
  const outerId = optionalIdentifier(body.id, `${code}_ID_INVALID`);
  const innerId = optionalIdentifier(candidate.id, `${code}_ID_INVALID`);
  if (outerId && innerId && outerId !== innerId) throw new Error(`${code}_ID_CONFLICT`);
  const id = outerId ?? innerId;
  const { id: _id, ...input } = candidate;
  return Object.freeze({ input: Object.freeze(input), id });
}

function decisionPlanInput(body: UnknownRecord): Readonly<{
  campaignId: string;
  pendingReviewCount: number;
  evidenceCount: number | null;
}> {
  exactKeys(body, DECISION_PLAN_KEYS, "GROWTH_CAMPAIGN_DECISION_KEYS_INVALID");
  const directCampaignId = optionalIdentifier(
    body.campaignId,
    "GROWTH_CAMPAIGN_DECISION_CAMPAIGN_ID_INVALID",
  );
  let nestedCampaignId: string | undefined;
  if (body.campaign !== undefined) {
    const campaign = recordValue(body.campaign, "GROWTH_CAMPAIGN_DECISION_CAMPAIGN_INVALID");
    exactKeys(campaign, DECISION_CAMPAIGN_KEYS, "GROWTH_CAMPAIGN_DECISION_CAMPAIGN_KEYS_INVALID");
    nestedCampaignId = optionalIdentifier(
      campaign.id,
      "GROWTH_CAMPAIGN_DECISION_CAMPAIGN_ID_INVALID",
    );
  }
  if (directCampaignId && nestedCampaignId && directCampaignId !== nestedCampaignId) {
    throw new Error("GROWTH_CAMPAIGN_DECISION_CAMPAIGN_ID_CONFLICT");
  }
  const campaignId = directCampaignId ?? nestedCampaignId;
  if (!campaignId) throw new Error("GROWTH_CAMPAIGN_DECISION_CAMPAIGN_ID_INVALID");
  return Object.freeze({
    campaignId,
    pendingReviewCount: boundedInteger(
      body.pendingReviewCount,
      0,
      "GROWTH_CAMPAIGN_DECISION_PENDING_REVIEW_INVALID",
    ),
    evidenceCount: body.evidenceCount === undefined
      ? null
      : boundedInteger(
          body.evidenceCount,
          0,
          "GROWTH_CAMPAIGN_DECISION_EVIDENCE_COUNT_INVALID",
        ),
  });
}

async function confirmedWriteBody(request: Request, json: JsonResponse) {
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

function requestReceipt(parsed: Readonly<{ contractVersion: string }>) {
  return Object.freeze({
    contractVersion: parsed.contractVersion,
    bodySha256Available: true,
    exactBooleanConfirmation: true,
  });
}

function normalizedFailure(error: unknown): Readonly<{
  status: 400 | 503;
  payload: Readonly<Record<string, unknown>>;
}> {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const missingGrowthTable = /no such table: growth_/i.test(message);
  const inputFailure =
    message.startsWith("GROWTH_CAMPAIGN_") ||
    /^growth_(campaign|experiment|metric|evidence|learning|decision)_/.test(message);
  return Object.freeze({
    status: inputFailure ? 400 : 503,
    payload: Object.freeze({
      ok: false,
      mode: "growth_campaign_intelligence_error",
      error: missingGrowthTable
        ? "growth_schema_missing"
        : inputFailure
          ? "growth_campaign_intelligence_invalid_request"
          : "growth_campaign_intelligence_failed",
      requiredMigration: missingGrowthTable
        ? "0014_growth_campaign_intelligence.sql through 0018_growth_cycle_memory_snapshots.sql"
        : null,
      rawErrorExposed: false,
      safety: inputFailure ? WRITE_SAFETY : READ_SAFETY,
    }),
  });
}

async function loadGrowthOperatorState(env: Env, url: URL) {
  const campaigns = await listGrowthCampaigns(env, intParam(url, "limit", 10, 1, 50), url.searchParams.get("status") || undefined);
  const experiments = await listGrowthExperiments(env, intParam(url, "experimentLimit", 10, 1, 50));
  const decisions = await listGrowthDecisions(env, intParam(url, "decisionLimit", 10, 1, 50));
  const metrics = await listGrowthCampaignMetrics(env, intParam(url, "metricLimit", 10, 1, 50));
  const evidence = await listGrowthEvidenceItems(env, intParam(url, "evidenceLimit", 10, 1, 50));
  const learning = await listGrowthLearningNotes(env, intParam(url, "learningLimit", 10, 1, 50));
  return { campaigns, experiments, decisions, metrics, evidence, learning };
}

async function loadGrowthCycleState(env: Env, url: URL) {
  const state = await loadGrowthOperatorState(env, url);
  const strategyMemory = await loadGrowthStrategyMemory(env);
  const blackboard = await loadGrowthBlackboard(env);
  return { ...state, strategyMemory, blackboard };
}

export async function handleGrowthCampaignIntelligenceAdmin(
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
    if (request.method === "GET" && pathname === "/admin/growth/autonomy") {
      const cycleState = await loadGrowthCycleState(env, url);
      const cycle = buildGrowthOperatorCycle(cycleState);
      return json(buildGrowthAutonomousRuntime({ operatorCycle: cycle, strategyMemory: cycleState.strategyMemory }));
    }

    if (request.method === "GET" && pathname === "/admin/growth/cycle") {
      return json(buildGrowthOperatorCycle(await loadGrowthCycleState(env, url)));
    }

    if (request.method === "GET" && pathname === "/admin/growth/cycle/events") {
      const events = await listGrowthOperatorCycleEvents(
        env,
        intParam(url, "limit", 25, 1, 100),
        url.searchParams.get("selectedStep") || undefined,
      );
      return json({ ok: true, mode: "growth_operator_cycle_events", events, count: events.length, safety: READ_SAFETY });
    }

    if (request.method === "POST" && pathname === "/admin/growth/cycle/record") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      exactKeys(parsed.body, EMPTY_KEYS, "GROWTH_CAMPAIGN_CYCLE_RECORD_KEYS_INVALID");
      const cycle = buildGrowthOperatorCycle(await loadGrowthCycleState(env, url));
      const event = await saveGrowthOperatorCycleEvent(env, cycle);
      return json({
        ok: true,
        mode: "growth_operator_cycle_recorded",
        event,
        cycle,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "GET" && pathname === "/admin/growth/operator") {
      const { campaigns, experiments, decisions, metrics, evidence, learning } = await loadGrowthOperatorState(env, url);
      const analyses = campaigns.map((campaign) => {
        const latestMetric = metrics.find((metric: any) => metric.campaign_id === campaign.id) as any;
        return analyzeGrowthCampaign({
          campaign,
          metrics: latestMetric || null,
          evidenceCount: evidence.filter((item: any) => item.campaign_id === campaign.id).length,
          learningCount: learning.filter((item: any) => item.campaign_id === campaign.id).length,
          decisionCount: decisions.filter((item) => item.campaign_id === campaign.id).length,
        });
      });
      return json({
        ok: true,
        mode: "growth_operator_intelligence",
        contractVersion: "growth_campaign_intelligence_v3_operator_loop_metadata_only",
        campaigns,
        experiments,
        decisions,
        metrics,
        evidence,
        learning,
        analyses,
        readiness: summarizeGrowthOperatorReadiness(analyses),
        loopPlan: planGrowthOperatorLoop({ campaigns, metrics, evidence, learning, decisions }),
        counts: {
          campaigns: campaigns.length,
          experiments: experiments.length,
          decisions: decisions.length,
          metrics: metrics.length,
          evidence: evidence.length,
          learning: learning.length,
          analyses: analyses.length,
        },
        safety: READ_SAFETY,
      });
    }

    if (request.method === "GET" && pathname === "/admin/growth/campaigns") {
      const campaigns = await listGrowthCampaigns(
        env,
        intParam(url, "limit", 25, 1, 100),
        url.searchParams.get("status") || undefined,
      );
      return json({ ok: true, mode: "growth_campaigns", campaigns, count: campaigns.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/experiments") {
      const experiments = await listGrowthExperiments(
        env,
        intParam(url, "limit", 25, 1, 100),
        url.searchParams.get("campaignId") || undefined,
      );
      return json({ ok: true, mode: "growth_experiments", experiments, count: experiments.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/decisions") {
      const decisions = await listGrowthDecisions(
        env,
        intParam(url, "limit", 25, 1, 100),
        url.searchParams.get("campaignId") || undefined,
      );
      return json({ ok: true, mode: "growth_decisions", decisions, count: decisions.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/metrics") {
      const metrics = await listGrowthCampaignMetrics(
        env,
        intParam(url, "limit", 25, 1, 100),
        url.searchParams.get("campaignId") || undefined,
      );
      return json({ ok: true, mode: "growth_campaign_metrics", metrics, count: metrics.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/evidence") {
      const evidence = await listGrowthEvidenceItems(
        env,
        intParam(url, "limit", 25, 1, 100),
        url.searchParams.get("campaignId") || undefined,
        url.searchParams.get("targetRef") || undefined,
      );
      return json({ ok: true, mode: "growth_evidence_items", evidence, count: evidence.length, safety: READ_SAFETY });
    }

    if (request.method === "GET" && pathname === "/admin/growth/learning") {
      const learning = await listGrowthLearningNotes(
        env,
        intParam(url, "limit", 25, 1, 100),
        url.searchParams.get("campaignId") || undefined,
      );
      return json({ ok: true, mode: "growth_learning_notes", learning, count: learning.length, safety: READ_SAFETY });
    }

    if (request.method === "POST" && pathname === "/admin/growth/campaigns") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "campaign",
        CAMPAIGN_BODY_KEYS,
        CAMPAIGN_INPUT_KEYS,
        "GROWTH_CAMPAIGN",
      );
      const saved = await upsertGrowthCampaign(env, input as unknown as GrowthCampaignInput, id);
      return json({
        ok: true,
        mode: "growth_campaign_saved",
        campaign: saved,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/experiments") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "experiment",
        EXPERIMENT_BODY_KEYS,
        EXPERIMENT_INPUT_KEYS,
        "GROWTH_EXPERIMENT",
      );
      const saved = await upsertGrowthExperiment(env, input as unknown as GrowthExperimentInput, id);
      return json({
        ok: true,
        mode: "growth_experiment_saved",
        experiment: saved,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/metrics") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "metric",
        METRIC_BODY_KEYS,
        METRIC_INPUT_KEYS,
        "GROWTH_METRIC",
      );
      const saved = await upsertGrowthCampaignMetric(env, input as unknown as GrowthCampaignMetricInput, id);
      return json({
        ok: true,
        mode: "growth_campaign_metric_saved",
        metric: saved,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/evidence") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "evidence",
        EVIDENCE_BODY_KEYS,
        EVIDENCE_INPUT_KEYS,
        "GROWTH_EVIDENCE",
      );
      const saved = await createGrowthEvidenceItem(env, input as unknown as GrowthEvidenceInput, id);
      return json({
        ok: true,
        mode: "growth_evidence_saved",
        evidence: saved,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/learning") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const { input, id } = wrappedInput(
        parsed.body,
        "learning",
        LEARNING_BODY_KEYS,
        LEARNING_INPUT_KEYS,
        "GROWTH_LEARNING",
      );
      const saved = await createGrowthLearningNote(env, input as unknown as GrowthLearningInput, id);
      return json({
        ok: true,
        mode: "growth_learning_note_saved",
        learning: saved,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    if (request.method === "POST" && pathname === "/admin/growth/decisions/plan") {
      const parsed = await confirmedWriteBody(request, json);
      if (!parsed.ok) return parsed.response;
      const input = decisionPlanInput(parsed.body);
      const campaigns = await listGrowthCampaigns(env, 100);
      const campaign = campaigns.find((item) => item.id === input.campaignId);
      if (!campaign) {
        return json({
          ok: false,
          error: "campaign_not_found",
          campaignId: input.campaignId,
          rawErrorExposed: false,
          safety: WRITE_SAFETY,
        }, { status: 404 });
      }
      const experiments = await listGrowthExperiments(env, 10, campaign.id);
      const experiment = experiments.find((item) => ["active", "testing", "draft"].includes(item.status)) || experiments[0] || null;
      const metrics = await getLatestCampaignMetrics(env, campaign.id);
      const evidence = await listGrowthEvidenceItems(env, 100, campaign.id);
      const plan = planGrowthCampaignDecision({
        campaign,
        experiment,
        metrics,
        pendingReviewCount: input.pendingReviewCount,
        evidenceCount: input.evidenceCount ?? evidence.length,
      });
      const decision = await saveGrowthDecision(env, {
        campaignId: campaign.id,
        experimentId: experiment?.id || null,
        plan,
      });
      return json({
        ok: true,
        mode: "growth_decision_planned",
        decision,
        plan,
        requestReceipt: requestReceipt(parsed),
        safety: WRITE_SAFETY,
      });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const failure = normalizedFailure(error);
    return json(failure.payload, { status: failure.status });
  }
}
