import assert from "node:assert/strict";
import test from "node:test";

import { assessCommunicationEvidenceReadiness } from "../src/core/businessCommunicationEvidenceReadiness";

const identity = {
  contract: "business_relationship_identity_resolver_v1" as const,
  status: "verified" as const,
  selected: {
    personId: "person_ashley",
    name: "Ashley Wong",
    addresses: ["ashley@example.com"],
    evidence: [{ source: "gmail" as const, ref: "gmail:message:m1", confidence: 100 }],
  },
  confidence: 100,
  exactAddressMatch: true,
  reasons: ["exact"],
  competingPersonIds: [],
};

const artifact = {
  contract: "business_artifact_resolver_v1" as const,
  status: "verified" as const,
  selected: {
    artifactId: "artifact_cv",
    filename: "cv.pdf",
    purpose: "candidate cv",
    canonicalOwner: "gmail" as const,
    current: true,
    contentHash: "a".repeat(64),
    sourceEvidenceIds: ["gmail:attachment:m1:cv.pdf"],
  },
  reasons: ["one match"],
  competingArtifactIds: [],
};

const calendar = {
  contract: "business_calendar_commitment_verifier_v2" as const,
  status: "verified_available" as const,
  canPromise: true,
  reasons: ["available"],
  evidenceIds: ["calendar:freebusy:greg:slot1"],
};

test("verified identity with no optional attachment or calendar requirement is approval ready", () => {
  const result = assessCommunicationEvidenceReadiness({ identity });
  assert.equal(result.status, "ready_for_approval");
  assert.ok(result.evidenceIds.includes("gmail:message:m1"));
  assert.ok(!result.evidenceIds.includes("gmail:gmail:message:m1"));
});

test("required attachment ambiguity blocks communication", () => {
  const result = assessCommunicationEvidenceReadiness({
    identity,
    attachmentsRequired: true,
    artifactResolutions: [{ ...artifact, status: "ambiguous", selected: undefined, competingArtifactIds: ["a", "b"] }],
  });
  assert.equal(result.status, "blocked");
  assert.equal(result.artifactsReady, false);
});

test("calendar promise requires exact verified availability", () => {
  const result = assessCommunicationEvidenceReadiness({ identity, calendarPromiseRequired: true, calendarCommitments: [{ ...calendar, status: "unverified", canPromise: false }] });
  assert.equal(result.status, "blocked");
  assert.equal(result.calendarReady, false);
});

test("unavailable calendar evidence does not block a communication with no time promise", () => {
  const result = assessCommunicationEvidenceReadiness({
    identity,
    calendarPromiseRequired: false,
    calendarCommitments: [{ ...calendar, status: "verified_unavailable", canPromise: false }],
  });
  assert.equal(result.status, "ready_for_approval");
  assert.equal(result.calendarReady, true);
  assert.ok(result.warnings.some((warning) => /unavailable slot/i.test(warning)));
});

test("all required evidence produces one approval-ready package", () => {
  const result = assessCommunicationEvidenceReadiness({ identity, attachmentsRequired: true, artifactResolutions: [artifact], calendarPromiseRequired: true, calendarCommitments: [calendar] });
  assert.equal(result.status, "ready_for_approval");
  assert.ok(result.evidenceIds.length >= 3);
});
