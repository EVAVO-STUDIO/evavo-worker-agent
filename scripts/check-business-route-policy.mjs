#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const read = (...parts) => {
  const file = path.join(root, ...parts);
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
};
const errors = [];
const requireToken = (source, token, label) => {
  if (!source.includes(token)) errors.push(`${label}: ${token}`);
};
const forbidToken = (source, token, label) => {
  if (source.includes(token)) errors.push(`${label}: ${token}`);
};

const routePaths = read("src", "core", "businessRoutePaths.ts");
const readBoundary = read("src", "core", "businessMetadataReadBoundary.ts");
const policy = read("src", "routes", "businessRoutePolicy.ts");
const handler = read("src", "routes", "businessRelationshipManagerAdmin.ts");
const runtimeInput = read("src", "core", "businessRelationshipManagerRuntimeInput.ts");
const index = read("src", "index.ts");
const inventory = read("src", "core", "growthBusinessRouteInventory.ts");
const catalogue = read("src", "routes", "businessAutopilotRouteCatalogue.ts");

for (const [name, source] of [
  ["route paths", routePaths], ["read boundary", readBoundary], ["route policy", policy],
  ["Relationship Manager handler", handler], ["Relationship Manager input parser", runtimeInput],
  ["Worker dispatcher", index], ["route inventory", inventory], ["route catalogue", catalogue],
]) if (!source) errors.push(`Missing ${name}`);

const ids = ["account-intelligence", "relationship-manager", "people", "website-audit", "business-historical", "business-fallback"];
for (const id of ids) {
  const policyCount = policy.split(`id: "${id}"`).length - 1;
  const caseCount = index.split(`case "${id}":`).length - 1;
  if (policyCount !== 1) errors.push(`Business policy ${id} must exist exactly once (${policyCount})`);
  if (caseCount !== 1) errors.push(`Business dispatcher ${id} must exist exactly once (${caseCount})`);
}

for (const token of [
  'export const BUSINESS_RELATIONSHIP_MANAGER_CYCLE_PATH = "/admin/business/relationship-manager/communication-cycle" as const',
  'export const BUSINESS_ROUTE_PREFIX = "/admin/business" as const',
  'export const BUSINESS_READ_QUERY_GUARDED_PATHS',
  'export function isBusinessRoutePath(pathname: string): boolean',
]) requireToken(routePaths, token, "Business path registry missing");

for (const token of [
  'export type BusinessMutationPosture = "read-only" | "internal-preview" | "mixed-internal" | "historical-read-retired-write"',
  'id: "relationship-manager"',
  'priority: 15',
  'mutationPosture: "internal-preview" as const',
  'const internalPreviewSafety = Object.freeze({',
  'readMethods: Object.freeze([] as const)',
  'writeMethods: Object.freeze(["POST"] as const)',
  'writeConfirmation: "not-applicable" as const',
  'matches: (pathname: string) => pathname === BUSINESS_RELATIONSHIP_MANAGER_CYCLE_PATH',
  'callsExternalNetwork: false as const',
  'callsAI: false as const',
  'canSendEmail: false as const',
]) requireToken(policy, token, "Business policy missing");

for (const unsafe of [
  'authentication: "none"', 'callsExternalNetwork: true', 'callsAI: true',
  'canSendEmail: true', 'canPostSocial: true', 'canSubmitForms: true',
]) forbidToken(policy, unsafe, "Unsafe Business policy token");

const priorities = [...policy.matchAll(/priority:\s*(\d+)/g)].map((match) => Number(match[1]));
if (priorities.length !== ids.length) errors.push(`Expected ${ids.length} Business priorities, found ${priorities.length}`);
if (new Set(priorities).size !== priorities.length) errors.push("Business route priorities must be unique");
for (let i = 1; i < priorities.length; i += 1) if (priorities[i] <= priorities[i - 1]) errors.push("Business route priorities must be strictly increasing");
const fallbackPosition = policy.indexOf('id: "business-fallback"');
for (const id of ids.slice(0, -1)) {
  const position = policy.indexOf(`id: "${id}"`);
  if (position < 0 || position >= fallbackPosition) errors.push(`${id} must precede the Business fallback`);
}

for (const token of [
  'preflightBusinessMetadataReadQuery(',
  'if (method !== "GET" || !isBusinessRoutePath(pathname)) return null',
  'BUSINESS_READ_QUERY_GUARDED_PATHS.includes',
]) requireToken(readBoundary, token, "Business read boundary missing");

for (const token of [
  'import { handleBusinessRelationshipManagerAdmin } from "./routes/businessRelationshipManagerAdmin"',
  'switch (resolveBusinessRouteHandlerId(pathname))',
  'case "relationship-manager":',
  'return await handleBusinessRelationshipManagerAdmin(req, env, pathname, jsonResponse)',
]) requireToken(index, token, "Worker dispatcher missing");
if (index.indexOf('case "relationship-manager":') >= index.indexOf('case "business-fallback":')) errors.push("Relationship Manager dispatch must precede Business fallback");

for (const token of [
  'export type WorkerPostClassification =',
  '| "internal-preview"',
  'case "relationship-manager":',
  'paths: Object.freeze([BUSINESS_RELATIONSHIP_MANAGER_CYCLE_PATH])',
  'const preview = policy.mutationPosture === "internal-preview"',
  'postClassification: preview ? "internal-preview"',
  'internalPreviewGroups: entries.filter((entry) => entry.postClassification === "internal-preview").length',
  'inventoryIncludesExternalExecution: false',
  'canSendEmail: false',
]) requireToken(inventory, token, "Worker route inventory missing");

for (const token of [
  'const relationshipManagerPreviewDescription = "Runs one bounded, authenticated Relationship Manager communication-cycle preview',
  'function previewRoute(', 'method: "POST"', 'safety: "read_only"', 'readOnly: true',
  'requiresConfirm: false', 'writesTables: []', 'callsNetwork: false', 'callsAI: false',
  'canSendEmail: false', 'previewRoute("business_relationship_manager_cycle_preview"',
  '/admin/business/relationship-manager/communication-cycle', 'does not call AI or external providers',
  'persist memory', 'approve execution', 'mutate canonical state',
]) requireToken(catalogue, token, "Business catalogue missing Relationship Manager posture");

for (const token of [
  'readBoundedJsonObject', 'isAdminRequestAuthorized', 'parseRelationshipManagerCommunicationCycleInput',
  'rawMessageBodiesExposed: false', 'callerSuppliedTrustedContextAccepted: false', 'previewApprovalGradeReady: false',
  'persisted: false', 'canonicalStateMutated: false', 'callsExternalNetwork: false', 'callsAI: false',
  'sendsEmail: false', 'createsMeetings: false', 'mutatesExternalProviders: false', 'externalExecutionAllowed: false',
]) requireToken(handler, token, "Relationship Manager handler safety missing");
for (const unsafe of ['sendEmail(', 'gmail.send', 'externalExecutionAllowed: true']) forbidToken(handler, unsafe, "Relationship Manager handler unsafe token");

for (const token of [
  'RELATIONSHIP_MANAGER_INPUT_PRECOMPOSED_TRUSTED_CONTEXT_NOT_ACCEPTED',
  'RELATIONSHIP_MANAGER_INPUT_CHANNEL_CURRENT_INVALID',
  'RELATIONSHIP_MANAGER_INPUT_CANDIDATE_REQUIRED',
  'RELATIONSHIP_MANAGER_INPUT_VERIFIED_IDENTITY_SELECTED_REQUIRED',
  'requiredBool(input.exactAddressMatch, "identity_exact_address_match")',
]) requireToken(runtimeInput, token, "Relationship Manager input parser safety missing");

const canonicalPaths = [
  "/admin/business/relationship-manager/communication-cycle",
  "/admin/business/organizations", "/admin/business/signals", "/admin/business/opportunities",
  "/admin/business/service-matches", "/admin/business/audit-packs", "/admin/business/suppression",
  "/admin/business/content-ideas", "/admin/business/followups", "/admin/business/learning",
  "/admin/business/websites", "/admin/business/pages", "/admin/business/website-audit-runs",
  "/admin/business/audit-observations", "/admin/business/audit-observation-candidates",
  "/admin/business/action-drafts", "/admin/business/approval-requests",
];
for (const routePath of canonicalPaths) {
  const count = routePaths.split(`"${routePath}"`).length - 1;
  if (count !== 1) errors.push(`Canonical Business path must exist exactly once (${count}): ${routePath}`);
}

const governedFlow = spawnSync(process.execPath, [path.join(root, "scripts", "check-relationship-manager-governed-flow.mjs")], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
});
if (governedFlow.status !== 0) {
  const details = (governedFlow.stderr || governedFlow.stdout || "unknown failure").trim().slice(0, 2000);
  errors.push(`Relationship Manager governed-flow gate failed: ${details}`);
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "typed-business-route-policy-v9-governed-relationship-manager",
  routeGroups: ids,
  relationshipManager: {
    routeGroupExplicit: true,
    postClassification: "internal-preview",
    postSupported: true,
    confirmationRequired: false,
    stateMutationAllowed: false,
    callsExternalNetwork: false,
    callsAI: false,
    canSendEmail: false,
    externalExecutionAllowed: false,
    catalogueExplicit: true,
    strictInputParser: true,
    governedFlowGate: governedFlow.status === 0,
  },
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
