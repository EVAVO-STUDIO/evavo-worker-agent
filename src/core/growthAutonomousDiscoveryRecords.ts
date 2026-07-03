import { Env, nowISO, safeJsonParse, uuid } from "../db";
import { GROWTH_DISCOVERY_BLOCKED_ACTIONS, GrowthAgentDecisionType, growthDiscoverySafety } from "./growthAutonomousDiscovery";

function stringify(value: unknown) {
  return JSON.stringify(value ?? null);
}

function sanitizeString(value: unknown, fallback: string, max = 512) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, max);
}

function clampNumber(value: unknown, fallback = 0, min = 0, max = 100) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(min, Math.min(max, number));
}

function safeLimit(limit: number, fallback = 25, max = 100) {
  if (!Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.min(max, Math.round(limit)));
}

export function safeDiscoveryJson(value: unknown, fallback: unknown) {
  return safeJsonParse(value) ?? fallback;
}

export async function listGrowthResearchRuns(env: Env, limit = 25, status?: string) {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = "WHERE status = ?";
    params.push(sanitizeString(status, "planned", 64));
  }
  params.push(safeLimit(limit));
  const rows = await env.DB.prepare(`SELECT * FROM growth_research_runs ${where} ORDER BY created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    mode: row.mode,
    objective: row.objective,
    industryFocus: row.industry_focus,
    geoFocus: row.geo_focus,
    serviceFocus: row.service_focus,
    candidateLimit: row.candidate_limit,
    crawlBudget: safeDiscoveryJson(row.crawl_budget_json, {}),
    blockedActions: safeDiscoveryJson(row.blocked_actions_json, []),
    scoringRubric: safeDiscoveryJson(row.scoring_rubric_json, {}),
    safety: safeDiscoveryJson(row.safety_json, growthDiscoverySafety()),
    notes: row.notes,
  }));
}

export async function saveGrowthResearchRun(env: Env, input: any, id?: string) {
  const now = nowISO();
  const recordId = sanitizeString(id || input.id || uuid(), uuid(), 128);
  const safety = growthDiscoverySafety();
  await env.DB.prepare(`
    INSERT INTO growth_research_runs (
      id, created_at, updated_at, status, mode, objective, industry_focus, geo_focus, service_focus,
      candidate_limit, crawl_budget_json, blocked_actions_json, scoring_rubric_json, safety_json, notes
    ) VALUES (?, ?, ?, ?, 'zero_source_discovery', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      updated_at = excluded.updated_at,
      status = excluded.status,
      objective = excluded.objective,
      industry_focus = excluded.industry_focus,
      geo_focus = excluded.geo_focus,
      service_focus = excluded.service_focus,
      candidate_limit = excluded.candidate_limit,
      crawl_budget_json = excluded.crawl_budget_json,
      blocked_actions_json = excluded.blocked_actions_json,
      scoring_rubric_json = excluded.scoring_rubric_json,
      safety_json = excluded.safety_json,
      notes = excluded.notes
  `).bind(
    recordId,
    now,
    now,
    sanitizeString(input.status, "planned", 64),
    sanitizeString(input.objective, "Zero-source Growth research run", 1000),
    input.industryFocus || input.industry_focus || null,
    input.geoFocus || input.geo_focus || null,
    input.serviceFocus || input.service_focus || null,
    Math.max(1, Math.min(250, Math.round(Number(input.candidateLimit || input.candidate_limit || 25)))) ,
    stringify(input.crawlBudget || input.crawl_budget || {}),
    stringify(input.blockedActions || input.blocked_actions || [...GROWTH_DISCOVERY_BLOCKED_ACTIONS]),
    stringify(input.scoringRubric || input.scoring_rubric || {}),
    stringify(safety),
    input.notes || null,
  ).run();
  return (await listGrowthResearchRuns(env, 1)).find((run: any) => run.id === recordId) || { id: recordId, safety };
}

export async function listGrowthSourceCandidates(env: Env, limit = 50, status?: string) {
  const params: unknown[] = [];
  let where = "";
  if (status) {
    where = "WHERE status = ?";
    params.push(sanitizeString(status, "planned", 64));
  }
  params.push(safeLimit(limit, 50, 200));
  const rows = await env.DB.prepare(`SELECT * FROM growth_source_candidates ${where} ORDER BY created_at DESC LIMIT ?`).bind(...params).all<any>();
  return (rows.results || []).map((row) => ({
    id: row.id,
    researchRunId: row.research_run_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
    domain: row.domain,
    url: row.url,
    canonicalUrl: row.canonical_url,
    sourceType: row.source_type,
    discoveryMethod: row.discovery_method,
    discoveryQuery: row.discovery_query,
    industryHint: row.industry_hint,
    geoHint: row.geo_hint,
    serviceMatchHint: row.service_match_hint,
    robotsStatus: row.robots_status,
    crawlAllowed: Boolean(row.crawl_allowed),
    fitScore: row.fit_score,
    needScore: row.need_score,
    confidenceScore: row.confidence_score,
    riskFlags: safeDiscoveryJson(row.risk_flags_json, []),
    evidenceSummary: row.evidence_summary,
  }));
}

export async function saveGrowthSourceCandidate(env: Env, input: any, id?: string) {
  const now = nowISO();
  const recordId = sanitizeString(id || input.id || uuid(), uuid(), 128);
  await env.DB.prepare(`
    INSERT INTO growth_source_candidates (
      id, research_run_id, created_at, updated_at, status, domain, url, canonical_url, source_type,
      discovery_method, discovery_query, industry_hint, geo_hint, service_match_hint, robots_status,
      crawl_allowed, fit_score, need_score, confidence_score, risk_flags_json, evidence_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      updated_at = excluded.updated_at,
      status = excluded.status,
      domain = excluded.domain,
      url = excluded.url,
      canonical_url = excluded.canonical_url,
      source_type = excluded.source_type,
      discovery_method = excluded.discovery_method,
      discovery_query = excluded.discovery_query,
      industry_hint = excluded.industry_hint,
      geo_hint = excluded.geo_hint,
      service_match_hint = excluded.service_match_hint,
      robots_status = excluded.robots_status,
      crawl_allowed = excluded.crawl_allowed,
      fit_score = excluded.fit_score,
      need_score = excluded.need_score,
      confidence_score = excluded.confidence_score,
      risk_flags_json = excluded.risk_flags_json,
      evidence_summary = excluded.evidence_summary
  `).bind(
    recordId,
    input.researchRunId || input.research_run_id || null,
    now,
    now,
    sanitizeString(input.status, "planned", 64),
    sanitizeString(input.domain, "unknown.local", 255).toLowerCase(),
    sanitizeString(input.url, "https://example.invalid", 1000),
    input.canonicalUrl || input.canonical_url || null,
    sanitizeString(input.sourceType || input.source_type, "unknown", 128),
    sanitizeString(input.discoveryMethod || input.discovery_method, "planned", 128),
    input.discoveryQuery || input.discovery_query || null,
    input.industryHint || input.industry_hint || null,
    input.geoHint || input.geo_hint || null,
    input.serviceMatchHint || input.service_match_hint || null,
    sanitizeString(input.robotsStatus || input.robots_status, "unknown", 64),
    input.crawlAllowed || input.crawl_allowed ? 1 : 0,
    clampNumber(input.fitScore || input.fit_score),
    clampNumber(input.needScore || input.need_score),
    clampNumber(input.confidenceScore || input.confidence_score),
    stringify(input.riskFlags || input.risk_flags || []),
    input.evidenceSummary || input.evidence_summary || null,
  ).run();
  return (await listGrowthSourceCandidates(env, 200)).find((candidate: any) => candidate.id === recordId) || { id: recordId };
}

export async function enqueueGrowthFetchWork(env: Env, input: any, id?: string) {
  const now = nowISO();
  const recordId = sanitizeString(id || input.id || uuid(), uuid(), 128);
  const safety = growthDiscoverySafety();
  await env.DB.prepare(`
    INSERT INTO growth_fetch_queue (id, candidate_id, created_at, updated_at, status, url, purpose, max_bytes, max_redirects, attempt_count, last_error, safety_json)
    VALUES (?, ?, ?, ?, 'queued', ?, ?, ?, ?, 0, NULL, ?)
    ON CONFLICT(id) DO UPDATE SET updated_at = excluded.updated_at, status = excluded.status, url = excluded.url, purpose = excluded.purpose, max_bytes = excluded.max_bytes, max_redirects = excluded.max_redirects, safety_json = excluded.safety_json
  `).bind(
    recordId,
    sanitizeString(input.candidateId || input.candidate_id, "missing_candidate", 128),
    now,
    now,
    sanitizeString(input.url, "https://example.invalid", 1000),
    sanitizeString(input.purpose, "research", 128),
    Math.max(1000, Math.min(1000000, Math.round(Number(input.maxBytes || input.max_bytes || 250000)))),
    Math.max(0, Math.min(5, Math.round(Number(input.maxRedirects || input.max_redirects || 3)))),
    stringify(safety),
  ).run();
  return { id: recordId, status: "queued", safety };
}

export async function listGrowthExtractedSignals(env: Env, limit = 50) {
  const rows = await env.DB.prepare("SELECT * FROM growth_extracted_signals ORDER BY created_at DESC LIMIT ?").bind(safeLimit(limit, 50, 200)).all<any>();
  return (rows.results || []).map((row) => ({ ...row, riskFlags: safeDiscoveryJson(row.risk_flags_json, []) }));
}

export async function listGrowthOpportunityScores(env: Env, limit = 50) {
  const rows = await env.DB.prepare("SELECT * FROM growth_opportunity_scores ORDER BY created_at DESC LIMIT ?").bind(safeLimit(limit, 50, 200)).all<any>();
  return (rows.results || []).map((row) => ({ ...row, evidence: safeDiscoveryJson(row.evidence_json, []) }));
}

export async function listGrowthAgentDecisions(env: Env, limit = 50) {
  const rows = await env.DB.prepare("SELECT * FROM growth_agent_decisions ORDER BY created_at DESC LIMIT ?").bind(safeLimit(limit, 50, 200)).all<any>();
  return (rows.results || []).map((row) => ({ ...row, evidence: safeDiscoveryJson(row.evidence_json, []), blockedActions: safeDiscoveryJson(row.blocked_actions_json, []), safety: safeDiscoveryJson(row.safety_json, growthDiscoverySafety()) }));
}

export async function saveGrowthAgentDecision(env: Env, input: any, id?: string) {
  const now = nowISO();
  const recordId = sanitizeString(id || input.id || uuid(), uuid(), 128);
  const decisionType = sanitizeString(input.decisionType || input.decision_type, "research_more", 128) as GrowthAgentDecisionType;
  const safety = growthDiscoverySafety();
  await env.DB.prepare(`
    INSERT INTO growth_agent_decisions (id, candidate_id, research_run_id, created_at, decision_type, reason, evidence_json, blocked_actions_json, next_internal_step, confidence, safety_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET decision_type = excluded.decision_type, reason = excluded.reason, evidence_json = excluded.evidence_json, blocked_actions_json = excluded.blocked_actions_json, next_internal_step = excluded.next_internal_step, confidence = excluded.confidence, safety_json = excluded.safety_json
  `).bind(
    recordId,
    input.candidateId || input.candidate_id || null,
    input.researchRunId || input.research_run_id || null,
    now,
    decisionType,
    sanitizeString(input.reason, "Autonomous discovery internal decision", 2000),
    stringify(input.evidence || []),
    stringify(input.blockedActions || input.blocked_actions || [...GROWTH_DISCOVERY_BLOCKED_ACTIONS]),
    input.nextInternalStep || input.next_internal_step || null,
    clampNumber(input.confidence, 0, 0, 1),
    stringify(safety),
  ).run();
  return (await listGrowthAgentDecisions(env, 200)).find((decision: any) => decision.id === recordId) || { id: recordId, safety };
}

export async function listGrowthDiscoveryFeedback(env: Env, limit = 50) {
  const rows = await env.DB.prepare("SELECT * FROM growth_discovery_feedback ORDER BY created_at DESC LIMIT ?").bind(safeLimit(limit, 50, 200)).all<any>();
  return (rows.results || []).map((row) => ({ ...row, learning: safeDiscoveryJson(row.learning_json, {}) }));
}

export async function saveGrowthDiscoveryFeedback(env: Env, input: any, id?: string) {
  const recordId = sanitizeString(id || input.id || uuid(), uuid(), 128);
  await env.DB.prepare(`
    INSERT INTO growth_discovery_feedback (id, candidate_id, research_run_id, created_at, feedback_type, feedback_note, reviewer, learning_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET feedback_type = excluded.feedback_type, feedback_note = excluded.feedback_note, reviewer = excluded.reviewer, learning_json = excluded.learning_json
  `).bind(
    recordId,
    input.candidateId || input.candidate_id || null,
    input.researchRunId || input.research_run_id || null,
    nowISO(),
    sanitizeString(input.feedbackType || input.feedback_type, "review_note", 128),
    input.feedbackNote || input.feedback_note || null,
    sanitizeString(input.reviewer, "operator", 128),
    stringify(input.learning || input.learning_json || {}),
  ).run();
  return (await listGrowthDiscoveryFeedback(env, 200)).find((feedback: any) => feedback.id === recordId) || { id: recordId };
}
