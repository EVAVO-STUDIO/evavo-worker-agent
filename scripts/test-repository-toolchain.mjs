#!/usr/bin/env node

import assert from "node:assert/strict";
import {
  cpSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const sourceRoot = process.cwd();
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), "evavo-worker-toolchain-"));
const fixtureRoot = path.join(temporaryRoot, "fixture");
const files = [
  ".nvmrc",
  "package.json",
  "package-lock.json",
  "evavo.reliability.json",
  "scripts/check-repository-toolchain.mjs",
  ".github/workflows/worker-contract.yml",
  ".github/workflows/worker-repository-confidentiality.yml",
  ".github/workflows/growth-zero-cost-source-selection.yml",
  ".github/workflows/evavo-mainline-confirmation.yml",
];

const reset = () => {
  rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
  for (const relativePath of files) {
    const target = path.join(fixtureRoot, relativePath);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(path.join(sourceRoot, relativePath), target);
  }
};

const run = () =>
  spawnSync(
    process.execPath,
    ["scripts/check-repository-toolchain.mjs", "--skip-runtime"],
    {
      cwd: fixtureRoot,
      encoding: "utf8",
      timeout: 20_000,
      windowsHide: true,
    },
  );

const mutateJson = (relativePath, operation) => {
  const absolute = path.join(fixtureRoot, relativePath);
  const value = JSON.parse(readFileSync(absolute, "utf8"));
  operation(value);
  writeFileSync(absolute, `${JSON.stringify(value, null, 2)}\n`, "utf8");
};

try {
  reset();
  assert.equal(run().status, 0);

  reset();
  writeFileSync(path.join(fixtureRoot, ".nvmrc"), "24.17.0\n", "utf8");
  assert.notEqual(run().status, 0);

  reset();
  mutateJson("package.json", (value) => {
    value.packageManager = "npm@11.15.0";
  });
  assert.notEqual(run().status, 0);

  reset();
  mutateJson("package-lock.json", (value) => {
    value.lockfileVersion = 2;
  });
  assert.notEqual(run().status, 0);

  reset();
  mutateJson("evavo.reliability.json", (value) => {
    value.runtime.node = "24.17.0";
  });
  assert.notEqual(run().status, 0);

  reset();
  const workflowPath = path.join(
    fixtureRoot,
    ".github/workflows/worker-contract.yml",
  );
  writeFileSync(
    workflowPath,
    readFileSync(workflowPath, "utf8").replace(
      'node-version: "24.18.0"',
      'node-version: "24"',
    ),
    "utf8",
  );
  assert.notEqual(run().status, 0);

  console.log("Worker repository toolchain adversarial tests passed.");
  console.log("- Node.js, npm, lockfile, profile and workflow drift fail closed");
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
