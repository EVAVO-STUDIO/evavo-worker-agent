export const BUSINESS_THREAD_DELTA_CONTRACT = "business_thread_delta_v1" as const;

export type ThreadStateItem = Readonly<{
  id: string;
  kind: "question" | "request" | "commitment" | "meeting" | "issue" | "decision" | "document" | "other";
  statement: string;
  status: "open" | "resolved" | "cancelled" | "superseded" | "acknowledged" | "uncertain";
  owner?: "evavo" | "counterparty" | "shared" | "unknown" | null;
  sourceEvidenceIds: readonly string[];
  lastObservedAt?: string | null;
  quotedHistory?: boolean;
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
  disappearedWithoutResolution: readonly ThreadStateItem[];
  nextActionOwner: "evavo" | "counterparty" | "shared" | "unknown" | "none";
}>;

function validateItem(item: ThreadStateItem): ThreadStateItem {
  if (!item.id.trim()) throw new Error("THREAD_DELTA_ITEM_ID_REQUIRED");
  if (!item.statement.trim()) throw new Error("THREAD_DELTA_STATEMENT_REQUIRED");
  const sourceEvidenceIds = Object.freeze([...new Set(item.sourceEvidenceIds.map((value) => value.trim()).filter(Boolean))]);
  if (!sourceEvidenceIds.length) throw new Error("THREAD_DELTA_EVIDENCE_REQUIRED");
  if (item.lastObservedAt && Number.isNaN(Date.parse(item.lastObservedAt))) throw new Error("THREAD_DELTA_LAST_OBSERVED_AT_INVALID");
  return Object.freeze({
    ...item,
    statement: item.statement.trim(),
    sourceEvidenceIds,
  });
}

function meaningful(item: ThreadStateItem): boolean {
  if (item.quotedHistory) return false;
  return item.kind === "question"
    || item.kind === "request"
    || item.kind === "commitment"
    || item.kind === "issue"
    || item.kind === "decision"
    || item.kind === "document"
    || item.kind === "meeting";
}

export function buildBusinessThreadDelta(input: ThreadDeltaInput): ThreadDelta {
  if (!input.threadId.trim()) throw new Error("THREAD_DELTA_THREAD_ID_REQUIRED");
  const previous = input.previousState.map(validateItem);
  const latest = input.latestObservedState.map(validateItem);
  const before = new Map(previous.map((item) => [item.id, item] as const));
  const after = new Map(latest.map((item) => [item.id, item] as const));
  if (before.size !== previous.length || after.size !== latest.length) throw new Error("THREAD_DELTA_DUPLICATE_ITEM_ID");

  const newItems: ThreadStateItem[] = [];
  const changedItems: Array<{ before: ThreadStateItem; after: ThreadStateItem }> = [];
  const resolvedItems: ThreadStateItem[] = [];
  const cancelledItems: ThreadStateItem[] = [];
  const supersededItems: ThreadStateItem[] = [];

  for (const item of latest) {
    const prior = before.get(item.id);
    if (!prior) {
      if (!item.quotedHistory) newItems.push(item);
    } else if (prior.status !== item.status || prior.statement !== item.statement || prior.owner !== item.owner) {
      changedItems.push({ before: prior, after: item });
    }
    if (item.status === "resolved") resolvedItems.push(item);
    if (item.status === "cancelled") cancelledItems.push(item);
    if (item.status === "superseded") supersededItems.push(item);
  }

  const disappearedWithoutResolution = previous.filter((item) => !after.has(item.id) && (item.status === "open" || item.status === "uncertain"));
  const stillOpenItems = latest.filter((item) => !item.quotedHistory && (item.status === "open" || item.status === "uncertain"));
  const liveResponseTargets = stillOpenItems.filter(meaningful);

  const ownerPriority = ["evavo", "shared", "counterparty", "unknown"] as const;
  const nextActionOwner = ownerPriority.find((owner) => liveResponseTargets.some((item) => (item.owner ?? "unknown") === owner)) ?? "none";

  return Object.freeze({
    contract: BUSINESS_THREAD_DELTA_CONTRACT,
    threadId: input.threadId.trim(),
    newItems: Object.freeze(newItems),
    changedItems: Object.freeze(changedItems),
    resolvedItems: Object.freeze(resolvedItems),
    cancelledItems: Object.freeze(cancelledItems),
    supersededItems: Object.freeze(supersededItems),
    stillOpenItems: Object.freeze(stillOpenItems),
    liveResponseTargets: Object.freeze(liveResponseTargets),
    disappearedWithoutResolution: Object.freeze(disappearedWithoutResolution),
    nextActionOwner,
  });
}
