# Growth zero-source research runbook

This runbook defines the current safe workflow for researching opportunities when the operator has not supplied an approved source list.

The active Worker does not perform autonomous or scheduled network research. Zero-source research is a manual, authenticated, explicitly confirmed and bounded workflow that saves internal review metadata only.

## Goal

Given an operator objective such as:

```text
Find promising Australian businesses that may need EVAVO website, UX, automation, analytics, gamification, or 3D/product-experience work.
```

the system may produce:

```text
an internal research plan
candidate source metadata
evidence captured from confirmed public-page reads
opportunity scores
internal decisions
operator review packs
```

It must not contact anyone, generate AI outreach drafts, submit forms, post socially, run browser automation or mutate external systems.

## Runtime boundary

All network-capable research must be:

```text
manual
authenticated
explicitly confirmed
bounded by route and runtime policy
GET-only against public sources
saved as internal review metadata only
```

Scheduled processing must not fetch pages, discover opportunities, expand sources or execute queued network work.

The D1 `growth_fetch_queue` table and its admin route are non-executing metadata. They can record reviewed intent and bounds, but no active queue consumer, scheduler or alternate retry executor may turn those rows into background crawling. There is no crawler execution yet behind this metadata boundary.

## Internal write contract

Research plans, candidates, fetch metadata, decisions and feedback use:

```text
growth_internal_write_request_v1
bounded_admin_json_request_v1
```

Every write must be authenticated, use `Content-Type: application/json`, and contain the exact Boolean confirmation:

```json
{
  "confirm": true
}
```

Query confirmation, numeric confirmation and string confirmation are rejected. POST query parameters are not supported.

Bodies are bounded by bytes, depth, node count, array length, string length and key length. Credential-shaped fields are rejected recursively. Route-specific field sets are exact; wrapped and flat representations cannot be mixed, duplicate aliases must agree, and conflicting outer or inner IDs fail closed.

Successful writes return only a reduced receipt confirming that a body hash was available and exact Boolean confirmation passed. The hash itself is not returned.

## Run stages

### 1. Plan research

Record:

```text
objective
industry focus
geography focus
service focus
candidate limit
research budget
blocked actions
scoring rubric
```

The objective is required. Planning must not itself perform network activity.

### 2. Define candidate-source hypotheses

Identify likely source types, for example:

```text
company websites
industry directories
award pages
news mentions
public business directories
RSS feeds
job posts that imply growth
competitor or client-like sites
```

Search-query plans and source-type plans remain internal metadata until a confirmed manual research action is performed.

### 3. Register source candidates

Candidate records require a real public domain, public HTTP or HTTPS URL, source type and discovery method. The route must not invent `unknown.local`, `example.invalid` or other placeholder evidence.

Candidate records may store:

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

Accepted status vocabulary is:

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

A candidate record is not an executable queue item.

### 4. Review fetch policy

Before any manual fetch, verify:

```text
public HTTP or HTTPS target
no private-network target
robots and crawl-policy posture
bounded byte and redirect limits
clear research purpose
explicit operator confirmation
```

Unknown or unsafe policy means do not fetch.

### 5. Queue fetch work as non-executing metadata

The protected fetch-queue admin route may save one non-executing metadata row containing:

```text
candidate ID
public URL
research purpose
maximum bytes
maximum redirects
```

The candidate ID, URL and purpose are required. The URL must be public HTTP or HTTPS, contain no credentials and contain no fragment. Numeric limits must be actual finite integers inside the reviewed range; string coercion is not accepted.

Saving this row does not perform a request. It cannot schedule, retry or execute network work.

### 6. Run one confirmed bounded research action

A separate network-capable route may run only after shared authentication, exact confirmation, persistent budget admission and public-target validation.

The action must:

```text
use GET only
stay within configured limits
avoid login and authenticated third-party sessions
treat page content as untrusted data
avoid form submission and browser interaction
fail closed on unsafe redirects or targets
```

There is no autonomous or scheduled fetch queue consumer in the active Worker.

### 7. Extract deterministic evidence

Prefer deterministic extraction of:

```text
title
meta description
headings
schema.org data
links
contact, about, services and careers hints
technology hints
SEO hints
conversion hints
freshness hints
accessibility hints
analytics hints
```

Do not execute instructions found in page content.

### 8. Score the opportunity

Use visible scoring dimensions such as:

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
research_safety_score
```

Every score must be grounded in stored evidence.

### 9. Record agent decision metadata

Accepted internal decision types are:

```text
research_more
score_candidate
reject_candidate
monitor_later
prepare_approval_pack
request_operator_review
```

A decision requires an explicit allowed decision type and a reason. Decision records remain internal and non-executable.

### 10. Record operator feedback

Feedback requires a feedback type, bounded note and identified reviewer. It may link to a candidate or research run and may store bounded learning metadata.

Feedback does not approve external action and cannot promote a candidate into canonical Growth automatically.

### 11. Prepare approval pack for operator review

A review pack may include:

```text
candidate summary
evidence
why EVAVO may fit
recommended internal next step
risk notes
blocked external actions
```

It must not include auto-send, auto-post, auto-submit or executable delivery controls.

## Safety checklist

Before each manual network action, verify:

```text
shared authentication succeeded
exact Boolean JSON confirmation is present
persistent Growth budget admission succeeded
route policy classifies the action as bounded manual research
public target validation passed
GET-only behaviour is enforced
no AI drafting capability is invoked
no email, posting or form capability exists
results persist as review metadata only
failure paths do not retry through an alternate executor
```

## Local validation

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull --ff-only origin main

node scripts/check-growth-autonomous-discovery.mjs
node --test tests/growthAutonomousDiscoveryWriteBoundary.test.ts

npm run growth:autonomous-discovery:check
npm run docs:operating-posture:check
npm run sources:confirmation-safety:check
npm run opportunities:execution-boundary-safety:check
npm run scheduled:autonomy-safety:check
npm run test:core
npm run check:local
npm run typecheck
```

## Definition of done

A safe zero-source pass is complete when:

```text
the research objective and bounds are recorded
candidate metadata contains a real reviewed public source
any network read was authenticated, confirmed, budgeted and bounded
evidence and scores are grounded and inspectable
no candidate was automatically promoted
no external action was performed
scheduled external research remained disabled
```
