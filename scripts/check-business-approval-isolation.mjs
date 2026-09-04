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
const candidatePersistencePath = "src/core/businessStaffCommunicationApprovalCandidatePersistence.ts";
const storagePortPath = "src/core/businessEvavoStorageApprovalCandidatePort.ts";
const approvalRuntimePath = "src/core/businessRelationshipManagerApprovalRuntime.ts";
const approvalFinalizerPath = "src/core/businessStaffCommunicationApprovalFinalizer.ts";

const records = read(recordsPath);
const route = read(routePath);
const catalogue = read(cataloguePath);
const candidatePersistence = read(candidatePersistencePath);
const storagePort = read(storagePortPath);
const approvalRuntime = read(approvalRuntimePath);
const approvalFinalizer = read(approvalFinalizerPath);

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

for (const token of [
  '"evavo-approval-candidate-write-request-v1"',
  'actorId: "evavo-worker-agent"',
  "approvalCandidatePersistenceEvidenceRef",
  "reconcileStaffApprovalCandidateWriteReceipt",
]) {
  if (!candidatePersistence.includes(token)) errors.push(`${candidatePersistencePath} must retain governed candidate persistence token: ${token}`);
}

for (const token of [
  '"business_evavo_storage_approval_candidate_port_v1"',
  '"/v1/actions/persist_approval_candidate"',
  '"Authorization": `Bearer ${writeToken}`',
  'redirect: "error"',
  'cache: "no-store"',
  "reconcileStaffApprovalCandidateWriteReceipt",
]) {
  if (!storagePort.includes(token)) errors.push(`${storagePortPath} must retain concrete EVAVO Storage persistence token: ${token}`);
}

for (const [relativePath, source, token] of [
  [approvalRuntimePath, approvalRuntime, "approvalCandidatePersistenceEvidenceRef"],
  [approvalFinalizerPath, approvalFinalizer, "approvalCandidatePersistenceEvidenceRef"],
]) {
  if (!source.includes(token)) errors.push(`${relativePath} must independently rederive persisted candidate evidence: ${token}`);
}

if (!approvalRuntime.includes("readyForCandidatePersistence: true") || !approvalRuntime.includes("readyForHumanApproval: false")) {
  errors.push(`${approvalRuntimePath} must keep prepared candidates non-approvable until persistence`);
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
  contract: "business-approval-storage-isolation-v2",
  historicalStorageHelperRetained: true,
  runtimeImportsAllowed: false,
  directApprovalWriteRouteEnabled: false,
  retiredRouteExpectedStatus: 410,
  governedApprovalCandidatePersistence: true,
  concreteEvavoStoragePortRequired: true,
  persistedCandidateEvidenceRederived: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
