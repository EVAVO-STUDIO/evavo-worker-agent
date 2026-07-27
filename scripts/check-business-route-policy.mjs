#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const policyPath = path.join(root, "src", "routes", "businessRoutePolicy.ts");
const indexPath = path.join(root, "src", "index.ts");
const inventoryPath = path.join(root, "src", "core", "growthBusinessRouteInventory.ts");
const errors = [];

const policy = fs.existsSync(policyPath) ? fs.readFileSync(policyPath, "utf8") : "";
const index = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";
const inventory = fs.existsSync(inventoryPath) ? fs.readFileSync(inventoryPath, "utf8") : "";

if (!policy) errors.push("Missing typed Business route policy registry");
if (!index) errors.push("Missing Worker dispatcher");
if (!inventory) errors.push("Missing Worker route inventory");

const ids = ["account-intelligence", "people", "website-audit", "business-historical", "business-fallback"];
for (const id of ids) {
  const policyCount = policy.split(`id: "${id}"`).length - 1;
  const caseCount = index.split(`case "${id}":`).length - 1;
  if (policyCount !== 1) errors.push(`Business route policy ${id} must exist exactly once (${policyCount})`);
  if (caseCount !== 1) errors.push(`Business dispatcher case ${id} must exist exactly once (${caseCount})`);
}

for (const token of [
  'import { resolveBusinessRouteHandlerId } from "./routes/businessRoutePolicy"',
  'switch (resolveBusinessRouteHandlerId(pathname))',
  'case "account-intelligence":',
  'return await handleBusinessAutopilotPeopleAdmin(req, env, pathname, jsonResponse)',
  'return await handleBusinessAutopilotWebsiteAdmin(req, env, pathname, jsonResponse)',
  'case "business-historical":',
  'return await handleBusinessAutopilotAdmin(req, env, pathname, jsonResponse)',
]) {
  if (!index.includes(token)) errors.push(`Business dispatcher is missing: ${token}`);
}

for (const raw of [
  'pathname === "/admin/business/people"',
  'pathname === "/admin/business/websites"',
  'pathname === "/admin/business/pages"',
  'pathname === "/admin/business/website-audit-runs"',
  'pathname === "/admin/business/audit-observations"',
  'pathname === "/admin/business/audit-observation-candidates"',
  'pathname === "/admin/business/action-drafts"',
  'pathname === "/admin/business/approval-requests"',
  'pathname === "/admin/business" || pathname.startsWith("/admin/business/")',
]) {
  if (index.includes(raw)) errors.push(`Raw Business route ownership must remain in the typed registry: ${raw}`);
}

for (const unsafe of [
  'authentication: "none"',
  'writeConfirmation: "not-required"',
  'callsExternalNetwork: true',
  'callsAI: true',
  'canSendEmail: true',
  'canPostSocial: true',
  'canSubmitForms: true',
]) {
  if (policy.includes(unsafe)) errors.push(`Business policy contains unsafe capability: ${unsafe}`);
}

for (const required of [
  'export type BusinessMutationPosture = "read-only" | "mixed-internal" | "historical-read-retired-write"',
  'export const BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN = "/admin/business/organizations/:organizationId/account-360" as const',
  'const accountIntelligencePath = /^\\/admin\\/business\\/organizations\\/[^/]+\\/account-360$/',
  'authentication: "handler-enforced"',
  'readMethods: Object.freeze(["GET"] as const)',
  'writeMethods: Object.freeze([] as const)',
  'writeConfirmation: "not-applicable" as const',
  'writeMethods: Object.freeze(["POST"] as const)',
  'writeConfirmation: "handler-enforced" as const',
  'callsExternalNetwork: false',
  'callsAI: false',
  'canSendEmail: false',
  'canPostSocial: false',
  'canSubmitForms: false',
  'historicalOnly: boolean',
  'retiredWritesFailClosed: boolean',
  'mutationPosture: "read-only" as const',
  'mutationPosture: "historical-read-retired-write" as const',
  'historicalOnly: true',
  'retiredWritesFailClosed: true',
  'export const BUSINESS_HISTORICAL_PATHS',
]) {
  if (!policy.includes(required)) errors.push(`Business policy is missing: ${required}`);
}

for (const required of [
  'BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN',
  'case "account-intelligence":',
  'kind: "pattern", pattern: BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN',
  'const readOnly = policy.mutationPosture === "read-only"',
  'postClassification: readOnly ? "not-supported"',
  'writeMethods: Object.freeze([...policy.writeMethods])',
  'confirmation: policy.writeConfirmation',
]) {
  if (!inventory.includes(required)) errors.push(`Business inventory is missing: ${required}`);
}

const priorities = [...policy.matchAll(/priority:\s*(\d+)/g)].map((match) => Number(match[1]));
if (priorities.length !== ids.length) errors.push(`Expected ${ids.length} Business priorities, found ${priorities.length}`);
if (new Set(priorities).size !== priorities.length) errors.push("Business route priorities must be unique");
for (let i = 1; i < priorities.length; i += 1) {
  if (priorities[i] <= priorities[i - 1]) errors.push("Business route priorities must be strictly increasing");
}

const fallbackPosition = policy.indexOf('id: "business-fallback"');
for (const specific of ['id: "account-intelligence"', 'id: "people"', 'id: "website-audit"', 'id: "business-historical"']) {
  if (policy.indexOf(specific) < 0 || policy.indexOf(specific) >= fallbackPosition) {
    errors.push(`${specific} must precede the Business fallback`);
  }
}

const expectedWebsitePaths = [
  "/admin/business/websites",
  "/admin/business/pages",
  "/admin/business/website-audit-runs",
  "/admin/business/audit-observations",
  "/admin/business/audit-observation-candidates",
];
for (const route of expectedWebsitePaths) {
  if (!policy.includes(`"${route}"`)) errors.push(`Business website/audit policy is missing ${route}`);
}

const expectedHistoricalPaths = [
  "/admin/business/action-drafts",
  "/admin/business/approval-requests",
];
for (const route of expectedHistoricalPaths) {
  if (!policy.includes(`"${route}"`)) errors.push(`Business historical policy is missing ${route}`);
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "typed-business-route-policy-v3-account-intelligence-read-only",
  routeGroups: ids,
  accountIntelligenceRouteGroupExplicit: true,
  accountIntelligenceReadOnly: true,
  accountIntelligencePostSupported: false,
  accountIntelligenceConfirmationRequired: false,
  historicalRouteGroupExplicit: true,
  historicalReadsOnly: true,
  retiredHistoricalWritesFailClosed: true,
  specificGroupsPrecedeFallback: true,
  readMethods: ["GET"],
  writeMethods: ["POST"],
  externalExecutionEnabled: false,
  confirmationRequiredForWrites: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
