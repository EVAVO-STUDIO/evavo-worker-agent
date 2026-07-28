#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pathsPath = path.join(root, "src", "core", "businessRoutePaths.ts");
const readBoundaryPath = path.join(root, "src", "core", "businessMetadataReadBoundary.ts");
const policyPath = path.join(root, "src", "routes", "businessRoutePolicy.ts");
const indexPath = path.join(root, "src", "index.ts");
const inventoryPath = path.join(root, "src", "core", "growthBusinessRouteInventory.ts");
const cataloguePath = path.join(root, "src", "routes", "businessAutopilotRouteCatalogue.ts");
const errors = [];

const routePaths = fs.existsSync(pathsPath) ? fs.readFileSync(pathsPath, "utf8") : "";
const readBoundary = fs.existsSync(readBoundaryPath) ? fs.readFileSync(readBoundaryPath, "utf8") : "";
const policy = fs.existsSync(policyPath) ? fs.readFileSync(policyPath, "utf8") : "";
const index = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";
const inventory = fs.existsSync(inventoryPath) ? fs.readFileSync(inventoryPath, "utf8") : "";
const catalogue = fs.existsSync(cataloguePath) ? fs.readFileSync(cataloguePath, "utf8") : "";

if (!routePaths) errors.push("Missing canonical Business route path registry");
if (!readBoundary) errors.push("Missing Business read query boundary");
if (!policy) errors.push("Missing typed Business route policy registry");
if (!index) errors.push("Missing Worker dispatcher");
if (!inventory) errors.push("Missing Worker route inventory");
if (!catalogue) errors.push("Missing Business route catalogue");

const ids = ["account-intelligence", "people", "website-audit", "business-historical", "business-fallback"];
for (const id of ids) {
  const policyCount = policy.split(`id: "${id}"`).length - 1;
  const caseCount = index.split(`case "${id}":`).length - 1;
  if (policyCount !== 1) errors.push(`Business route policy ${id} must exist exactly once (${policyCount})`);
  if (caseCount !== 1) errors.push(`Business dispatcher case ${id} must exist exactly once (${caseCount})`);
}

for (const token of [
  'import { resolveBusinessRouteHandlerId } from "./routes/businessRoutePolicy"',
  'preflightBusinessMetadataReadQuery,',
  'parseBusinessMetadataReadRouteQuery,',
  'const businessReadPreflight = preflightBusinessMetadataReadQuery(url, pathname, req.method)',
  'return jsonResponse(businessReadPreflight.payload, { status: businessReadPreflight.status })',
  'const businessReadQuery = parseBusinessMetadataReadRouteQuery(url, pathname, req.method)',
  'return jsonResponse(businessReadQuery.payload, { status: businessReadQuery.status })',
  'switch (resolveBusinessRouteHandlerId(pathname))',
  'case "account-intelligence":',
  'return await handleBusinessAutopilotPeopleAdmin(req, env, pathname, jsonResponse)',
  'return await handleBusinessAutopilotWebsiteAdmin(req, env, pathname, jsonResponse)',
  'case "business-historical":',
  'return await handleBusinessAutopilotAdmin(req, env, pathname, jsonResponse)',
]) {
  if (!index.includes(token)) errors.push(`Business dispatcher is missing: ${token}`);
}

const preflightPosition = index.indexOf("const businessReadPreflight = preflightBusinessMetadataReadQuery");
const collectionParserPosition = index.indexOf("const businessReadQuery = parseBusinessMetadataReadRouteQuery");
const businessDispatchPosition = index.indexOf("switch (resolveBusinessRouteHandlerId(pathname))");
if (!(preflightPosition >= 0 && collectionParserPosition > preflightPosition && businessDispatchPosition > collectionParserPosition)) {
  errors.push("Business GET family preflight must run before collection parsing and Business dispatch");
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
  'export const BUSINESS_ROUTE_PREFIX = "/admin/business" as const',
  'export const BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN =',
  '"/admin/business/organizations/:organizationId/account-360" as const',
  'export const BUSINESS_PEOPLE_PATH = "/admin/business/people" as const',
  'export const BUSINESS_WEBSITE_AUDIT_PATHS',
  'export const BUSINESS_HISTORICAL_PATHS',
  'export const BUSINESS_FALLBACK_COLLECTION_PATHS',
  'export const BUSINESS_READ_QUERY_GUARDED_PATHS',
  'export type BusinessReadQueryGuardedPath',
  'export function isBusinessRoutePath(pathname: string): boolean',
  'pathname === BUSINESS_ROUTE_PREFIX || pathname.startsWith(`${BUSINESS_ROUTE_PREFIX}/`)',
]) {
  if (!routePaths.includes(required)) errors.push(`Business path registry is missing: ${required}`);
}

for (const required of [
  'from "../core/businessRoutePaths"',
  'export type BusinessMutationPosture = "read-only" | "mixed-internal" | "historical-read-retired-write"',
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
  'pathname === BUSINESS_PEOPLE_PATH',
  'BUSINESS_WEBSITE_AUDIT_PATHS.includes',
  'BUSINESS_HISTORICAL_PATHS.includes',
]) {
  if (!policy.includes(required)) errors.push(`Business policy is missing: ${required}`);
}

for (const forbidden of [
  'const websiteAuditPaths =',
  'const historicalBusinessPaths =',
]) {
  if (policy.includes(forbidden)) errors.push(`Business policy duplicates canonical paths: ${forbidden}`);
}

for (const required of [
  'BUSINESS_READ_QUERY_GUARDED_PATHS',
  'isBusinessRoutePath',
  'type BusinessReadQueryGuardedPath',
  'Record<BusinessReadQueryGuardedPath, BusinessMetadataReadQueryOptions>',
  'export function preflightBusinessMetadataReadQuery(',
  'if (method !== "GET" || !isBusinessRoutePath(pathname)) return null',
  'BUSINESS_READ_QUERY_GUARDED_PATHS.includes',
]) {
  if (!readBoundary.includes(required)) errors.push(`Business read boundary is missing path parity or preflight token: ${required}`);
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

for (const required of [
  'const accountIntelligenceDescription = "Reads one bounded, evidence-backed Worker Account 360 snapshot',
  'readRoute("business_account_360"',
  '/admin/business/organizations/:organizationId/account-360?limit=25',
  'D1 remains noncanonical',
  'does not promote state to Supabase',
  'infer relationship or deal health',
  'expose contact details',
  'create meetings',
  'or execute external actions',
]) {
  if (!catalogue.includes(required)) errors.push(`Business catalogue is missing Account 360 posture: ${required}`);
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

const expectedFallbackPaths = [
  "/admin/business/organizations",
  "/admin/business/signals",
  "/admin/business/opportunities",
  "/admin/business/service-matches",
  "/admin/business/audit-packs",
  "/admin/business/suppression",
  "/admin/business/content-ideas",
  "/admin/business/followups",
  "/admin/business/learning",
];
const expectedWebsitePaths = [
  "/admin/business/websites",
  "/admin/business/pages",
  "/admin/business/website-audit-runs",
  "/admin/business/audit-observations",
  "/admin/business/audit-observation-candidates",
];
const expectedHistoricalPaths = [
  "/admin/business/action-drafts",
  "/admin/business/approval-requests",
];
for (const route of [...expectedFallbackPaths, ...expectedWebsitePaths, ...expectedHistoricalPaths]) {
  const routeCount = routePaths.split(`"${route}"`).length - 1;
  if (routeCount !== 1) errors.push(`Canonical Business path must exist exactly once (${routeCount}): ${route}`);
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "typed-business-route-policy-v5-family-read-preflight",
  compatibility: {
    contract: "typed-business-route-policy-v4-canonical-paths",
  },
  routeGroups: ids,
  canonicalPathRegistry: true,
  businessFamilyPrefixCanonical: true,
  businessFamilyReadPreflightActive: true,
  specialisedBusinessReadsStructurallyPreflighted: true,
  unknownBusinessReadsStructurallyPreflighted: true,
  readGuardPathParityTyped: true,
  accountIntelligenceRouteGroupExplicit: true,
  accountIntelligenceReadOnly: true,
  accountIntelligencePostSupported: false,
  accountIntelligenceConfirmationRequired: false,
  accountIntelligenceInventoryExplicit: true,
  accountIntelligenceCatalogueExplicit: true,
  accountIntelligenceCanonicalPromotionAllowed: false,
  historicalRouteGroupExplicit: true,
  historicalReadsOnly: true,
  retiredHistoricalWritesFailClosed: true,
  historicalGroupPrecedesFallback: true,
  specificGroupsPrecedeFallback: true,
  readMethods: ["GET"],
  writeMethods: ["POST"],
  externalExecutionEnabled: false,
  confirmationRequiredForWrites: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
