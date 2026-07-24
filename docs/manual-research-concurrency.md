# Manual research concurrency

## Purpose

Authenticated confirmation authorises one bounded manual research action. It does not imply that the same action may safely run multiple times concurrently.

The Worker uses atomic, expiring D1 leases to prevent duplicate broad research runs, conflicting per-source research and source-health actions, and duplicate query-hint resolution writes.

This control does not create background work, scheduled retries or external execution.

## Authoritative implementation

```text
src/core/manualResearchLease.ts
```

The lease contract is:

```text
manual_research_lease_v1
```

The focused regression gate is:

```text
npm run research:manual-lease-safety:check
```

## Atomic acquisition

Leases are stored in the existing internal `settings` table under the prefix:

```text
manual-research-lease:
```

Acquisition uses one SQLite `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE` statement. The statement may replace an existing lease only when its stored expiry is no later than the acquisition time.

There is no read-then-write acquisition path. Two concurrent requests cannot both acquire the same unexpired action key.

No migration or remote D1 mutation is required merely to introduce the lease code. A lease row is created only when an authenticated, explicitly confirmed route is actually invoked.

## Confirmation ordering

A route authenticates and validates its bounded JSON body before entering a lease-protected action.

Exact `confirm: true` is required before the lease is acquired. Invalid media types, oversized bodies, malformed JSON and coerced confirmation values fail without creating a lease row.

A lease is an exclusion primitive only. It is not confirmation and cannot replace confirmation.

## Expiry

Lease time-to-live values are bounded between 30 and 1,800 seconds.

Current route TTLs are:

```text
query-hint resolution: 300 seconds
per-source actions and tiny batches: 600 seconds
broad opportunity, source-expansion and sitemap scans: 900 seconds
```

Expiry is a recovery boundary for interrupted requests. It is not a scheduler and does not trigger a retry.

A route always attempts to release its lease in a `finally` block. Release deletes the row only when the stored lease value exactly matches the current holder. An expired holder cannot delete a newer lease acquired for the same action.

## Scope

Broad actions use distinct action keys, including:

```text
opportunity-run-due
source-expansion-scan
source-expansion-sitemap-scan
source-expansion-relationship-graph
sources-run-tiny
```

Opportunity source test, preview, commit-preview and source-health routes share a key based on the source identifier:

```text
opportunity-source:<source-id>
```

That shared key prevents:

- a source test from racing a preview or commit;
- a source-health pause, activation, priority change or error reset from racing research on the same source;
- a broad confirmed opportunity run from updating source health while an operator is changing the same source;
- two source-health writes from producing inconsistent audit history.

A confirmed source-health action batches the `opportunity_sources` mutation and its `events` audit record in one D1 transaction. The audit uses `lead_id = NULL`; source review metadata is stored in the bounded event message rather than overloading the historical lead relationship.

The historical source-management family uses a separate per-source key:

```text
legacy-source:<source-id>
```

This prevents a legacy source test, expansion commit, cooldown, retirement or activation from overwriting the same source concurrently.

Query-hint URL resolution uses a per-hint key:

```text
query-hint-resolve:<hint-id>
```

The candidate upserts and hint usage counters then commit in one D1 transaction. Query-hint generation and internal learning remain metadata-only and do not acquire a public-research network lease.

## Conflict response

A conflicting request returns HTTP `409` with:

```text
error: research_action_in_progress
retryable: true
automaticRetryAllowed: false
scheduledFallbackAllowed: false
externalExecutionAllowed: false
contract: manual_research_lease_v1
```

The response never exposes the lease token or stored value.

`retryable: true` means an operator may deliberately try again later. It does not authorise an automatic retry executor.

## Prohibited behaviour

The lease system must never:

- enqueue a retry;
- trigger scheduled research;
- create a background crawler;
- bypass route authentication, bounded-body validation or confirmation;
- expose lease tokens;
- act as approval for drafting, sending, posting or external mutation;
- permit a stale holder to release a newer lease;
- silently continue when acquisition fails.
