import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db";
import {
  listBusinessAuditObservationsWithScoreProvenance,
  listBusinessAuditPacksWithScoreProvenance,
  listBusinessOpportunitiesWithScoreProvenance,
  listBusinessOrganizationsWithScoreProvenance,
  listBusinessPeopleWithScoreProvenance,
  listBusinessServiceMatchesWithScoreProvenance,
  listBusinessSignalsWithScoreProvenance,
  listBusinessWebsiteAuditRunsWithScoreProvenance,
} from "../src/core/businessScoreProvenanceReaders";

type Row = Record<string, unknown>;

const PRIVATE_METADATA = "private-business-context-must-not-leak";
const PRIVATE_EMAIL = "jamie.private@example.test";
const PRIVATE_PHONE = "+61 400 000 000";
const PRIVATE_PROFILE = "https://example.test/private-profile";
const PRIVATE_SOURCE = "https://example.test/private-source";
const PRIVATE_REQUESTER = "private-requester@example.test";

const tableRows: Record<string, Row[]> = {
  business_organizations: [{
    id: "organization-1",
    name: "Example Co",
    fit_score: 0,
    fit_score_observed: 1,
    priority_score: 0,
    priority_score_observed: 0,
    risk_score: 15,
    risk_score_observed: 1,
    confidence_score: 80,
    confidence_score_observed: 1,
    metadata_json: JSON.stringify({ note: PRIVATE_METADATA }),
  }],
  business_people: [{
    id: "person-1",
    name: "Jamie Example",
    email: PRIVATE_EMAIL,
    phone: PRIVATE_PHONE,
    profile_url: PRIVATE_PROFILE,
    source_url: PRIVATE_SOURCE,
    confidence_score: 0,
    confidence_score_observed: 0,
    metadata_json: JSON.stringify({ note: PRIVATE_METADATA }),
  }],
  business_signals: [{
    id: "signal-1",
    signal_type: "technology_stack",
    signal_strength: 0,
    signal_strength_observed: 1,
    confidence_score: 101,
    confidence_score_observed: 1,
    risk_flags_json: "[]",
    metadata_json: JSON.stringify({ note: PRIVATE_METADATA }),
  }],
  business_opportunities: [{
    id: "opportunity-1",
    priority: "B",
    fit_score: 75,
    fit_score_observed: 1,
    need_score: 0,
    need_score_observed: 0,
    urgency_score: 0,
    urgency_score_observed: 1,
    budget_likelihood_score: 30,
    budget_likelihood_score_observed: 1,
    contactability_score: 50,
    contactability_score_observed: 1,
    evidence_quality_score: 80,
    evidence_quality_score_observed: 1,
    risk_score: 0,
    risk_score_observed: 1,
    confidence_score: 65,
    confidence_score_observed: 1,
    metadata_json: JSON.stringify({ note: PRIVATE_METADATA }),
  }],
  business_service_matches: [{
    id: "service-match-1",
    match_score: 0,
    match_score_observed: 1,
    evidence_json: "[]",
    metadata_json: JSON.stringify({ note: PRIVATE_METADATA }),
  }],
  business_audit_packs: [{
    id: "audit-pack-1",
    confidence_score: 70,
    confidence_score_observed: 1,
    findings_json: "[]",
    recommendations_json: "[]",
    risk_flags_json: "[]",
    metadata_json: JSON.stringify({ note: PRIVATE_METADATA }),
  }],
  business_website_audit_runs: [{
    id: "audit-run-1",
    requested_by: PRIVATE_REQUESTER,
    readiness_score: 0,
    readiness_score_observed: 1,
    risk_score: 38,
    risk_score_observed: 1,
    confidence_score: 0,
    confidence_score_observed: 0,
    metadata_json: JSON.stringify({ note: PRIVATE_METADATA }),
  }],
  business_audit_observations: [{
    id: "observation-1",
    title: "Review friction",
    confidence_score: 78,
    confidence_score_observed: 1,
    metadata_json: JSON.stringify({ note: PRIVATE_METADATA }),
  }],
};

function fixture() {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const env = {
    DB: {
      prepare(sql: string) {
        const normalized = sql.replace(/\s+/g, " ").trim();
        return {
          bind(...values: unknown[]) {
            calls.push({ sql: normalized, values });
            return {
              async all<T>() {
                const table = Object.keys(tableRows).find((name) =>
                  normalized.includes(`FROM ${name}`),
                );
                if (!table) throw new Error(`Unhandled SQL: ${normalized}`);
                return { results: tableRows[table] as T[] };
              },
            };
          },
        };
      },
    },
  } as unknown as Env;
  return { env, calls };
}

test("all active Business score collections preserve observed scores and minimize private read data", async () => {
  const { env, calls } = fixture();

  const organizations = await listBusinessOrganizationsWithScoreProvenance(env, 25);
  const people = await listBusinessPeopleWithScoreProvenance(env, 25);
  const signals = await listBusinessSignalsWithScoreProvenance(env, 25);
  const opportunities = await listBusinessOpportunitiesWithScoreProvenance(env, 25);
  const serviceMatches = await listBusinessServiceMatchesWithScoreProvenance(env, 25);
  const auditPacks = await listBusinessAuditPacksWithScoreProvenance(env, 25);
  const auditRuns = await listBusinessWebsiteAuditRunsWithScoreProvenance(env, 25);
  const observations = await listBusinessAuditObservationsWithScoreProvenance(env, 25);

  assert.equal(organizations[0]?.fitScore, 0);
  assert.equal(organizations[0]?.priorityScore, null);
  assert.equal(people[0]?.confidenceScore, null);
  assert.equal(signals[0]?.signalStrength, 0);
  assert.equal(signals[0]?.confidenceScore, null);
  assert.equal(opportunities[0]?.fitScore, 75);
  assert.equal(opportunities[0]?.needScore, null);
  assert.equal(opportunities[0]?.urgencyScore, 0);
  assert.equal(opportunities[0]?.riskScore, 0);
  assert.equal(serviceMatches[0]?.matchScore, 0);
  assert.equal(auditPacks[0]?.confidenceScore, 70);
  assert.equal(auditRuns[0]?.readinessScore, 0);
  assert.equal(auditRuns[0]?.confidenceScore, null);
  assert.equal(observations[0]?.confidenceScore, 78);

  const collections = [
    organizations,
    people,
    signals,
    opportunities,
    serviceMatches,
    auditPacks,
    auditRuns,
    observations,
  ];
  for (const collection of collections) {
    const record = collection[0];
    assert.equal(record?.scoreProvenanceContract, "business_score_observation_flags_v1");
    assert.equal(record?.metadataPresent, true);
    assert.equal(record?.metadataRedacted, true);
    assert.equal(Object.prototype.hasOwnProperty.call(record ?? {}, "metadata"), false);
    assert.equal(Object.isFrozen(record), true);
  }

  const person = people[0];
  assert.equal(person?.email, null);
  assert.equal(person?.phone, null);
  assert.equal(person?.profileUrl, null);
  assert.equal(person?.sourceUrl, null);
  assert.equal(person?.emailPresent, true);
  assert.equal(person?.phonePresent, true);
  assert.equal(person?.profileUrlPresent, true);
  assert.equal(person?.sourceUrlPresent, true);
  assert.equal(person?.contactDetailsRedacted, true);

  const auditRun = auditRuns[0];
  assert.equal(Object.prototype.hasOwnProperty.call(auditRun ?? {}, "requestedBy"), false);
  assert.equal(auditRun?.requestedByPresent, true);
  assert.equal(auditRun?.requesterIdentityRedacted, true);

  const outputText = JSON.stringify(collections);
  for (const privateValue of [
    PRIVATE_METADATA,
    PRIVATE_EMAIL,
    PRIVATE_PHONE,
    PRIVATE_PROFILE,
    PRIVATE_SOURCE,
    PRIVATE_REQUESTER,
  ]) {
    assert.equal(outputText.includes(privateValue), false, privateValue);
  }

  assert.equal(
    tableRows.business_people[0]?.email,
    PRIVATE_EMAIL,
    "reader projection must not mutate D1 rows",
  );
  assert.equal(
    tableRows.business_website_audit_runs[0]?.requested_by,
    PRIVATE_REQUESTER,
    "reader projection must not mutate D1 rows",
  );

  assert.equal(calls.length, 8);
  assert.equal(
    calls.every((call) => call.values.at(-1) === 25),
    true,
  );
  assert.match(calls[0].sql, /priority_score_observed DESC/);
  assert.match(calls[2].sql, /signal_strength_observed DESC/);
  assert.match(calls[3].sql, /fit_score_observed DESC/);
  assert.match(calls[4].sql, /match_score_observed DESC/);
  assert.match(calls[5].sql, /confidence_score_observed DESC/);
});
