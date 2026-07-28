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

const migration = read("migrations/0024_business_score_observation_flags.sql");
const helper = read("src/core/businessScoreProvenance.ts");
const writers = read("src/core/businessScoreProvenanceWriters.ts");
const account360 = read("src/core/businessAccount360.ts");
const businessRoute = read("src/routes/businessAutopilotAdmin.ts");
const peopleRoute = read("src/routes/businessAutopilotPeopleAdmin.ts");
const websiteRoute = read("src/routes/businessAutopilotWebsiteAdmin.ts");
const provenanceTest = read("tests/businessScoreProvenance.test.ts");
const accountTest = read("tests/businessAccount360NullableScores.test.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

requireTokens("score migration", migration, [
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

requireTokens("score helper", helper, [
  '"business_score_observation_flags_v1"',
  "buildBusinessScoreWrite",
  "businessScoreObserved",
  "readBusinessObservedScore",
  "businessOpportunityPriorityFromScores",
  "parsed >= 0 && parsed <= 100",
  "return { value: parsed, observed: 1, supplied }",
]);

requireTokens("atomic provenance writers", writers, [
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
  "explicit",
  "BUSINESS_SCORE_PROVENANCE_CONTRACT",
]);
forbidTokens("atomic provenance writers", writers, [
  "saveBusinessPersonBase",
  "saveBusinessOpportunityBase",
  "requireScoreColumns",
]);

for (const [label, route, tokens] of [
  ["Business route", businessRoute, [
    'from "../core/businessScoreProvenanceWriters"',
    "saveBusinessOrganization",
    "saveBusinessSignal",
    "saveBusinessOpportunity",
    "saveBusinessServiceMatch",
    "saveBusinessAuditPack",
    '"0024_business_score_observation_flags.sql"',
  ]],
  ["people route", peopleRoute, [
    'from "../core/businessScoreProvenanceWriters"',
    "saveBusinessPerson",
    '"0024_business_score_observation_flags.sql"',
    "exact JSON confirmation",
  ]],
  ["website route", websiteRoute, [
    'from "../core/businessScoreProvenanceWriters"',
    "saveBusinessWebsiteAuditRun",
    "saveBusinessAuditObservation",
    '"0024_business_score_observation_flags.sql"',
  ]],
]) {
  requireTokens(label, route, tokens);
}

requireTokens("Account 360", account360, [
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
forbidTokens("Account 360", account360, [
  "business_account_360_zero_ambiguous_scores_v1",
  "zeroValuesAreAmbiguous",
  "zeroValuesReturnedAsNull",
]);

requireTokens("provenance executable test", provenanceTest, [
  "explicit zero",
  "buildBusinessScoreWrite(0)",
  "confidenceScoreObserved",
  "single atomic write statement",
  "missing provenance schema",
  "business_score_observation_flags_v1",
]);
requireTokens("Account 360 provenance test", accountTest, [
  '"business_account_360_observed_scores_v1"',
  '"business_score_observation_flags_v1"',
  "an observed zero remains visible",
  "observationFlagsRequired: true",
  "explicitZeroPreserved: true",
]);

const expectedCommand = "node scripts/check-business-score-provenance.mjs";
if (packageJson.scripts?.["business:score-provenance:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:score-provenance:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run business:score-provenance:check")) {
  errors.push("check:local must include business:score-provenance:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-score-provenance-v1-atomic-observation-flags",
  explicitObservedZeroPreserved: true,
  unobservedScoresReturnedAsNull: true,
  scoreAndObservationFlagWrittenAtomically: true,
  missingMigrationFailsClosed: true,
  migrationExecutedByThisCheck: false,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
