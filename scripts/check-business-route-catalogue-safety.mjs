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
    if (!source.includes(token)) errors.push(`${label} is missing: ${token}`);
  }
}

const catalogue = read("src/routes/businessAutopilotRouteCatalogue.ts");
const admin = read("src/routes/businessAutopilotAdmin.ts");
const printer = read("scripts/print-business-autopilot-route-contract-check.mjs");
const packageJson = JSON.parse(read("package.json") || "{}");

requireTokens("Business route catalogue", catalogue, [
  "disabledBusinessAutopilotWriteRouteIds",
  '"business_action_draft_save"',
  '"business_approval_request_save"',
  "historicalReadDescription",
  "historicalReviewDescription",
  "function historicalReadRoute",
  "function historicalReviewWriteRoute",
  'historicalReadRoute("business_action_drafts"',
  'historicalReadRoute("business_approval_requests"',
  'historicalReviewWriteRoute("business_action_draft_build"',
  "operationsHubRecommended: false",
  "Records are non-deliverable, non-executable and non-authoritative for external action.",
  "Confirm-saves one internal historical review record only.",
]);

for (const id of ["business_action_draft_save", "business_approval_request_save"]) {
  const advertised = new RegExp(`(?:readRoute|historicalReadRoute|writeRoute|historicalReviewWriteRoute)\\(\\s*[\"']${id}[\"']`);
  if (advertised.test(catalogue)) errors.push(`Disabled Business route is still advertised: ${id}`);
}

requireTokens("Business admin route", admin, [
  'error: "historical_record_write_disabled"',
  "{ status: 410 }",
  'mode: "business_historical_review_record_saved"',
  "historicalOnly: true",
  "deliverable: false",
  "authoritativeForExecution: false",
]);
if ((admin.match(/historical_record_write_disabled/g) || []).length < 2) {
  errors.push("Both direct draft and approval write routes must remain disabled");
}

requireTokens("Business route smoke printer", printer, [
  "$historicalBusinessReadRouteIds",
  "$historicalBusinessWriteRouteIds",
  "$disabledBusinessWriteRouteIds",
  "$disabledBusinessWritePaths",
  "Disabled direct draft and approval write routes are not advertised.",
  "Historical Business read routes are clearly labelled and not recommended as ordinary Operations Hub actions.",
  "Historical Business review-write routes are not recommended as ordinary Operations Hub actions.",
  "function Assert-DisabledBusinessWrite",
  "$statusCode -ne 410",
  "Disabled Business write correctly returned 410 Gone",
]);

const expectedCommand = "node scripts/check-business-route-catalogue-safety.mjs";
if (packageJson.scripts?.["business:route-catalogue-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:route-catalogue-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run business:route-catalogue-safety:check")) {
  errors.push("check:local must include business:route-catalogue-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-route-catalogue-safety-v1",
  historicalReadRoutesAdvertisedAsNonRecommended: true,
  historicalReviewWriteAdvertisedAsNonRecommended: true,
  retiredDirectWritesAdvertised: false,
  retiredDirectWriteExpectedStatus: 410,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
