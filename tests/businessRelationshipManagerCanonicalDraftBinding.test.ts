import assert from "node:assert/strict";
import test from "node:test";

import { assertCanonicalRelationshipManagerDraftBinding } from "../src/core/businessRelationshipManagerCanonicalApprovalRuntime";

function canonical() {
  return {
    decisionContext: {
      generatedAt: "2026-09-05T00:01:00.000Z",
      evidenceRefs: ["gmail:thread:t1", "operations:careers-snapshot:abc"],
      staffBrief: {
        sourceRefs: ["brain:memory-context-query:def", "gmail:thread:t1"],
      },
    },
    cycle: {
      cycleId: "cycle-draft-binding-1",
      decision: {
        packageId: "relationship-cycle:cycle-draft-binding-1",
        evidenceIds: ["gmail:thread:t1", "operations:careers-snapshot:abc", "brain:memory-context-query:def"],
      },
    },
  } as any;
}

function handoff(sourceRefs = [
  "brain:memory-context-query:def",
  "operations:careers-snapshot:abc",
  "gmail:thread:t1",
]) {
  return {
    staffContext: {
      generatedAt: "2026-09-05T00:01:00.000Z",
      decisionPackageId: "relationship-cycle:cycle-draft-binding-1",
      relationshipCycleId: "cycle-draft-binding-1",
      sourceRefs,
    },
  } as any;
}

test("canonical draft binding accepts the same complete source set regardless of ordering", () => {
  assert.doesNotThrow(() => assertCanonicalRelationshipManagerDraftBinding({
    canonical: canonical(),
    handoff: handoff(),
  }));
});

test("new or removed source evidence after drafting forces regeneration", () => {
  assert.throws(() => assertCanonicalRelationshipManagerDraftBinding({
    canonical: canonical(),
    handoff: handoff(["gmail:thread:t1", "brain:memory-context-query:def"]),
  }), /SOURCE_CONTEXT_CHANGED_AFTER_DRAFT/);

  const changed = canonical();
  changed.decisionContext.evidenceRefs = [
    ...changed.decisionContext.evidenceRefs,
    "operations:careers-snapshot:new-snapshot",
  ];
  assert.throws(() => assertCanonicalRelationshipManagerDraftBinding({
    canonical: changed,
    handoff: handoff(),
  }), /SOURCE_CONTEXT_CHANGED_AFTER_DRAFT/);
});

test("changed canonical context generation time forces regeneration", () => {
  const changed = canonical();
  changed.decisionContext.generatedAt = "2026-09-05T00:02:00.000Z";
  assert.throws(() => assertCanonicalRelationshipManagerDraftBinding({
    canonical: changed,
    handoff: handoff(),
  }), /CONTEXT_CHANGED_AFTER_DRAFT/);
});
