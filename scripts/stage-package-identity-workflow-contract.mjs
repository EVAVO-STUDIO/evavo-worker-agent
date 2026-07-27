#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const checkerPath = path.join(root, "scripts/check-worker-contract-workflow.mjs");
const workflowPath = path.join(root, ".github/workflows/stage-package-identity-workflow-contract.yml");
const scriptPath = path.join(root, "scripts/stage-package-identity-workflow-contract.mjs");

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing expected ${label}`);
  return source.replace(from, to);
}

let source = fs.readFileSync(checkerPath, "utf8");
source = replaceRequired(
  source,
  '  sourceSecrets: resolve("scripts", "check-worker-source-secrets.mjs"),\n',
  '  sourceSecrets: resolve("scripts", "check-worker-source-secrets.mjs"),\n  packageIdentity: resolve("scripts", "check-package-service-identity.mjs"),\n',
  "package identity source path",
);
source = replaceRequired(
  source,
  '  "npm run worker:source-secret-safety:check",\n  "node scripts/check-worker-contract-workflow.mjs",\n',
  '  "npm run worker:source-secret-safety:check",\n  "Verify npm package and deployment identity",\n  "npm run worker:package-identity:check",\n  "node scripts/check-worker-contract-workflow.mjs",\n',
  "workflow package identity tokens",
);
source = replaceRequired(
  source,
  'const checkLocal = String(scripts["check:local"] || "");\n',
  'const checkLocal = String(scripts["check:local"] || "");\nif (scripts["worker:package-identity:check"] !== "node scripts/check-package-service-identity.mjs") {\n  errors.push("package.json must expose worker:package-identity:check");\n}\nif (!checkLocal.includes("npm run worker:package-identity:check")) {\n  errors.push("check:local must include worker:package-identity:check");\n}\n',
  "package identity command checks",
);
source = replaceRequired(
  source,
  '  "npm run worker:source-secret-safety:check",\n  "node scripts/check-worker-contract-workflow.mjs",\n  "npm run research:bounded-json-safety:check",\n',
  '  "npm run worker:source-secret-safety:check",\n  "npm run worker:package-identity:check",\n  "node scripts/check-worker-contract-workflow.mjs",\n  "npm run research:bounded-json-safety:check",\n',
  "ordered package identity step",
);
source = replaceRequired(
  source,
  '  ]],\n  ["bounded JSON safety", sources.bounded, [\n',
  '  ]],\n  ["package identity", sources.packageIdentity, [\n    \'contract: "package-service-identity-v2-active-package"\',\n    \'packageIdentifier: packageJson.name || null\',\n    \'historicalDeploymentIdentifier: identity.historicalDeploymentIdentifier || null\',\n    \'historicalDatabaseIdentifier: identity.historicalDatabaseIdentifier || null\',\n    \'npmPackageUsesHistoricalDeploymentName: packageJson.name === identity.historicalDeploymentIdentifier\',\n    "packageLockAligned:",\n    "outboundExecutionEnabled: false",\n  ]],\n  ["bounded JSON safety", sources.bounded, [\n',
  "package identity contract posture",
);
source = replaceRequired(
  source,
  '  contract: "worker-contract-workflow-v8-source-secrets",',
  '  contract: "worker-contract-workflow-v9-package-identity",',
  "workflow contract version",
);
source = replaceRequired(
  source,
  '  trackedSourceSecretGateBeforeWorkflowParityRequired: true,\n',
  '  trackedSourceSecretGateBeforeWorkflowParityRequired: true,\n  packageIdentityFocusedGateRequired: true,\n  packageIdentityGateBeforeWorkflowParityRequired: true,\n  packageAndLockIdentityMustRemainAligned: true,\n  historicalDeploymentIdentifierRetained: true,\n',
  "workflow package identity report",
);
fs.writeFileSync(checkerPath, source, "utf8");

for (const temporaryPath of [workflowPath, scriptPath]) {
  if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath);
}

console.log(JSON.stringify({
  staged: true,
  workflowContract: "worker-contract-workflow-v9-package-identity",
  packageIdentityFocusedGateRequired: true,
  temporaryStagingFilesRemoved: true,
}, null, 2));
