# EVAVO Growth Autonomy Agent

The Growth Autonomy Agent is the next layer above the existing Opportunity Intelligence / Outbound Agent.

The existing agent finds and scores opportunity/source signals. The Growth Autonomy Agent decides what EVAVO should do with those signals across owned content, directories, procurement, contact forms, email, and community-style channels.

## Contract

The agent is an autonomous EVAVO growth employee:

- automated, but accountable
- natural, but not deceptive
- EVAVO-aligned, not generic
- useful first, commercial second
- cost-aware, not always-on

It can research, classify, draft, queue, and execute allowed actions, but only when channel policy, action policy, cost budget, and audit requirements pass.

## Hard rules

The Growth Autonomy Agent must not support:

- hidden-human mode
- fake neutral recommendations
- CAPTCHA bypass
- private or gated-source scraping
- harvested-email blasts
- repetitive mass posting
- hidden promotional links
- unaudited public actions
- execution when budget state is unknown

If an action relies on hiding who is behind it, the action is blocked.

If a channel, budget, or rules state is unclear, the agent saves intelligence and does not execute.

## Operating modes

### observe

Find, classify, score, and save signals only.

Allowed:

- public-source discovery
- signal extraction
- fit scoring
- channel classification
- budget-safe memory writes

Blocked:

- drafting
- sending
- posting
- contact-form submission

### draft

Prepare drafts but do not execute them.

Allowed:

- EVAVO voice drafts
- no-link community reply drafts
- contact-form drafts
- email drafts
- directory profile drafts
- blog/social post drafts
- draft scoring

Blocked:

- public posting
- sending
- form submission

### assist

Queue recommended actions for approval.

Allowed:

- draft generation
- risk scoring
- cost estimate
- approve/edit/reject queue
- audit preparation

Execution requires explicit approval.

### approved_autopilot

Execute only whitelisted, low-risk actions under caps.

Allowed examples:

- provider-expected directory updates
- approved service marketplace actions
- warm/permissioned follow-up actions

Blocked examples:

- community autoposting unless explicitly whitelisted
- cold mass outreach
- high-volume contact forms

### owned_channel_autopilot

Publish or schedule only EVAVO-owned channel work under cadence and quality rules.

Examples:

- EVAVO blog drafts or scheduled posts
- EVAVO social drafts or posts
- EVAVO landing-page idea drafts
- case-study snippets

### blocked

No drafting and no execution. Intelligence may still be saved if it is public and useful.

## Decision ladder

For every signal, the agent decides:

1. Is there a real context or prompt?
2. Does it map to an active EVAVO goal?
3. Is this channel appropriate for action?
4. Is a link allowed, contextual, approval-gated, or blocked?
5. Is EVAVO identity clear enough for this channel?
6. Is the draft specific enough that it cannot be reused unchanged elsewhere?
7. Is the daily budget healthy?
8. Should the system execute, queue, draft only, save, or ignore?

## Growth goals

The Growth Strategy Board should supply:

- active services
- current campaigns
- target audiences
- target regions
- offer stack
- proof points
- tone profile
- risk appetite
- budget profile

Signals and actions must be evaluated against those goals.

## Allowed channel classes

- owned channels
- provider-expected spaces
- direct business contact
- community channels
- procurement channels
- blocked or unclear channels

See `docs/growth-channel-policy.md`.

## Action classes

- save signal
- draft email
- draft contact form
- draft thread reply
- draft video comment
- draft directory profile
- draft owned social post
- draft blog outline
- submit directory listing
- submit contact form
- send email
- post owned channel
- post community reply
- do not engage

See `docs/growth-engagement-action-model.md`.

## Cost governance

Every run must check a budget ledger before work starts. If budget state is missing, stale, or near cap, new work pauses.

See `docs/growth-cost-governor.md`.

## Implementation sequence

1. Contract and policy docs
2. Growth Strategy Board config and UI
3. Worker schema and migrations
4. Read-only discovery routes
5. Draft generation and scoring routes
6. Engagement queue
7. Controlled execution
8. Outcome learning

Execution must not be added before channel policy, cost governance, draft scoring, and audit records exist.
