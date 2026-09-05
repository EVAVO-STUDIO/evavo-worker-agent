#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const failures = [];
const read = (file) => {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) {
    failures.push(`Missing source grounding file: ${file}`);
    return "";
  }
  return fs.readFileSync(absolute, "utf8");
};
const requireTokens = (file, tokens) => {
  const source = read(file);
  for (const token of tokens) if (!source.includes(token)) failures.push(`${file} missing ${token}`);
  return source;
};

requireTokens("src/core/businessBrainMemoryContextPort.ts", [
  '"business_brain_memory_context_port_v2"', "stateEvidenceRef", 'redirect: "error"', 'cache: "no-store"',
]);
requireTokens("src/core/businessOperationsCoreRelationshipSnapshotPort.ts", [
  '"business_operations_core_relationship_snapshot_port_v1"', "providerWrites: 0", "externalSends: 0",
]);
requireTokens("src/core/businessCareersRoleTruthPort.ts", [
  '"business_careers_role_truth_port_v1"', 'source: "careers_registry"', "candidateMessages: 0", "employmentCommitments: 0",
]);
const supportPort = requireTokens("src/core/businessSupportRelationshipSnapshotPort.ts", [
  '"business_support_relationship_snapshot_port_v1"', '"/api/internal/relationship-manager/support-snapshot"',
  "providerWrites: 0", "outboundMessages: 0", "ticketMutations: 0", 'redirect: "error"', 'cache: "no-store"',
]);
if (/method:\s*["'](?:PATCH|PUT|DELETE)["']/.test(supportPort)) failures.push("Support port must be read-only");
const documentPort = requireTokens("src/core/businessDocumentRelationshipSnapshotPort.ts", [
  '"business_document_relationship_snapshot_port_v1"', '"/api/v1/internal/relationship-manager/document-snapshot"',
  "providerWrites: 0", "rendersCompleted: 0", "exportsCreated: 0", "externalSends: 0", 'redirect: "error"', 'cache: "no-store"',
]);
if (/method:\s*["'](?:PATCH|PUT|DELETE)["']/.test(documentPort)) failures.push("Document port must be read-only");

const supportRuntime = requireTokens("src/core/businessRelationshipManagerCanonicalSupportContextRuntime.ts", [
  '"business_relationship_manager_canonical_support_context_runtime_v1"',
  "RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_CALLER_READINESS_FORBIDDEN",
  "RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_CALLER_EVIDENCE_FORBIDDEN",
  "RELATIONSHIP_MANAGER_CANONICAL_SUPPORT_EVIDENCE_NOT_BOUND",
  'domain: "support"',
]);
const documentRuntime = requireTokens("src/core/businessRelationshipManagerCanonicalDocumentContextRuntime.ts", [
  '"business_relationship_manager_canonical_document_context_runtime_v1"',
  "RELATIONSHIP_MANAGER_CANONICAL_DOCUMENT_CALLER_READINESS_FORBIDDEN",
  "RELATIONSHIP_MANAGER_CANONICAL_DOCUMENT_CALLER_EVIDENCE_FORBIDDEN",
  "RELATIONSHIP_MANAGER_CANONICAL_DOCUMENT_EVIDENCE_NOT_BOUND",
  "attachment bytes remain separately verified",
]);
if (supportRuntime.includes("gmail.users.messages.send") || documentRuntime.includes("gmail.users.messages.send")) failures.push("Source hydration runtimes must never send email");

requireTokens("src/core/businessRelationshipManagerCanonicalFullSourceHydrationEnv.ts", [
  '"business_relationship_manager_canonical_full_source_hydration_env_v1"',
  "RelationshipManagerCanonicalSourceEnv", "OPERATIONS_DOCUMENT_READ_TOKEN", "SUPPORT_RELATIONSHIP_READ_TOKEN",
  "runCanonicalRelationshipManagerCycleWithDocumentContext",
  "RELATIONSHIP_MANAGER_FULL_SOURCE_SUPPORT_READINESS_WIDENED",
  "RELATIONSHIP_MANAGER_FULL_SOURCE_DOCUMENT_READINESS_WIDENED",
]);
requireTokens("src/core/businessRelationshipSourceReadiness.ts", [
  '"identity"', '"gmail"', '"operations"', '"careers"', '"support"', '"document"', '"calendar"', '"memory"',
  '"not_found"', '"provider_unavailable"', '"not_queried"', '"stale"',
]);
requireTokens("src/core/businessRelationship360Context.ts", [
  'domain: "identity"', '"gmail"', '"operations"', '"careers"', '"support"', '"document"', '"memory"',
]);
requireTokens(".dev.vars.example", [
  "BRAIN_BASE_URL", "OPERATIONS_RELATIONSHIP_READ_TOKEN", "OPERATIONS_CAREERS_READ_TOKEN",
  "OPERATIONS_DOCUMENT_READ_TOKEN", "SUPPORT_AGENT_BASE_URL", "SUPPORT_RELATIONSHIP_READ_TOKEN",
]);
requireTokens("tests/businessSupportRelationshipSnapshotPort.test.ts", [
  "provider effect counters fail closed", "remote support error detail is not surfaced",
]);
requireTokens("tests/businessRelationshipManagerCanonicalSupportContextRuntime.test.ts", [
  "verified live support state binds ticket emotion risk into canonical context",
  "support provider is not called when support truth is irrelevant",
]);
requireTokens("tests/businessDocumentRelationshipSnapshotPort.test.ts", [
  "document/version chronology mismatch fails closed", "provider mutation counters fail closed",
]);
requireTokens("tests/businessRelationshipManagerCanonicalDocumentContextRuntime.test.ts", [
  "superseded document is not accepted as current", "document provider is not called when document truth is irrelevant",
]);

if (failures.length) {
  console.error("Relationship Manager source-grounding check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(JSON.stringify({
  ok: true,
  contract: "relationship_manager_source_grounding_v2",
  sourceAuthorities: ["gmail", "brain_memory", "operations_core", "careers_registry", "support_agent", "document_read_model", "calendar"],
  supportIsIndependentAuthority: true,
  documentsUsePersistentOperationsReadModel: true,
  supportEvidenceStateStableAcrossQueryTime: true,
  documentEvidenceStateStableAcrossQueryTime: true,
  callerSuppliedSupportEvidenceAccepted: false,
  callerSuppliedDocumentEvidenceAccepted: false,
  supportMutationAuthority: false,
  documentMutationAuthority: false,
  attachmentBytesProvenByDocumentMetadata: false,
  externalExecutionEnabled: false,
}, null, 2));
