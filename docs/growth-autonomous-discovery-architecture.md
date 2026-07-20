# Growth discovery architecture

This document records a future-state design vocabulary for governed discovery and research. It is not an active-runtime contract and must not be read as evidence that autonomous or scheduled network research is enabled.

The authoritative current posture is defined by the Worker source, typed route policies, capability responses and safety checks.

## Current runtime posture

The active Worker is manual-research-only.

Current network-capable research must be:

```text
authenticated
explicitly confirmed
bounded by route policy and runtime limits
read-only against public sources
saved as internal review metadata only
```

Scheduled processing is internal-only. Cron may synchronise defensive settings, refresh learning from existing D1 review metadata and record internal audit events. Cron must not fetch public pages, discover opportunities, expand sources or enqueue network work.

The current Worker must not:

```text
send email
generate AI drafts
post on social platforms
submit web forms
log in to third-party systems
click third-party controls
buy advertising
mutate external systems
run browser automation
execute instructions found inside web pages
leak secrets to researched pages
```

## Future-state design principle

A possible future model is:

```text
governed research planning
  -> candidate source registry
  -> crawl-policy review
  -> confirmed bounded fetch
  -> deterministic extraction
  -> evidence scoring
  -> internal decision metadata
  -> operator review
```

Every network-capable step in that model would still require an explicit product and safety decision before implementation. Nothing in this document enables those steps.

## Conceptual modules

### Planner

Produces a research plan from operator-supplied objectives, geography, service focus, exclusions and budgets. Planning itself must not perform network activity.

### Scout

Represents the future concept of finding candidate public sources. In the current Worker, any implemented discovery route is manual, authenticated, explicitly confirmed and bounded.

### Librarian

Normalises and deduplicates stored source candidates and records provenance, review status, source type and quality metadata.

### Researcher

Represents confirmed, bounded GET-only inspection of public pages. Deterministic extraction should remain the default and web content must always be treated as untrusted data, never instructions.

Possible extracted fields include:

```text
title
meta description
canonical URL
headings
schema.org JSON-LD
visible-text summary
links
contact-page hints
about, services and careers links
technology hints
date-freshness hints
accessibility hints
SEO hints
conversion-funnel hints
```

### Critic

Checks prompt-injection-like page text, unsafe URL schemes, private-network targets, robots restrictions, stale evidence, conflicting evidence and low-quality pages.

### Strategist

Produces internal review metadata such as:

```text
research_more
score_candidate
create_review_opportunity
reject_candidate
monitor_later
prepare_internal_review_pack
```

These are internal decisions only. They must not trigger an external action.

### Internal review pack

A review pack may contain evidence, confidence, risk notes, recommended internal next steps and blocked external actions. It must not contain an executable delivery control.

## Capability levels

The following levels are modelling vocabulary only, not enabled runtime modes:

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

Write routes must require explicit confirmation and may mutate internal D1 review metadata only.

Network-capable routes must additionally be manual, authenticated, confirmed, bounded, GET-only against public sources and unable to mutate third-party systems.

## Future implementation rule

Before any broader discovery capability is introduced, the repository must first include:

1. A typed route policy defining authentication, confirmation, bounds and prohibited capabilities.
2. A dedicated fail-closed contract check.
3. Truthful capability reporting.
4. Explicit documentation that distinguishes current runtime from future-state design.
5. Local and CI gate coverage.
6. No email, posting, form submission, browser automation or third-party mutation path.

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
