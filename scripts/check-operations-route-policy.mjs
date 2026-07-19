#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const policyPath = path.join(root, "src", "routes", "operationsRoutePolicy.ts");
const indexPath = path.join(root, "src", "index.ts");
const autonomyPath = path.join(root, "src", "routes", "autonomySettingsAdmin.ts");
const errors = [];

const policy = fs.existsSync(policyPath) ? fs.readFileSync(policyPath, "utf8") : "";
const index = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";
const autonomy = fs.existsSync(autonomyPath) ? fs.readFileSync(autonomyPath, "utf8") : "";

if (!policy) errors.push("Missing typed operational route policy registry");
if (!index) errors.push("Missing Worker dispatcher");
if (!autonomy) errors.push("Missing autonomy settings handler");

const ids = ["autonomy-settings", "planner-routes", "planner", "source-batch", "sources", "draft-review", "strategy-scores"];
for (const id of ids) {
  const policyCount = policy.split(`id: "${id}"`).length - 1;
  const caseCount = index.split(`case "${id}":`).length - 1;
  if (policyCount !== 1) errors.push(`Operational route policy ${id} must exist exactly once (${policyCount})`);
  if (caseCount !== 1) errors.push(`Operational dispatcher case ${id} must exist exactly once (${caseCount})`);
}

for (const token of [
  'import { resolveOperationsRouteHandlerId } from "./routes/operationsRoutePolicy"',
  'switch (resolveOperationsRouteHandlerId(pathname))',
  'return await handleAutonomySettingsAdmin(req, env, pathname, jsonResponse)',
  'return await handlePlannerRoutesAdmin(req, env, pathname, jsonResponse)',
  'return await handlePlannerAdmin(req, env, pathname, jsonResponse)',
  'return await handleSourceBatchAdmin(req, env, pathname, jsonResponse)',
  'return await handleSourcesAdmin(req, env, pathname, jsonResponse)',
  'return await handleDraftReviewAdmin(req, env, pathname, jsonResponse)',
]) {
  if (!index.includes(token)) errors.push(`Operational dispatcher is missing: ${token}`);
}

for (const raw of [
  'pathname === "/admin/settings/autonomy"',
  'pathname === "/admin/planner/routes"',
  'pathname === "/admin/planner" || pathname.startsWith("/admin/planner/")',
  'pathname === "/admin/sources/run-tiny"',
  'pathname.startsWith("/admin/sources") || pathname === "/admin/seeds"',
  'pathname.startsWith("/admin/draft-review")',
  'pathname.startsWith("/admin/strategy-scores")',
]) {
  if (index.includes(raw)) errors.push(`Raw operational route ownership must remain in the typed registry: ${raw}`);
}

for (const unsafe of [
  'authentication: "none"',
  'callsAI: true',
  'canSendEmail: true',
  'canPostSocial: true',
  'canSubmitForms: true',
]) {
  if (policy.includes(unsafe)) errors.push(`Operational policy contains unsafe capability: ${unsafe}`);
}

for (const required of [
  'authentication: "handler-enforced"',
  'networkPosture: "read-only-research"',
  'writeConfirmation: "handler-enforced"',
  'writeConfirmation: "handler-defined"',
  'mutationPosture: "read-only"',
  'mutationPosture: "mixed-internal"',
  'callsAI: false',
  'canSendEmail: false',
  'canPostSocial: false',
  'canSubmitForms: false',
]) {
  if (!policy.includes(required)) errors.push(`Operational policy is missing: ${required}`);
}

for (const token of [
  'function confirmed(body: any): boolean',
  'if (!confirmed(body))',
  'error: "confirm_required"',
  'settingsWriteRequiresConfirmation: true',
]) {
  if (!autonomy.includes(token)) errors.push(`Autonomy settings handler is missing confirmation guard: ${token}`);
}

const autonomyPolicyStart = policy.indexOf('id: "autonomy-settings"');
const autonomyPolicyEnd = policy.indexOf('id: "planner-routes"', autonomyPolicyStart);
const autonomyPolicy = autonomyPolicyStart >= 0 && autonomyPolicyEnd > autonomyPolicyStart
  ? policy.slice(autonomyPolicyStart, autonomyPolicyEnd)
  : "";
if (!autonomyPolicy.includes('writeConfirmation: "handler-enforced"')) {
  errors.push("Autonomy settings policy must require handler-enforced confirmation");
}

const priorities = [...policy.matchAll(/priority:\s*(\d+)/g)].map((match) => Number(match[1]));
if (priorities.length !== ids.length) errors.push(`Expected ${ids.length} operational priorities, found ${priorities.length}`);
if (new Set(priorities).size !== priorities.length) errors.push("Operational route priorities must be unique");
for (let i = 1; i < priorities.length; i += 1) {
  if (priorities[i] <= priorities[i - 1]) errors.push("Operational route priorities must be strictly increasing");
}

const plannerRoutesPosition = policy.indexOf('id: "planner-routes"');
const plannerPosition = policy.indexOf('id: "planner"');
if (plannerRoutesPosition < 0 || plannerPosition < 0 || plannerRoutesPosition >= plannerPosition) {
  errors.push("Planner route catalogue must precede the general planner policy");
}

const sourceBatchPosition = policy.indexOf('id: "source-batch"');
const sourcesPosition = policy.indexOf('id: "sources"');
if (sourceBatchPosition < 0 || sourcesPosition < 0 || sourceBatchPosition >= sourcesPosition) {
  errors.push("Tiny source batch must precede the broad sources policy");
}

for (const route of [
  "/admin/settings/autonomy",
  "/admin/planner/routes",
  "/admin/sources/run-tiny",
  "/admin/seeds",
  "/admin/strategy-scores",
]) {
  if (!policy.includes(`"${route}"`)) errors.push(`Operational policy is missing ${route}`);
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "typed-operational-route-policy",
  routeGroups: ids,
  autonomySettingsRequireConfirmation: true,
  externalResearchOnly: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
