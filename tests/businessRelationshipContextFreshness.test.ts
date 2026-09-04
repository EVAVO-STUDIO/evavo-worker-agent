import assert from "node:assert/strict";
import test from "node:test";

import { assessRelationshipContextFreshness } from "../src/core/businessRelationshipContextFreshness";

const evidence = (domain: "gmail" | "calendar" | "memory", observedAt: string) => ({
  id: `${domain}-1`,
  domain,
  summary: `${domain} evidence`,
  status: "current" as const,
  authority: "canonical" as const,
  observedAt,
  sourceRefs: [`${domain}:1`],
});

test("stale Gmail and calendar evidence block approval", () => {
  const result = assessRelationshipContextFreshness({
    now: "2026-09-04T12:00:00Z",
    evidence: [
      evidence("gmail", "2026-09-04T10:00:00Z"),
      evidence("calendar", "2026-09-04T11:30:00Z"),
    ],
  });
  assert.equal(result.ready, false);
  assert.deepEqual(new Set(result.refreshDomains), new Set(["gmail", "calendar"]));
});

test("older durable memory can remain useful without blocking approval", () => {
  const result = assessRelationshipContextFreshness({
    now: "2026-09-04T12:00:00Z",
    evidence: [evidence("memory", "2026-01-01T00:00:00Z")],
  });
  assert.equal(result.ready, true);
  assert.equal(result.findings[0]?.stale, true);
  assert.equal(result.findings[0]?.blocking, false);
});
