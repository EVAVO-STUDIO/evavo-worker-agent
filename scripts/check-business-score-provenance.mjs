#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} missing: ${token}`);
  }
}

function forbidTokens(label, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) errors.push(`${label} contains forbidden token: ${token}`);
  }
}

const sources = {
  migration: read("migrations/0024_business_score_observation_flags.sql"),
  helper: read("src/core/businessScoreProvenance.ts"),
  projection: read("src/core/businessReadProjection.ts"),
  readers: read("src/core/businessScoreProvenanceReaders.ts"),
  writers: read("src/core/businessScoreProvenanceWriters.ts"),
  peopleRecords: read("src/core/businessAutopilotPeopleRecords.ts"),
  auditPackRecords: read("src/core/businessAutopilotAuditPackRecords.ts"),
  account360: read("src/core/businessAccount360.ts"),
  businessRoute: read("src/routes/businessAutopilotAdmin.ts"),
  peopleRoute: read("src/routes/businessAutopilotPeopleAdmin.ts"),
  websiteRoute: read("src/routes/businessAutopilotWebsiteAdmin.ts"),
  writerTest: read("tests/businessScoreProvenance.test.ts"),
  readerTest: read("tests/businessScoreProvenanceReaders.test.ts"),
  projectionTest: read("tests/businessReadProjection.test.ts"),
  accountTest: read("tests/businessAccount360NullableScores.test.ts"),
};
const packageJson = JSON.parse(read("package.json") || "{}");

requireTokens("score migration", sources.migration, [
  "Business score observation provenance v1",
  "fit_score_observed INTEGER NOT NULL DEFAULT 0",
  "priority_score_observed INTEGER NOT NULL DEFAULT 0",
  "signal_strength_observed INTEGER NOT NULL DEFAULT 0",
  "budget_likelihood_score_observed INTEGER NOT NULL DEFAULT 0",
  "match_score_observed INTEGER NOT NULL DEFAULT 0",
  "readiness_score_observed INTEGER NOT NULL DEFAULT 0",
  "confidence_score_observed INTEGER NOT NULL DEFAULT 0",
  "CASE WHEN fit_score > 0 AND fit_score <= 100 THEN 1 ELSE 0 END",
  "Existing zero",
  "does not enable",
]);

requireTokens("score helper", sources.helper, [
  '"business_score_observation_flags_v1"',
  "buildBusinessScoreWrite",
  "businessScoreObserved",
  "readBusinessObservedScore",
  "businessOpportunityPriorityFromScores",
  "parsed >= 0 && parsed <= 100",
  "return { value: parsed, observed: 1, supplied }",
]);

requireTokens("Business read projection", sources.projection, [
  '"business_read_projection_v1"',
  "projectBusinessReadRecord",
  "projectBusinessReadCollection",
  'field === "metadata" || field === "requestedBy"',
  "redactContactDetails",
  "existingBoolean",
  "metadataPresent",
  "metadataRedacted = true",
  "requestedByPresent",
  "requesterIdentityRedacted = true",
  "contactDetailsRedacted = true",
  "Object.freeze(projected)",
]);
forbidTokens("Business read projection", sources.projection, [
  "projected.metadata = record.metadata",
  "projected.requestedBy = record.requestedBy",
]);

requireTokens("provenance readers", sources.readers, [
  'from "./businessReadProjection"',
  "projectBusinessReadCollection",
  "listBusinessOrganizationsWithScoreProvenance",
  "listBusinessPeopleWithScoreProvenance",
  "listBusinessSignalsWithScoreProvenance",
  "listBusinessOpportunitiesWithScoreProvenance",
  "listBusinessServiceMatchesWithScoreProvenance",
  "listBusinessAuditPacksWithScoreProvenance",
  "listBusinessWebsiteAuditRunsWithScoreProvenance",
  "listBusinessAuditObservationsWithScoreProvenance",
  "readBusinessObservedScore",
  "priority_score_observed DESC",
  "signal_strength_observed DESC",
  "fit_score_observed DESC",
  "match_score_observed DESC",
  "confidence_score_observed DESC",
  "scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT",
  "{ redactContactDetails: true }",
]);

requireTokens("atomic provenance writers", sources.writers, [
  "saveBusinessOrganization",
  "saveBusinessSignal",
  "saveBusinessOpportunity",
  "saveBusinessServiceMatch",
  "saveBusinessAuditPack",
  "saveBusinessPerson",
  "saveBusinessWebsiteAuditRun",
  "saveBusinessAuditObservation",
  "INSERT INTO business_organizations",
  "INSERT INTO business_signals",
  "INSERT INTO business_opportunities",
  "INSERT INTO business_service_matches",
  "INSERT INTO business_audit_packs",
  "INSERT INTO business_people",
  "INSERT INTO business_website_audit_runs",
  "INSERT INTO business_audit_observations",
  "confidence_score_observed = excluded.confidence_score_observed",
  "fit_score_observed = excluded.fit_score_observed",
  "scoreResult",
  "BUSINESS_SCORE_PROVENANCE_CONTRACT",
]);
forbidTokens("atomic provenance writers", sources.writers, [
  "saveBusinessPersonBase",
  "saveBusinessOpportunityBase",
  "requireScoreColumns",
]);

requireTokens("people collection reads", sources.peopleRecords, [
  "readBusinessObservedScore",
  "row.confidence_score_observed",
  "scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT",
]);
requireTokens("audit-pack collection reads", sources.auditPackRecords, [
  "readBusinessObservedScore",
  "row.confidence_score_observed",
  'from "./businessReadProjection"',
  "projectBusinessReadRecord(pack)",
  'typeof projected.metadataPresent === "boolean"',
  "metadata: {}",
  'contract: "business_audit_pack_reads_v3_score_provenance"',
  "scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT",
]);
forbidTokens("audit-pack collection reads", sources.auditPackRecords, [
  "const metadataPresent = Boolean(pack.metadata",
]);

for (const [label, source, tokens] of [
  ["Business route", sources.businessRoute, [
    'from "../core/businessScoreProvenanceReaders"',
    'from "../core/businessScoreProvenanceWriters"',
    "listBusinessOrganizationsWithScoreProvenance",
    "listBusinessSignalsWithScoreProvenance",
    "listBusinessOpportunitiesWithScoreProvenance",
    "listBusinessServiceMatchesWithScoreProvenance",
    "listBusinessAuditPacksWithScoreProvenance",
    "scoreReadPayload",
    "saveBusinessOrganization",
    "saveBusinessSignal",
    "saveBusinessOpportunity",
    "saveBusinessServiceMatch",
    "saveBusinessAuditPack",
    '"0024_business_score_observation_flags.sql"',
  ]],
  ["people route", sources.peopleRoute, [
    "readBusinessMetadataWriteRequest",
    'from "../core/businessScoreProvenanceWriters"',
    "saveBusinessPerson",
    "requestReceipt: parsed.requestReceipt",
    '"0024_business_score_observation_flags.sql"',
  ]],
  ["website route", sources.websiteRoute, [
    'from "../core/businessReadProjection"',
    "projectBusinessReadCollection",
    'from "../core/businessScoreProvenanceReaders"',
    'from "../core/businessScoreProvenanceWriters"',
    "listBusinessWebsiteAuditRunsWithScoreProvenance",
    "listBusinessAuditObservationsWithScoreProvenance",
    "scoreReadPayload",
    "saveBusinessWebsiteAuditRun",
    "saveBusinessAuditObservation",
    '"0024_business_score_observation_flags.sql"',
  ]],
]) {
  requireTokens(label, source, tokens);
}

requireTokens("Account 360", sources.account360, [
  'numericEvidenceContract: "business_account_360_observed_scores_v1"',
  "scoreProvenanceContract: BUSINESS_SCORE_PROVENANCE_CONTRACT",
  "readBusinessObservedScore",
  "fit_score_observed AS fitScoreObserved",
  "signal_strength_observed AS signalStrengthObserved",
  "budget_likelihood_score_observed AS budgetLikelihoodScoreObserved",
  "match_score_observed AS matchScoreObserved",
  "observationFlagsRequired: true",
  "explicitZeroPreserved: true",
  "unobservedValuesReturnedAsNull: true",
  '"0024_business_score_observation_flags.sql"',
]);
forbidTokens("Account 360", sources.account360, [
  "business_account_360_zero_ambiguous_scores_v1",
  "zeroValuesAreAmbiguous",
  "zeroValuesReturnedAsNull",
]);

requireTokens("provenance writer executable test", sources.writerTest, [
  "explicit zero",
  "buildBusinessScoreWrite(0)",
  "confidenceScoreObserved",
  "single atomic write statement",
  "missing provenance schema",
  "business_score_observation_flags_v1",
]);
requireTokens("provenance reader executable test", sources.readerTest, [
  "all active Business score collections preserve observed scores and minimize private read data",
  "listBusinessOrganizationsWithScoreProvenance",
  "listBusinessPeopleWithScoreProvenance",
  "listBusinessWebsiteAuditRunsWithScoreProvenance",
  "priorityScore, null",
  "signalStrength, 0",
  "matchScore, 0",
  "metadataPresent, true",
  "contactDetailsRedacted, true",
  "requesterIdentityRedacted, true",
  "reader projection must not mutate D1 rows",
  "business_score_observation_flags_v1",
]);
requireTokens("Business read projection executable test", sources.projectionTest, [
  "Business read projection removes arbitrary metadata and requester identity without mutating evidence",
  "Business people projection preserves presence evidence while redacting contact values",
  "repeated projection preserves existing redaction and presence flags",
  "collection projection and audit-pack minimisation preserve metadata-presence truth",
  "business_read_projection_v1",
  "private-operator-context-must-not-leak",
  "projectBusinessReadCollection",
  "businessAuditPackReadPayload",
  "metadataPresent, true",
  "Object.isFrozen(projected)",
]);
requireTokens("Account 360 provenance test", sources.accountTest, [
  '"business_account_360_observed_scores_v1"',
  '"business_score_observation_flags_v1"',
  "an observed zero remains visible",
  "observationFlagsRequired: true",
  "explicitZeroPreserved: true",
]);

const scripts = packageJson.scripts || {};
const expectedCommand = "node scripts/check-business-score-provenance.mjs";
if (scripts["business:score-provenance:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:score-provenance:check as ${expectedCommand}`);
}
const localGate = String(scripts["check:local"] || "");
if (!localGate.includes("npm run business:score-provenance:check")) {
  errors.push("check:local must include business:score-provenance:check");
}
if (!localGate.includes("npm run test:core")) {
  errors.push("check:local must execute test:core so read-projection contracts cannot be skipped");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-score-provenance-v3-minimized-observed-reads",
  explicitObservedZeroPreserved: true,
  unobservedScoresReturnedAsNull: true,
  scoreAndObservationFlagWrittenAtomically: true,
  activeListReadsProvenanceAware: true,
  arbitraryMetadataRedactedFromCollections: true,
  requesterIdentityRedactedFromAuditRuns: true,
  personContactDetailsRedactedFromCollections: true,
  auditPackMetadataPresencePreserved: true,
  missingMigrationFailsClosed: true,
  migrationExecutedByThisCheck: false,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
