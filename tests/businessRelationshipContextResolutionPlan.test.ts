import assert from "node:assert/strict";
import test from "node:test";

import { buildRelationshipContextResolutionPlan } from "../src/core/businessRelationshipContextResolutionPlan";

test("routes identity, thread, project, document and calendar gaps to canonical sources", () => {
  const plan = buildRelationshipContextResolutionPlan({
    relationshipId: "rel-1",
    missingContext: [
      "Verified person identity is missing.",
      "Current email thread state is missing.",
      "Current project status is missing.",
      "Document/version context is uncertain.",
      "Calendar availability has not been verified.",
    ],
  });
  assert.equal(plan.ready, false);
  assert.deepEqual(plan.orderedSources.slice(0, 5), ["identity_directory", "gmail", "operations_core", "docs_suite", "calendar"]);
  assert.ok(plan.items.every((item) => item.evidenceRequired));
});

test("routes hiring and role-opening truth to careers rather than Operations Core", () => {
  const plan = buildRelationshipContextResolutionPlan({
    relationshipId: "rel-careers",
    missingContext: ["Current hiring status and open role truth are not verified."],
  });
  assert.deepEqual(plan.orderedSources, ["careers_registry"]);
  assert.equal(plan.items[0]?.source, "careers_registry");
  assert.match(plan.items[0]?.purpose ?? "", /Commercial or project state must not be used/i);
});

test("routes unresolved conflicts to explicit human review", () => {
  const plan = buildRelationshipContextResolutionPlan({
    relationshipId: "rel-2",
    conflicts: ["Conflict: two authoritative sources disagree about the controlling scope."],
  });
  assert.equal(plan.ready, false);
  assert.ok(plan.items.some((item) => item.source === "human_review"));
});

test("history-only retrieval can be non-blocking", () => {
  const plan = buildRelationshipContextResolutionPlan({
    relationshipId: "rel-3",
    mustVerify: ["Retrieve prior relationship history and previous decisions."],
  });
  assert.equal(plan.ready, true);
  assert.deepEqual(plan.orderedSources, ["brain_memory"]);
});
