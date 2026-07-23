#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configPath = path.join(root, ".github", "dependabot.yml");
const packagePath = path.join(root, "package.json");
const workflowPath = path.join(root, ".github", "workflows", "worker-contract.yml");
const errors = [];

const config = fs.existsSync(configPath) ? fs.readFileSync(configPath, "utf8") : "";
const packageJson = fs.existsSync(packagePath)
  ? JSON.parse(fs.readFileSync(packagePath, "utf8"))
  : {};
const workflow = fs.existsSync(workflowPath) ? fs.readFileSync(workflowPath, "utf8") : "";

if (!config) errors.push("Missing .github/dependabot.yml");
if (!workflow) errors.push("Missing Worker contract workflow");

const requiredTokens = [
  "version: 2",
  "package-ecosystem: npm",
  "package-ecosystem: github-actions",
  "interval: weekly",
  "timezone: Australia/Melbourne",
  "open-pull-requests-limit: 5",
  "versioning-strategy: increase-if-necessary",
  "rebase-strategy: auto",
  "version-update:semver-major",
  "npm-patch-and-minor",
  "github-actions-patch-and-minor",
];
for (const token of requiredTokens) {
  if (!config.includes(token)) errors.push(`Dependabot config is missing: ${token}`);
}

const ecosystemCount = (config.match(/package-ecosystem:/g) || []).length;
if (ecosystemCount !== 2) errors.push(`Expected exactly 2 Dependabot ecosystems, found ${ecosystemCount}`);

const weeklyCount = (config.match(/interval: weekly/g) || []).length;
if (weeklyCount !== 2) errors.push(`Expected weekly cadence for both ecosystems, found ${weeklyCount}`);

const majorIgnoreCount = (config.match(/version-update:semver-major/g) || []).length;
if (majorIgnoreCount !== 2) errors.push(`Expected major-version exclusions for both ecosystems, found ${majorIgnoreCount}`);

for (const forbidden of [
  "interval: daily",
  "open-pull-requests-limit: 0",
  "version-update:semver-major\n          - version-update:semver-minor",
]) {
  if (config.includes(forbidden)) errors.push(`Dependabot config contains unsafe setting: ${forbidden}`);
}

const expectedCommand = "node scripts/check-dependabot-config.mjs";
if (packageJson.scripts?.["worker:dependabot-config:check"] !== expectedCommand) {
  errors.push(`package.json must expose worker:dependabot-config:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run worker:dependabot-config:check")) {
  errors.push("check:local must include worker:dependabot-config:check");
}
if (!workflow.includes('      - ".github/dependabot.yml"')) {
  errors.push("Worker workflow path filters must include .github/dependabot.yml");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "dependabot-configuration-v1-conservative-weekly",
  ecosystems: ["npm", "github-actions"],
  cadence: "weekly",
  timezone: "Australia/Melbourne",
  majorUpdatesIgnored: true,
  openPullRequestLimitPerEcosystem: 5,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
