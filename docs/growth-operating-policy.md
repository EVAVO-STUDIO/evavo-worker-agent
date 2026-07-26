# Growth Operating Policy

Date: 2026-07-26

The Growth runtime must be useful enough to perform the recurring thinking of a Growth manager, business development manager, sales manager, account manager, business analyst and marketing manager without confusing activity with value.

The core rule is:

> Activity is not authority.

A higher activity setting may research more sources, refresh more evidence and prepare more internal work. It does not automatically gain permission to contact people, publish publicly, modify a provider or spend money.

## Three independent controls

### Activity level

Activity controls volume, cadence and internal resource budgets.

```text
paused   no work
light    two bounded scheduled runs per day
balanced six bounded scheduled runs per day
active   twelve bounded scheduled runs per day
lab      manual-only experiments with no outbound drafts or actions
```

The runtime may degrade an active level before hard exhaustion. Missing or stale usage telemetry pauses scheduled work.

### Autonomy level

Authority controls what the runtime may do with the work it prepares.

```text
observe   research, score and report internally
draft     observe plus prepare emails, posts, comments, assets and provider changes
approval  external actions require an explicit approval
trusted   narrowly allowlisted external actions may run inside a pre-approved scope
```

Trusted mode is not a blanket permission. It requires all of:

- `allowTrustedExternalActions: true`;
- a bounded trusted scope;
- an allowlisted target;
- confirmed platform-policy compatibility;
- available cost and activity budget.

Meetings always require explicit owner approval. This preserves the requested workflow where the system proposes suitable times, checks with Greg and only then confirms the meeting.

Public posting and commenting should remain approval-gated until a specific channel, identity, campaign, content policy and moderation rule have been reviewed. Provider write-back follows the same principle.

### Cost mode

The first and only cost mode is:

```text
free_only
```

The Free-only cost governor rejects any action estimate containing:

- a paid model call;
- a paid API call;
- paid queue operations;
- browser-rendering time;
- advertising spend;
- any other positive estimated monetary cost.

Advertising spend is blocked even when an approval flag is present. The system may prepare a campaign plan, asset brief or draft, but it may not spend.

## No telemetry, no scheduled run

Free-only automation cannot safely infer that capacity remains. Scheduled work therefore requires current daily usage counters. Missing or stale counters fail closed.

The policy uses conservative internal budgets for Worker invocations, external fetches, D1 rows read, D1 rows written, candidates, drafts and external actions. Those budgets are deliberately much smaller than a typical platform ceiling, but they are not copied from a mutable provider marketing page.

Cloudflare account usage is shared capacity. Other applications, retries, attacks or operational traffic may consume the same account-level allowance. A future production governor should combine its own durable ledger with provider-visible usage where available and preserve a substantial reserve.

This contract is not a billing guarantee. The reliable guarantee comes from all of the following together:

1. No paid provider or paid feature is configured.
2. Every scheduled action passes the free-only governor.
3. Current usage telemetry is available.
4. A conservative internal hard limit is enforced.
5. Work stops before the account-level free allowance is approached.
6. Billing alerts and provider limits remain enabled outside the application.

## Autonomous internal work

The following classes can run automatically when activity and cost budgets allow:

- discover public sources;
- fetch a bounded public page;
- scan a small allowlisted site surface;
- score a candidate;
- compare evidence;
- generate a deterministic internal report;
- propose meeting slots from known availability.

These operations still need source-health controls, robots and terms awareness, duplicate detection, evidence timestamps, confidence calibration and source backoff.

## Approval-gated external work

The following work remains separate from internal automation:

- send an email;
- create or confirm a calendar meeting;
- publish a social post;
- publish a public comment;
- publish an asset or video;
- write back to HubSpot or another CRM provider.

The system may prepare those actions automatically. Execution requires an explicit approval or a narrowly configured trusted scope. An allowlist and platform-policy confirmation are required in either case.

## Human-quality communication

A future communication profile should be versioned independently from activity and authority. It should define:

- EVAVO and Greg voice rules;
- preferred greeting, length and structure;
- prohibited generic sales language;
- Australian spelling;
- channel-specific tone;
- follow-up spacing and stop conditions;
- claims that require evidence;
- confidentiality and privacy rules;
- when to ask Greg rather than improvise.

Learning should update measured preferences and outcomes, not silently rewrite the voice contract. Suggested changes should be reviewable and reversible.

## Role coverage

The operating model is intended to cover valuable internal work normally distributed across several roles.

### Growth manager

- source and channel experiments;
- acquisition and conversion hypotheses;
- evidence-backed reporting;
- experiment prioritisation;
- performance anomaly review.

### Business development manager

- account discovery;
- opportunity signals;
- relationship maps;
- outreach drafts;
- meeting proposals;
- follow-up queues.

### Sales manager

- pipeline hygiene;
- qualification;
- stage risk;
- next-best actions;
- forecast evidence;
- stalled-deal exceptions.

### Account manager

- account health;
- commitments and follow-ups;
- meeting preparation;
- agenda and note drafts;
- renewal and expansion signals;
- service-risk escalation.

### Business analyst

- source reconciliation;
- process gaps;
- requirements and decision logs;
- structured reports;
- impact and dependency analysis.

### Marketing manager

- audience and message research;
- content plans;
- channel-specific drafts;
- campaign briefs;
- performance summaries;
- brand and policy checks.

## Source discovery standard

The runtime should not reward raw crawl volume. A source is valuable when it provides new, timely, attributable evidence that changes a decision.

A future source-quality memory should track:

```text
last attempted
last successful
new evidence rate
duplicate rate
error rate
robots or policy posture
average confidence
candidate conversion rate
owner usefulness feedback
backoff-until time
```

Low-yield or failing sources should back off automatically. Novel sources may receive a small bounded exploration budget. No source should receive unlimited crawling.

## Current implementation boundary

`growth_operating_policy_v1` is a pure decision contract. It does not:

- fetch;
- schedule;
- persist;
- send email;
- create meetings;
- publish posts or comments;
- spend money;
- promote canonical Growth records;
- enable the Worker bridge.

Those capabilities must call this policy before work begins and again immediately before any external side effect.
