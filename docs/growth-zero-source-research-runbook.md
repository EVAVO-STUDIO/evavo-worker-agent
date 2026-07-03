# Growth zero-source research runbook

This runbook defines how EVAVO Growth Ops should research opportunities without the operator supplying a source list.

The system must discover, classify, score, and explain candidate sources while staying inside the autonomous research / supervised action boundary.

## Goal

Given an operator objective such as:

```text
Find promising Australian businesses that may need EVAVO website, UX, automation, analytics, gamification, or 3D/product-experience work.
```

The system should produce:

```text
research run record
source discovery plan
candidate source list
evidence signals
opportunity scores
agent decisions
approval packs for operator review
```

It must not contact anyone or mutate external systems.

## Run stages

### 1. Plan research

Create a research run with:

```text
objective
industry focus
geography focus
service focus
candidate limit
crawl budget
blocked actions
scoring rubric
```

Output should include a source discovery plan and a safety object.

### 2. Generate candidate discovery strategy

The planner should identify likely source types:

```text
company websites
industry directories
award pages
news mentions
public business directories
sitemap URLs
RSS feeds
job posts that imply growth
competitor/client-like sites
```

It should create search-query plans and source-type plans, but it should not execute broad crawling from the browser.

### 3. Register source candidates

Each candidate should store:

```text
domain
url
canonical_url
source_type
discovery_method
discovery_query
industry_hint
geo_hint
service_match_hint
status
risk_flags_json
created_at
updated_at
```

Initial statuses:

```text
planned
discovered
rejected
queued_for_policy_check
queued_for_research
researched
scored
needs_operator_review
```

### 4. Check crawl policy

Before fetching pages, the system must check and store:

```text
robots_url
robots_status
crawl_allowed
crawl_delay_seconds
last_checked_at
policy_reason
```

Unknown policy means do not fetch yet.

### 5. Queue fetch work

Fetch work must be queued and bounded.

Each queue item should include:

```text
candidate_id
url
purpose
max_bytes
max_redirects
created_at
status
attempt_count
last_error
```

### 6. Extract evidence

Extract deterministic signals first:

```text
title
meta description
headings
schema
links
contact/about/services/careers hints
technology hints
SEO hints
conversion hints
freshness hints
accessibility hints
analytics hints
```

### 7. Score opportunity

Score each candidate using visible dimensions:

```text
fit_score
need_score
urgency_score
budget_likelihood_score
contactability_score
website_weakness_score
strategic_value_score
confidence_score
evidence_quality_score
crawl_safety_score
```

Every score must cite evidence.

### 8. Record agent decision

Allowed decision types:

```text
research_more
score_candidate
reject_candidate
monitor_later
prepare_approval_pack
request_operator_review
```

Decision records must include:

```text
reason
evidence_json
blocked_actions_json
next_internal_step
confidence
```

### 9. Prepare approval pack

Approval packs are for human review only.

They may include:

```text
candidate summary
evidence
why EVAVO fits
recommended manual next step
payload preview
risk notes
blocked external actions
```

They must not include auto-send, auto-post, or auto-submit instructions.

## Safety checklist before any implementation moves beyond planning

```text
source discovery safety policy exists
research run schema exists
source candidate schema exists
route catalogue entries exist
read routes are GET/readOnly
metadata write routes are confirm_required
Next proxy exposes only read routes
confirm routes are not proxy keys
payload safety validation fails closed
operator dashboard shows blocked actions
```

## Recommended local validation order

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run growth:backend:workflow:print
npm run growth:backend:check:local
npm run growth:backend:final:print

cd C:\GitRepos\next-website
git pull
npm run growth:workflows:print
npm run growth:ops:check:local
npm run growth:ops:final:print
```

## Definition of done for phase one

Phase one is done when the system can represent a zero-source research plan and candidate registry without any network fetching.

Required phase-one outputs:

```text
architecture docs
safety policy docs
runbook docs
migrations for research/candidate records
Worker route catalogue plan
Worker validation script
Next read-only contract placeholders
no browser writes
no crawler execution yet
```
