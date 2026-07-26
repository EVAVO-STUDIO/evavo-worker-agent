#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const policyPath = path.join(root, "src", "routes", "growthRoutePolicy.ts");
const indexPath = path.join(root, "src", "index.ts");
const errors = [];

if (!fs.existsSync(policyPath)) errors.push("Missing typed Growth route policy registry");
if (!fs.existsSync(indexPath)) errors.push("Missing Worker dispatcher");

const policy = fs.existsSync(policyPath) ? fs.readFileSync(policyPath, "utf8") : "";
const index = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";

const expectedHandlers = [
  "approval-requests",
  "operator-artifacts",
  "capabilities",
  "blackboard",
  "strategy-memory",
  "campaign-intelligence",
  "growth-fallback",
];

for (const handlerId of expectedHandlers) {
  const exactHelperCount = policy.split(`exact("${handlerId}",`).length - 1;
  const literalCount = policy.split(`handlerId: "${handlerId}"`).length - 1;
  const count = exactHelperCount + literalCount;
  if (count !== 1) errors.push(`Growth handler policy must appear exactly once: ${handlerId} (${count})`);
  const switchCount = index.split(`case "${handlerId}":`).length - 1;
  if (switchCount !== 1) errors.push(`Growth dispatcher case must appear exactly once: ${handlerId} (${switchCount})`);
}

for (const token of [
  'import { resolveGrowthRouteHandlerId } from "./routes/growthRoutePolicy"',
  'import { handleGrowthInternalOperatorPackAdmin } from "./routes/growthInternalOperatorPackAdmin"',
  "switch (resolveGrowthRouteHandlerId(pathname))",
  'case "operator-artifacts":',
  "handleGrowthInternalOperatorPackAdmin(req, env, pathname, jsonResponse)",
  'authentication: "handler-enforced"',
  "callsExternalNetwork: false",
  "callsAI: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
  'prefix: "/admin/growth"',
]) {
  const source = token.startsWith("import ") || token.startsWith("switch ") || token.startsWith("case ") || token.startsWith("handleGrowth") ? index : policy;
  if (!source.includes(token)) errors.push(`Growth route policy contract is missing: ${token}`);
}

const expectedPaths = [
  "/admin/growth/approval-requests",
  "/admin/growth/approval-requests/status",
  "/admin/growth/operator/artifacts",
  "/admin/growth/capabilities",
  "/admin/growth/blackboard",
  "/admin/growth/blackboard/facts",
  "/admin/growth/blackboard/entities",
  "/admin/growth/blackboard/relationships",
  "/admin/growth/blackboard/signals",
  "/admin/growth/blackboard/assets",
  "/admin/growth/strategy-memory",
  "/admin/growth/objectives",
  "/admin/growth/key-results",
  "/admin/growth/segments",
  "/admin/growth/offers",
  "/admin/growth/positioning",
  "/admin/growth/runtime-constraints",
  "/admin/growth/autonomy",
  "/admin/growth/cycle",
  "/admin/growth/cycle/events",
  "/admin/growth/cycle/record",
  "/admin/growth/operator",
  "/admin/growth/campaigns",
  "/admin/growth/experiments",
  "/admin/growth/decisions",
  "/admin/growth/decisions/plan",
  "/admin/growth/metrics",
  "/admin/growth/evidence",
  "/admin/growth/learning",
];

for (const routePath of expectedPaths) {
  const count = policy.split(`"${routePath}"`).length - 1;
  if (count !== 1) errors.push(`Growth route path must have one typed owner: ${routePath} (${count})`);
}

const operatorPolicyStart = policy.indexOf('exact("operator-artifacts"');
const operatorPolicyEnd = policy.indexOf('exact("capabilities"', operatorPolicyStart);
const operatorPolicy = operatorPolicyStart >= 0 && operatorPolicyEnd > operatorPolicyStart
  ? policy.slice(operatorPolicyStart, operatorPolicyEnd)
  : "";
for (const token of [
  '"mixed-internal"',
  '"not-required"',
  "/admin/growth/operator/artifacts",
]) {
  if (!operatorPolicy.includes(token)) errors.push(`Growth operator-artifacts policy is missing: ${token}`);
}
for (const forbidden of [
  "callsExternalNetwork: true",
  "callsAI: true",
  "canSendEmail: true",
  "canPostSocial: true",
  "canSubmitForms: true",
]) {
  if (operatorPolicy.includes(forbidden)) errors.push(`Unsafe operator-artifacts policy capability detected: ${forbidden}`);
}

const helperPriorities = [...policy.matchAll(/exact\("[^"]+",\s*(\d+)/g)].map((match) => Number(match[1]));
const literalPriorities = [...policy.matchAll(/handlerId:\s*"[^"]+"[\s\S]{0,120}?priority:\s*(\d+)/g)].map((match) => Number(match[1]));
const priorities = [...helperPriorities, ...literalPriorities];
if (priorities.length !== expectedHandlers.length) errors.push(`Expected ${expectedHandlers.length} Growth priorities, found ${priorities.length}`);
if (new Set(priorities).size !== priorities.length) errors.push("Growth route priorities must be unique");
const sortedPriorities = [...priorities].sort((left, right) => left - right);
for (let indexValue = 1; indexValue < sortedPriorities.length; indexValue += 1) {
  if (sortedPriorities[indexValue] <= sortedPriorities[indexValue - 1]) errors.push("Growth route priorities must be strictly increasing");
}

const forbiddenIndexTokens = [
  'pathname === "/admin/growth/approval-requests"',
  'pathname === "/admin/growth/operator/artifacts"',
  'pathname === "/admin/growth/capabilities"',
  'pathname === "/admin/growth/blackboard"',
  'pathname === "/admin/growth/strategy-memory"',
  'pathname === "/admin/growth/autonomy"',
  'pathname.startsWith("/admin/growth/")',
];
for (const token of forbiddenIndexTokens) {
  if (index.includes(token)) errors.push(`Growth route ownership must not be duplicated in src/index.ts: ${token}`);
}

for (const forbidden of [
  "canSendEmail: true",
  "canPostSocial: true",
  "canSubmitForms: true",
  "callsExternalNetwork: true",
  "callsAI: true",
  'authentication: "none"',
]) {
  if (policy.includes(forbidden)) errors.push(`Unsafe Growth route policy capability detected: ${forbidden}`);
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "typed-growth-route-policy",
  handlerCount: expectedHandlers.length,
  exactPathCount: expectedPaths.length,
  deterministicOperatorArtifactsEnabled: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
