import assert from "node:assert/strict";
import test from "node:test";

import { businessAuditPackReadPayload } from "../src/core/businessAutopilotAuditPackRecords";
import {
  BUSINESS_READ_PROJECTION_CONTRACT,
  projectBusinessReadCollection,
  projectBusinessReadRecord,
} from "../src/core/businessReadProjection";

const PRIVATE_METADATA = "private-operator-context-must-not-leak";
const PRIVATE_REQUESTER = "private-requester@example.test";
const PRIVATE_EMAIL = "reviewed.person@example.test";
const PRIVATE_PHONE = "+61 400 000 000";
const PRIVATE_PROFILE = "https://example.test/private-profile";
const PRIVATE_SOURCE = "https://example.test/private-source";

test("Business read projection removes arbitrary metadata and requester identity without mutating evidence", () => {
  const source = {
    id: "audit-run-1",
    organizationId: "organization-1",
    summary: "Reviewed evidence remains visible.",
    requestedBy: PRIVATE_REQUESTER,
    metadata: { note: PRIVATE_METADATA },
  };

  const projected = projectBusinessReadRecord(source);

  assert.equal(BUSINESS_READ_PROJECTION_CONTRACT, "business_read_projection_v1");
  assert.equal(projected.id, source.id);
  assert.equal(projected.summary, source.summary);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "metadata"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(projected, "requestedBy"), false);
  assert.equal(projected.metadataPresent, true);
  assert.equal(projected.metadataRedacted, true);
  assert.equal(projected.requestedByPresent, true);
  assert.equal(projected.requesterIdentityRedacted, true);
  assert.equal(Object.isFrozen(projected), true);
  assert.deepEqual(source.metadata, { note: PRIVATE_METADATA });
  assert.equal(source.requestedBy, PRIVATE_REQUESTER);
  assert.equal(JSON.stringify(projected).includes(PRIVATE_METADATA), false);
  assert.equal(JSON.stringify(projected).includes(PRIVATE_REQUESTER), false);
});

test("Business people projection preserves presence evidence while redacting contact values", () => {
  const source = {
    id: "person-1",
    name: "Reviewed Person",
    email: PRIVATE_EMAIL,
    phone: PRIVATE_PHONE,
    profileUrl: PRIVATE_PROFILE,
    sourceUrl: PRIVATE_SOURCE,
    metadata: { note: PRIVATE_METADATA },
  };

  const projected = projectBusinessReadRecord(source, {
    redactContactDetails: true,
  });

  assert.equal(projected.email, null);
  assert.equal(projected.phone, null);
  assert.equal(projected.profileUrl, null);
  assert.equal(projected.sourceUrl, null);
  assert.equal(projected.emailPresent, true);
  assert.equal(projected.phonePresent, true);
  assert.equal(projected.profileUrlPresent, true);
  assert.equal(projected.sourceUrlPresent, true);
  assert.equal(projected.contactDetailsRedacted, true);
  assert.equal(projected.metadataPresent, true);
  assert.equal(projected.metadataRedacted, true);

  const text = JSON.stringify(projected);
  for (const privateValue of [
    PRIVATE_EMAIL,
    PRIVATE_PHONE,
    PRIVATE_PROFILE,
    PRIVATE_SOURCE,
    PRIVATE_METADATA,
  ]) {
    assert.equal(text.includes(privateValue), false, privateValue);
  }
});

test("repeated projection preserves existing redaction and presence flags", () => {
  const alreadyProjected = {
    id: "record-1",
    metadataPresent: true,
    metadataRedacted: true,
    requestedByPresent: true,
    requesterIdentityRedacted: true,
    email: null,
    emailPresent: true,
    phone: null,
    phonePresent: false,
    profileUrl: null,
    profileUrlPresent: true,
    sourceUrl: null,
    sourceUrlPresent: false,
    contactDetailsRedacted: true,
  };

  const projected = projectBusinessReadRecord(alreadyProjected, {
    redactContactDetails: true,
  });

  assert.equal(projected.metadataPresent, true);
  assert.equal(projected.metadataRedacted, true);
  assert.equal(projected.requestedByPresent, true);
  assert.equal(projected.requesterIdentityRedacted, true);
  assert.equal(projected.emailPresent, true);
  assert.equal(projected.phonePresent, false);
  assert.equal(projected.profileUrlPresent, true);
  assert.equal(projected.sourceUrlPresent, false);
});

test("collection projection and audit-pack minimisation preserve metadata-presence truth", () => {
  const rawPack = {
    id: "audit-pack-1",
    title: "Reviewed audit pack",
    findings: ["Reviewed finding"],
    recommendations: ["Reviewed recommendation"],
    confidenceScore: 80,
    metadata: { note: PRIVATE_METADATA },
  };

  const projectedPacks = projectBusinessReadCollection([rawPack]);
  const payload = businessAuditPackReadPayload(projectedPacks);
  const packs = payload.auditPacks as Array<Record<string, unknown>>;

  assert.equal(payload.metadataRedacted, true);
  assert.equal(payload.internalReviewOnly, true);
  assert.equal(payload.executable, false);
  assert.equal(payload.deliverable, false);
  assert.equal(payload.authoritativeForExecution, false);
  assert.equal(packs.length, 1);
  assert.deepEqual(packs[0]?.metadata, {});
  assert.equal(packs[0]?.metadataPresent, true);
  assert.equal(packs[0]?.metadataRedacted, true);
  assert.deepEqual(packs[0]?.findings, ["Reviewed finding"]);
  assert.deepEqual(packs[0]?.recommendations, ["Reviewed recommendation"]);
  assert.equal(JSON.stringify(payload).includes(PRIVATE_METADATA), false);

  const emptyMetadataPayload = businessAuditPackReadPayload([{
    ...rawPack,
    id: "audit-pack-2",
    metadata: {},
  }]);
  const emptyPack = (emptyMetadataPayload.auditPacks as Array<Record<string, unknown>>)[0];
  assert.equal(emptyPack?.metadataPresent, false);
});
