import assert from "node:assert/strict";
import test from "node:test";

import {
  materializeProviderReadyCommunicationRequest,
  verifyCommunicationAttachmentBytes,
} from "../src/core/businessCommunicationAttachmentBytes";
import type { AuthorizedCommunicationExecutionRequest } from "../src/core/businessCommunicationExecutionRequest";

const HELLO_SHA256 = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
const bytes = new TextEncoder().encode("hello");

const request: AuthorizedCommunicationExecutionRequest = Object.freeze({
  contract: "business_communication_execution_request_v3",
  provider: "gmail",
  requestId: "gmail-send:approval-1:abcdef",
  authorizedAt: "2026-09-04T01:30:00.000Z",
  sender: "greg@evavo.com.au",
  to: Object.freeze(["client@example.com"]),
  cc: Object.freeze([]),
  bcc: Object.freeze([]),
  threadId: "gmail-thread-1",
  replyMessageId: "gmail-message-1",
  subject: "Re: Forecast",
  body: "Please find the verified forecast attached.",
  attachments: Object.freeze([{
    artifactId: "forecast-1",
    filename: "forecast.xlsx",
    sha256: HELLO_SHA256,
    versionRef: "issue-2",
  }]),
  authorization: Object.freeze({
    envelopeId: "approval-1",
    materialSha256: "a".repeat(64),
    approvalBindingSha256: "b".repeat(64),
    decisionPackageId: "decision-1",
    decisionOrigin: "direct",
    relationshipCycleId: null,
    decisionEvidenceIds: Object.freeze(["gmail:message:gmail-message-1"]),
    approvalEvidenceIds: Object.freeze(["operator-approval:approval-1"]),
    operatorApprovalId: "operator-approval-1",
    operatorApprovalSource: "operator_approval",
    approvedBy: "greg",
    approvedAt: "2026-09-04T01:20:00.000Z",
    expiresAt: "2026-09-04T02:20:00.000Z",
    mailboxKey: "greg",
    writingProvenance: null,
    approvalCandidate: null,
    memoryCheckpoint: null,
  }),
});

const actual = [{
  artifactId: "forecast-1",
  filename: "forecast.xlsx",
  bytes,
  sourceEvidenceIds: ["docs:forecast-1:bytes"],
  observedAt: "2026-09-04T01:31:00Z",
}] as const;

test("actual attachment bytes are rehashed and accepted only when they match approval", () => {
  const verified = verifyCommunicationAttachmentBytes({ approvedAttachments: request.attachments, actualAttachments: actual });
  assert.equal(verified.length, 1);
  assert.equal(verified[0]?.sha256, HELLO_SHA256);
  assert.equal(verified[0]?.byteLength, 5);
});

test("changed bytes fail even when artifact metadata is unchanged", () => {
  assert.throws(() => verifyCommunicationAttachmentBytes({
    approvedAttachments: request.attachments,
    actualAttachments: [{ ...actual[0], bytes: new TextEncoder().encode("HELLO") }],
  }), /BYTES_HASH_MISMATCH/);
});

test("wrong filename or missing attachment fails closed", () => {
  assert.throws(() => verifyCommunicationAttachmentBytes({
    approvedAttachments: request.attachments,
    actualAttachments: [{ ...actual[0], filename: "different.xlsx" }],
  }), /FILENAME_MISMATCH/);
  assert.throws(() => verifyCommunicationAttachmentBytes({ approvedAttachments: request.attachments, actualAttachments: [] }), /COUNT_MISMATCH/);
});

test("provider-ready request can only be materialized inside the approval window", () => {
  const ready = materializeProviderReadyCommunicationRequest({
    request,
    actualAttachments: actual,
    verifiedAt: "2026-09-04T01:31:30Z",
  });
  assert.equal(ready.provider, "gmail");
  assert.equal(ready.attachments[0]?.sha256, HELLO_SHA256);
  assert.equal(ready.authorization.decisionOrigin, "direct");
  assert.equal(ready.authorization.approvalCandidate, null);
  assert.throws(() => materializeProviderReadyCommunicationRequest({
    request,
    actualAttachments: actual,
    verifiedAt: request.authorization.expiresAt,
  }), /AFTER_APPROVAL_EXPIRY/);
});
