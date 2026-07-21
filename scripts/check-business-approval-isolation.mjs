#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(absolutePath);
    return entry.isFile() && /\.(ts|mjs)$/.test(entry.name) ? [absolutePath] : [];
  });
}

const recordsPath = "src/core/businessAutopilotRecords.ts";
const routePath = "src/routes/businessAutopilotAdmin.ts";
const cataloguePath = "src/routes/businessAutopilotRouteCatalogue.ts";

const records = read(recordsPath);
const route = read(routePath);
const catalogue = read(cataloguePath);

for (const token of [
  "export async function saveBusinessApprovalRequest",
  "buildBusinessApprovalRequest(input)",
]) {
  if (!records.includes(token)) errors.push(`${recordsPath} must preserve historical compatibility token: ${token}`);
}

for (const token of [
  'error: "historical_record_write_disabled"',
  'mode: "business_approval_request_write_disabled"',
  '{ status: 410 }',
]) {
  if (!route.includes(token)) errors.push(`${routePath} must fail closed for approval writes: ${token}`);
}

for (const token of [
  '"business_approval_request_save"',
  "disabledBusinessAutopilotWriteRouteIds",
]) {
  if (!catalogue.includes(token)) errors.push(`${cataloguePath} must retain disabled approval-route compatibility metadata: ${token}`);
}

if (/writeRoute\(\s*["']business_approval_request_save["']/.test(catalogue)) {
  errors.push("Route catalogue must not advertise business_approval_request_save as an active write route");
}

const allowedDefinition = path.join(root, recordsPath);
for (const absolutePath of walk(path.join(root, "src"))) {
  if (absolutePath === allowedDefinition) continue;
  const source = fs.readFileSync(absolutePath, "utf8");
  if (/\bsaveBusinessApprovalRequest\b/.test(source)) {
    errors.push(`${path.relative(root, absolutePath)} must not import or invoke saveBusinessApprovalRequest`);
  }
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-approval-storage-isolation-v1",
  historicalStorageHelperRetained: true,
  runtimeImportsAllowed: false,
  directApprovalWriteRouteEnabled: false,
  retiredRouteExpectedStatus: 410,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
