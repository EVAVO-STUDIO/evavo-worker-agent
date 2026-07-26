# Growth Zero-Cost Operating Envelope

Date: 2026-07-26

Contract:

```text
growth_zero_cost_envelope_v1
```

The Growth Worker is designed to reserve only a conservative portion of Cloudflare's current free allocations while keeping paid services, AI inference, browser runtime and external execution disabled.

This is a usage policy and fail-closed runtime contract. It is not a promise that the Cloudflare account can never be billed.

## Why the system cannot honestly guarantee a zero bill by itself

Repository code does not know:

- whether the Cloudflare account is currently on Workers Free or Workers Paid;
- usage created by other Workers, D1 clients, Queues, KV, Browser Run or Workers AI workloads;
- current D1 storage consumption;
- dashboard, Wrangler or REST operations performed outside this Worker;
- future Cloudflare pricing or quota changes.

Therefore the machine-readable contract exposes:

```text
requiredCloudflarePlan: workers_free
paidOverageAllowed: false
absoluteZeroCostGuaranteed: false
accountWideUsageKnown: false
accountPlanVerifiedAtRuntime: false
```

This is deliberate. A truthful uncertainty flag is safer than a false `$0 guaranteed` claim.

## Current free-limit snapshot

The reviewed snapshot is dated `2026-07-26` and must be reviewed again by `2026-10-01` or earlier if Cloudflare changes pricing or limits.

Current official free allocations represented by the contract include:

- 100,000 Worker requests per day;
- 10 milliseconds of CPU time per invocation;
- 50 external subrequests per invocation;
- 1,000 Cloudflare-service subrequests per invocation;
- five Cron Triggers per account;
- 5,000,000 D1 rows read per day;
- 100,000 D1 rows written per day;
- 5 GB total D1 storage and 500 MB per free database;
- 10,000 Queue operations per day with 24-hour retention;
- 100,000 KV reads and 1,000 KV writes per day;
- 10,000 Workers AI neurons per day;
- 10 Browser Run minutes per day and three concurrent browser sessions.

The source URLs are stored in `src/core/growthZeroCostEnvelope.ts` so future reviews can update the contract and tests together.

## EVAVO reservation ceiling

The Growth Worker hard envelope reserves at most:

```text
Worker requests/day                  5,000 of 100,000   5%
external subrequests/invocation         15 of 50       30%
D1 rows read/day                    500,000 of 5,000,000 10%
D1 rows written/day                  10,000 of 100,000 10%
Queue operations/day                  1,000 of 10,000 10%
Workers AI neurons/day                    0
Browser Run minutes/day                   0
paid-service calls/day                    0
external actions/day                      0
```

The extra account headroom is intentional. It leaves room for other EVAVO Workers and avoids treating one product's theoretical maximum as the whole account allowance.

## Activity profiles

The owner-selectable profiles are:

```text
paused
light
balanced
high
```

`High` means more bounded internal work and confirmed public research. It does not mean AI, browser automation, sending, posting, form submission, calendar mutation, provider write-back or autonomous campaigns.

Every named profile must retain:

```text
scheduledExternalResearchRunsPerDay: 0
aiCallsPerDay: 0
browserMinutesPerDay: 0
paidServiceCallsPerDay: 0
externalActionsPerDay: 0
```

## Requirements before enabling free AI or browser capacity

Even though Cloudflare currently advertises free allocations for Workers AI and Browser Run, neither is enabled in the Growth budget. Before either can be admitted, the system must:

1. verify the account cannot incur overage;
2. add a persistent account-aware neuron or browser-minute ledger;
3. reserve headroom for other account workloads;
4. fail closed before the free allocation is exhausted;
5. expose the selected activity profile and measured usage to the owner;
6. retain a one-click kill switch;
7. keep all external state changes in a separate approval and execution contract.

## External communication and social channels

Email, comments, social posts, forum posts, forms, calendar events and provider writes are not part of this zero-cost research envelope.

Future channel adapters require separate contracts for:

- channel ownership and authentication;
- consent, suppression and unsubscribe rules;
- reputation and frequency controls;
- platform API and terms compliance;
- recipient and thread identity;
- approval level and policy reason;
- idempotency and replay protection;
- audit, rollback or compensating action;
- a channel-specific kill switch.

A higher activity profile must never bypass those controls.

## Validation

Run:

```powershell
cd C:\GitRepos\evavo-worker-agent
node scripts/check-growth-zero-cost-envelope.mjs
npm run test:core
npm run check:local
npm run typecheck
```

The contract is exposed through the protected Growth capability response. It remains server/operator-only and does not enable the proposal bridge, Worker delivery, canonical promotion or external execution.
