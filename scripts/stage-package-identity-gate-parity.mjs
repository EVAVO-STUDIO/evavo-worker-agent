#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const helperPath = path.join(root, "scripts/check-helper-scripts.mjs");
const safetyPath = path.join(root, "scripts/check-safety-gate-completeness.mjs");
const workflowPath = path.join(root, ".github/workflows/stage-package-identity-gate-parity.yml");
const scriptPath = path.join(root, "scripts/stage-package-identity-gate-parity.mjs");

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing expected ${label}`);
  return source.replace(from, to);
}

let helper = fs.readFileSync(helperPath, "utf8");
helper = replaceRequired(
  helper,
  '  "scripts/check-worker-repository-visibility.mjs",\n',
  '  "scripts/check-package-service-identity.mjs",\n  "scripts/check-worker-repository-visibility.mjs",\n',
  "helper required package identity file",
);
helper = replaceRequired(
  helper,
  'requireTokens("scripts/check-worker-repository-visibility.mjs", [\n',
  'requireTokens("scripts/check-package-service-identity.mjs", [\n  \'contract: "package-service-identity-v2-active-package"\',\n  \'packageIdentifier: packageJson.name || null\',\n  \'historicalDeploymentIdentifier: identity.historicalDeploymentIdentifier || null\',\n  \'historicalDatabaseIdentifier: identity.historicalDatabaseIdentifier || null\',\n  \'npmPackageUsesHistoricalDeploymentName: packageJson.name === identity.historicalDeploymentIdentifier\',\n  "packageLockAligned:",\n  "outboundExecutionEnabled: false",\n]);\nrequireTokens("scripts/check-worker-repository-visibility.mjs", [\n',
  "helper package identity contract",
);
helper = replaceRequired(
  helper,
  '  "worker:repository-visibility:check": "node scripts/check-worker-repository-visibility.mjs",\n',
  '  "worker:package-identity:check": "node scripts/check-package-service-identity.mjs",\n  "worker:repository-visibility:check": "node scripts/check-worker-repository-visibility.mjs",\n',
  "helper expected package identity script",
);
helper = replaceRequired(
  helper,
  '  contract: "dynamic-helper-and-gate-validation-v9-repository-confidentiality",',
  '  contract: "dynamic-helper-and-gate-validation-v10-package-identity",',
  "helper contract version",
);
helper = replaceRequired(
  helper,
  '  repositoryConfidentialityPolicyRequired: true,\n',
  '  activePackageIdentityRequired: true,\n  packageAndLockIdentityAlignmentRequired: true,\n  historicalDeploymentIdentifierRetained: true,\n  repositoryConfidentialityPolicyRequired: true,\n',
  "helper package identity report",
);
fs.writeFileSync(helperPath, helper, "utf8");

let safety = fs.readFileSync(safetyPath, "utf8");
safety = replaceRequired(
  safety,
  'const checkLocal = String(scripts["check:local"] || "");\n',
  'const checkLocal = String(scripts["check:local"] || "");\nconst packageIdentityPath = path.join(root, "scripts/check-package-service-identity.mjs");\nconst packageIdentity = fs.existsSync(packageIdentityPath)\n  ? fs.readFileSync(packageIdentityPath, "utf8")\n  : "";\n',
  "safety package identity source",
);
safety = replaceRequired(
  safety,
  'if (!String(scripts.predeploy || "").includes("npm run check:local")) {\n',
  'for (const token of [\n  \'contract: "package-service-identity-v2-active-package"\',\n  \'packageIdentifier: packageJson.name || null\',\n  \'historicalDeploymentIdentifier: identity.historicalDeploymentIdentifier || null\',\n  \'historicalDatabaseIdentifier: identity.historicalDatabaseIdentifier || null\',\n  "packageLockAligned:",\n  "outboundExecutionEnabled: false",\n]) {\n  if (!packageIdentity.includes(token)) {\n    errors.push(`Package identity safety contract is missing: ${token}`);\n  }\n}\n\nif (!String(scripts.predeploy || "").includes("npm run check:local")) {\n',
  "safety package identity posture",
);
safety = replaceRequired(
  safety,
  '      contract: "safety-gate-completeness-v9-repository-confidentiality",',
  '      contract: "safety-gate-completeness-v10-package-identity",',
  "safety contract version",
);
safety = replaceRequired(
  safety,
  '      packageServiceIdentityRequired: true,\n',
  '      packageServiceIdentityRequired: true,\n      activePackageIdentifierRequired: "evavo-worker-agent",\n      packageAndLockIdentityAlignmentRequired: true,\n      historicalDeploymentIdentifierRetained: true,\n      historicalDatabaseIdentifierRetained: true,\n',
  "safety package identity report",
);
fs.writeFileSync(safetyPath, safety, "utf8");

for (const temporaryPath of [workflowPath, scriptPath]) {
  if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath);
}

console.log(JSON.stringify({
  staged: true,
  helperContract: "dynamic-helper-and-gate-validation-v10-package-identity",
  safetyContract: "safety-gate-completeness-v10-package-identity",
  packageIdentityGateRequired: true,
  temporaryStagingFilesRemoved: true,
}, null, 2));
