import { Env, getAdminToken } from "../db";
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

export type JsonResponse = (data: any, init?: ResponseInit) => Response;

const readSafety = { readOnly: true, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false, canSendEmail: false, canPostSocial: false, canSubmitForms: false };
const writeSafety = { readOnly: false, internalMetadataOnly: true, externalStateChange: false, callsAI: false, callsNetwork: false, canSendEmail: false, canPostSocial: false, canSubmitForms: false };

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
    reason: "Growth autonomous discovery writes require confirmation and only save internal metadata. They do not crawl, browse, send, post, call AI, submit forms, spend, or mutate external systems.",
    safety: writeSafety,
  }, { status: 400 });
}

function migrationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const missingTable = /no such table: growth_(research_runs|source_candidates|fetch_queue|extracted_signals|opportunity_scores|agent_decisions|discovery_feedback)/i.test(message);
  return {
    ok: false,
    mode: "growth_autonomous_discovery_error",
    error: missingTable ? "growth_autonomous_discovery_schema_missing" : "growth_autonomous_discovery_failed",
    message,
    requiredMigration: missingTable ? "0020_growth_autonomous_discovery.sql" : null,
    safety: readSafety,
  };
}

export async function handleGrowthAutonomousDiscoveryAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const url = new URL(request.url);

  try {
    if (request.method === "GET" && pathname === "/admin/growth/discovery/research-runs") {
      const runs = await listGrowthResearchRuns(env, intParam(url, "limit", 25, 1, 100), url.searchParams.get("status") || undefined);
      return json({ ok: true, mode: "growth_research_runs", runs, count: runs.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/discovery/source-candidates") {
      const candidates = await listGrowthSourceCandidates(env, intParam(url, "limit", 50, 1, 200), url.searchParams.get("status") || undefined);
      return json({ ok: true, mode: "growth_source_candidates", candidates, count: candidates.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/discovery/signals") {
      const signals = await listGrowthExtractedSignals(env, intParam(url, "limit", 50, 1, 200));
      return json({ ok: true, mode: "growth_extracted_signals", signals, count: signals.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/discovery/opportunity-scores") {
      const scores = await listGrowthOpportunityScores(env, intParam(url, "limit", 50, 1, 200));
      return json({ ok: true, mode: "growth_opportunity_scores", scores, count: scores.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/discovery/agent-decisions") {
      const decisions = await listGrowthAgentDecisions(env, intParam(url, "limit", 50, 1, 200));
      return json({ ok: true, mode: "growth_agent_decisions", decisions, count: decisions.length, safety: readSafety });
    }

    if (request.method === "GET" && pathname === "/admin/growth/discovery/feedback") {
      const feedback = await listGrowthDiscoveryFeedback(env, intParam(url, "limit", 50, 1, 200));
      return json({ ok: true, mode: "growth_discovery_feedback", feedback, count: feedback.length, safety: readSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/discovery/research-runs/plan") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const run = await saveGrowthResearchRun(env, body.researchRun || body.run || body, body.id);
      return json({ ok: true, mode: "growth_research_run_planned", run, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/discovery/source-candidates") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const candidate = await saveGrowthSourceCandidate(env, body.candidate || body.sourceCandidate || body, body.id);
      return json({ ok: true, mode: "growth_source_candidate_saved", candidate, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/discovery/fetch-queue") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const queued = await enqueueGrowthFetchWork(env, body.fetch || body.queueItem || body, body.id);
      return json({ ok: true, mode: "growth_fetch_queue_enqueued_metadata_only", queued, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/discovery/agent-decisions") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const decision = await saveGrowthAgentDecision(env, body.decision || body, body.id);
      return json({ ok: true, mode: "growth_agent_decision_recorded", decision, safety: writeSafety });
    }

    if (request.method === "POST" && pathname === "/admin/growth/discovery/feedback") {
      const body = await parseBody(request);
      if (!confirmed(url, body)) return blockedWrite(json);
      const feedback = await saveGrowthDiscoveryFeedback(env, body.feedback || body, body.id);
      return json({ ok: true, mode: "growth_discovery_feedback_saved", feedback, safety: writeSafety });
    }

    return json({ ok: false, error: "not_found", path: pathname, method: request.method }, { status: 404 });
  } catch (error) {
    const normalized = migrationError(error);
    return json(normalized, { status: 500 });
  }
}
