#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing identity source: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

const packageText = read("package.json");
const lockText = read("package-lock.json");
const wrangler = read("wrangler.toml");
const readme = read("README.md");

let packageJson = {};
let lockJson = {};
try {
  packageJson = JSON.parse(packageText);
} catch {
  errors.push("package.json must remain valid JSON");
}
try {
  lockJson = JSON.parse(lockText);
} catch {
  errors.push("package-lock.json must remain valid JSON");
}

const identity = packageJson.evavoServiceIdentity || {};
if (packageJson.description !== "EVAVO Growth Research Worker package. Historical Cloudflare deployment and D1 resource identifiers remain compatibility-only.") {
  errors.push("package description must identify the active Growth Research Worker and historical identifier posture");
}
if (identity.activeName !== "EVAVO Growth Research Worker") errors.push("active package service identity is incorrect");
if (identity.packageIdentifier !== "evavo-worker-agent") errors.push("active npm package identifier is incorrect");
if (identity.historicalPackageIdentifier !== "evavo-outbound-agent") errors.push("historical package identifier must be explicit");
if (identity.historicalDeploymentIdentifier !== "evavo-outbound-agent") errors.push("historical deployment identifier must be explicit");
if (identity.historicalDatabaseIdentifier !== "evavo_outbound_agent") errors.push("historical database identifier must be explicit");
if (identity.historicalIdentifierAuthoritative !== false) errors.push("historical package identifier must remain non-authoritative");
if (identity.outboundExecutionEnabled !== false) errors.push("package identity must not advertise outbound execution");

if (packageJson.name !== "evavo-worker-agent") errors.push("active npm package name must be evavo-worker-agent");
if (lockJson.name !== packageJson.name || lockJson.packages?.[""]?.name !== packageJson.name) {
  errors.push("package.json and package-lock.json root package names must remain aligned");
}

for (const token of [
  '# Historical Cloudflare deployment identifier retained to avoid renaming the live Worker.',
  '# The active public service identity is EVAVO Growth Research Worker.',
  'name = "evavo-outbound-agent"',
  'database_name = "evavo_outbound_agent"',
  'PUBLIC_ENGINE_NAME = "EVAVO Growth Research Worker"',
]) {
  if (!wrangler.includes(token)) errors.push(`wrangler identity posture is missing: ${token}`);
}

for (const token of [
  '# EVAVO Growth Research Worker',
  'It does **not** provide outbound execution.',
  'The npm package identifier is `evavo-worker-agent`.',
  'The live Cloudflare Worker deployment identifier remains `evavo-outbound-agent`.',
  'The historical D1 resource identifier remains `evavo_outbound_agent`.',
]) {
  if (!readme.includes(token)) errors.push(`README identity posture is missing: ${token}`);
}

for (const unsafe of [
  '"historicalIdentifierAuthoritative": true',
  '"outboundExecutionEnabled": true',
  'PUBLIC_ENGINE_NAME = "EVAVO Outbound Agent"',
]) {
  if (`${packageText}\n${wrangler}`.includes(unsafe)) errors.push(`Unsafe service identity claim found: ${unsafe}`);
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "package-service-identity-v2-active-package",
  activeServiceName: identity.activeName || null,
  packageIdentifier: packageJson.name || null,
  historicalPackageIdentifier: identity.historicalPackageIdentifier || null,
  historicalDeploymentIdentifier: identity.historicalDeploymentIdentifier || null,
  historicalDatabaseIdentifier: identity.historicalDatabaseIdentifier || null,
  packageLockAligned: lockJson.name === packageJson.name && lockJson.packages?.[""]?.name === packageJson.name,
  deploymentIdentifierRetained: wrangler.includes('name = "evavo-outbound-agent"'),
  npmPackageUsesHistoricalDeploymentName: packageJson.name === identity.historicalDeploymentIdentifier,
  historicalIdentifiersAuthoritative: false,
  outboundExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
