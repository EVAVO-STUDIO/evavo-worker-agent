#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptsDir = path.join(root, "scripts");
const errors = [];
const passes = [];

function requireFile(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) errors.push(`Missing required file: ${relativePath}`);
  else passes.push(`${relativePath} exists`);
  return absolutePath;
}

function requireTokens(relativePath, tokens) {
  const absolutePath = requireFile(relativePath);
  if (!fs.existsSync(absolutePath)) return;
  const content = fs.readFileSync(absolutePath, "utf8");
  for (const token of tokens) {
    if (!content.includes(token)) errors.push(`${relativePath} is missing required token: ${token}`);
  }
}

if (!fs.existsSync(scriptsDir)) errors.push("Missing scripts directory");
const helperScripts = fs.existsSync(scriptsDir)
  ? fs.readdirSync(scriptsDir).filter((name) => name.endsWith(".mjs")).sort()
  : [];

for (const scriptName of helperScripts) {
  const relativePath = path.join("scripts", scriptName).replaceAll("\\", "/");
  const absolutePath = path.join(scriptsDir, scriptName);
  const result = spawnSync(process.execPath, ["--check", absolutePath], { encoding: "utf8" });
  if (result.status !== 0) errors.push(`${relativePath} does not parse: ${result.stderr || result.stdout}`);
  else passes.push(`${relativePath} parses`);
}

for (const relativePath of [
  "Run-BusinessOperatorWorkerRunbook.ps1",
  "Run-WorkerFinalGate.ps1",
  "src/index.ts",
  "src/routes/workerRoutePolicy.ts",
  "src/routes/growthRoutePolicy.ts",
  "src/routes/opportunityRoutePolicy.ts",
  "src/routes/businessRoutePolicy.ts",
  ".github/workflows/worker-contract.yml",
  "wrangler.toml",
  "package.json",
  "package-lock.json",
]) requireFile(relativePath);

requireTokens("src/routes/growthRoutePolicy.ts", [
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
  'authentication: "handler-enforced"',
]);
requireTokens("src/routes/opportunityRoutePolicy.ts", [
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
  'networkPosture: "read-only-research"',
  'authentication: "handler-enforced"',
]);
requireTokens("src/routes/businessRoutePolicy.ts", [
  "callsExternalNetwork: false",
  "callsAI: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
  'readMethods: Object.freeze(["GET"] as const)',
  'writeMethods: Object.freeze(["POST"] as const)',
  'writeConfirmation: "handler-enforced"',
  'authentication: "handler-enforced"',
]);
requireTokens("src/routes/workerRoutePolicy.ts", [
  'id: "health"',
  'id: "admin"',
  'authentication: "handler-enforced"',
  'mutationPosture: "read-only"',
]);
requireTokens("README.md", [
  "Autonomous discovery is research-memory-first and supervised-action only.",
  "Internal automation can reason, score, prioritise, draft and learn; external execution remains confirm-gated and disabled by default.",
]);
requireTokens("docs/business-autopilot-validation.md", [
  "Business Autopilot validation workflow",
  "business_people",
  "business_websites",
]);
requireTokens("scripts/check-growth-negative-safety.mjs", [
  "canSendEmail: true",
  "canPostSocial: true",
  "canSubmitForms: true",
]);

const packagePath = path.join(root, "package.json");
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  const scripts = packageJson.scripts || {};
  const expectedScripts = {
    "worker:health:check": "node scripts/check-worker-health-contract.mjs",
    "worker:routes:check": "node scripts/check-worker-route-policy.mjs",
    "growth:route-policy:check": "node scripts/check-growth-route-policy.mjs",
    "growth:negative-safety:check": "node scripts/check-growth-negative-safety.mjs",
    "opportunities:route-policy:check": "node scripts/check-opportunity-route-policy.mjs",
    "business:route-policy:check": "node scripts/check-business-route-policy.mjs",
    "scripts:check": "node scripts/check-helper-scripts.mjs",
    "typecheck": "tsc --noEmit",
  };
  for (const [name, command] of Object.entries(expectedScripts)) {
    if (scripts[name] !== command) errors.push(`package.json script ${name} must equal: ${command}`);
  }

  const requiredLocalSteps = [
    "npm run scripts:check",
    "npm run db:migrations:check",
    "npm run worker:health:check",
    "npm run worker:routes:check",
    "npm run opportunities:route-policy:check",
    "npm run business:route-policy:check",
    "npm run growth:route-policy:check",
    "npm run growth:negative-safety:check",
    "npm run typecheck",
  ];
  const localGate = String(scripts["check:local"] || "");
  for (const step of requiredLocalSteps) {
    if (!localGate.includes(step)) errors.push(`check:local is missing: ${step}`);
  }
  if (!String(scripts.predeploy || "").includes("npm run check:local")) {
    errors.push("predeploy must run the authoritative check:local gate");
  }
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "dynamic-helper-and-gate-validation",
  parsedHelperScripts: helperScripts.length,
  verifiedFiles: passes.length,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
