import assert from "node:assert/strict";
import test from "node:test";

import { assessRelationshipContextFreshness } from "../src/core/businessRelationshipContextFreshness";

const evidence = (domain: "gmail" | "calendar" | "careers" | "memory", observedAt: string) => ({
  id: `${domain}-1`,
  domain,
  summary: `${domain} evidence`,
  status: "current" as const,
  authority: "canonical" as const,
  observedAt,
  sourceRefs: [`${domain}:1`],
});

test("direct freshness assessment remains conservative when no relevance set is supplied", () => {
  const result = assessRelationshipContextFreshness({
    now: "2026-09-04T12:00:00Z",
    evidence: [
      evidence("gmail", "2026-09-04T10:00:00Z"),
      evidence("calendar", "2026-09-04T11:30:00Z"),
    ],
  });
  assert.equal(result.contract, "business_relationship_context_freshness_v3");
  assert.equal(result.ready, false);
  assert.deepEqual(new Set(result.refreshDomains), new Set(["gmail", "calendar"]));
  assert.equal(result.requiredDomains, null);
});

test("stale irrelevant calendar evidence does not block a non-scheduling decision", () => {
  const result = assessRelationshipContextFreshness({
    now: "2026-09-04T12:00:00Z",
    evidence: [
      evidence("gmail", "2026-09-04T11:30:00Z"),
      evidence("calendar", "2026-09-04T10:00:00Z"),
    ],
    requiredDomains: ["gmail"],
  });
  assert.equal(result.ready, true);
  const calendar = result.findings.find((item) => item.domain === "calendar");
  assert.equal(calendar?.stale, true);
  assert.equal(calendar?.relevant, false);
  assert.equal(calendar?.blocking, false);
});

test("stale calendar evidence blocks when scheduling is explicitly relevant", () => {
  const result = assessRelationshipContextFreshness({
    now: "2026-09-04T12:00:00Z",
    evidence: [evidence("calendar", "2026-09-04T10:00:00Z")],
    requiredDomains: ["calendar"],
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.refreshDomains, ["calendar"]);
  assert.equal(result.findings[0]?.relevant, true);
  assert.equal(result.findings[0]?.blocking, true);
});

test("careers truth older than one hour blocks a role-opening claim until refreshed", () => {
  const result = assessRelationshipContextFreshness({
    now: "2026-09-04T12:00:00Z",
    evidence: [evidence("careers", "2026-09-04T10:59:00Z")],
    requiredDomains: ["careers"],
  });
  assert.equal(result.ready, false);
  assert.deepEqual(result.refreshDomains, ["careers"]);
  assert.equal(result.findings[0]?.maximumAgeMinutes, 60);
  assert.equal(result.findings[0]?.blocking, true);
});

test("fresh careers truth remains approval-usable", () => {
  const result = assessRelationshipContextFreshness({
    now: "2026-09-04T12:00:00Z",
    evidence: [evidence("careers", "2026-09-04T11:30:00Z")],
    requiredDomains: ["careers"],
  });
  assert.equal(result.ready, true);
  assert.equal(result.findings[0]?.stale, false);
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
