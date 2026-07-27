#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const CHECKOUT_SHA = "08eba0b27e820071cde6df949e0beb9ba4906955";
const SETUP_NODE_SHA = "49933ea5288caeca8642d1e84afbd3f7d6820020";

const workflows = Object.freeze([
  {
    label: "Worker contract workflow",
    relativePath: ".github/workflows/worker-contract.yml",
    required: Object.freeze([
      `actions/checkout@${CHECKOUT_SHA} # v4.3.0`,
      `actions/setup-node@${SETUP_NODE_SHA} # v4.4.0`,
      "persist-credentials: false",
      "permissions:\n  contents: read",
      "npm ci --no-audit --no-fund",
      "npm run check:local",
    ]),
  },
  {
    label: "Worker repository confidentiality workflow",
    relativePath: ".github/workflows/worker-repository-confidentiality.yml",
    required: Object.freeze([
      "name: Worker repository confidentiality",
      `actions/checkout@${CHECKOUT_SHA} # v4.3.0`,
      `actions/setup-node@${SETUP_NODE_SHA} # v4.4.0`,
      "persist-credentials: false",
      "permissions:\n  contents: read",
      "GITHUB_TOKEN: ${{ github.token }}",
      "node scripts/check-worker-repository-visibility.mjs --live",
    ]),
  },
  {
    label: "Growth zero-cost source selection workflow",
    relativePath: ".github/workflows/growth-zero-cost-source-selection.yml",
    required: Object.freeze([
      "name: Growth zero-cost source selection",
      `actions/checkout@${CHECKOUT_SHA} # v4.3.0`,
      `actions/setup-node@${SETUP_NODE_SHA} # v4.4.0`,
      "persist-credentials: false",
      "permissions:\n  contents: read",
      "npm ci --ignore-scripts --no-audit --no-fund",
      "node scripts/check-growth-activity-budget.mjs",
      "node --test tests/growthActivityBudgetSettings.test.ts tests/opportunitySourceSelection.test.ts",
      "npm run typecheck",
    ]),
  },
]);

const forbidden = Object.freeze([
  "uses: actions/checkout@v4",
  "uses: actions/setup-node@v4",
  "uses: actions/checkout@main",
  "uses: actions/setup-node@main",
  "persist-credentials: true",
  "permissions: write-all",
  "contents: write",
  "pull-requests: write",
  "id-token: write",
  "wrangler deploy",
  "npm run deploy",
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

  for (const token of contract.required) {
    if (!workflow.includes(token)) {
      errors.push(`${contract.label} is missing pinned safety token: ${token}`);
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
}

console.log(
  JSON.stringify(
    {
      passed: errors.length === 0,
      activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
      contract: "worker-workflow-action-pinning-v3-confidentiality-lane",
      guardedWorkflows: workflows.map((workflow) => workflow.relativePath),
      checkoutPinnedCommit: CHECKOUT_SHA,
      setupNodePinnedCommit: SETUP_NODE_SHA,
      persistedCheckoutCredentialsAllowed: false,
      workflowWritePermissionsAllowed: false,
      oidcWritePermissionAllowed: false,
      deploymentAllowed: false,
      applicationCredentialsRequired: false,
      builtInReadOnlyRepositoryTokenAllowed: true,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exitCode = 1;
