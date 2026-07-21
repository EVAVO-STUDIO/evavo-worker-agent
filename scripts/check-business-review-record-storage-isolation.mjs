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
const builderPath = "src/core/businessAutopilotActionDraftBuilder.ts";
const cataloguePath = "src/routes/businessAutopilotRouteCatalogue.ts";

const records = read(recordsPath);
const route = read(routePath);
const builder = read(builderPath);
const catalogue = read(cataloguePath);

for (const token of [
  "export async function saveBusinessActionDraft",
  "buildBusinessActionDraft(input)",
]) {
  if (!records.includes(token)) errors.push(`${recordsPath} must preserve guarded historical review storage: ${token}`);
}

for (const token of [
  "business_historical_review_record_v2",
  "draftType: 'crm_note'",
  "channel: 'internal'",
  "historicalOnly: true",
  "executable: false",
  "deliverable: false",
  "authoritativeForExecution: false",
  "requiresApproval: false",
]) {
  if (!builder.includes(token)) errors.push(`${builderPath} missing internal review posture: ${token}`);
}

for (const token of [
  "const built = buildBusinessDraftOnlyAction(body.draftRequest || body)",
  "const draft = await saveBusinessActionDraft(env, built.draft)",
  'mode: "business_historical_review_record_saved"',
  "historicalOnly: true",
  "deliverable: false",
  "authoritativeForExecution: false",
]) {
  if (!route.includes(token)) errors.push(`${routePath} missing guarded review-record storage posture: ${token}`);
}

for (const token of [
  'writeRoute("business_action_draft_build"',
  '"Save internal historical review record"',
  "Confirm-saves one internal historical review record only.",
]) {
  if (!catalogue.includes(token)) errors.push(`${cataloguePath} missing truthful review-record catalogue posture: ${token}`);
}

const allowedFiles = new Set([
  path.join(root, recordsPath),
  path.join(root, routePath),
]);

for (const absolutePath of walk(path.join(root, "src"))) {
  if (allowedFiles.has(absolutePath)) continue;
  const source = fs.readFileSync(absolutePath, "utf8");
  if (/\bsaveBusinessActionDraft\b/.test(source)) {
    errors.push(`${path.relative(root, absolutePath)} must not import or invoke saveBusinessActionDraft`);
  }
}

for (const unsafe of [
  "draftType: 'email'",
  "channel: 'email'",
  "channel: 'linkedin'",
  "requiresApproval: true",
  "externalExecutionAllowed: true",
  "deliverable: true",
  "authoritativeForExecution: true",
]) {
  if (builder.includes(unsafe)) errors.push(`${builderPath} contains unsafe review-record posture: ${unsafe}`);
}

const packageJson = JSON.parse(read("package.json") || "{}");
const expectedCommand = "node scripts/check-business-review-record-storage-isolation.mjs";
const scripts = packageJson.scripts || {};
if (scripts["business:review-record-storage-isolation:check"] !== expectedCommand) {
  errors.push(`package.json must expose business:review-record-storage-isolation:check as ${expectedCommand}`);
}
if (!String(scripts["check:local"] || "").includes("npm run business:review-record-storage-isolation:check")) {
  errors.push("check:local must include business:review-record-storage-isolation:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "business-review-record-storage-isolation-v1",
  storageDefinitionAllowed: true,
  guardedCompatibilityRouteAllowed: true,
  otherRuntimeImportsAllowed: false,
  deliverableDraftGenerationEnabled: false,
  approvalToExecutionEnabled: false,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
