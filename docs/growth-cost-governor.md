# Growth cost governor

The Growth Autonomy Agent must be cost-governed before it becomes action-governed.

The goal is not to permanently limit useful work. The goal is to make the agent sleep, pause, and scale gradually so it does not create accidental Cloudflare, D1, network, or AI costs.

## Contract

Before any run that may fetch, write, draft, or execute, the Worker must check a budget ledger.

If budget state is missing, stale, or near cap, the Worker must pause new work and return a clear reason.

## Cost categories

Track at least:

- Worker invocations
- estimated CPU milliseconds
- D1 rows read
- D1 rows written
- network fetches
- AI calls
- draft generations
- public actions executed
- contact actions executed
- retries
- errors
- estimated cost cents

## Budget profiles

### free_safe

Default low-cost mode.

Recommended caps:

- network fetches/day: 20
- AI drafts/day: 0
- D1 writes/day: 2,000
- public actions/day: 0
- contact actions/day: 0

Use for initial setup, zero-source startup, and low-risk source discovery.

### research_budgeted

More discovery, still no public execution.

Recommended caps:

- network fetches/day: 100
- AI drafts/day: 5
- D1 writes/day: 5,000
- public actions/day: 0
- contact actions/day: 0

Use when the agent is learning what channels and signals are useful.

### growth_budgeted

Controlled growth mode.

Recommended caps:

- network fetches/day: 250
- AI drafts/day: 20
- D1 writes/day: 10,000
- public actions/day: 3
- contact actions/day: 5

Use only after strategy board, channel policy, scoring gates, and review queue exist.

## Budget ledger

Planned table shape:

```sql
CREATE TABLE growth_budget_ledger (
  id TEXT PRIMARY KEY,
  budget_date TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  worker_invocations INTEGER NOT NULL DEFAULT 0,
  cpu_ms_estimate INTEGER NOT NULL DEFAULT 0,
  d1_rows_read INTEGER NOT NULL DEFAULT 0,
  d1_rows_written INTEGER NOT NULL DEFAULT 0,
  network_fetches INTEGER NOT NULL DEFAULT 0,
  ai_calls INTEGER NOT NULL DEFAULT 0,
  draft_generations INTEGER NOT NULL DEFAULT 0,
  public_actions_executed INTEGER NOT NULL DEFAULT 0,
  contact_actions_executed INTEGER NOT NULL DEFAULT 0,
  retries INTEGER NOT NULL DEFAULT 0,
  errors INTEGER NOT NULL DEFAULT 0,
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  hard_stop_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

## Run envelope

Every run follows:

1. Load budget profile.
2. Load today's budget ledger.
3. Check caps before doing work.
4. Reserve budget for planned work where practical.
5. Execute tiny batch.
6. Record actual usage.
7. Stop before caps are exceeded.
8. Return next safe action.

## Rest triggers

The agent should rest when:

- budget state is missing or stale
- usage reaches 80 percent of a soft cap
- usage reaches 95 percent of a hard cap
- duplicate candidates dominate a run
- two or more consecutive runs are low yield
- source health is poor
- channel cooldown is active
- post/comment removal is detected
- negative reaction or unsubscribe spike occurs
- AI draft quality is repeatedly rejected

Rest means:

- do not fetch more
- do not call AI
- do not execute actions
- return a dashboard recommendation
- optionally schedule a later lightweight check

## Batch design

Do not crawl continuously.

Use small batches:

- max sources per run
- max URLs per source
- max fetches per channel
- max drafts per run
- max actions per channel
- max retries per target

Default retries should be low. Repeated failures should create cooldowns, not more retries.

## Cache and memory rules

The Worker should avoid repeat work by storing:

- URL fingerprint
- content hash
- last fetched time
- next eligible fetch time
- unchanged count
- failed count
- cooldown until
- channel id
- signal id

If a URL has not changed, the agent should not spend AI or action budget on it.

## AI cost rules

AI calls should be last, not first.

Use cheap logic before AI:

- keyword rules
- URL patterns
- known channel class
- previous outcomes
- source health
- existing signal score

Call AI only when:

- the signal score is high enough
- a draft is likely to be useful
- the target is not duplicate
- budget allows it
- expected value justifies the call

## Execution cost rules

Execution is more expensive than discovery because it carries reputation risk.

Before execution:

- budget profile must allow the action type
- action cap must be available
- channel cap must be available
- cooldown must be clear
- suppression rules must pass
- audit write must be available

If execution fails, retries must be capped. A second failure should normally create a cooldown.

## Fail-closed rules

Pause when:

- budget profile is missing
- budget ledger cannot be read
- usage cannot be written
- caps are malformed
- date rollover is ambiguous
- estimated cost is unknown for a paid action
- AI provider key or quota state is unclear

Failing closed protects the account and avoids surprise spend.

## Dashboard requirements

The Ops UI should show:

- current budget profile
- today's usage
- soft cap percentage
- hard stop reason
- next safe run
- rest/cooldown reason
- recent low-yield runs
- recent negative outcomes
- AI calls used today
- network fetches used today
- public/contact actions used today

## Scaling rule

The agent earns more budget only through good outcomes.

Good outcomes:

- reply
- meeting
- lead
- accepted listing
- useful traffic
- positive community response
- shortlist or watch decision

Bad outcomes:

- removal
- negative reply
- unsubscribe
- duplicate-heavy run
- ignored action batches
- low-quality draft rejections

Good outcomes may increase caps gradually. Bad outcomes reduce caps or trigger rest.
