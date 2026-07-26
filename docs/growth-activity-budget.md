# Growth Activity Budget

Date: 2026-07-26

Contract:

```text
growth_activity_budget_v1
```

This contract is the cost and activity control plane for EVAVO Growth Research Worker.

It exists because an autonomous Growth system should not treat provider limits as a target. It should reserve substantial headroom, refuse paid-service use, stop repeated low-value work, and remain useful even when every external action is disabled.

## Product objective

The long-term system should help with the useful parts of Growth, business development, sales, account management, business analysis and marketing:

- discover public evidence and potential opportunities;
- maintain source health and discover better sources;
- score fit, urgency, confidence, value, effort and risk;
- retain provenance and explain why a lead or opportunity deserves attention;
- prepare proposals, briefs, reports, meeting agendas and reviewable communications;
- learn from accepted, rejected, deferred and successful outcomes;
- coordinate approved follow-up through separately configured email, calendar, CRM and owned-channel adapters;
- preserve a consistent EVAVO voice without pretending to be a person or creating fake engagement.

Automation must be useful rather than merely active. Repeated fetching, low-confidence scraping, generic posting and mass unsolicited outreach are treated as failure modes.

## Current Cloudflare planning assumptions

The limits below were reviewed against Cloudflare's published Free plan documentation on 2026-07-26:

- Workers Free: 100,000 requests per day, 10 ms CPU per invocation, 50 external subrequests per request, and five cron triggers per account.
- D1 Free: 5,000,000 rows read per day, 100,000 rows written per day, 5 GB total storage, ten databases and 500 MB per database.
- Queues Free: 10,000 operations per day with 24-hour retention.
- Browser Rendering Free: ten browser minutes per day and five crawl jobs per day, but browser activity is disabled by this contract.
- Workflows Free: 3,000 steps per day, but Workflows are not part of the current Growth runtime.

Official references:

- https://developers.cloudflare.com/workers/platform/limits/
- https://developers.cloudflare.com/d1/platform/limits/
- https://developers.cloudflare.com/queues/platform/pricing/
- https://developers.cloudflare.com/browser-rendering/platform/limits/
- https://developers.cloudflare.com/workflows/reference/pricing/

Cloudflare can change plan limits. These values are planning evidence, not a runtime dependency. The runtime uses much lower internal limits and must be reviewed again if the hosting plan or published limits change.

The Worker cannot know all account-wide Cloudflare activity from a single request. Therefore:

```text
accountWideCloudUsageKnown: false
persistentUsageAccountingRequired: true
```

A future persistent usage ledger must account for this Worker's admitted activity and fail closed when its snapshot is missing, malformed or stale. It must not claim to guarantee account-wide cost when unrelated Workers or tools share the account.

## Immutable zero-paid-service posture

Every activity profile keeps these values at zero:

```text
scheduledExternalResearchRunsPerDay
browserMinutesPerDay
aiCallsPerDay
paidServiceCallsPerDay
externalActionsPerDay
```

This means increasing the profile from Light to High does not enable:

- Cloudflare AI calls;
- external LLM calls;
- Browser Rendering;
- email sending;
- social posts or comments;
- form submissions;
- calendar event creation;
- CRM/provider writes;
- automatic proposal promotion;
- automatic retries after a failed external action.

Those capabilities require separate connectors, credentials, platform authorization, suppression checks, approval policy, audit, idempotency and rollback or remediation contracts. They cannot be smuggled into an activity-profile change.

## Activity profiles

### Paused

No Growth activity is admitted. Existing records remain readable through their normal owner-only surfaces.

### Light

Designed for quiet background use and early validation:

```text
manual research runs/day: 1
external fetches/day: 5
external fetches/run: 3
distinct domains/day: 4
fetches/domain/day: 2
candidate writes/day: 25
proposal writes/day: 10
worker requests/day: 250
D1 rows read/day: 25,000
D1 rows written/day: 500
minimum research cooldown: 360 minutes
minimum opportunity score: 65
```

### Balanced

Designed for normal owner-supervised use:

```text
manual research runs/day: 2
external fetches/day: 15
external fetches/run: 8
distinct domains/day: 10
fetches/domain/day: 3
candidate writes/day: 100
proposal writes/day: 30
worker requests/day: 1,000
D1 rows read/day: 100,000
D1 rows written/day: 2,000
minimum research cooldown: 180 minutes
minimum opportunity score: 55
```

### High

The largest reviewed zero-paid-service envelope:

```text
manual research runs/day: 4
external fetches/day: 40
external fetches/run: 15
distinct domains/day: 20
fetches/domain/day: 4
candidate writes/day: 300
proposal writes/day: 75
worker requests/day: 5,000
D1 rows read/day: 300,000
D1 rows written/day: 7,500
minimum research cooldown: 60 minutes
minimum opportunity score: 45
```

High remains far below the published Worker and D1 daily allowances and still has no paid, AI, browser or external-action budget.

### Custom

Custom accepts the complete exact limit set only. Unknown fields, missing fields and values outside the hard envelope fail closed.

Custom cannot raise the immutable zero values. It is intended for controlled tuning between the named profiles, not as an unlimited mode.

## Admission inputs

Every decision requires:

- one exact profile;
- one known activity kind;
- manual or scheduled invocation context;
- a fresh usage snapshot for the current UTC day;
- conservative requested units;
- owner approval and exact confirmation where required;
- a canonical lower-case target domain for public research;
- recent failure and cooldown state.

Usage snapshots older than ten minutes, from another UTC day, from the future, or with malformed counters are rejected.

## Waste controls

The evaluator blocks:

- a research run larger than the profile's per-run cap;
- a domain that has reached its daily cap;
- new distinct domains after the profile's domain cap;
- repeated work during the research cooldown;
- more failed fetches after the profile's failure circuit opens;
- any projected daily counter above its profile limit;
- scheduled public research;
- any unimplemented action;
- any action missing required approval or exact confirmation.

No automatic retry is admitted. A later retry must be a new reviewed decision using a fresh usage snapshot.

## Current implemented activities

The budget currently models these as implemented:

- internal learning from existing D1 review metadata;
- deterministic signal scoring;
- deterministic owner brief generation;
- manually confirmed bounded public research;
- manually confirmed public-directory scanning;
- manually confirmed candidate persistence;
- proposal preparation without delivery.

Reports, documents and meeting agendas are modelled but still marked unimplemented. This avoids claiming value before those paths exist.

## Future connector architecture

HubSpot, Gmail, Google Calendar, YouTube, TikTok, Reddit, Meta and other platforms should be adapters behind one common action contract, not special cases inside the research engine.

Each adapter must provide:

```text
provider identity
OAuth or server credential posture
read/write capability inventory
platform scopes
free quota or operator budget
idempotency key
suppression and consent decision
owner approval decision
content provenance
voice profile version
external result receipt
retry classification
rollback or remediation path
audit event
```

Current official platform evidence shows why this setup cannot be truly zero-configuration:

- HubSpot private apps require authentication and have account/app API limits; CRM search has separate rate and result limits.
- Gmail and Calendar require Google Cloud projects and OAuth authorization, even though standard API use is available without an additional charge under published thresholds.
- YouTube comments and uploads require OAuth; unverified upload projects can be restricted to private videos.
- TikTok direct posting requires a registered app, approved `video.publish` scope, user authorization and app audit for public visibility.
- Reddit write actions require a Devvit app and appropriate installation or user-action permissions.

Official references:

- https://developers.hubspot.com/docs/developer-tooling/platform/usage-guidelines
- https://developers.hubspot.com/docs/api-reference/latest/crm/search-the-crm
- https://developers.google.com/workspace/gmail/api/reference/quota
- https://developers.google.com/workspace/calendar/api/guides/quota
- https://developers.google.com/youtube/v3/getting-started
- https://developers.tiktok.com/doc/content-posting-api-get-started/
- https://developers.reddit.com/docs/capabilities/server/reddit-api

The correct zero-cost approach is to keep adapters optional, disabled when unconfigured, and budgeted well below their free thresholds. Credentials, OAuth consent and platform review are legitimate setup requirements and must not be bypassed.

## Communication and personality design

A future voice profile should be versioned and reviewable. It should include:

- brand and sender identity;
- audience and relationship stage;
- preferred tone, vocabulary and sentence length;
- phrases to avoid;
- factual claims allowed by evidence;
- region and spelling;
- channel-specific conventions;
- follow-up spacing;
- escalation and handoff rules.

The system may write naturally and avoid generic AI phrasing. It must not fabricate familiarity, pretend a human personally performed an action they did not perform, fake community participation, or conceal required platform disclosures.

## Recommended implementation sequence

1. Add this pure activity budget and executable hostile fixtures.
2. Include the profile summary in the protected Growth capability response.
3. Add a D1 daily usage ledger with atomic admission and actual post-operation reconciliation.
4. Make manual opportunity discovery consume a budget lease before network access.
5. Add a budget panel to the owner Growth dashboard.
6. Add deterministic reports, documents and meeting agendas without AI calls.
7. Add read-only HubSpot, Gmail and Calendar adapters with bounded sync and explicit OAuth setup.
8. Add draft preparation using templates and evidence first; optional model providers remain separately budgeted.
9. Add approved email and calendar actions before social posting because they have clearer identity, consent and remediation paths.
10. Add owned-channel social adapters one platform at a time, with platform audit and explicit owner approval.
11. Keep unsolicited mass outreach, fake engagement and uncontrolled forum commenting out of scope.

## Validation

```powershell
cd C:\GitRepos\evavo-worker-agent

node scripts/check-growth-activity-budget.mjs
npm run test:core
npm run growth:capabilities:check
npm run check:local
npm run typecheck
```

This document and the pure policy do not by themselves prove persistent budget enforcement. That requires the D1 usage ledger and integration into each activity path.
