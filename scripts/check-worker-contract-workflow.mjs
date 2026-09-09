#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const packagePath = path.join(root, "package.json");
const packageJson = fs.existsSync(packagePath)
  ? JSON.parse(fs.readFileSync(packagePath, "utf8"))
  : {};
const scripts = packageJson.scripts ?? {};
const checkLocal = String(scripts["check:local"] ?? "");

const requiredLocalChecks = [
  "worker:source-secret-safety:check",
  "worker:repository-visibility:check",
  "worker:workflow-action-pinning:check",
  "worker:package-identity:check",
  "research:bounded-json-safety:check",
  "research:manual-lease-safety:check",
  "review:mutation-safety:check",
  "research:public-fetch-safety:check",
  "opportunities:evidence-quality:check",
  "growth:route-parity:check",
  "test:core",
  "typecheck",
];

if (!fs.existsSync(packagePath)) errors.push("Missing package.json.");
for (const scriptName of requiredLocalChecks) {
  if (!scripts[scriptName]) errors.push(`Missing package script: ${scriptName}`);
  if (!checkLocal.includes(`npm run ${scriptName}`)) {
    errors.push(`check:local must include ${scriptName}`);
  }
}
if (!String(scripts.predeploy ?? "").includes("npm run check:local")) {
  errors.push("predeploy must run the authoritative local gate.");
}

const workflowDirectory = path.join(root, ".github", "workflows");
const activeWorkflows = fs.existsSync(workflowDirectory)
  ? fs
      .readdirSync(workflowDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.ya?ml$/iu.test(entry.name))
      .map((entry) => entry.name)
      .sort()
  : [];
if (activeWorkflows.length > 0) {
  errors.push(
    `Active hosted workflows remain: ${activeWorkflows.join(", ")}`,
  );
}

console.log(
  JSON.stringify(
    {
      passed: errors.length === 0,
      activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
      contract: "worker-local-contract-parity-v1",
      compatibilityCheckerNameRetained: true,
      githubActionsRequired: false,
      activeWorkflowCount: activeWorkflows.length,
      completeLocalGateRequired: true,
      predeployUsesCompleteLocalGate: true,
      externalExecutionEnabled: false,
      deploymentPerformed: false,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exitCode = 1;
