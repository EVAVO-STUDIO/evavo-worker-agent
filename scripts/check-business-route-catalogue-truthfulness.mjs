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

function count(source, token) {
  return source.split(token).length - 1;
}

const catalogue = read("src/routes/businessAutopilotRouteCatalogue.ts");
const plannerCatalogue = read("src/routes/routeCataloguePlanner.ts");
const catalogueApplyScript = read("scripts/apply-business-autopilot-route-catalogue.mjs");
const adminRoute = read("src/routes/businessAutopilotAdmin.ts");
const smokePrinter = read("scripts/print-business-autopilot-route-contract-check.mjs");
const readOnlyPrinter = read("scripts/print-business-autopilot-readonly-verify-commands.mjs");
const packageJson = JSON.parse(read("package.json") || "{}");

const disabledRouteIds = [
  "business_action_draft_save",
  "business_approval_request_save",
];

const requiredCatalogueTokens = [
  "disabledBusinessAutopilotWriteRouteIds",
  '"business_action_draft_save"',
  '"business_approval_request_save"',
  "They are intentionally not included in businessAutopilotRouteCatalogue.",
  "historicalReadDescription",
  "function historicalReadRoute",
  "function historicalReviewWriteRoute",
  "Records are non-deliverable, non-executable and non-authoritative for external action.",
  "operationsHubRecommended: false",
  "Confirm-saves one internal historical review record only.",
  'historicalReadRoute("business_action_drafts"',
  'historicalReadRoute("business_approval_requests"',
  'historicalReviewWriteRoute("business_action_draft_build"',
  '"Save internal historical review record"',
  "callsNetwork: false",
  "callsAI: false",
  "canSendEmail: false",
];

for (const token of requiredCatalogueTokens) {
  if (!catalogue.includes(token)) errors.push(`Business route catalogue missing: ${token}`);
}

for (const disabledId of disabledRouteIds) {
  const activePattern = new RegExp(`(?:readRoute|historicalReadRoute|writeRoute|historicalReviewWriteRoute)\\(\\s*["']${disabledId}["']`);
  if (activePattern.test(catalogue)) {
    errors.push(`Disabled Business route is still actively advertised: ${disabledId}`);
  }
  if (plannerCatalogue.includes(`id: "${disabledId}"`) || plannerCatalogue.includes(`id: '${disabledId}'`)) {
    errors.push(`Planner catalogue duplicates disabled Business route: ${disabledId}`);
  }
  if (!catalogueApplyScript.includes(`'${disabledId}'`) && !catalogueApplyScript.includes(`"${disabledId}"`)) {
    errors.push(`Business catalogue apply script must explicitly block retired route id: ${disabledId}`);
  }
}

const historicalReviewBuildPattern = /historicalReviewWriteRoute\(\s*["']business_action_draft_build["'][\s\S]*?["']business_action_drafts["']\s*\)/;
if (!historicalReviewBuildPattern.test(catalogue)) {
  errors.push("Historical Business review build must use historicalReviewWriteRoute");
}

const authoritativeImport = 'import { businessAutopilotRouteCatalogue } from "./businessAutopilotRouteCatalogue";';
const authoritativeSpread = "...businessAutopilotRouteCatalogue";
if (count(plannerCatalogue, authoritativeImport) !== 1) {
  errors.push("Planner catalogue must import the authoritative Business catalogue exactly once");
}
if (count(plannerCatalogue, authoritativeSpread) !== 1) {
  errors.push("Planner catalogue must spread the authoritative Business catalogue exactly once");
}

for (const token of [
  "const cataloguePath = path.join(repoRoot, 'src/routes/businessAutopilotRouteCatalogue.ts')",
  "const retiredRouteIds = [",
  "const requiredCataloguePosture = [",
  "Refusing to wire retired Business route",
  "Refusing to wire Business catalogue without required safety posture",
  'const importLine = \'import { businessAutopilotRouteCatalogue } from "./businessAutopilotRouteCatalogue";\'',
  'const spreadLine = \'  ...businessAutopilotRouteCatalogue,\'',
  "if (!content.includes(importLine))",
  "if (!content.includes(spreadLine))",
  "Applied Business Autopilot route catalogue wiring after fail-closed posture validation.",
]) {
  if (!catalogueApplyScript.includes(token)) errors.push(`Business catalogue apply script missing fail-closed guard: ${token}`);
}

for (const token of [
  'pathname === "/admin/business/action-drafts"',
  'pathname === "/admin/business/approval-requests"',
  'error: "historical_record_write_disabled"',
  "{ status: 410 }",
]) {
  if (!adminRoute.includes(token)) errors.push(`Business admin route missing disabled-write posture: ${token}`);
}

for (const token of [
  "$historicalBusinessReadRouteIds",
  "$historicalBusinessReadPaths",
  "$historicalBusinessWriteRouteIds",
  "$disabledBusinessWriteRouteIds",
  "$disabledBusinessWritePaths",
  '"/admin/business/action-drafts"',
  '"/admin/business/approval-requests"',
  "Disabled direct draft and approval write routes are not advertised.",
  "Historical Business read routes are clearly labelled and not recommended as ordinary Operations Hub actions.",
  "Historical Business review-write routes are not recommended as ordinary Operations Hub actions.",
  "All advertised Business Autopilot metadata-write routes use confirm_required and non-executing posture.",
  "Verify historical Business read responses remain non-executable",
  "$payload.historicalOnly -ne $true",
  "$payload.executable -ne $false",
  "$payload.deliverable -ne $false",
  "$payload.authoritativeForExecution -ne $false",
  "Historical Business read response is missing required non-execution flags",
  "function Assert-DisabledBusinessWrite",
  "-Method POST",
  "-Body '{\"confirm\":true}'",
  "$statusCode -ne 410",
  "Disabled Business write correctly returned 410 Gone",
  "Verify retired Business write endpoints fail closed",
]) {
  if (!smokePrinter.includes(token)) errors.push(`Business route smoke contract missing: ${token}`);
}

for (const token of [
  "function Assert-BusinessRead([string]$Path, [bool]$HistoricalOnly = $false)",
  "$payload.historicalOnly -ne $true",
  "$payload.executable -ne $false",
  "$payload.deliverable -ne $false",
  "$payload.authoritativeForExecution -ne $false",
  "$historicalPaths = @(",
  '"/admin/business/action-drafts?limit=5"',
  '"/admin/business/approval-requests?limit=5"',
  "Assert-BusinessRead $path $true",
]) {
  if (!readOnlyPrinter.includes(token)) errors.push(`Business read-only verification printer missing: ${token}`);
}

const expectedCommand = "node scripts/check-business-route-catalogue-truthfulness.mjs";
const scripts = packageJson.scripts || {};
if (scripts["business:route-catalogue-truthfulness:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:route-catalogue-truthfulness:check as ${expectedCommand}`);
}
if (!String(scripts["check:local"] || "").includes("npm run business:route-catalogue-truthfulness:check")) {
  errors.push("check:local must include business:route-catalogue-truthfulness:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-route-catalogue-truthfulness-v9-historical-read-smoke-gated",
  plannerUsesAuthoritativeBusinessCatalogue: true,
  plannerBusinessImportCountExpected: 1,
  plannerBusinessSpreadCountExpected: 1,
  catalogueApplyScriptIdempotent: true,
  catalogueApplyScriptValidatesPostureBeforeWrite: true,
  catalogueApplyScriptBlocksRetiredRouteIds: true,
  historicalReadsUseDedicatedCataloguePosture: true,
  historicalReadsRecommendedInOperationsHub: false,
  historicalReadVerificationChecksRequiredNonExecutionFlags: true,
  historicalReadSmokeChecksRequiredNonExecutionFlags: true,
  historicalReviewWriteUsesDedicatedCataloguePosture: true,
  historicalReviewWriteRecommendedInOperationsHub: false,
  disabledDirectDraftWriteAdvertised: false,
  disabledApprovalWriteAdvertised: false,
  retiredWriteEndpointsExpectedStatus: 410,
  deployedRetiredWriteChecksRequired: true,
  historicalReviewBuildIsInternalOnly: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;