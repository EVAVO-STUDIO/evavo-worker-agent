# Opportunity evidence quality

## Purpose

The Worker identifies possible grants, tenders, procurement notices, partnerships and digital-service opportunities from explicitly confirmed, bounded public research.

Opportunity extraction is deterministic and evidence-first. It does not use AI, invent missing facts, generate a response, create a deliverable or authorise external action.

## Authoritative implementation

```text
src/core/opportunityDiscovery.ts
src/core/opportunityPersistence.ts
src/core/opportunityScoring.ts
```

The focused contract is:

```text
npm run opportunities:evidence-quality:check
```

## Public candidate URLs

Candidate links use the shared `public_research_fetch_v1` URL policy.

The extractor and persistence layer reject:

- non-HTTP schemes;
- localhost and internal hosts;
- private or reserved literal addresses;
- embedded URL credentials;
- non-standard ports.

Fragments and known tracking parameters are removed. Query parameters are sorted before deduplication. Future opportunities are deduplicated by canonical URL, not by a mutable page title.

## Boundary-aware evidence matching

Keyword matching is boundary-aware. Short terms such as `ai`, `ar`, `ui`, `eoi`, `rfp` and `rft` must not match as arbitrary substrings inside unrelated words.

Generic navigation links, policy pages, login pages and self-links are excluded.

Definitive inactive signals such as `applications closed`, `submissions closed`, `no longer accepting`, `expired opportunity` and `archived opportunity` are excluded from active opportunity candidates.

## Deadline evidence

The extractor may normalise a deadline only when a complete date is present in one of the supported conservative forms:

```text
YYYY-MM-DD
DD/MM/YYYY
DD-MM-YYYY
DD Month YYYY
Month DD YYYY
```

A year is never guessed. A timezone or closing time is never invented.

Evidence records retain:

```text
raw
normalizedDate
status
daysRemaining
```

The status is `future`, `today`, `past` or `unparsed`. A parsed past deadline is excluded from active opportunity candidates.

## Value evidence

A monetary value is parsed only when the text contains:

- `AUD`;
- `NZD`; or
- a dollar sign.

Ordinary numbers, years, counts and percentages must not be treated as money.

Evidence records retain:

```text
raw
amountCents
currency
qualifier
```

The qualifier is `up_to`, `from` or `exact_or_unspecified`.

A numeric value may be stored in the dedicated value column only when the amount and currency are both grounded. A bare dollar sign does not cause the system to invent AUD or NZD.

## Evidence quality

Every candidate receives a deterministic `evidenceQualityScore` from 0 to 100. The score reflects the presence of independently useful evidence such as:

- a recognised opportunity type;
- explicit intent language;
- EVAVO-relevant scope;
- authoritative source context;
- a parseable deadline;
- a parseable monetary value;
- eligibility evidence;
- scope or deliverable evidence.

The evidence strength is:

```text
weak
moderate
strong
```

The evidence record also reports `missingFacts` and `reviewFlags`. Missing facts remain missing; they are never filled by assumptions.

## Confidence and learning

Candidate confidence depends on both the opportunity score and evidence quality.

Historical source performance and operator-review learning may adjust a score, but evidence guardrails apply:

- weak evidence receives no positive learning boost;
- limited evidence has a small positive-boost cap;
- weak and limited evidence have calibrated-score ceilings;
- strong review floors apply only when the evidence itself is sufficiently strong.

Learning may refine grounded evidence. It must not manufacture evidence or confidence.

## Review-only persistence

A candidate can be persisted only when it explicitly reports:

```text
reviewOnly: true
executable: false
deliverable: false
authoritativeForExecution: false
```

Stored evidence adds:

```text
externalExecutionAllowed: false
```

The evidence schema is:

```text
opportunity_evidence_v4_quality_review_only
```

Allowed operator-facing recommendations are internal review instructions only:

```text
shortlist_for_eligibility_review
shortlist_for_operator_review
review_evidence_and_source
retain_low_priority_signal
review_manually
```

Legacy labels that imply preparing a response are normalised into review-only labels before storage.

## Prohibited behaviour

Opportunity evidence must never:

- generate a draft or response;
- treat a score as approval;
- mark an item executable;
- send email or direct messages;
- post or comment;
- submit a form;
- mutate a third-party system;
- invent a deadline, amount, currency, eligibility rule, scope or issuer;
- promote weak evidence solely because historical learning is positive.
