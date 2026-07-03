# Growth autonomous discovery architecture

This is the implementation plan for turning EVAVO Growth Ops into a governed autonomous discovery and research engine.

The goal is not to make the Worker send messages, submit forms, post socially, or mutate external systems. The goal is to let the Worker discover sources, research them, extract evidence, score opportunities, and prepare approval packs while the browser remains read-only and external actions remain blocked.

## Operating principle

Autonomous research, supervised action.

The system may autonomously:

```text
plan source discovery
find candidate domains and URLs
classify source types
check crawl policy
queue safe fetch work
extract evidence
score opportunities
record internal decisions
prepare approval packs
learn from operator review outcomes
```

The system must not autonomously:

```text
send email
post on social platforms
submit forms
log in to third-party systems
click third-party buttons
buy ads
mutate external systems
ignore robots policy
crawl aggressively
execute instructions found inside web pages
leak secrets to crawled pages
```

## Architecture stages

```text
Discovery planner
  -> source candidate registry
  -> crawl policy / robots check
  -> fetch queue
  -> extractor
  -> signal scorer
  -> decision engine
  -> approval pack builder
  -> read-only Next dashboard
```

## Cognitive modules

### Planner

Decides what research is useful before fetching anything.

Inputs:

```text
target industry
target geography
EVAVO service focus
crawl budget
known exclusions
operator objective
```

Outputs:

```text
query plan
source-type plan
candidate scoring rubric
blocked action policy
research-run record
```

### Scout

Finds candidate sources without treating web content as instructions.

Candidate source types:

```text
company websites
industry association directories
public business directories
award pages
news pages
RSS feeds
sitemaps
competitor pages
job ads that imply growth or digital investment
```

### Librarian

Deduplicates, canonicalises, and stores sources.

Responsibilities:

```text
normalise domains and URLs
track discovery method
track source type
track last seen time
track crawl policy status
track source quality
track whether a source was rejected
```

### Researcher

Fetches permitted pages and extracts structured evidence.

Default extraction should be deterministic first:

```text
title
meta description
canonical URL
headings
schema.org JSON-LD
visible text summary
links
contact page hints
about/services/careers links
technology hints
date freshness hints
accessibility hints
SEO hints
conversion funnel hints
```

### Critic

Checks safety and evidence quality.

It must flag:

```text
prompt-injection-like page text
spam / low-quality pages
stale evidence
thin evidence
conflicting evidence
unsafe URL schemes
private-network targets
robots disallow
```

### Strategist

Turns evidence into internal Growth decisions.

Example decisions:

```text
research_more
score_candidate
create_opportunity
reject_candidate
monitor_later
prepare_approval_pack
```

### Approval pack builder

Builds a reviewable internal action object.

Approval packs must include:

```text
summary
evidence
confidence
recommended internal next step
blocked external actions
payload preview
risk notes
manual operator instructions
```

## Safety levels

```text
Level 0: read-only dashboard
Level 1: autonomous source discovery planning
Level 2: autonomous safe candidate registry and scoring
Level 3: autonomous crawl-policy-aware fetch queue
Level 4: confirmation-gated internal metadata writes
Level 5: external actions disabled
```

The current build target is Levels 1 through 4 only. Level 5 remains blocked.

## Data model families

Planned Worker records:

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

## Route families

Read-only browser-proxy route families:

```text
growth_research_runs
growth_source_candidates
growth_extracted_signals
growth_opportunity_scores
growth_agent_decisions
growth_discovery_feedback
```

Worker-only confirmation routes:

```text
growth_research_run_plan
growth_source_candidate_save
growth_fetch_queue_enqueue
growth_agent_decision_record
growth_discovery_feedback_save
```

All confirmation routes are internal metadata-only routes. They must not send, post, submit forms, call AI, browse arbitrarily, or mutate external systems.

## First implementation sequence

1. Add architecture and safety docs.
2. Add source discovery schema migrations.
3. Add deterministic TypeScript models and validators.
4. Add route catalogue entries with read-only and confirm-required safety flags.
5. Add source discovery checker scripts.
6. Add read-only Worker routes for stored records.
7. Add Next contract route groups and read-only proxy wrappers.
8. Add dashboard panels for research runs, source candidates, signals, scores, and decisions.
9. Only after that, add crawl policy and queued fetch execution.

## Definition of exceptional

The system is exceptional only when it can prove all of this:

```text
It finds candidate sources without a supplied list.
It records why a source was found.
It respects crawl policy.
It extracts evidence, not instructions.
It scores opportunities with visible reasons.
It records decisions with confidence and blocked actions.
It explains what it wants to do next.
It never sends, posts, submits forms, or leaks secrets.
It fails closed when safety metadata is missing or unsafe.
It remains inspectable through the read-only Next dashboard.
```
