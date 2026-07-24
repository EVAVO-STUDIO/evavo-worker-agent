import type { Env } from "../db";
import { uuid } from "../db";

export type OpportunityRunStatus = "running" | "completed" | "partial" | "failed" | "skipped";

export type OpportunityRunSummary = {
  sourcesChecked: number;
  candidatesFound: number;
  saved: number;
  duplicates: number;
  failed: number;
  skipped: number;
  rejected: number;
};

export type SourceRunResult = {
  runId: string;
  sourceId?: string | null;
  sourceUrl: string;
  fetchStatus?: number | null;
  contentType?: string | null;
  elapsedMs?: number | null;
  bytes?: number | null;
  candidatesFound?: number;
  candidatesSaved?: number;
  candidatesRejected?: number;
  duplicates?: number;
  error?: string | null;
};

export type CandidateRejectionInput = {
  runId?: string | null;
  sourceId?: string | null;
  sourceUrl?: string | null;
  candidateUrl?: string | null;
  candidateTitle?: string | null;
  score?: number | null;
  reason: string;
  evidence?: unknown;
};

export async function hasOpportunityRunAuditTables(env: Env): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = 'opportunity_runs' LIMIT 1").first<any>();
  return Boolean(row?.name);
}

export async function startOpportunityRun(env: Env, runType: string, settings: unknown): Promise<string | null> {
  if (!(await hasOpportunityRunAuditTables(env))) return null;
  const id = uuid();
  await env.DB.prepare(
    `INSERT INTO opportunity_runs (id, run_type, started_at_iso, settings_json, status)
     VALUES (?, ?, ?, ?, 'running')`
  ).bind(id, runType, new Date().toISOString(), JSON.stringify(settings || {})).run();
  return id;
}

export async function finishOpportunityRun(env: Env, runId: string | null, status: Exclude<OpportunityRunStatus, "running">, summary: OpportunityRunSummary, error: string | null = null): Promise<void> {
  if (!runId || !(await hasOpportunityRunAuditTables(env))) return;
  await env.DB.prepare(
    `UPDATE opportunity_runs
     SET finished_at_iso = ?, status = ?, sources_checked = ?, candidates_found = ?, candidates_saved = ?, candidates_rejected = ?, duplicates = ?, failed = ?, skipped = ?, error = ?
     WHERE id = ?`
  ).bind(
    new Date().toISOString(),
    status,
    summary.sourcesChecked,
    summary.candidatesFound,
    summary.saved,
    summary.rejected,
    summary.duplicates,
    summary.failed,
    summary.skipped,
    error,
    runId,
  ).run();
}

export function prepareSourceRunResult(env: Env, result: SourceRunResult): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO opportunity_run_source_results (
      id, run_id, source_id, source_url, fetch_status, content_type, elapsed_ms, bytes,
      candidates_found, candidates_saved, candidates_rejected, duplicates, error, created_at_iso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    uuid(),
    result.runId,
    result.sourceId || null,
    result.sourceUrl,
    result.fetchStatus ?? null,
    result.contentType || null,
    result.elapsedMs ?? null,
    result.bytes ?? null,
    result.candidatesFound || 0,
    result.candidatesSaved || 0,
    result.candidatesRejected || 0,
    result.duplicates || 0,
    result.error || null,
    new Date().toISOString(),
  );
}

export async function recordSourceRunResult(env: Env, result: SourceRunResult): Promise<void> {
  if (!result.runId || !(await hasOpportunityRunAuditTables(env))) return;
  await prepareSourceRunResult(env, result).run();
}

export async function recordCandidateRejection(env: Env, input: CandidateRejectionInput): Promise<void> {
  if (!input.runId || !(await hasOpportunityRunAuditTables(env))) return;
  await env.DB.prepare(
    `INSERT INTO opportunity_candidate_rejections (
      id, run_id, source_id, source_url, candidate_url, candidate_title, score, reason, evidence_json, created_at_iso
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    uuid(),
    input.runId,
    input.sourceId || null,
    input.sourceUrl || null,
    input.candidateUrl || null,
    input.candidateTitle || null,
    input.score ?? null,
    input.reason,
    input.evidence ? JSON.stringify(input.evidence) : null,
    new Date().toISOString(),
  ).run();
}
