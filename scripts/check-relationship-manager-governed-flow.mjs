import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const files = {
  admin: "src/routes/businessRelationshipManagerAdmin.ts",
  approvalRuntime: "src/core/businessRelationshipManagerApprovalRuntime.ts",
  approvalCandidate: "src/core/businessStaffCommunicationApprovalCandidate.ts",
  executionRuntime: "src/core/businessRelationshipManagerExecutionRuntime.ts",
  executionGate: "src/core/businessCommunicationExecutionGate.ts",
  lifecycle: "src/core/businessCommunicationLifecycleReceipt.ts",
  dryRun: "tests/businessRelationshipManagerEndToEndDryRun.test.ts",
};

const source = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, read(file)]));
const failures = [];
const requireToken = (key, token, message) => {
  if (!source[key].includes(token)) failures.push(message);
};
const forbidToken = (key, token, message) => {
  if (source[key].includes(token)) failures.push(message);
};

// The HTTP preview route must remain reasoning-only. It must never acquire
// approval, execution or provider-send primitives directly.
for (const token of [
  "createCommunicationSendEnvelope",
  "finalizeStaffCommunicationApproval",
  "authorizeCommunicationExecutionRequest",
  "authorizeRelationshipManagerCommunicationExecution",
  "finalizeRelationshipManagerCommunicationApproval",
  "gmail.users.messages.send",
]) {
  forbidToken("admin", token, `Relationship Manager admin preview illegally references ${token}`);
}
requireToken("admin", "externalExecutionAllowed: false", "Relationship Manager admin preview must advertise externalExecutionAllowed:false");
requireToken("admin", "sendsEmail: false", "Relationship Manager admin preview must advertise sendsEmail:false");

// Canonical approval preparation must bind the actual cycle, durable memory and
// Writing Studio output before a human can approve anything.
requireToken("approvalRuntime", "prepareStaffCommunicationApprovalCandidate", "Approval runtime must use the canonical staff approval candidate builder");
requireToken("approvalRuntime", "finalizeStaffCommunicationApproval", "Approval runtime must use the explicit human approval finalizer");
requireToken("approvalRuntime", "externalExecutionAllowed: false", "Approval runtime must remain non-executable after human approval");
requireToken("approvalCandidate", "bindStaffWritingOutputForApproval", "Approval candidate must validate Writing Studio output provenance");
requireToken("approvalCandidate", "STAFF_APPROVAL_CANDIDATE_MEMORY_NOT_DURABLE", "Approval candidate must fail closed on non-durable Relationship Manager memory");
requireToken("approvalCandidate", "STAFF_APPROVAL_CANDIDATE_SENDER_IDENTITY_MISMATCH", "Approval candidate must verify sender identity before human approval");

// Provider authorization must be available only through the Relationship
// Manager execution runtime, which delegates to the canonical communication
// execution gate/request builder and itself performs no external effect.
requireToken("executionRuntime", "authorizeCommunicationExecutionRequest", "Relationship Manager execution runtime must delegate to the canonical execution request authorizer");
requireToken("executionRuntime", "externalEffectPerformed: false", "Relationship Manager execution runtime must remain provider-neutral");
requireToken("executionRuntime", "RELATIONSHIP_MANAGER_EXECUTION_RUNTIME_WRITING_PROVENANCE_REQUIRED", "Execution runtime must require Writing Studio provenance");
forbidToken("executionRuntime", "gmail.users.messages.send", "Relationship Manager execution runtime must not call Gmail send directly");

requireToken("executionGate", "writing_provenance_missing", "Execution gate must block canonical cycles without approved Writing Studio provenance");
requireToken("lifecycle", "business_communication_lifecycle_receipt_v3", "Lifecycle must use the Writing Studio provenance-aware v3 contract");
requireToken("lifecycle", "sameWritingProvenance", "Lifecycle must reconcile approval and execution Writing Studio provenance");

// The principal dry run is the architectural canary. It must exercise the
// governed path and may not fall back to manually created approvals/requests.
for (const token of [
  "prepareRelationshipManagerCommunicationForApproval",
  "finalizeRelationshipManagerCommunicationApproval",
  "authorizeRelationshipManagerCommunicationExecution",
]) {
  requireToken("dryRun", token, `End-to-end dry run must exercise ${token}`);
}
for (const token of ["createCommunicationSendEnvelope", "assertAuthorizedCommunicationExecutionRequest"]) {
  forbidToken("dryRun", token, `End-to-end dry run must not bypass governed flow via ${token}`);
}
requireToken("dryRun", "No Gmail connector/send API is invoked", "End-to-end dry run must explicitly remain non-sending");

if (failures.length) {
  console.error("Relationship Manager governed-flow check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  contract: "relationship_manager_governed_flow_check_v1",
  adminPreviewSendCapable: false,
  approvalRequiresDurableCycle: true,
  approvalRequiresWritingProvenance: true,
  executionUsesCanonicalGate: true,
  lifecycleReconcilesWritingProvenance: true,
  dryRunUsesGovernedPath: true,
}, null, 2));
