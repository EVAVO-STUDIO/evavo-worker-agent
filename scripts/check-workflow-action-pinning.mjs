#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const CHECKOUT_SHA = "08eba0b27e820071cde6df949e0beb9ba4906955";
const SETUP_NODE_SHA = "49933ea5288caeca8642d1e84afbd3f7d6820020";
const UPLOAD_ARTIFACT_SHA = "ea165f8d65b6e75b540449e92b4886f43607fa02";
const automaticEvents = Object.freeze([
  "push",
  "pull_request",
  "pull_request_target",
  "schedule",
  "workflow_run",
  "repository_dispatch",
  "merge_group",
]);

const commonRequired = Object.freeze([
  "workflow_dispatch:",
  "expected_sha:",
  "request_source:",
  "cancel-in-progress: false",
  "permissions:\n  contents: read",
  `actions/checkout@${CHECKOUT_SHA} # v4.3.0`,
  "ref: ${{ inputs.expected_sha }}",
  "fetch-depth: 0",
  "persist-credentials: false",
  'ACTUAL_SHA="$(git rev-parse HEAD)"',
  'test "$ACTUAL_SHA" = "$EXPECTED_SHA"',
  'git merge-base --is-ancestor "$EXPECTED_SHA" origin/main',
  `actions/setup-node@${SETUP_NODE_SHA} # v4.4.0`,
  `actions/upload-artifact@${UPLOAD_ARTIFACT_SHA} # v4.6.2`,
  "retention-days: 14",
]);

const workflows = Object.freeze([
  {
    label: "Worker contract workflow",
    relativePath: ".github/workflows/worker-contract.yml",
    required: Object.freeze([
      "name: Worker contract",
      "group: worker-contract-${{ inputs.expected_sha }}",
      'node-version: "24"',
      "cache: npm",
      "npm ci --no-audit --no-fund",
      "npm run worker:source-secret-safety:check",
      "npm run worker:package-identity:check",
      "node scripts/check-worker-contract-workflow.mjs",
      "npm run check:local",
      '"deployment":"disabled"',
    ]),
  },
  {
    label: "Worker repository confidentiality workflow",
    relativePath: ".github/workflows/worker-repository-confidentiality.yml",
    required: Object.freeze([
      "name: Worker repository confidentiality",
      "group: worker-confidentiality-${{ inputs.expected_sha }}",
      'node-version: "24"',
      "package-manager-cache: false",
      "GITHUB_TOKEN: ${{ github.token }}",
      "node scripts/check-worker-repository-visibility.mjs --live",
      '"repositoryMutation":"disabled"',
    ]),
  },
  {
    label: "Growth zero-cost source selection workflow",
    relativePath: ".github/workflows/growth-zero-cost-source-selection.yml",
    required: Object.freeze([
      "name: Growth zero-cost source selection",
      "group: growth-zero-cost-${{ inputs.expected_sha }}",
      'node-version: "24"',
      "cache: npm",
      "npm ci --ignore-scripts --no-audit --no-fund",
      "node scripts/check-growth-activity-budget.mjs",
      "node --test tests/growthActivityBudgetSettings.test.ts tests/opportunitySourceSelection.test.ts",
      "npm run typecheck",
      '"externalSpend":"disabled"',
      '"deployment":"disabled"',
    ]),
  },
]);

const forbidden = Object.freeze([
  "uses: actions/checkout@v",
  "uses: actions/setup-node@v",
  "uses: actions/upload-artifact@v",
  "uses: actions/checkout@main",
  "uses: actions/setup-node@main",
  "persist-credentials: true",
  "permissions: write-all",
  "contents: write",
  "pull-requests: write",
  "packages: write",
  "id-token: write",
  "wrangler deploy",
  "npm run deploy",
  "npm install ",
  "ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_ADMIN_TOKEN",
  "secrets.",
]);

for (const contract of workflows) {
  const workflowPath = path.join(root, contract.relativePath);
  const workflow = fs.existsSync(workflowPath)
    ? fs.readFileSync(workflowPath, "utf8")
    : "";
  if (!workflow) {
    errors.push(`Missing ${contract.label}: ${contract.relativePath}`);
    continue;
  }

  for (const token of [...commonRequired, ...contract.required]) {
    if (!workflow.includes(token)) {
      errors.push(`${contract.label} is missing release safety token: ${token}`);
    }
  }
  for (const event of automaticEvents) {
    if (new RegExp(`^  ${event}:`, "m").test(workflow)) {
      errors.push(`${contract.label} contains prohibited automatic event: ${event}`);
    }
  }
  for (const token of forbidden) {
    if (workflow.includes(token)) {
      errors.push(`${contract.label} contains mutable or unsafe token: ${token}`);
    }
  }

  const actionUses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)].map(
    (match) => match[1],
  );
  for (const action of actionUses) {
    const at = action.lastIndexOf("@");
    const ref = at >= 0 ? action.slice(at + 1) : "";
    if (!/^[0-9a-f]{40}$/i.test(ref)) {
      errors.push(
        `${contract.label} action must be pinned to a full 40-character commit SHA: ${action}`,
      );
    }
  }

  if (
    contract.relativePath !== ".github/workflows/worker-repository-confidentiality.yml" &&
    workflow.includes("GITHUB_TOKEN")
  ) {
    errors.push(`${contract.label} must not request the built-in repository token.`);
  }
}

console.log(
  JSON.stringify(
    {
      passed: errors.length === 0,
      activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
      contract: "worker-workflow-release-policy-v4-exact-sha",
      guardedWorkflows: workflows.map((workflow) => workflow.relativePath),
      checkoutPinnedCommit: CHECKOUT_SHA,
      setupNodePinnedCommit: SETUP_NODE_SHA,
      uploadArtifactPinnedCommit: UPLOAD_ARTIFACT_SHA,
      automaticWorkflowTriggersAllowed: false,
      exactMainShaRequired: true,
      persistedCheckoutCredentialsAllowed: false,
      workflowWritePermissionsAllowed: false,
      oidcWritePermissionAllowed: false,
      deploymentAllowed: false,
      applicationCredentialsRequired: false,
      builtInReadOnlyRepositoryTokenAllowedOnlyForVisibilityCheck: true,
      evidenceRetentionDays: 14,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exitCode = 1;
