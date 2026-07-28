#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const documentPath = path.join(root, "docs", "business-autopilot-validation.md");
const packagePath = path.join(root, "package.json");

const document = fs.existsSync(documentPath)
  ? fs.readFileSync(documentPath, "utf8")
  : "";
const packageJson = fs.existsSync(packagePath)
  ? JSON.parse(fs.readFileSync(packagePath, "utf8"))
  : {};

if (!document) errors.push("Missing docs/business-autopilot-validation.md");
if (!fs.existsSync(packagePath)) errors.push("Missing package.json");

const required = [
  "The active Business Autopilot is an authenticated, internal-metadata, scoring, website/page memory, audit and review system.",
  "Historical draft-shaped and approval-shaped records remain readable for compatibility only.",
  "business:draft-runtime-safety:check",
  "business:historical-record-posture:check",
  "business:autopilot:check",
  "business:score-provenance:check",
  "business:route-policy:check",
  "0021, 0022 and 0024 migration presence",
  "business_account_360_observed_scores_v1",
  "business_score_observation_flags_v1",
  "business_account_360_bounded_chronology_v1",
  "observationFlagsRequired: true",
  "explicitZeroPreserved: true",
  "unobservedValuesReturnedAsNull: true",
  "A score-bearing write must save the numeric value and its observation flag in one D1 statement.",
  "show an explicitly observed zero as 0",
  "return an unobserved, missing, malformed or out-of-range score as null",
  "return 0024_business_score_observation_flags.sql as the required migration",
  "The guard checks source contracts and executable fixtures. It does not apply migration `0024`.",
  "business_action_draft_build",
  "It saves one internal historical review record only.",
  "business_action_draft_save",
  "business_approval_request_save",
  "Direct POST requests to their underlying paths return `410 Gone`.",
  "Routine validation must not execute migrations or rewrite generated route files.",
  "Migration execution requires a separate, explicit database-target decision",
  "npm run db:migration:one -- 0024_business_score_observation_flags.sql --remote --execute --confirm-database evavo_outbound_agent --confirm-unapplied",
  "Do not reapply `0024` after its columns exist.",
  "Dashboard verification is read-only",
  "explicit observed zero scores render as 0",
  "unobserved scores render as Not recorded",
  "scores are withheld when the provenance contract is missing",
];

for (const token of required) {
  if (!document.includes(token)) errors.push(`Validation workflow is missing: ${token}`);
}

const forbiddenActiveInstructions = [
  "Expected Business confirm-required route IDs:\n\n```text\nbusiness_organization_save",
  "all Business route IDs are advertised",
  "npm run db:migration:one -- 0021 --execute",
  "npm run growth:wiring:apply\nnpm run growth:route-catalogue:apply",
  "draft-only governance layer",
  "approval request builder\ndraft-review bundle builder",
  "unconfirmed draft-builder writes are blocked",
  "business_account_360_zero_ambiguous_scores_v1",
  "zeroValuesAreAmbiguous",
  "zeroValuesReturnedAsNull",
];

for (const token of forbiddenActiveInstructions) {
  if (document.includes(token)) errors.push(`Validation workflow contains stale active instruction: ${token}`);
}

const expectedCommand = "node scripts/check-business-validation-workflow-safety.mjs";
if (packageJson.scripts?.["business:validation-workflow-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:validation-workflow-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run business:validation-workflow-safety:check")) {
  errors.push("check:local must include business:validation-workflow-safety:check");
}
if (packageJson.scripts?.["business:score-provenance:check"] !== "node scripts/check-business-score-provenance.mjs") {
  errors.push("package.json must expose business:score-provenance:check");
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run business:score-provenance:check")) {
  errors.push("check:local must include business:score-provenance:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-validation-workflow-v3-score-provenance",
  routineValidationExecutesMigrations: false,
  routineValidationRewritesGeneratedRoutes: false,
  scoreProvenanceFocusedGateRequired: true,
  explicitObservedZeroRequired: true,
  unobservedScoresReturnedAsNull: true,
  migration0024ExecutionSeparateFromValidation: true,
  disabledDraftWritesAdvertised: false,
  disabledApprovalWritesAdvertised: false,
  dashboardVerificationReadOnly: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
