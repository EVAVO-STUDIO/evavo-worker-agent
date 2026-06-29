import { Env, getAdminToken } from "../db";
import { analyzeGrowthCampaign, summarizeGrowthOperatorReadiness } from "../core/growthCampaignAnalysis";
import { planGrowthOperatorLoop } from "../core/growthOperatorLoop";
import { buildGrowthOperatorCycle } from "../core/growthOperatorCycle";
import { buildGrowthAutonomousRuntime } from "../core/growthAutonomousRuntime";
import { listGrowthOperatorCycleEvents, saveGrowthOperatorCycleEvent } from "../core/growthOperatorCycleEvents";
import { loadGrowthStrategyMemory } from "../core/growthStrategyMemory";
import {
  getLatestCampaignMetrics,
  listGrowthCampaigns,
  listGrowthExperiments,
  upsertGrowthCampaign,
  upsertGrowthExperiment,
} from "../core/growthCampaignIntelligence";
import { listGrowthDecisions, planGrowthCampaignDecision, saveGrowthDecision } from "../core/growthCampaignDecisions";
import {
  createGrowthEvidenceItem,
  createGrowthLearningNote,
  listGrowthCampaignMetrics,
  listGrowthEvidenceItems,
  listGrowthLearningNotes,
  upsertGrowthCampaignMetric,
} from "../core/growthCampaignRecords";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

function intParam(url: URL, key: string, fallback: number, min: number, max: number): number {
  const value = Number(url.searchParams.get(key));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

async function parseBody(request: Request): Promise<any> {
  return request.json().catch(() => ({}));
}

function confirmed(url: URL, body: any): boolean {
  return url.searchParams.get("confirm") === "1" || body?.confirm === true || body?.confirm === 1 || body?.confirm === "1";
}

function blockedWrite(json: JsonResponse) {
  return json({
    ok: false,
    error: "confirm_required",
    reason: "Campaign intelligence writes require confirmation and only write internal planning or analytics metadata.",
    safety: { readOnly: false, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false },
  }, { status: 400 });
}

function migrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const missingGrowthTable = /no such table: growth_/i.test(message);
  return {
    ok: false,
    mode: "growth_campaign_intelligence_error",
    error: missingGrowthTable ? "growth_schema_missing" : "growth_campaign_intelligence_failed",
    message,
    requiredMigration: missingGrowthTable ? "0014_growth_campaign_intelligence.sql, 0015_growth_operator_cycle_events.sql, or 0016_growth_strategy_memory.sql" : null,
    safety: { readOnly: true, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false },
  };
}

const readSafety = { readOnly: true, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false };
const writeSafety = { readOnly: false, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false };

async function loadGrowthOperatorState(env: Env, url: URL) {
  const campaigns = await listGrowthCampaigns(env, intParam(url, "limit", 10, 1, 50), url.searchParams.get("status") || undefined);
  const experiments = await listGrowthExperiments(env, intParam(url, "experimentLimit", 10, 1, 50));
  const decisions = await listGrowthDecisions(env, intParam(url, "decisionLimit", 10, 1, 50));
  const metrics = await listGrowthCampaignMetrics(env, intParam(url, "metricLimit", 10, 1, 50));
  const evidence = await listGrowthEvidenceItems(env, intParam(url, "evidenceLimit", 10, 1, 50));
  const learning = await listGrowthLearningNotes(env, intParam(url, "learningLimit", 10, 1, 50));
  return { campaigns, experiments, decisions, metrics, evidence, learning };
}

export async function handleGrowthCampaignIntelligenceAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);

  try {
    if (request.method === "GET" && pathname === "/admin/growth/autonomy") {
      const state = await loadGrowthOperatorState(env, url);
      const cycle = buildGrowthOperatorCycle(state);
      const strategyMemory = await loadGrowthStrategyMemory(env);
      return json(buildGrowthAutonomousRuntime({ operatorCycle: cycle, strategyMemory }));
    }

    if (request.method === "GET" && pathname === "/admin/growth/cycle") {
      return json(buildGrowthOperatorCycle(await loadGrowthOperatorState(env, url)));
    }

    if (request.method === "GET" && pathname === "/admin/growth/cycle/events") {
      const events = await listGrowthOperatorCycleEvents(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("selectedStep") || undefined);
      return json({ ok: true, mode: "growth_operator_cycle_events", events, count: events.length, safety: readSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/cycle/record") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const cycle = buildGrowthOperatorCycle(await loadGrowthOperatorState(env, url));
      const event = await saveGrowthOperatorCycleEvent(env, cycle);
      return json({ ok: true, mode: "growth_operator_cycle_recorded", event, cycle, safety: writeSafety });
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
        counts: { campaigns: campaigns.length, experiments: experiments.length, decisions: decisions.length, metrics: metrics.length, evidence: evidence.length, learning: learning.length, analyses: analyses.length },
        safety: readSafety,
      });
    }

    if (request.method === "GET" && pathname === "/admin/growth/campaigns") {
      const campaigns = await listGrowthCampaigns(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ ok: true, mode: "growth_campaigns", campaigns, count: campaigns.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/experiments") {
      const experiments = await listGrowthExperiments(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("campaignId") || undefined);
      return json({ ok: true, mode: "growth_experiments", experiments, count: experiments.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/decisions") {
      const decisions = await listGrowthDecisions(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("campaignId") || undefined);
      return json({ ok: true, mode: "growth_decisions", decisions, count: decisions.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/metrics") {
      const metrics = await listGrowthCampaignMetrics(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("campaignId") || undefined);
      return json({ ok: true, mode: "growth_campaign_metrics", metrics, count: metrics.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/evidence") {
      const evidence = await listGrowthEvidenceItems(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("campaignId") || undefined, url.searchParams.get("targetRef") || undefined);
      return json({ ok: true, mode: "growth_evidence_items", evidence, count: evidence.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/learning") {
      const learning = await listGrowthLearningNotes(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("campaignId") || undefined);
      return json({ ok: true, mode: "growth_learning_notes", learning, count: learning.length, safety: readSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/campaigns") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const saved = await upsertGrowthCampaign(env, body.campaign || body, body.id || body.campaign?.id);
      return json({ ok: true, mode: "growth_campaign_saved", campaign: saved, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/experiments") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const saved = await upsertGrowthExperiment(env, body.experiment || body, body.id || body.experiment?.id);
      return json({ ok: true, mode: "growth_experiment_saved", experiment: saved, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/metrics") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const saved = await upsertGrowthCampaignMetric(env, body.metric || body, body.id || body.metric?.id);
      return json({ ok: true, mode: "growth_campaign_metric_saved", metric: saved, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/evidence") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const saved = await createGrowthEvidenceItem(env, body.evidence || body, body.id || body.evidence?.id);
      return json({ ok: true, mode: "growth_evidence_saved", evidence: saved, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/learning") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const saved = await createGrowthLearningNote(env, body.learning || body, body.id || body.learning?.id);
      return json({ ok: true, mode: "growth_learning_note_saved", learning: saved, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/decisions/plan") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const campaignId = String(body.campaignId || body.campaign?.id || "");
      if (!campaignId) return json({ ok: false, error: "campaign_id_required" }, { status: 400 });
      const campaigns = await listGrowthCampaigns(env, 100);
      const campaign = campaigns.find((item) => item.id === campaignId);
      if (!campaign) return json({ ok: false, error: "campaign_not_found", campaignId }, { status: 404 });
      const experiments = await listGrowthExperiments(env, 10, campaign.id);
      const experiment = experiments.find((item) => ["active", "testing", "draft"].includes(item.status)) || experiments[0] || null;
      const metrics = await getLatestCampaignMetrics(env, campaign.id);
      const evidence = await listGrowthEvidenceItems(env, 100, campaign.id);
      const plan = planGrowthCampaignDecision({ campaign, experiment, metrics, pendingReviewCount: Number(body.pendingReviewCount || 0), evidenceCount: Number(body.evidenceCount || evidence.length || 0) });
      const decision = await saveGrowthDecision(env, { campaignId: campaign.id, experimentId: experiment?.id || null, plan });
      return json({ ok: true, mode: "growth_decision_planned", decision, plan, safety: writeSafety });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const normalized = migrationError(error);
    return json(normalized, { status: normalized.error === "growth_schema_missing" ? 500 : 500 });
  }
}
