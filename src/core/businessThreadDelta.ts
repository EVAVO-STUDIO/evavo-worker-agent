export const BUSINESS_THREAD_DELTA_CONTRACT = "business_thread_delta_v1" as const;

export type ThreadStateItem = Readonly<{
  id: string;
  kind: "question" | "request" | "commitment" | "meeting" | "issue" | "decision" | "document" | "other";
  statement: string;
  status: "open" | "resolved" | "cancelled" | "superseded" | "acknowledged" | "uncertain";
  owner?: "evavo" | "counterparty" | "shared" | "unknown" | null;
  sourceEvidenceIds: readonly string[];
}>;

export type ThreadDeltaInput = Readonly<{
  threadId: string;
  previousState: readonly ThreadStateItem[];
  latestObservedState: readonly ThreadStateItem[];
}>;

export type ThreadDelta = Readonly<{
  contract: typeof BUSINESS_THREAD_DELTA_CONTRACT;
  threadId: string;
  newItems: readonly ThreadStateItem[];
  changedItems: readonly Readonly<{ before: ThreadStateItem; after: ThreadStateItem }>[];
  resolvedItems: readonly ThreadStateItem[];
  cancelledItems: readonly ThreadStateItem[];
  supersededItems: readonly ThreadStateItem[];
  stillOpenItems: readonly ThreadStateItem[];
  liveResponseTargets: readonly ThreadStateItem[];
}>;

export function buildBusinessThreadDelta(input: ThreadDeltaInput): ThreadDelta {
  const before = new Map(input.previousState.map((item) => [item.id, item] as const));
  const after = new Map(input.latestObservedState.map((item) => [item.id, item] as const));
  const newItems: ThreadStateItem[] = [];
  const changedItems: Array<{ before: ThreadStateItem; after: ThreadStateItem }> = [];
  const resolvedItems: ThreadStateItem[] = [];
  const cancelledItems: ThreadStateItem[] = [];
  const supersededItems: ThreadStateItem[] = [];

  for (const item of input.latestObservedState) {
    const prior = before.get(item.id);
    if (!prior) newItems.push(item);
    else if (prior.status !== item.status || prior.statement !== item.statement || prior.owner !== item.owner) {
      changedItems.push({ before: prior, after: item });
    }
    if (item.status === "resolved") resolvedItems.push(item);
    if (item.status === "cancelled") cancelledItems.push(item);
    if (item.status === "superseded") supersededItems.push(item);
  }

  const stillOpenItems = input.latestObservedState.filter((item) => item.status === "open" || item.status === "uncertain");
  const liveResponseTargets = stillOpenItems.filter((item) =>
    item.kind === "question"
    || item.kind === "request"
    || item.kind === "commitment"
    || item.kind === "issue"
    || item.kind === "decision"
    || item.kind === "document"
  );

  // Missing old ids are intentionally not treated as resolved; disappearance is not evidence of resolution.
  void after;

  return Object.freeze({
    contract: BUSINESS_THREAD_DELTA_CONTRACT,
    threadId: input.threadId,
    newItems: Object.freeze(newItems),
    changedItems: Object.freeze(changedItems),
    resolvedItems: Object.freeze(resolvedItems),
    cancelledItems: Object.freeze(cancelledItems),
    supersededItems: Object.freeze(supersededItems),
    stillOpenItems: Object.freeze(stillOpenItems),
    liveResponseTargets: Object.freeze(liveResponseTargets),
  });
}
