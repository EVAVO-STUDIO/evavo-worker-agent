# Zero-source route catalogue

This document describes the safe route sequence for running the Opportunity Intelligence / Outbound Agent when no manual source list has been supplied.

Zero-source startup is not a scraping mode. It is a candidate-memory-first recovery path that creates safe seed memory, runs tiny bounded public discovery, and routes all useful findings through review before they become live opportunity sources.

## Route sequence

### 1. Read settings and policy

- `GET /admin/settings/autonomy`

Expected safe startup settings:

- `engineEnabled: true`
- `freeSafeOnly: true`
- `sourceExpansionEnabled: true`
- `leadDiscoveryEnabled: false`
- `aiDraftsEnabled: false`
- `sendingEnabled: false`
- `maxNetworkCallsPerRun > 0`
- `maxExpansionFetchesPerRun > 0`
- `maxExpansionCandidatesPerRun > 0`

If these checks fail, fix settings before running discovery.

### 2. Bootstrap seed memory

- `POST /admin/opportunities/sources/expansion/bootstrap`

Purpose:

- create durable default source-expansion seed memory
- no network
- no AI
- no email
- no live source creation

This is the safest first step in a fresh or reset environment.

### 3. Run bounded source expansion

- `POST /admin/opportunities/sources/expansion/scan`

Purpose:

- fetch a small capped set of public seed pages
- score ordinary public links into `source_expansion_candidates`
- store candidate-source memory only

Important behaviour:

- scan also ensures bootstrap seed memory before selecting due seeds
- useful links remain candidates
- saving to `opportunity_sources` requires a separate confirmed action

### 4. Follow fallback guidance

A scan may return or log states such as:

- `no_due_seeds`
- `all_fetches_failed`
- `thin_seed_pages`
- `links_without_candidates`
- `known_or_duplicate_candidates`
- `fresh_candidates_found`

These states should route the next action:

| State | Safe next action |
| --- | --- |
| `no_due_seeds` | bootstrap or rotate strategy |
| `all_fetches_failed` | inspect source health, retry later, or try sitemap discovery |
| `thin_seed_pages` | try sitemap/robots or public-link graph discovery |
| `links_without_candidates` | try query hints or review filters/scoring |
| `known_or_duplicate_candidates` | inspect candidate/source-origin state before spending more budget |
| `fresh_candidates_found` | review candidates before source promotion |

### 5. Try sitemap or public-link graph discovery

- `POST /admin/opportunities/sources/expansion/sitemap-scan`
- `POST /admin/opportunities/sources/expansion/public-directory-scan`

Purpose:

- rotate method before increasing scan depth
- inspect public robots/sitemaps or ordinary public links
- store candidate-source memory only

These routes remain confirm-required and capped.

### 6. Use query hints if source memory is exhausted

- `GET /admin/opportunities/sources/expansion/query-hints?status=candidate&limit=80`
- `POST /admin/opportunities/sources/expansion/query-hints/generate`
- `POST /admin/opportunities/sources/expansion/query-hints/resolve`

Purpose:

- generate source-hunting search patterns without searching automatically
- let the operator manually inspect public search results
- resolve human-reviewed URLs into candidate-source memory

Resolver behaviour:

- no browser automation
- no automatic web search
- no live source save
- dedupe and score pasted public URLs into `source_expansion_candidates`

### 7. Review candidate sources

- `GET /admin/opportunities/sources/expansion/candidates?status=candidate&limit=50`
- `GET /admin/opportunities/sources/candidates/preview`
- `POST /admin/opportunities/sources/candidates/commit`

Purpose:

- inspect candidate evidence and duplicate status
- promote only useful fresh candidates
- preserve origin and operator reason

Promotion must remain explicit and confirmation-gated.

### 8. Test and monitor saved sources

- `GET /admin/opportunities/sources?limit=50`
- `POST /admin/opportunities/sources/:id/test`
- `GET /admin/opportunities/sources/:id/preview`
- `GET /admin/opportunities/sources/health?limit=50`
- `POST /admin/opportunities/sources/:id/health-action`

Purpose:

- test saved sources before relying on them
- inspect source health before spending more budget
- pause, activate, lower priority, raise priority, or reset source error state through local metadata actions only

### 9. Run opportunity discovery only after source memory exists

- `POST /admin/opportunities/run-due`

Purpose:

- process due live opportunity sources
- save high-score opportunities for review
- record run audit history

This remains governed by autonomy settings and policy gates.

## Safety boundary

Zero-source startup must keep the following hard boundaries:

- public-source-only discovery
- tiny bounded fetches
- candidate-memory-first storage
- origin preservation
- no private/authenticated areas
- no bypassing access controls
- no paid AI by default
- no email or outreach by default
- no lead discovery in the startup path
- no automatic source promotion
- explicit confirmation for networked scans and source saves

## Operational rule

When the system has no source-origin signals, route to zero-source startup before learning-first planning.

Learning needs outcomes. A brand-new or reset environment first needs safe candidate-source memory.
