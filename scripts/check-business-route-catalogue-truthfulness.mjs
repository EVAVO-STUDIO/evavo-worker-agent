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

const catalogue = read("src/routes/businessAutopilotRouteCatalogue.ts");
const plannerCatalogue = read("src/routes/routeCataloguePlanner.ts");
const adminRoute = read("src/routes/businessAutopilotAdmin.ts");
const smokePrinter = read("scripts/print-business-autopilot-route-contract-check.mjs");
const packageJson = JSON.parse(read("package.json") || "{}");

const requiredCatalogueTokens = [
  "disabledBusinessAutopilotWriteRouteIds",
  '"business_action_draft_save"',
  '"business_approval_request_save"',
  "They are intentionally not included in businessAutopilotRouteCatalogue.",
  "Confirm-saves one internal historical review record only.",
  'readRoute("business_action_drafts"',
  'readRoute("business_approval_requests"',
  'writeRoute("business_action_draft_build"',
  '"Save internal historical review record"',
  "callsNetwork: false",
  "callsAI: false",
  "canSendEmail: false",
];

for (const token of requiredCatalogueTokens) {
  if (!catalogue.includes(token)) errors.push(`Business route catalogue missing: ${token}`);
}

for (const disabledId of ["business_action_draft_save", "business_approval_request_save"]) {
  const activePattern = new RegExp(`(?:readRoute|writeRoute)\\(\\s*["']${disabledId}["']`);
  if (activePattern.test(catalogue)) {
    errors.push(`Disabled Business route is still actively advertised: ${disabledId}`);
  }
  if (plannerCatalogue.includes(`id: "${disabledId}"`) || plannerCatalogue.includes(`id: '${disabledId}'`)) {
    errors.push(`Planner catalogue duplicates disabled Business route: ${disabledId}`);
  }
}

for (const token of [
  'import { businessAutopilotRouteCatalogue } from "./businessAutopilotRouteCatalogue"',
  "...businessAutopilotRouteCatalogue",
]) {
  if (!plannerCatalogue.includes(token)) errors.push(`Planner catalogue missing authoritative Business wiring: ${token}`);
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
  "$disabledBusinessWriteRouteIds",
  "$disabledBusinessWritePaths",
  '"/admin/business/action-drafts"',
  '"/admin/business/approval-requests"',
  "Disabled direct draft and approval write routes are not advertised.",
  "All advertised Business Autopilot metadata-write routes use confirm_required and non-executing posture.",
  "function Assert-DisabledBusinessWrite",
  "-Method POST",
  "-Body '{\"confirm\":true}'",
  "$statusCode -ne 410",
  "Disabled Business write correctly returned 410 Gone",
  "Verify retired Business write endpoints fail closed",
]) {
  if (!smokePrinter.includes(token)) errors.push(`Business route smoke contract missing: ${token}`);
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
  contract: "business-route-catalogue-truthfulness-v2-deployed-retirement-check",
  plannerUsesAuthoritativeBusinessCatalogue: true,
  disabledDirectDraftWriteAdvertised: false,
  disabledApprovalWriteAdvertised: false,
  retiredWriteEndpointsExpectedStatus: 410,
  deployedRetiredWriteChecksRequired: true,
  historicalReadsRemainAdvertised: true,
  historicalReviewBuildIsInternalOnly: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
