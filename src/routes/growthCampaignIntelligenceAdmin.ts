import { Env, getAdminToken } from "../db";
import {
  getLatestCampaignMetrics,
  listGrowthCampaigns,
  listGrowthExperiments,
  upsertGrowthCampaign,
  upsertGrowthExperiment,
} from "../core/growthCampaignIntelligence";
import { listGrowthDecisions, planGrowthCampaignDecision, saveGrowthDecision } from "../core/growthCampaignDecisions";

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
    reason: "Campaign intelligence writes require confirmation and only write internal planning metadata.",
    safety: { readOnly: false, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false },
  }, { status: 400 });
}

function migrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const missingGrowthTable = /no such table: growth_/i.test(message);
  return {
    ok: false,
    mode: "growth_campaign_intelligence_error",
    error: missingGrowthTable ? "growth_campaign_schema_missing" : "growth_campaign_intelligence_failed",
    message,
    requiredMigration: missingGrowthTable ? "0014_growth_campaign_intelligence.sql" : null,
    safety: { readOnly: true, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false },
  };
}

export async function handleGrowthCampaignIntelligenceAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);

  try {
    if (request.method === "GET" && pathname === "/admin/growth/operator") {
      const campaigns = await listGrowthCampaigns(env, intParam(url, "limit", 10, 1, 50), url.searchParams.get("status") || undefined);
      const experiments = await listGrowthExperiments(env, intParam(url, "experimentLimit", 10, 1, 50));
      const decisions = await listGrowthDecisions(env, intParam(url, "decisionLimit", 10, 1, 50));
      return json({
        ok: true,
        mode: "growth_operator_intelligence",
        contractVersion: "growth_campaign_intelligence_v1_metadata_only",
        campaigns,
        experiments,
        decisions,
        counts: { campaigns: campaigns.length, experiments: experiments.length, decisions: decisions.length },
        safety: { readOnly: true, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false },
      });
    }

    if (request.method === "GET" && pathname === "/admin/growth/campaigns") {
      const campaigns = await listGrowthCampaigns(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ ok: true, mode: "growth_campaigns", campaigns, count: campaigns.length, safety: { readOnly: true, internalMetadataOnly: true } });
    }

    if (request.method === "GET" && pathname === "/admin/growth/experiments") {
      const experiments = await listGrowthExperiments(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("campaignId") || undefined);
      return json({ ok: true, mode: "growth_experiments", experiments, count: experiments.length, safety: { readOnly: true, internalMetadataOnly: true } });
    }

    if (request.method === "GET" && pathname === "/admin/growth/decisions") {
      const decisions = await listGrowthDecisions(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("campaignId") || undefined);
      return json({ ok: true, mode: "growth_decisions", decisions, count: decisions.length, safety: { readOnly: true, internalMetadataOnly: true } });
    }

    if (request.method === "POST" && pathname === "/admin/growth/campaigns") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const saved = await upsertGrowthCampaign(env, body.campaign || body, body.id || body.campaign?.id);
      return json({ ok: true, mode: "growth_campaign_saved", campaign: saved, safety: { readOnly: false, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false } });
    }

    if (request.method === "POST" && pathname === "/admin/growth/experiments") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const saved = await upsertGrowthExperiment(env, body.experiment || body, body.id || body.experiment?.id);
      return json({ ok: true, mode: "growth_experiment_saved", experiment: saved, safety: { readOnly: false, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false } });
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
      const plan = planGrowthCampaignDecision({ campaign, experiment, metrics, pendingReviewCount: Number(body.pendingReviewCount || 0), evidenceCount: Number(body.evidenceCount || 0) });
      const decision = await saveGrowthDecision(env, { campaignId: campaign.id, experimentId: experiment?.id || null, plan });
      return json({ ok: true, mode: "growth_decision_planned", decision, plan, safety: { readOnly: false, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false } });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const normalized = migrationError(error);
    return json(normalized, { status: normalized.error === "growth_campaign_schema_missing" ? 500 : 500 });
  }
}
