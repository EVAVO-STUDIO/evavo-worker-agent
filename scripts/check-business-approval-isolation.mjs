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
const relationshipPreviewPath = "src/routes/businessRelationshipManagerAdmin.ts";
const candidatePersistencePath = "src/core/businessStaffCommunicationApprovalCandidatePersistence.ts";
const storagePortPath = "src/core/businessEvavoStorageApprovalCandidatePort.ts";
const brainPortPath = "src/core/businessBrainMemoryIngestionPort.ts";
const brainEnvPath = "src/core/businessBrainMemoryIngestionEnv.ts";
const canonicalMemoryPath = "src/core/businessRelationshipManagerCanonicalMemoryPersistence.ts";
const brainPersistencePath = "src/core/businessRelationshipManagerBrainPersistenceRuntime.ts";
const approvalRuntimePath = "src/core/businessRelationshipManagerApprovalRuntime.ts";
const approvalFinalizerPath = "src/core/businessStaffCommunicationApprovalFinalizer.ts";
const canonicalRuntimePath = "src/core/businessRelationshipManagerCanonicalRuntime.ts";
const canonicalApprovalPath = "src/core/businessRelationshipManagerCanonicalApprovalRuntime.ts";
const decisionContextPath = "src/core/businessRelationshipDecisionContext.ts";
const sourceReadinessPath = "src/core/businessRelationshipSourceReadiness.ts";

const records = read(recordsPath);
const route = read(routePath);
const catalogue = read(cataloguePath);
const relationshipPreview = read(relationshipPreviewPath);
const candidatePersistence = read(candidatePersistencePath);
const storagePort = read(storagePortPath);
const brainPort = read(brainPortPath);
const brainEnv = read(brainEnvPath);
const canonicalMemory = read(canonicalMemoryPath);
const brainPersistence = read(brainPersistencePath);
const approvalRuntime = read(approvalRuntimePath);
const approvalFinalizer = read(approvalFinalizerPath);
const canonicalRuntime = read(canonicalRuntimePath);
const canonicalApproval = read(canonicalApprovalPath);
const decisionContext = read(decisionContextPath);
const sourceReadiness = read(sourceReadinessPath);

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
  'model: "immutable_document_version"',
  'vaultId: "internal"',
  "assertNativeStorageBinding",
  "approvalCandidatePersistenceEvidenceRef",
  "reconcileStaffApprovalCandidateWriteReceipt",
]) {
  if (!candidatePersistence.includes(token)) errors.push(`${candidatePersistencePath} must retain governed candidate persistence token: ${token}`);
}

for (const token of [
  '"business_evavo_storage_approval_candidate_port_v2"',
  '"/v1/actions/persist_approval_candidate"',
  '"Authorization": `Bearer ${writeToken}`',
  "expectedAuthorityId",
  "AUTHORITY_MISMATCH",
  "MAX_APPROVAL_CANDIDATE_REQUEST_BYTES",
  'redirect: "error"',
  'cache: "no-store"',
  "reconcileStaffApprovalCandidateWriteReceipt",
]) {
  if (!storagePort.includes(token)) errors.push(`${storagePortPath} must retain concrete EVAVO Storage persistence token: ${token}`);
}

for (const token of [
  '"business_brain_memory_ingestion_port_v2"',
  '"/v1/tools/call"',
  'name: "brain_memory_ingest_v2"',
  'autonomy: "auto_low_risk"',
  '"Authorization": `Bearer ${apiToken}`',
  "scopedWriteToken",
  "businessHmacSha256",
  "writerProof",
  'redirect: "error"',
  'cache: "no-store"',
  "BRAIN_MEMORY_INGESTION_UNEXPECTED_APPROVAL_REQUIRED",
]) {
  if (!brainPort.includes(token)) errors.push(`${brainPortPath} must retain scoped authenticated Brain memory persistence token: ${token}`);
}

for (const token of [
  "BRAIN_BASE_URL",
  "BRAIN_API_TOKEN",
  "BRAIN_RELATIONSHIP_MEMORY_WRITE_TOKEN",
  "requireBrainMemoryIngestionPortFromEnv",
]) {
  if (!brainEnv.includes(token)) errors.push(`${brainEnvPath} must retain complete Brain memory environment binding: ${token}`);
}

for (const token of [
  '"business_relationship_manager_brain_persistence_runtime_v2"',
  "CanonicalRelationshipManagerCycle",
  "persistCanonicalRelationshipManagerCycleToBrain",
  "persistCanonicalRelationshipManagerCycleToConfiguredBrain",
  "RELATIONSHIP_MANAGER_BRAIN_PERSISTENCE_CANONICAL_CONTEXT_NOT_READY",
]) {
  if (!brainPersistence.includes(token)) errors.push(`${brainPersistencePath} must retain canonical-only Brain persistence token: ${token}`);
}

for (const token of [
  '"business_relationship_manager_canonical_memory_persistence_v2"',
  "persistCanonicalRelationshipManagerCycleToBrain",
  "RELATIONSHIP_MANAGER_CANONICAL_MEMORY_NOT_DURABLE",
  "RELATIONSHIP_MANAGER_CANONICAL_MEMORY_RECORDS_REQUIRED",
]) {
  if (!canonicalMemory.includes(token)) errors.push(`${canonicalMemoryPath} must remain a facade over canonical Brain persistence: ${token}`);
}

for (const token of [
  'mode: "relationship_manager_caller_supplied_preview"',
  "canonicalContextBound: false",
  "canonicalApprovalGradeReady: false",
  "allowedFromThisPreview: false",
  "persistenceAllowedFromThisPreview: false",
  "externalExecutionAllowed: false",
]) {
  if (!relationshipPreview.includes(token)) errors.push(`${relationshipPreviewPath} must keep caller-supplied preview noncanonical/nonpersistable: ${token}`);
}
if (/persistCanonicalRelationshipManagerCycleToBrain|requireBrainMemoryIngestionPortFromEnv|createBrainMemoryIngestionPort/.test(relationshipPreview)) {
  errors.push(`${relationshipPreviewPath} must not persist caller-supplied preview cycles to Brain`);
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

for (const token of [
  '"business_relationship_manager_canonical_runtime_v1"',
  "buildRelationshipDecisionContext",
  "decisionContext.approvalGradeReady",
]) {
  if (!canonicalRuntime.includes(token)) errors.push(`${canonicalRuntimePath} must retain canonical context-bound cycle token: ${token}`);
}

for (const token of [
  '"business_relationship_manager_canonical_approval_runtime_v1"',
  "RELATIONSHIP_MANAGER_CANONICAL_APPROVAL_CONTEXT_NOT_READY",
  "prepareRelationshipManagerCommunicationForApproval",
]) {
  if (!canonicalApproval.includes(token)) errors.push(`${canonicalApprovalPath} must retain canonical approval token: ${token}`);
}

for (const token of [
  '"business_relationship_decision_context_v3"',
  "sourceReadiness",
  "approvalGradeReady",
]) {
  if (!decisionContext.includes(token)) errors.push(`${decisionContextPath} must retain decision-context readiness token: ${token}`);
}
for (const token of [
  '"business_relationship_source_readiness_v1"',
  '"provider_unavailable"',
  '"not_queried"',
  '"not_found"',
  "absenceAcceptable",
]) {
  if (!sourceReadiness.includes(token)) errors.push(`${sourceReadinessPath} must distinguish source-readiness state: ${token}`);
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
  contract: "business-approval-storage-isolation-v6",
  historicalStorageHelperRetained: true,
  runtimeImportsAllowed: false,
  directApprovalWriteRouteEnabled: false,
  retiredRouteExpectedStatus: 410,
  governedApprovalCandidatePersistence: true,
  nativeImmutableStorageVersionRequired: true,
  concreteEvavoStoragePortRequired: true,
  expectedStorageAuthorityRequired: true,
  boundedCandidateWriteRequired: true,
  persistedCandidateEvidenceRederived: true,
  concreteBrainMemoryPortRequired: true,
  scopedBrainMemoryHmacRequired: true,
  completeBrainMemoryEnvRequired: true,
  canonicalBrainCheckpointRequiredByPreferredPath: true,
  callerSuppliedPreviewCannotPersist: true,
  canonicalDecisionContextRequiredByPreferredPath: true,
  sourceReadinessDistinguishesUnknownFromNotFound: true,
  canonicalApprovalPreparationRequiredByPreferredPath: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
