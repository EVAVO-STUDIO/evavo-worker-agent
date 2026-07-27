#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packagePath = path.join(root, "package.json");
const lockPath = path.join(root, "package-lock.json");
const checkerPath = path.join(root, "scripts/check-package-service-identity.mjs");
const readmePath = path.join(root, "README.md");
const workflowPath = path.join(root, ".github/workflows/stage-atomic-package-identity.yml");
const scriptPath = path.join(root, "scripts/stage-atomic-package-identity.mjs");

const PACKAGE_IDENTIFIER = "evavo-worker-agent";
const HISTORICAL_DEPLOYMENT_IDENTIFIER = "evavo-outbound-agent";
const HISTORICAL_DATABASE_IDENTIFIER = "evavo_outbound_agent";
const DESCRIPTION =
  "EVAVO Growth Research Worker package. Historical Cloudflare deployment and D1 resource identifiers remain compatibility-only.";

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function replaceRequired(source, from, to, label) {
  if (!source.includes(from)) {
    throw new Error(`Missing expected ${label}`);
  }
  return source.replace(from, to);
}

const packageJson = readJson(packagePath);
packageJson.name = PACKAGE_IDENTIFIER;
packageJson.description = DESCRIPTION;
packageJson.evavoServiceIdentity = {
  activeName: "EVAVO Growth Research Worker",
  packageIdentifier: PACKAGE_IDENTIFIER,
  historicalPackageIdentifier: HISTORICAL_DEPLOYMENT_IDENTIFIER,
  historicalDeploymentIdentifier: HISTORICAL_DEPLOYMENT_IDENTIFIER,
  historicalDatabaseIdentifier: HISTORICAL_DATABASE_IDENTIFIER,
  historicalIdentifierAuthoritative: false,
  outboundExecutionEnabled: false,
};
writeJson(packagePath, packageJson);

const lockJson = readJson(lockPath);
lockJson.name = PACKAGE_IDENTIFIER;
if (!lockJson.packages?.[""]) {
  throw new Error("package-lock.json root package record is missing");
}
lockJson.packages[""].name = PACKAGE_IDENTIFIER;
writeJson(lockPath, lockJson);

let checker = fs.readFileSync(checkerPath, "utf8");
checker = replaceRequired(
  checker,
  'if (packageJson.description !== "EVAVO Growth Research Worker. Historical npm package identifier retained for lockfile and deployment compatibility.") {',
  `if (packageJson.description !== ${JSON.stringify(DESCRIPTION)}) {`,
  "package description contract",
);
checker = replaceRequired(
  checker,
  'if (identity.activeName !== "EVAVO Growth Research Worker") errors.push("active package service identity is incorrect");',
  'if (identity.activeName !== "EVAVO Growth Research Worker") errors.push("active package service identity is incorrect");\nif (identity.packageIdentifier !== "evavo-worker-agent") errors.push("active npm package identifier is incorrect");',
  "active package identity check",
);
checker = replaceRequired(
  checker,
  'if (identity.historicalPackageIdentifier !== "evavo-outbound-agent") errors.push("historical package identifier must be explicit");',
  'if (identity.historicalPackageIdentifier !== "evavo-outbound-agent") errors.push("historical package identifier must be explicit");\nif (identity.historicalDeploymentIdentifier !== "evavo-outbound-agent") errors.push("historical deployment identifier must be explicit");\nif (identity.historicalDatabaseIdentifier !== "evavo_outbound_agent") errors.push("historical database identifier must be explicit");',
  "historical identity checks",
);
checker = replaceRequired(
  checker,
  'if (packageJson.name !== "evavo-outbound-agent") errors.push("package name and lockfile must be changed atomically, not independently");',
  'if (packageJson.name !== "evavo-worker-agent") errors.push("active npm package name must be evavo-worker-agent");',
  "package name contract",
);
checker = replaceRequired(
  checker,
  "  'It does **not** provide outbound execution.',\n",
  "  'It does **not** provide outbound execution.',\n  'The npm package identifier is `evavo-worker-agent`.',\n  'The live Cloudflare Worker deployment identifier remains `evavo-outbound-agent`.',\n  'The historical D1 resource identifier remains `evavo_outbound_agent`.',\n",
  "README package identity tokens",
);
checker = replaceRequired(
  checker,
  '  contract: "package-service-identity-v1",',
  '  contract: "package-service-identity-v2-active-package",',
  "identity contract version",
);
checker = replaceRequired(
  checker,
  '  historicalPackageIdentifier: packageJson.name || null,',
  '  packageIdentifier: packageJson.name || null,\n  historicalPackageIdentifier: identity.historicalPackageIdentifier || null,\n  historicalDeploymentIdentifier: identity.historicalDeploymentIdentifier || null,\n  historicalDatabaseIdentifier: identity.historicalDatabaseIdentifier || null,',
  "identity report fields",
);
checker = replaceRequired(
  checker,
  '  historicalIdentifiersAuthoritative: false,',
  '  npmPackageUsesHistoricalDeploymentName: packageJson.name === identity.historicalDeploymentIdentifier,\n  historicalIdentifiersAuthoritative: false,',
  "historical identity truthfulness report",
);
fs.writeFileSync(checkerPath, checker, "utf8");

let readme = fs.readFileSync(readmePath, "utf8");
const packageIdentitySection = `## Package and deployment identity\n\nThe npm package identifier is \`evavo-worker-agent\`.\n\nThe live Cloudflare Worker deployment identifier remains \`evavo-outbound-agent\`. The historical D1 resource identifier remains \`evavo_outbound_agent\`. These infrastructure names are compatibility resources only; they do not describe an enabled outbound capability.\n\nChanging the npm package identity does not rename or deploy the Worker, alter the Wrangler deployment name, rename the D1 database, run a migration or mutate remote data.\n\n`;
if (!readme.includes("## Package and deployment identity")) {
  const marker = "It does **not** provide outbound execution.\n\n";
  if (!readme.includes(marker)) {
    throw new Error("README package identity insertion point is missing");
  }
  readme = readme.replace(marker, `${marker}${packageIdentitySection}`);
}
fs.writeFileSync(readmePath, readme, "utf8");

for (const temporaryPath of [workflowPath, scriptPath]) {
  if (fs.existsSync(temporaryPath)) fs.rmSync(temporaryPath);
}

console.log(JSON.stringify({
  staged: true,
  packageIdentifier: PACKAGE_IDENTIFIER,
  lockfileRootAligned: true,
  historicalDeploymentIdentifier: HISTORICAL_DEPLOYMENT_IDENTIFIER,
  historicalDatabaseIdentifier: HISTORICAL_DATABASE_IDENTIFIER,
  deploymentRenamed: false,
  databaseRenamed: false,
  temporaryStagingFilesRemoved: true,
}, null, 2));
