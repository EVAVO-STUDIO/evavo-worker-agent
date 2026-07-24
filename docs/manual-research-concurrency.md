# Manual research concurrency

## Purpose

Authenticated confirmation authorises one bounded manual research action. It does not imply that the same action may safely run multiple times concurrently.

The Worker uses atomic, expiring D1 leases to prevent duplicate broad research runs and conflicting per-source research actions.

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

## Expiry

Lease time-to-live values are bounded between 30 and 1,800 seconds. Current broad manual research routes use 600- or 900-second leases.

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

Opportunity source test, preview and commit-preview routes share a key based on the source identifier:

```text
opportunity-source:<source-id>
```

That shared key prevents a source test and a source commit from racing each other.

Metadata-only reads, query-hint generation and internal learning do not acquire public-research network leases unless they invoke the bounded public fetch boundary.

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
- bypass route authentication or confirmation;
- expose lease tokens;
- act as approval for drafting, sending, posting or external mutation;
- permit a stale holder to release a newer lease;
- silently continue when acquisition fails.
