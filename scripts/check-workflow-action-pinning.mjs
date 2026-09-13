#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const workflowDirectory = path.join(root, ".github", "workflows");
const packagePath = path.join(root, "package.json");
const visibilityCheckerPath = path.join(
  root,
  "scripts",
  "check-worker-repository-visibility.mjs",
);

const activeWorkflowFiles = fs.existsSync(workflowDirectory)
  ? fs
      .readdirSync(workflowDirectory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.ya?ml$/iu.test(entry.name))
      .map((entry) => entry.name)
      .sort()
  : [];

if (activeWorkflowFiles.length > 0) {
  errors.push(
    `Hosted GitHub Actions are not part of the active zero-cost execution architecture: ${activeWorkflowFiles.join(", ")}`,
  );
}

if (!fs.existsSync(packagePath)) {
  errors.push("Missing package.json.");
}
if (!fs.existsSync(visibilityCheckerPath)) {
  errors.push("Missing local/provider repository visibility checker.");
}

const packageJson = fs.existsSync(packagePath)
  ? JSON.parse(fs.readFileSync(packagePath, "utf8"))
  : {};
const scripts = packageJson.scripts ?? {};
const checkLocal = String(scripts["check:local"] ?? "");
const predeploy = String(scripts.predeploy ?? "");

if (
  scripts["worker:workflow-action-pinning:check"] !==
  "node scripts/check-workflow-action-pinning.mjs"
) {
  errors.push(
    "package.json must retain worker:workflow-action-pinning:check as the compatibility name for the local-first hosted-execution policy.",
  );
}
if (
  scripts["worker:repository-visibility:check"] !==
  "node scripts/check-worker-repository-visibility.mjs"
) {
  errors.push(
    "package.json must expose the repository visibility checker locally.",
  );
}
if (!checkLocal.includes("npm run worker:workflow-action-pinning:check")) {
  errors.push(
    "check:local must enforce the hosted-execution absence policy.",
  );
}
if (!checkLocal.includes("npm run worker:repository-visibility:check")) {
  errors.push(
    "check:local must include the repository visibility policy check.",
  );
}
if (!predeploy.includes("npm run check:local")) {
  errors.push("predeploy must run the complete local validation gate.");
}

console.log(
  JSON.stringify(
    {
      passed: errors.length === 0,
      activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
      contract: "worker-hosted-execution-policy-v1-local-first",
      activeWorkflowDirectory: ".github/workflows",
      activeWorkflowCount: activeWorkflowFiles.length,
      activeWorkflowFiles,
      githubActionsRequired: false,
      hostedRunnerRequired: false,
      automaticWorkflowTriggersAllowed: false,
      manualHostedWorkflowDispatchRequired: false,
      localValidationAuthoritative: true,
      providerVisibilityReadUsesLocalChecker: true,
      providerVisibilityMutationAllowed: false,
      predeployUsesCompleteLocalGate: true,
      cloudflareRuntimeSchedulingSeparateFromGithubActions: true,
      compatibilityScriptNameRetained: true,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exitCode = 1;
