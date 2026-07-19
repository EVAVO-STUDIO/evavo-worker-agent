#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const policyPath = path.join(root, "src", "routes", "opportunityRoutePolicy.ts");
const indexPath = path.join(root, "src", "index.ts");
const errors = [];

const policy = fs.existsSync(policyPath) ? fs.readFileSync(policyPath, "utf8") : "";
const index = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, "utf8") : "";
if (!policy) errors.push("Missing opportunity route policy registry");
if (!index) errors.push("Missing Worker dispatcher");

const handlerIds = [
  "run-due",
  "runs",
  "source-health-action",
  "origin-metrics",
  "expansion-budget-recommendations",
  "public-directory-scan",
  "query-hint-resolver",
  "source-expansion",
  "source-candidates",
  "source-health",
  "scoring-diagnostics",
  "discovery",
  "learning",
  "review",
  "opportunities-fallback",
];

for (const id of handlerIds) {
  const policyCount = policy.split(`id: "${id}"`).length - 1;
  const caseCount = index.split(`case "${id}":`).length - 1;
  if (policyCount !== 1) errors.push(`Opportunity policy must define ${id} exactly once (${policyCount})`);
  if (caseCount !== 1) errors.push(`Worker dispatcher must handle ${id} exactly once (${caseCount})`);
}

for (const token of [
  'import { resolveOpportunityRouteHandlerId } from "./routes/opportunityRoutePolicy"',
  "switch (resolveOpportunityRouteHandlerId(pathname))",
  'authentication: "handler-enforced"',
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
  'networkPosture: "read-only-research"',
  'id: "opportunities-fallback", priority: 150',
]) {
  if (!(policy + index).includes(token)) errors.push(`Opportunity route contract is missing: ${token}`);
}

for (const forbidden of [
  "canSendEmail: true",
  "canPostSocial: true",
  "canSubmitForms: true",
  'authentication: "none"',
]) {
  if (policy.includes(forbidden)) errors.push(`Opportunity route policy enables forbidden capability: ${forbidden}`);
}

const priorities = [...policy.matchAll(/priority:\s*(\d+)/g)].map((match) => Number(match[1]));
if (priorities.length !== handlerIds.length) errors.push(`Expected ${handlerIds.length} opportunity priorities, found ${priorities.length}`);
if (new Set(priorities).size !== priorities.length) errors.push("Opportunity route priorities must be unique");
for (let indexValue = 1; indexValue < priorities.length; indexValue += 1) {
  if (priorities[indexValue] <= priorities[indexValue - 1]) errors.push("Opportunity route priorities must be strictly increasing");
}

const rawOpportunityMatchers = [
  'pathname === "/admin/opportunities/run-due"',
  'pathname.startsWith("/admin/opportunities/runs/")',
  'pathname === "/admin/opportunities/sources/origin-metrics"',
  'pathname === "/admin/opportunities/sources/health"',
  'pathname === "/admin/opportunities/scoring-diagnostics"',
  'pathname === "/admin/opportunities/learning"',
  'pathname.startsWith("/admin/opportunities")',
];
for (const matcher of rawOpportunityMatchers) {
  if (index.includes(matcher)) errors.push(`Opportunity path ownership must remain in the typed policy, not src/index.ts: ${matcher}`);
}

const precedenceTokens = [
  'id: "expansion-budget-recommendations", priority: 50',
  'id: "public-directory-scan", priority: 60',
  'id: "query-hint-resolver", priority: 70',
  'id: "source-expansion", priority: 80',
  'id: "discovery", priority: 120',
  'id: "opportunities-fallback", priority: 150',
];
let previous = -1;
for (const token of precedenceTokens) {
  const position = policy.indexOf(token);
  if (position < 0) errors.push(`Missing opportunity precedence token: ${token}`);
  if (position >= 0 && position <= previous) errors.push(`Opportunity precedence is incorrect around: ${token}`);
  previous = position;
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "typed-opportunity-route-policy",
  handlerCount: handlerIds.length,
  safety: {
    authentication: "handler-enforced",
    sending: false,
    posting: false,
    formSubmission: false,
    externalResearch: "explicitly-classified",
  },
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
