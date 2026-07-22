# Zero-source startup contract

This document defines the safe starting posture when the operator has not supplied any opportunity-source list.

The active EVAVO Growth Research Worker is manual-research-only. Zero-source startup is not an autonomous recovery mode, scheduled discovery mode, crawl queue or execution pipeline.

## Authoritative posture

- Scheduled external research is disabled.
- Cron must not fetch public pages, expand sources or discover opportunities.
- Public-source research requires `ADMIN_TOKEN` authentication.
- Every network-capable action requires an explicit confirmed POST request.
- Each research action is bounded by route-specific request, byte, time and result limits.
- Network access is GET-only against validated public targets.
- Results are saved as internal review metadata only.
- AI drafting, email, social posting, form submission, browser automation and external mutation are disabled.
- Automatic source promotion and automatic opportunity execution are disabled.
- Automatic retries and alternate executors are disabled.

## Safe startup order

### 1. Review the route catalogue

Read the authenticated planner route catalogue and identify routes explicitly classified as bounded manual research or confirmed internal metadata writes.

Do not infer capability from a historical route name, schema table, stored setting or old event record.

### 2. Create or review seed metadata

Seed and query-hint records may be created as confirmed internal D1 metadata only.

This step:

- makes no network request
- calls no AI service
- generates no draft
- creates no external state change
- grants no permission for a later action

### 3. Select one manual research action

The operator may choose one advertised route that is explicitly classified as bounded manual public-source research.

Before the request runs, verify:

1. shared authentication succeeded
2. explicit confirmation is present
3. the route permits network access
4. the target is public and passes SSRF and redirect validation
5. GET-only behaviour is enforced
6. request, byte, time and result limits are active
7. persistence is review-only
8. no fallback executor or automatic retry exists

### 4. Save candidate evidence for review

A successful manual research action may save only internal candidate, evidence, source-health or review metadata.

It must not:

- create a deliverable message
- create an executable approval
- promote a candidate automatically
- run opportunity discovery automatically
- schedule another network action
- contact or mutate a third party

### 5. Review manually

The operator reviews evidence, duplicate state, source origin, risk flags and confidence before recording a separate confirmed internal disposition.

A review decision remains internal metadata. It never authorises delivery or autonomous follow-on work.

## Safe outcomes

A bounded manual action may report states such as:

- no suitable public target selected
- public target rejected by validation
- request limit reached
- fetch failed without retry
- no useful evidence found
- duplicate candidate found
- new review candidate saved

These are review outcomes, not instructions for automatic continuation.

## Fail-closed rule

When authentication, confirmation, public-target validation, bounds, D1 safety or route classification cannot be established, the action must stop without network access or fallback behaviour.

## Current goal

The goal is to help an operator move from zero supplied sources to a small, evidence-backed internal review set without scheduled research, autonomous crawling, drafting, delivery or external execution.