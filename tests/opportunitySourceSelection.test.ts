import assert from "node:assert/strict";
import test from "node:test";

import {
  OPPORTUNITY_SOURCE_SELECTION_VERSION,
  opportunitySourceExplorationSlots,
  selectOpportunitySources,
} from "../src/core/opportunitySourceSelection";

const NOW = new Date("2026-07-26T04:00:00.000Z");

type Source = Readonly<{
  id: string;
  priority: number;
  successCount: number;
  failureCount: number;
  opportunityCount: number;
  lastRunAtIso: string | null;
  url: string;
}>;

function source(
  id: string,
  overrides: Partial<Omit<Source, "id" | "url">> = {},
): Source {
  return Object.freeze({
    id,
    url: `https://${id}.example.com/opportunities`,
    priority: 50,
    successCount: 0,
    failureCount: 0,
    opportunityCount: 0,
    lastRunAtIso: null,
    ...overrides,
  });
}

test("activity intensity reserves only a small bounded exploration allowance", () => {
  assert.equal(opportunitySourceExplorationSlots("paused", 15), 0);
  assert.equal(opportunitySourceExplorationSlots("light", 3), 1);
  assert.equal(opportunitySourceExplorationSlots("balanced", 8), 2);
  assert.equal(opportunitySourceExplorationSlots("high", 15), 3);
  assert.equal(opportunitySourceExplorationSlots("high", 1), 1);
});

test("selection favours useful evidence over a static high priority failure loop", () => {
  const result = selectOpportunitySources({
    sources: [
      source("reliable-source", {
        priority: 65,
        successCount: 8,
        failureCount: 1,
        opportunityCount: 12,
        lastRunAtIso: "2026-07-24T04:00:00.000Z",
      }),
      source("failing-source", {
        priority: 100,
        successCount: 0,
        failureCount: 12,
        opportunityCount: 0,
        lastRunAtIso: "2026-07-25T22:00:00.000Z",
      }),
    ],
    limit: 1,
    explorationSlots: 0,
    now: NOW,
  });

  assert.equal(result.contractVersion, OPPORTUNITY_SOURCE_SELECTION_VERSION);
  assert.equal(result.selected[0]?.source.id, "reliable-source");
  assert.equal(result.selected[0]?.mode, "exploit");
  assert.ok((result.selected[0]?.score ?? 0) > (result.selected[1]?.score ?? -1));
});

test("one novel source is explored without displacing the entire useful set", () => {
  const result = selectOpportunitySources({
    sources: [
      source("proven-one", {
        priority: 85,
        successCount: 10,
        failureCount: 1,
        opportunityCount: 18,
        lastRunAtIso: "2026-07-25T04:00:00.000Z",
      }),
      source("proven-two", {
        priority: 75,
        successCount: 6,
        failureCount: 1,
        opportunityCount: 8,
        lastRunAtIso: "2026-07-24T04:00:00.000Z",
      }),
      source("novel-high", { priority: 80 }),
      source("novel-low", { priority: 20 }),
    ],
    limit: 3,
    explorationSlots: 1,
    now: NOW,
  });

  assert.deepEqual(
    result.selected.map((item) => [item.source.id, item.mode]),
    [
      ["novel-high", "explore"],
      ["proven-one", "exploit"],
      ["proven-two", "exploit"],
    ],
  );
  assert.equal(result.explorationSelected, 1);
  assert.equal(result.exploitationSelected, 2);
});

test("stale sources receive a bounded revisit boost and ties remain deterministic", () => {
  const result = selectOpportunitySources({
    sources: [
      source("source-b", {
        priority: 50,
        successCount: 1,
        failureCount: 1,
        lastRunAtIso: "2026-07-19T04:00:00.000Z",
      }),
      source("source-a", {
        priority: 50,
        successCount: 1,
        failureCount: 1,
        lastRunAtIso: "2026-07-19T04:00:00.000Z",
      }),
      source("recent-source", {
        priority: 50,
        successCount: 1,
        failureCount: 1,
        lastRunAtIso: "2026-07-26T03:30:00.000Z",
      }),
    ],
    limit: 3,
    explorationSlots: 0,
    now: NOW,
  });

  assert.deepEqual(
    result.selected.map((item) => item.source.id),
    ["source-a", "source-b", "recent-source"],
  );
});

test("invalid, duplicate or future-dated source state fails closed", () => {
  assert.throws(
    () => selectOpportunitySources({
      sources: [source("duplicate-source"), source("duplicate-source")],
      limit: 1,
      explorationSlots: 0,
      now: NOW,
    }),
    /OPPORTUNITY_SOURCE_SELECTION_DUPLICATE_SOURCE/,
  );
  assert.throws(
    () => selectOpportunitySources({
      sources: [source("future-source", { lastRunAtIso: "2026-07-26T04:02:00.000Z" })],
      limit: 1,
      explorationSlots: 0,
      now: NOW,
    }),
    /OPPORTUNITY_SOURCE_SELECTION_SOURCE_INVALID/,
  );
  assert.throws(
    () => selectOpportunitySources({
      sources: [source("bad-count", { failureCount: -1 })],
      limit: 1,
      explorationSlots: 0,
      now: NOW,
    }),
    /OPPORTUNITY_SOURCE_SELECTION_SOURCE_INVALID/,
  );
});

test("zero limit returns an empty immutable decision without selecting work", () => {
  const result = selectOpportunitySources({
    sources: [source("unused-source")],
    limit: 0,
    explorationSlots: 0,
    now: NOW,
  });
  assert.equal(result.selected.length, 0);
  assert.equal(result.requested, 0);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.selected));
});
