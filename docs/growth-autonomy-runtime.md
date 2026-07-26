# Growth Zero-Cost Autonomy Runtime

Date: 2026-07-26

## Purpose

The Growth runtime turns `growth_autonomy_policy_v1` from a dashboard preference into an enforceable Worker boundary.

It is designed for an EVAVO owner-operated Growth, business-development, sales, account-management and marketing assistant that can research, compare, qualify, draft and report with minimal setup while remaining conservative about cost and public actions.

The runtime contracts are:

```text
growth_autonomy_policy_v1
growth_autonomy_runtime_v1
growth_autonomy_d1_ledger_v1
```

## No-setup posture

Light is the no-setup default.

Light permits one focused daily research pass, one report slot and draft-only email, meeting and social preparation. Public comments are disabled.

Balanced and High permit more bounded internal research, but they do not enable unrestricted external execution.

Paused is the immediate stop profile.

## Hard zero-cost firewall

Every profile preserves:

```text
paidServicesAllowed: false
maxPaidSpendCentsPerMonth: 0
failClosedWhenUsageUnknown: true
automaticExternalExecutionAllowed: false
paidAdvertising: disabled
providerWriteback: disabled
```

A run is rejected before D1 reservation when:

- the profile is Paused;
- the current local time is inside policy quiet hours;
- usage state is unknown;
- any estimated paid spend is detected;
- the durable ledger is unavailable;
- the daily run limit has been reached;
- a requested report slot would exceed the daily report limit.

## Durable reservation sequence

### Run reservation

Before research starts, `GrowthAutonomyD1Ledger.reserve` uses a bounded D1 batch to:

1. create or conditionally advance the organisation/workspace/day usage window;
2. enforce the profile's daily run ceiling;
3. enforce the exact zero-paid-spend window constraint;
4. refuse duplicate `run_id` inflation;
5. insert an opaque expiring run reservation only when the window admitted it.

The run ID is unique. A legitimate replay returns the existing reservation without incrementing the daily counter.

### Report reservation

A run declares whether it plans to produce a report.

When `reportPlanned` is true, the same atomic window update reserves one daily report slot. This prevents three Balanced research passes or six High research passes from each independently consuming the full daily report budget.

A research-only run may continue without a report slot, but the in-memory session rejects any later attempt to record a generated report.

### Per-run usage meter

A verified session meters:

- sources visited;
- outbound network requests;
- candidates created;
- reports generated;
- CPU milliseconds reported by the caller;
- D1 rows read;
- D1 rows written;
- storage bytes created.

The session starts with conservative D1 read/write overhead for its own reservation and completion path.

A counter increment that would exceed the selected profile fails before mutating the session's usage state.

### Usage application

Completion uses a three-statement D1 batch:

1. transition the reservation from `active` to `completed` or `failed`, while permitting the exact same completion as an idempotent retry;
2. apply measured usage to the daily window only when `usage_applied = 0`;
3. mark the reservation usage as applied.

A conflicting completion fails closed. A transient completion failure does not permanently finish the in-memory session, so the exact completion can be retried.

Expired unfinished reservations are intentionally not refunded. That conservative choice prevents failure loops from increasing free-tier risk.

## External-action boundary

The runtime can evaluate a requested action, but it does not implement a sender, poster, browser automator, calendar writer or CRM writer.

```text
Light:
  email, meeting, social post -> draft only
  public comment -> disabled

Balanced and High:
  email, meeting, social post, public comment -> owner approval required

Every profile:
  paid advertising -> disabled
  provider write-back -> disabled
  unrestricted automatic external execution -> disabled
```

Action approval is action-specific. Approving one email does not approve a meeting, social post or future email.

Worker delivery remains disabled. The proposal bridge and owner queue remain separate from external communication adapters.

## Source discovery strategy

The eventual autonomous researcher should prioritise low-cost, permission-respecting sources:

- public RSS and Atom feeds;
- XML sitemaps and explicitly linked public pages;
- public procurement and government feeds;
- public organisation, council, university and venue websites;
- existing CRM domains and owner-provided seed organisations;
- bounded link-graph expansion from already validated sources;
- public APIs whose terms and free allowance explicitly permit the use;
- cached source metadata and conditional requests.

It should not depend on paid search APIs, headless browser rendering or uncontrolled crawling to produce useful baseline results.

Novel exploration should be bounded by source novelty, domain reputation, tenant relevance, deduplication and the current run budget. Failed or low-value sources should receive a cooldown rather than being retried repeatedly.

## No absolute account-wide cost guarantee

Application-level metering can keep this Worker far below its own configured ceilings, but it cannot prove that an entire Cloudflare account will never incur cost.

Other Workers, D1 databases, R2 buckets, third-party APIs, plan changes, billing configuration and provider pricing sit outside this runtime's direct control.

For that reason:

- internal limits are intentionally much lower than provider allowances;
- paid service adapters are disabled by policy;
- unknown usage fails closed;
- account-level Cloudflare and provider usage alerts remain necessary;
- published free-tier values must never be hard-coded as a permanent entitlement;
- owner-visible usage summaries and emergency Pause remain required.

## Still unavailable

This runtime does not yet provide:

- a signed policy-sync path from `next-website` to Worker D1;
- a recurring scheduler or due-run planner;
- autonomous Worker-to-website proposal delivery;
- automatic email sending;
- automatic meeting booking;
- automatic forum, Reddit, YouTube, Instagram, Facebook, TikTok or other public posting/commenting;
- paid advertising;
- provider write-back;
- canonical Growth promotion.

Those capabilities must remain separate adapters with platform-specific terms, permissions, rate limits, idempotency, audit evidence and owner controls.
