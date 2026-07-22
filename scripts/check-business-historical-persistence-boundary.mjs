#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const srcRoot = path.join(root, "src");
const recordsPath = path.join(srcRoot, "core", "businessAutopilotRecords.ts");
const adminPath = path.join(srcRoot, "routes", "businessAutopilotAdmin.ts");

function read(filePath) {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else if (entry.isFile() && /\.(ts|tsx|js|mjs)$/.test(entry.name)) files.push(absolute);
  }
  return files;
}

const records = read(recordsPath);
const admin = read(adminPath);
if (!records) errors.push("Missing Business Autopilot records module");
if (!admin) errors.push("Missing Business Autopilot admin route");

for (const token of [
  "export async function saveBusinessActionDraft",
  "export async function saveBusinessApprovalRequest",
  "export async function listBusinessActionDrafts",
  "export async function listBusinessApprovalRequests",
]) {
  if (!records.includes(token)) errors.push(`Historical compatibility records module is missing ${token}`);
}

for (const token of [
  'pathname === "/admin/business/action-drafts/build"',
  "buildBusinessDraftOnlyAction",
  "saveBusinessActionDraft",
  "business_historical_review_record_saved",
  "historicalOnly: true",
  "deliverable: false",
  "authoritativeForExecution: false",
  "historical_record_write_disabled",
  "{ status: 410 }",
]) {
  if (!admin.includes(token)) errors.push(`Business admin route is missing ${token}`);
}

if (admin.includes("saveBusinessApprovalRequest")) {
  errors.push("Active Business admin route must not import or call the historical approval writer");
}

const sourceFiles = walk(srcRoot);
const draftWriterConsumers = [];
const approvalWriterConsumers = [];
for (const filePath of sourceFiles) {
  if (filePath === recordsPath) continue;
  const content = read(filePath);
  const relative = path.relative(root, filePath).replaceAll("\\", "/");
  if (/\bsaveBusinessActionDraft\b/.test(content)) draftWriterConsumers.push(relative);
  if (/\bsaveBusinessApprovalRequest\b/.test(content)) approvalWriterConsumers.push(relative);
}

const allowedDraftConsumers = ["src/routes/businessAutopilotAdmin.ts"];
if (JSON.stringify(draftWriterConsumers.sort()) !== JSON.stringify(allowedDraftConsumers)) {
  errors.push(`Historical draft writer consumers must be exactly ${allowedDraftConsumers.join(", ")}; found ${draftWriterConsumers.join(", ") || "none"}`);
}
if (approvalWriterConsumers.length) {
  errors.push(`Historical approval writer must have no active source consumers; found ${approvalWriterConsumers.join(", ")}`);
}

const routeDraftSaveCalls = (admin.match(/\bsaveBusinessActionDraft\s*\(/g) || []).length;
if (routeDraftSaveCalls !== 1) {
  errors.push(`Business admin route must call the historical draft writer exactly once; found ${routeDraftSaveCalls}`);
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-historical-persistence-boundary-v1",
  draftWriterConsumers,
  approvalWriterConsumers,
  approvalWriterActiveConsumersAllowed: false,
  directDraftWriteEndpointEnabled: false,
  directApprovalWriteEndpointEnabled: false,
  compatibilityBuildPersistsInternalHistoricalRecordOnly: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
