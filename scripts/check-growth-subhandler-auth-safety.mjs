#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const read = (relativePath) => {
  const absolute = path.join(root, relativePath);
  return fs.existsSync(absolute) ? fs.readFileSync(absolute, "utf8") : "";
};

const approvalRequests = read("src/routes/growthApprovalRequestsAdmin.ts");
const strategyMemory = read("src/routes/growthStrategyMemoryAdmin.ts");
const packageJson = JSON.parse(read("package.json") || "{}");

for (const [label, content] of [
  ["Growth approval requests handler", approvalRequests],
  ["Growth strategy memory handler", strategyMemory],
]) {
  if (!content) errors.push(`Missing ${label}`);
  for (const token of [
    'import { isAdminRequestAuthorized } from "../core/adminAuthentication"',
    "await isAdminRequestAuthorized(request, env)",
    'error: "Unauthorized"',
    'request.method === "OPTIONS"',
    "status: 405",
    'allow: "GET, POST"',
  ]) {
    if (!content.includes(token)) errors.push(`${label} is missing protected-boundary token: ${token}`);
  }

  const authPosition = content.indexOf("await isAdminRequestAuthorized(request, env)");
  const optionsPosition = content.indexOf('request.method === "OPTIONS"');
  if (authPosition < 0 || optionsPosition < 0 || authPosition >= optionsPosition) {
    errors.push(`${label} must authenticate before OPTIONS handling`);
  }

  for (const forbidden of [
    "getAdminToken",
    "function authorized(",
    "function authorised(",
    "authorization ===",
    "authorization ==",
    "`Bearer ${token}`",
    'request.method === "OPTIONS") return json({ ok: true',
  ]) {
    if (content.includes(forbidden)) errors.push(`${label} contains forbidden authentication token: ${forbidden}`);
  }
}

for (const [label, content, persistenceCalls] of [
  [
    "Growth approval requests handler",
    approvalRequests,
    ["saveGrowthApprovalRequest(env,", "updateGrowthApprovalRequestStatus(env,"],
  ],
  [
    "Growth strategy memory handler",
    strategyMemory,
    [
      "upsertGrowthObjective(env,",
      "upsertGrowthKeyResult(env,",
      "upsertGrowthTargetSegment(env,",
      "upsertGrowthOfferProfile(env,",
      "upsertGrowthPositioningProfile(env,",
      "upsertGrowthRuntimeConstraint(env,",
    ],
  ],
]) {
  for (const call of persistenceCalls) {
    const callPosition = content.indexOf(call);
    if (callPosition < 0) {
      errors.push(`${label} is missing persistence call: ${call}`);
      continue;
    }
    const bodyPosition = content.lastIndexOf("const body = await parseBody(request)", callPosition);
    const confirmPosition = content.lastIndexOf("if (!confirmed(url, body))", callPosition);
    if (bodyPosition < 0 || confirmPosition < 0 || !(bodyPosition < confirmPosition && confirmPosition < callPosition)) {
      errors.push(`${label} must confirm after body parsing and before persistence call: ${call}`);
    }
  }
}

for (const token of [
  "internalMetadataOnly: true",
  "externalStateChange: false",
  "callsAI: false",
  "callsNetwork: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
]) {
  if (!approvalRequests.includes(token)) errors.push(`Growth approval safety token is missing: ${token}`);
  if (!strategyMemory.includes(token)) errors.push(`Growth strategy safety token is missing: ${token}`);
}

const expectedCommand = "node scripts/check-growth-subhandler-auth-safety.mjs";
if (packageJson.scripts?.["growth:subhandler-auth-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose growth:subhandler-auth-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run growth:subhandler-auth-safety:check")) {
  errors.push("check:local must include growth:subhandler-auth-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "growth-subhandler-authentication-safety",
  approvalRequestsUseSharedAuthentication: true,
  approvalRequestWritesRequireConfirmation: true,
  strategyMemoryUsesSharedAuthentication: true,
  strategyMemoryWritesRequireConfirmation: true,
  externalStateChangeAllowed: false,
  callsAI: false,
  callsNetwork: false,
  canSendEmail: false,
  canPostSocial: false,
  canSubmitForms: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
