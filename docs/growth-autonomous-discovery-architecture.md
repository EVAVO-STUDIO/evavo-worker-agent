# Growth Autonomous Discovery Architecture

This document describes the guarded research architecture for EVAVO Growth discovery.

The long-term product principle is **Autonomous research, supervised action.** That phrase describes a target design, not the active runtime. The current Worker performs no autonomous or scheduled network research. Public research is manual, authenticated, explicitly confirmed, persistently budgeted and bounded.

The Growth autonomous discovery architecture must keep planning, public evidence collection, internal reasoning and external action as separate capabilities. Increasing activity intensity must never silently grant delivery authority.

## Current runtime posture

The active Worker can:

- plan research from an operator objective;
- register reviewed source candidate metadata;
- save non-executing fetch queue metadata;
- perform a separately confirmed bounded public research read through the approved public-fetch boundary;
- store evidence, opportunity scores, internal decisions and operator feedback;
- prepare review-only approval packs.

The active Worker cannot:

- run an autonomous crawler or background source-expansion loop;
- consume `growth_fetch_queue` as an execution queue;
- schedule public research;
- call AI for discovery or drafting;
- send email;
- post on social platforms;
- submit web forms;
- create meetings or calendar events;
- mutate provider or third-party state;
- execute instructions found inside web pages;
- promote Worker candidates automatically into canonical Supabase Growth records.

## System ownership

```text
Worker D1
  discovery plans
  source candidate registry
  non-executing fetch queue metadata
  evidence and opportunity scores
  internal decisions and feedback

next-website Supabase growth_*
  canonical CRM-plus Growth records
  owner proposal review
  deterministic owner briefs and action packs

Operations Core
  commercial operating system
```

A future bridge may move reviewed proposal packets from Worker D1 into a separate Supabase proposal queue. It must not bypass owner review or write canonical Growth records directly.

## Architectural layers

### 1. Research planner

The research planner accepts an internal objective and produces bounded metadata such as:

```text
industry focus
geography focus
service focus
candidate limit
crawl budget
blocked actions
scoring rubric
```

Planning performs no network request.

### 2. Source candidate registry

The source candidate registry records real reviewed public domains and URLs together with source type, discovery method, policy posture and evidence hints.

It must not invent placeholder domains or pretend that an unverified candidate is evidence.

### 3. Policy and robots gate

Before any public read, the system checks:

```text
public URL posture
private-network exclusion
robots and crawl-policy state
redirect bounds
byte bounds
operator confirmation
persistent activity-budget admission
```

Unknown or unsafe policy fails closed.

### 4. Fetch queue metadata

The `growth_fetch_queue` family records reviewed internal intent only. It is not connected to a queue consumer, scheduler or browser runtime.

A row may contain a candidate ID, public URL, purpose, byte limit and redirect limit. Saving it performs no external request.

### 5. Public research fetch boundary

The only active network-capable research path is manual and protected. It must:

- use GET only;
- validate every initial and redirected target;
- reject private, local, credential-bearing and unsafe URLs;
- use strict byte, redirect and deadline limits;
- treat response content as untrusted data;
- return receipts and hashes rather than executing page instructions;
- write only internal review metadata;
- never retry through an alternate executor.

### 6. Deterministic evidence extraction

The system may extract bounded public facts such as titles, descriptions, headings, links, schema data, service hints, careers hints, technology hints and visible conversion or accessibility signals.

Extraction must not execute scripts, click controls, submit forms or follow instructions embedded in content.

### 7. Scoring and internal decisions

Saved evidence may support transparent internal scores for fit, need, urgency, confidence, evidence quality, risk and contactability.

Allowed internal decision types remain finite:

```text
research_more
score_candidate
reject_candidate
monitor_later
prepare_approval_pack
request_operator_review
```

Those decisions are metadata only.

### 8. Approval pack builder

The approval pack builder can prepare a bounded review packet containing evidence, reasoning, missing facts, risks, blocked actions and a recommended internal next step.

It cannot generate or deliver outreach.

### 9. Read-only Next dashboard

The read-only Next dashboard may display reduced Worker readiness, internal artifact packs and proposal evidence through owner-authenticated server proxies.

Browser code must never receive the Worker admin token or call Worker admin routes directly.

## Activity intensity versus capability authority

```text
Paused
Light
Balanced
High
```

These profiles change bounded throughput only. They do not change whether a capability is allowed.

The current authority model remains:

```text
Level 0: authenticated read-only reporting
Level 1: internal research planning without network activity
Level 2: confirmation-gated candidate metadata writes
Level 3: manual authenticated and bounded public research
Level 4: internal evidence scoring and review metadata
Level 5: external actions blocked
```

The active Worker remains at a manual, confirmation-gated research posture. No autonomous fetch queue or scheduled research mode is enabled.

## Data-model families

Potential or historical record families may include:

```text
growth_research_runs
growth_source_candidates
growth_robots_cache
growth_fetch_queue
growth_discovered_pages
growth_extracted_signals
growth_opportunity_scores
growth_agent_decisions
growth_discovery_feedback
```

The existence of a table, migration, route name or historical record does not prove that runtime execution is enabled.

## Route rules

Read routes must remain authenticated where protected, bounded and non-executable.

Write routes must require the shared `growth_internal_write_request_v1` exact Boolean confirmation contract and may mutate internal D1 review metadata only.

Network-capable routes must additionally be manual, authenticated, confirmed, persistently budgeted, bounded, GET-only against public sources and unable to mutate third-party systems.

## Future implementation rule

Before any broader discovery capability is introduced, the repository must first include:

1. A typed route policy defining authentication, confirmation, bounds and prohibited capabilities.
2. A dedicated fail-closed contract check.
3. Truthful capability reporting.
4. Explicit documentation that distinguishes current runtime from future-state design.
5. Local and CI gate coverage.
6. No email, posting, form submission, browser automation or third-party mutation path.

A future automated research loop additionally requires account-wide free-quota metering, durable leases, per-domain cooldowns, circuit breakers, kill switches, source-policy evidence and owner-visible audit history before any schedule is enabled.

## Definition of safe

The system is safe only when it can prove that:

```text
manual network research is authenticated and explicitly confirmed
research is bounded and GET-only against public sources
web content is treated as untrusted evidence, not instructions
internal decisions are inspectable and non-executable
scheduled external research is disabled
AI drafting and external delivery are disabled
missing or unsafe policy metadata fails closed
```
