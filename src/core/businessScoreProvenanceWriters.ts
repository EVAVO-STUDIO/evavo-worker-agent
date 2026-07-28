import type { Env } from "../db";
import type { BusinessAuditPackInput } from "./businessAutopilotAuditPacks";
import {
  saveBusinessAuditPack as saveBusinessAuditPackBase,
} from "./businessAutopilotAuditPackRecords";
import type { BusinessPersonInput } from "./businessAutopilotPeopleRecords";
import {
  saveBusinessPerson as saveBusinessPersonBase,
} from "./businessAutopilotPeopleRecords";
import {
  saveBusinessOpportunity as saveBusinessOpportunityBase,
  saveBusinessOrganization as saveBusinessOrganizationBase,
  saveBusinessServiceMatch as saveBusinessServiceMatchBase,
  saveBusinessSignal as saveBusinessSignalBase,
} from "./businessAutopilotRecords";
import type {
  BusinessOpportunityInput,
  BusinessOrganizationInput,
  BusinessServiceMatchInput,
  BusinessSignalInput,
} from "./businessAutopilotTypes";
import type {
  BusinessAuditObservationInput,
  BusinessWebsiteAuditRunInput,
} from "./businessAutopilotWebsiteRecords";
import {
  saveBusinessAuditObservation as saveBusinessAuditObservationBase,
  saveBusinessWebsiteAuditRun as saveBusinessWebsiteAuditRunBase,
} from "./businessAutopilotWebsiteRecords";
import {
  BUSINESS_SCORE_PROVENANCE_CONTRACT,
  buildBusinessScoreWrite,
  businessOpportunityPriorityFromScores,
  readBusinessObservedScore,
  type BusinessScoreWrite,
} from "./businessScoreProvenance";

type Row = Record<string, unknown>;

type BusinessOrganizationScoreInput = BusinessOrganizationInput & {
  id?: string;
  fitScore?: number | null;
  priorityScore?: number | null;
  riskScore?: number | null;
  confidenceScore?: number | null;
};

function observed(state: BusinessScoreWrite): boolean {
  return state.observed === 1;
}

async function requireScoreColumns(
  env: Env,
  table: string,
  columns: readonly string[],
): Promise<void> {
  await env.DB.prepare(
    `SELECT ${columns.join(", ")} FROM ${table} LIMIT 0`,
  ).all();
}

function scoreResult(state: BusinessScoreWrite): number | null {
  return readBusinessObservedScore(state.value, state.observed);
}

export async function saveBusinessOrganization(
  env: Env,
  input: BusinessOrganizationScoreInput,
) {
  await requireScoreColumns(env, "business_organizations", [
    "fit_score_observed",
    "priority_score_observed",
    "risk_score_observed",
    "confidence_score_observed",
  ]);
  const fit = buildBusinessScoreWrite(input.fitScore);
  const priority = buildBusinessScoreWrite(input.priorityScore);
  const risk = buildBusinessScoreWrite(input.riskScore);
  const confidence = buildBusinessScoreWrite(input.confidenceScore);
  const saved = await saveBusinessOrganizationBase(env, input);
  await env.DB.prepare(`
    UPDATE business_organizations SET
      fit_score = CASE WHEN ? = 1 THEN ? ELSE fit_score END,
      fit_score_observed = CASE WHEN ? = 1 THEN ? ELSE fit_score_observed END,
      priority_score = CASE WHEN ? = 1 THEN ? ELSE priority_score END,
      priority_score_observed = CASE WHEN ? = 1 THEN ? ELSE priority_score_observed END,
      risk_score = CASE WHEN ? = 1 THEN ? ELSE risk_score END,
      risk_score_observed = CASE WHEN ? = 1 THEN ? ELSE risk_score_observed END,
      confidence_score = CASE WHEN ? = 1 THEN ? ELSE confidence_score END,
      confidence_score_observed = CASE WHEN ? = 1 THEN ? ELSE confidence_score_observed END
    WHERE id = ?
  `).bind(
    Number(fit.supplied), fit.value, Number(fit.supplied), fit.observed,
    Number(priority.supplied), priority.value, Number(priority.supplied), priority.observed,
    Number(risk.supplied), risk.value, Number(risk.supplied), risk.observed,
    Number(confidence.supplied), confidence.value, Number(confidence.supplied), confidence.observed,
    saved.id,
  ).run();
  const row = await env.DB.prepare(`
    SELECT fit_score AS fitScore, fit_score_observed AS fitScoreObserved,
      priority_score AS priorityScore, priority_score_observed AS priorityScoreObserved,
      risk_score AS riskScore, risk_score_observed AS riskScoreObserved,
      confidence_score AS confidenceScore, confidence_score_observed AS confidenceScoreObserved
    FROM business_organizations WHERE id = ? LIMIT 1
  `).bind(saved.id).first<Row>();
  return {
    ...saved,
    fitScore: readBusinessObservedScore(row?.fitScore, row?.fitScoreObserved),
    priorityScore: readBusinessObservedScore(row?.priorityScore, row?.priorityScoreObserved),
    riskScore: readBusinessObservedScore(row?.riskScore, row?.riskScoreObserved),
    confidenceScore: readBusinessObservedScore(row?.confidenceScore, row?.confidenceScoreObserved),
    fitScoreObserved: Boolean(row && observed(buildBusinessScoreWrite(row.fitScoreObserved === 1 ? row.fitScore : undefined))),
    priorityScoreObserved: Boolean(row && observed(buildBusinessScoreWrite(row.priorityScoreObserved === 1 ? row.priorityScore : undefined))),
    riskScoreObserved: Boolean(row && observed(buildBusinessScoreWrite(row.riskScoreObserved === 1 ? row.riskScore : undefined))),
    confidenceScoreObserved: Boolean(row && observed(buildBusinessScoreWrite(row.confidenceScoreObserved === 1 ? row.confidenceScore : undefined))),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
  };
}

export async function saveBusinessSignal(
  env: Env,
  input: BusinessSignalInput & { id?: string },
) {
  await requireScoreColumns(env, "business_signals", [
    "signal_strength_observed",
    "confidence_score_observed",
  ]);
  const strength = buildBusinessScoreWrite(input.signalStrength);
  const confidence = buildBusinessScoreWrite(input.confidenceScore);
  const saved = await saveBusinessSignalBase(env, input);
  await env.DB.prepare(`
    UPDATE business_signals SET
      signal_strength = ?, signal_strength_observed = ?,
      confidence_score = ?, confidence_score_observed = ?
    WHERE id = ?
  `).bind(
    strength.value,
    strength.observed,
    confidence.value,
    confidence.observed,
    saved.id,
  ).run();
  return {
    ...saved,
    signalStrength: scoreResult(strength),
    confidenceScore: scoreResult(confidence),
    signalStrengthObserved: observed(strength),
    confidenceScoreObserved: observed(confidence),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
  };
}

export async function saveBusinessOpportunity(
  env: Env,
  input: BusinessOpportunityInput & { id?: string },
) {
  await requireScoreColumns(env, "business_opportunities", [
    "fit_score_observed",
    "need_score_observed",
    "urgency_score_observed",
    "budget_likelihood_score_observed",
    "contactability_score_observed",
    "evidence_quality_score_observed",
    "risk_score_observed",
    "confidence_score_observed",
  ]);
  const fit = buildBusinessScoreWrite(input.fitScore);
  const need = buildBusinessScoreWrite(input.needScore);
  const urgency = buildBusinessScoreWrite(input.urgencyScore);
  const budget = buildBusinessScoreWrite(input.budgetLikelihoodScore);
  const contactability = buildBusinessScoreWrite(input.contactabilityScore);
  const evidence = buildBusinessScoreWrite(input.evidenceQualityScore);
  const risk = buildBusinessScoreWrite(input.riskScore);
  const confidence = buildBusinessScoreWrite(input.confidenceScore);
  const priority = businessOpportunityPriorityFromScores(input);
  const saved = await saveBusinessOpportunityBase(env, input);
  await env.DB.prepare(`
    UPDATE business_opportunities SET
      priority = ?,
      fit_score = ?, fit_score_observed = ?,
      need_score = ?, need_score_observed = ?,
      urgency_score = ?, urgency_score_observed = ?,
      budget_likelihood_score = ?, budget_likelihood_score_observed = ?,
      contactability_score = ?, contactability_score_observed = ?,
      evidence_quality_score = ?, evidence_quality_score_observed = ?,
      risk_score = ?, risk_score_observed = ?,
      confidence_score = ?, confidence_score_observed = ?
    WHERE id = ?
  `).bind(
    priority,
    fit.value, fit.observed,
    need.value, need.observed,
    urgency.value, urgency.observed,
    budget.value, budget.observed,
    contactability.value, contactability.observed,
    evidence.value, evidence.observed,
    risk.value, risk.observed,
    confidence.value, confidence.observed,
    saved.id,
  ).run();
  return {
    ...saved,
    priority,
    fitScore: scoreResult(fit),
    needScore: scoreResult(need),
    urgencyScore: scoreResult(urgency),
    budgetLikelihoodScore: scoreResult(budget),
    contactabilityScore: scoreResult(contactability),
    evidenceQualityScore: scoreResult(evidence),
    riskScore: scoreResult(risk),
    confidenceScore: scoreResult(confidence),
    fitScoreObserved: observed(fit),
    needScoreObserved: observed(need),
    urgencyScoreObserved: observed(urgency),
    budgetLikelihoodScoreObserved: observed(budget),
    contactabilityScoreObserved: observed(contactability),
    evidenceQualityScoreObserved: observed(evidence),
    riskScoreObserved: observed(risk),
    confidenceScoreObserved: observed(confidence),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
  };
}

export async function saveBusinessServiceMatch(
  env: Env,
  input: BusinessServiceMatchInput & { id?: string },
) {
  await requireScoreColumns(env, "business_service_matches", [
    "match_score_observed",
  ]);
  const match = buildBusinessScoreWrite(input.matchScore);
  const saved = await saveBusinessServiceMatchBase(env, input);
  await env.DB.prepare(`
    UPDATE business_service_matches SET match_score = ?, match_score_observed = ?
    WHERE id = ?
  `).bind(match.value, match.observed, saved.id).run();
  return {
    ...saved,
    matchScore: scoreResult(match),
    matchScoreObserved: observed(match),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
  };
}

export async function saveBusinessAuditPack(
  env: Env,
  input: BusinessAuditPackInput & { id?: string; opportunityId?: string | null },
) {
  await requireScoreColumns(env, "business_audit_packs", [
    "confidence_score_observed",
  ]);
  const saved = await saveBusinessAuditPackBase(env, input);
  const confidence = buildBusinessScoreWrite(saved.confidenceScore);
  await env.DB.prepare(`
    UPDATE business_audit_packs SET confidence_score = ?, confidence_score_observed = ?
    WHERE id = ?
  `).bind(confidence.value, confidence.observed, saved.id).run();
  return {
    ...saved,
    confidenceScore: scoreResult(confidence),
    confidenceScoreObserved: observed(confidence),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
  };
}

export async function saveBusinessPerson(
  env: Env,
  input: BusinessPersonInput,
) {
  await requireScoreColumns(env, "business_people", [
    "confidence_score_observed",
  ]);
  const confidence = buildBusinessScoreWrite(input.confidenceScore);
  const saved = await saveBusinessPersonBase(env, input);
  await env.DB.prepare(`
    UPDATE business_people SET confidence_score = ?, confidence_score_observed = ?
    WHERE id = ?
  `).bind(confidence.value, confidence.observed, saved.id).run();
  return {
    ...saved,
    confidenceScore: scoreResult(confidence),
    confidenceScoreObserved: observed(confidence),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
  };
}

export async function saveBusinessWebsiteAuditRun(
  env: Env,
  input: BusinessWebsiteAuditRunInput,
) {
  await requireScoreColumns(env, "business_website_audit_runs", [
    "readiness_score_observed",
    "risk_score_observed",
    "confidence_score_observed",
  ]);
  const readiness = buildBusinessScoreWrite(input.readinessScore);
  const risk = buildBusinessScoreWrite(input.riskScore);
  const confidence = buildBusinessScoreWrite(input.confidenceScore);
  const saved = await saveBusinessWebsiteAuditRunBase(env, input);
  await env.DB.prepare(`
    UPDATE business_website_audit_runs SET
      readiness_score = ?, readiness_score_observed = ?,
      risk_score = ?, risk_score_observed = ?,
      confidence_score = ?, confidence_score_observed = ?
    WHERE id = ?
  `).bind(
    readiness.value, readiness.observed,
    risk.value, risk.observed,
    confidence.value, confidence.observed,
    saved.id,
  ).run();
  return {
    ...saved,
    readinessScore: scoreResult(readiness),
    riskScore: scoreResult(risk),
    confidenceScore: scoreResult(confidence),
    readinessScoreObserved: observed(readiness),
    riskScoreObserved: observed(risk),
    confidenceScoreObserved: observed(confidence),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
  };
}

export async function saveBusinessAuditObservation(
  env: Env,
  input: BusinessAuditObservationInput,
) {
  await requireScoreColumns(env, "business_audit_observations", [
    "confidence_score_observed",
  ]);
  const confidence = buildBusinessScoreWrite(input.confidenceScore);
  const saved = await saveBusinessAuditObservationBase(env, input);
  await env.DB.prepare(`
    UPDATE business_audit_observations SET
      confidence_score = ?, confidence_score_observed = ?
    WHERE id = ?
  `).bind(confidence.value, confidence.observed, saved.id).run();
  return {
    ...saved,
    confidenceScore: scoreResult(confidence),
    confidenceScoreObserved: observed(confidence),
    scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT,
  };
}
