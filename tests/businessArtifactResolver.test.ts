import assert from "node:assert/strict";
import test from "node:test";

import { assertArtifactReadyForSend, resolveBusinessArtifact } from "../src/core/businessArtifactResolver";

const current = {
  artifactId: "artifact_issue_02",
  filename: "Contractor_Forecast_Issue_02.xlsx",
  purpose: "controlling contractor forecast",
  canonicalOwner: "docs_suite" as const,
  version: "Issue 02",
  contentHash: "sha256:abc123",
  current: true,
  sourceEvidenceIds: ["docs:artifact:issue02"],
};

test("resolves one evidence-backed current artifact", () => {
  const result = resolveBusinessArtifact({ requestedPurpose: current.purpose, candidates: [current] });
  assert.equal(result.status, "verified");
  assert.equal(assertArtifactReadyForSend(result).artifactId, current.artifactId);
});

test("does not choose between multiple current versions by filename guess", () => {
  const result = resolveBusinessArtifact({
    requestedPurpose: current.purpose,
    candidates: [current, { ...current, artifactId: "artifact_issue_02_copy", filename: "Issue02-copy.xlsx" }],
  });
  assert.equal(result.status, "ambiguous");
});

test("stale-only matches stay unresolved", () => {
  const result = resolveBusinessArtifact({ requestedPurpose: current.purpose, candidates: [{ ...current, current: false }] });
  assert.equal(result.status, "unresolved");
  assert.match(result.reasons[0]!, /non-current/i);
});

test("send binding requires a content hash", () => {
  const result = resolveBusinessArtifact({ requestedPurpose: current.purpose, candidates: [{ ...current, contentHash: null }] });
  assert.throws(() => assertArtifactReadyForSend(result), /CONTENT_HASH/);
});
