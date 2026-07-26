# Adaptive Opportunity Source Selection

Date: 2026-07-26

Contract:

```text
opportunity_source_selection_v1
```

This contract makes a bounded confirmed opportunity-research run spend its existing source-fetch allowance on the sources most likely to produce useful, attributable evidence while retaining a small exploration allowance for new sources.

It does not increase the Growth activity budget, enable scheduled external research, call AI, create browser sessions, contact anyone or perform an external state change.

## Why this exists

The Worker already records source priority, successful fetches, failed fetches, last-run time and saved opportunities. Static priority alone does not use that history. It can repeatedly favour a high-priority source that fails or produces nothing while underusing a lower-priority source that reliably produces useful evidence.

The selector therefore separates:

```text
operator priority
observed reliability
saved opportunity yield
failure pressure
time since last attempt
bounded exploration
```

Activity volume and authority remain separate. A higher activity level may consider more sources inside its existing budget. It does not gain permission to send, post, comment, submit forms, create meetings, mutate providers or spend money.

## Bounded candidate pool

The opportunity runtime reads at most:

```text
min(60, effective source limit × 4)
```

due source rows before selecting the final run set.

The final selection remains bounded by the already-admitted per-run source limit:

```text
Light      up to 3 sources per confirmed run
Balanced   up to 8 sources per confirmed run
High       up to 15 sources per confirmed run
```

Legacy daily-source and network-call settings may reduce those values but cannot enlarge them.

The number of manual runs per day is a separate unit enforced by the persistent activity ledger. It is never reused as a sources-per-run cap.

## Score inputs

Each due source receives a deterministic score from:

```text
45% operator priority
25% smoothed fetch reliability
20% logarithmically bounded saved-opportunity yield
10% bounded staleness/revisit value
minus 20% failure pressure
```

Reliability uses additive smoothing so a source with one success is not treated as certain and a new source is not treated as proven or worthless.

Saved-opportunity yield is logarithmically bounded. A source cannot acquire unlimited priority merely because it has accumulated many historical records.

Staleness reaches its maximum after seven days. Old sources receive a modest revisit opportunity, not unlimited preference.

Ties resolve by priority, then fewer historical attempts, then stable source ID ordering. The result is deterministic and reviewable.

## Exploration allowance

A small part of the selected set is reserved for never-attempted sources:

```text
Paused      0
Light       at most 1
Balanced    at most 2
High        at most 3
```

Exploration never enlarges the run. It replaces part of the same finite source allowance.

New sources are ordered by operator priority and stable ID. The remaining positions are filled from the evidence-weighted ranking.

## Adaptive backoff

Source scheduling now avoids spending free capacity on low-value loops:

```text
successful source with saved candidates   retry after 24 hours
successful source with no saved candidate retry after 72 hours
failed source                             retry after 48 hours and set cooldown
```

This replaces the old posture where a failed source could be retried after six hours, more frequently than a successful source.

The persistent Growth activity ledger remains authoritative before every public fetch. The selector does not bypass daily, per-run, domain, cooldown, failure-circuit or request-replay controls.

## Evidence provenance

Saved candidate evidence receives a reduced source-selection receipt containing:

```text
contract version
explore or exploit mode
score
attempt count
reliability
opportunity yield
failure pressure
staleness
```

This explains why a source was chosen without exposing credentials or granting execution authority.

## Fail-closed validation

The pure selector rejects:

- malformed source records;
- negative or unsafe counters;
- duplicate source IDs;
- noncanonical or future last-run timestamps;
- invalid limits;
- exploration slots larger than the selected set;
- more than 200 candidate rows.

The selector performs no network, D1, environment, AI, scheduling or side-effect operation.

## Current runtime posture

```text
manual authenticated research only
exact confirmation required
persistent budget admission required
adaptive selection enabled
scheduled external research disabled
AI disabled
browser runtime disabled
email sending disabled
social posting and commenting disabled
form submission disabled
calendar creation disabled
provider write-back disabled
advertising spend disabled
canonical Growth promotion disabled
```

The capability registry may truthfully report confirmed public research as available only in this bounded, manual, review-only posture. It must continue to report migration application and account-wide Cloudflare usage as unknown until independently verified.
