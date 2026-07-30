#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const EXPECTED_NODE = "24.18.0";
const EXPECTED_NPM = "11.16.0";
const workflows = [
  ".github/workflows/worker-contract.yml",
  ".github/workflows/worker-repository-confidentiality.yml",
  ".github/workflows/growth-zero-cost-source-selection.yml",
  ".github/workflows/evavo-mainline-confirmation.yml",
];
const args = new Set(process.argv.slice(2));
const skipRuntime = args.delete("--skip-runtime");
if (args.size > 0) throw new Error(`WORKER_TOOLCHAIN_OPTION_UNSUPPORTED:${[...args][0]}`);
const root = fs.realpathSync.native(process.cwd());
const errors = [];

const read = (relativePath, maximumBytes = 4_000_000) => {
  const absolute = path.resolve(root, relativePath);
  const relative = path.relative(root, absolute);
  if (!relativePath || path.isAbsolute(relativePath) || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`WORKER_TOOLCHAIN_PATH_INVALID:${relativePath}`);
  }
  if (!fs.existsSync(absolute)) throw new Error(`Missing Worker toolchain file: ${relativePath}`);
  const stats = fs.lstatSync(absolute);
  if (!stats.isFile() || stats.isSymbolicLink()) throw new Error(`Worker toolchain path must be a regular file: ${relativePath}`);
  if (stats.size > maximumBytes) throw new Error(`Worker toolchain file is too large: ${relativePath}`);
  const bytes = fs.readFileSync(absolute);
  try {
    return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    throw new Error(`Worker toolchain file is not valid UTF-8: ${relativePath}`);
  }
};

const json = (relativePath) => {
  const source = read(relativePath, 64_000_000);
  if (source.startsWith("\uFEFF")) throw new Error(`Worker toolchain JSON contains a BOM: ${relativePath}`);
  let value;
  try {
    value = JSON.parse(source);
  } catch {
    throw new Error(`Worker toolchain JSON is invalid: ${relativePath}`);
  }
  if (source !== `${JSON.stringify(value, null, 2)}\n`) throw new Error(`Worker toolchain JSON is not canonical: ${relativePath}`);
  return value;
};

if (read(".nvmrc", 64) !== `${EXPECTED_NODE}\n`) errors.push(`.nvmrc must contain exactly ${EXPECTED_NODE}`);
const manifest = json("package.json");
if (
  manifest.name !== "evavo-worker-agent" ||
  manifest.type !== "module" ||
  manifest.packageManager !== `npm@${EXPECTED_NPM}` ||
  manifest.engines?.node !== EXPECTED_NODE ||
  manifest.engines?.npm !== EXPECTED_NPM
) errors.push("package.json exact Worker identity or toolchain authority changed");
for (const script of ["toolchain:check", "toolchain:test", "check:local", "typecheck", "worker:workflow-action-pinning:check"]) {
  if (typeof manifest.scripts?.[script] !== "string") errors.push(`package.json is missing required script: ${script}`);
}
if (!String(manifest.scripts?.["check:local"] ?? "").startsWith("npm run toolchain:check && npm run toolchain:test &&")) {
  errors.push("check:local must begin with dependency-free toolchain validation");
}

const lock = json("package-lock.json");
if (lock.name !== manifest.name || lock.version !== manifest.version || lock.lockfileVersion !== 3 || lock.packages?.[""]?.name !== manifest.name) {
  errors.push("package-lock.json root identity or lockfile version changed");
}

const profile = json("evavo.reliability.json");
if (
  profile.id !== "evavo-worker-agent" ||
  profile.repository !== "EVAVO-STUDIO/evavo-worker-agent" ||
  profile.stack !== "node-npm-cloudflare-worker" ||
  profile.packageManager?.exactVersion !== EXPECTED_NPM ||
  profile.runtime?.node !== EXPECTED_NODE ||
  profile.runtime?.npm !== EXPECTED_NPM ||
  profile.branchPolicy?.mode !== "direct-main" ||
  profile.branchPolicy?.forcePushAllowed !== false
) errors.push("evavo.reliability.json Worker authority changed");

for (const workflowPath of workflows) {
  const workflow = read(workflowPath);
  for (const token of ["workflow_dispatch:", "permissions:\n  contents: read", "persist-credentials: false", 'node-version: "24.18.0"', "node scripts/check-repository-toolchain.mjs"]) {
    if (!workflow.includes(token)) errors.push(`${workflowPath} is missing ${token}`);
  }
  if (/^\s*node-version:\s*"24"\s*$/m.test(workflow)) {
    errors.push(`${workflowPath} still uses a floating Node.js major`);
  }
}

if (!skipRuntime) {
  if (process.versions.node !== EXPECTED_NODE) errors.push(`Node.js runtime must be ${EXPECTED_NODE}; observed ${process.versions.node}`);
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(executable, ["--version"], { encoding: "utf8", timeout: 10_000, windowsHide: true });
  const observedNpm = result.status === 0 ? result.stdout.trim() : "unavailable";
  if (observedNpm !== EXPECTED_NPM) errors.push(`npm runtime must be ${EXPECTED_NPM}; observed ${observedNpm}`);
}

if (errors.length > 0) {
  console.error("Worker repository toolchain check failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log("Worker repository toolchain check passed.");
console.log(`- Node.js ${EXPECTED_NODE} and npm ${EXPECTED_NPM} are exact authorities`);
console.log("- package, lockfile, profile and manual workflow identities agree");
