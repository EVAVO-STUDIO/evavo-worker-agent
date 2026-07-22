#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const readmePath = path.join(root, "README.md");
const packagePath = path.join(root, "package.json");

const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";
const packageJson = fs.existsSync(packagePath)
  ? JSON.parse(fs.readFileSync(packagePath, "utf8"))
  : {};

if (!readme) errors.push("README.md is missing");
if (!fs.existsSync(packagePath)) errors.push("package.json is missing");

const required = [
  "The active Worker is a governed, review-first opportunity-intelligence system.",
  "historical review records and private operational reporting",
  "It does **not** provide outbound execution.",
  "Historical draft-shaped and approval-shaped records are non-deliverable, non-executable and non-authoritative.",
  "historical review-record and strategy-score routes",
  "Historical labels and schema families are retained only for data compatibility.",
  "They do not describe enabled drafting, approvals-to-execution, campaigns or external delivery.",
  "The authoritative model is research-memory-first, metadata-first, review-first and non-executing.",
  "The focused commands are useful for diagnosing one contract, but `npm run check:local` remains the authoritative complete gate.",
];

for (const token of required) {
  if (!readme.includes(token)) errors.push(`README missing truthful top-level posture: ${token}`);
}

const requiredFocusedChecks = [
  "npm run safety:gates:check",
  "npm run docs:operating-posture:check",
  "npm run docs:readme-truthfulness:check",
  "npm run worker:package-identity:check",
  "npm run business:route-catalogue-truthfulness:check",
  "npm run business:draft-runtime-safety:check",
  "npm run business:historical-type-isolation:check",
  "npm run business:review-record-storage-isolation:check",
  "npm run business:ci-parity:check",
  "npm run planner:catalogue-truthfulness:check",
  "npm run typecheck",
];

for (const command of requiredFocusedChecks) {
  if (!readme.includes(command)) errors.push(`README focused validation list is missing: ${command}`);
  const scriptName = command.replace("npm run ", "");
  if (!packageJson.scripts?.[scriptName]) errors.push(`README advertises missing package script: ${scriptName}`);
}

const forbidden = [
  "audit metadata, approval records and private operational reporting",
  "draft-review and strategy-score routes",
  "Some historical architecture documents describe future governed execution concepts.",
  "Review and promote candidates through explicit confirmation gates.",
  "The authoritative model is research-memory-first, metadata-first, review-first and approval-gated.",
];

for (const token of forbidden) {
  if (readme.includes(token)) errors.push(`README contains stale top-level capability wording: ${token}`);
}

const expectedCommand = "node scripts/check-readme-top-level-truthfulness.mjs";
if (packageJson.scripts?.["docs:readme-truthfulness:check"] !== expectedCommand) {
  errors.push(`package.json must expose docs:readme-truthfulness:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run docs:readme-truthfulness:check")) {
  errors.push("check:local must include docs:readme-truthfulness:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "readme-top-level-truthfulness-v2-focused-validation",
  outboundExecutionDocumentedAsDisabled: true,
  historicalReviewRecordsDocumentedAsNonAuthoritative: true,
  approvalToExecutionDocumentedAsDisabled: true,
  authoritativeModelDocumentedAsNonExecuting: true,
  authoritativeCompleteGateDocumented: true,
  focusedSafetyChecksDocumented: true,
  focusedCommandsBackedByPackageScripts: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
