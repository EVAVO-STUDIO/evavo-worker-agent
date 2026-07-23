#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const workflowPath = path.join(root, ".github", "workflows", "worker-contract.yml");
const errors = [];

const workflow = fs.existsSync(workflowPath)
  ? fs.readFileSync(workflowPath, "utf8")
  : "";

if (!workflow) errors.push("Missing Worker contract workflow");

const required = [
  "actions/checkout@08eba0b27e820071cde6df949e0beb9ba4906955 # v4.3.0",
  "actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020 # v4.4.0",
  "persist-credentials: false",
  "permissions:\n  contents: read",
  "npm ci --no-audit --no-fund",
  "npm run check:local",
];

for (const token of required) {
  if (!workflow.includes(token)) errors.push(`Worker workflow is missing pinned safety token: ${token}`);
}

const forbidden = [
  "uses: actions/checkout@v4",
  "uses: actions/setup-node@v4",
  "uses: actions/checkout@main",
  "uses: actions/setup-node@main",
  "persist-credentials: true",
  "permissions: write-all",
  "contents: write",
  "wrangler deploy",
  "ADMIN_TOKEN",
];

for (const token of forbidden) {
  if (workflow.includes(token)) errors.push(`Worker workflow contains mutable or unsafe token: ${token}`);
}

const actionUses = [...workflow.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)].map((match) => match[1]);
for (const action of actionUses) {
  const at = action.lastIndexOf("@");
  const ref = at >= 0 ? action.slice(at + 1) : "";
  if (!/^[0-9a-f]{40}$/i.test(ref)) {
    errors.push(`Workflow action must be pinned to a full 40-character commit SHA: ${action}`);
  }
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "worker-workflow-action-pinning-v1",
  checkoutPinnedCommit: "08eba0b27e820071cde6df949e0beb9ba4906955",
  setupNodePinnedCommit: "49933ea5288caeca8642d1e84afbd3f7d6820020",
  persistedCheckoutCredentialsAllowed: false,
  workflowWritePermissionsAllowed: false,
  deploymentAllowed: false,
  credentialsRequired: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
