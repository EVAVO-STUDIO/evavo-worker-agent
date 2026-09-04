import assert from "node:assert/strict";
import test from "node:test";

import { buildRelationshipChangeDigest } from "../src/core/businessRelationshipChangeDigest";

test("summarises only material changes in the active window", () => {
  const result = buildRelationshipChangeDigest({
    relationshipId: "rel-1",
    since: "2026-09-01T00:00:00Z",
    through: "2026-09-04T03:00:00Z",
    changes: [
      { id: "c1", occurredAt: "2026-09-02T00:00:00Z", domain: "communication", changeType: "updated", summary: "Client asked a new question.", material: true, sourceRefs: ["gmail:m1"] },
      { id: "c2", occurredAt: "2026-09-02T01:00:00Z", domain: "other", changeType: "updated", summary: "Internal metadata label refreshed.", material: false, sourceRefs: ["system:x"] },
      { id: "c3", occurredAt: "2026-09-03T00:00:00Z", domain: "obligation", changeType: "resolved", summary: "EVAVO delivery obligation was satisfied.", material: true, sourceRefs: ["ops:o1"] },
    ],
  });

  assert.equal(result.materialChanges.length, 2);
  assert.equal(result.nonMaterialChanges.length, 1);
  assert.equal(result.latestMaterialChangeAt, "2026-09-03T00:00:00.000Z");
  assert.ok(result.summary.includes("Client asked a new question"));
});

test("returns explicit no-change summary when nothing material changed", () => {
  const result = buildRelationshipChangeDigest({
    relationshipId: "rel-2",
    since: "2026-09-01T00:00:00Z",
    through: "2026-09-04T03:00:00Z",
    changes: [{ id: "c1", occurredAt: "2026-09-02T00:00:00Z", domain: "other", changeType: "updated", summary: "Cache metadata refreshed.", material: false, sourceRefs: ["system:x"] }],
  });
  assert.equal(result.materialChanges.length, 0);
  assert.match(result.summary, /No material relationship changes/);
});
