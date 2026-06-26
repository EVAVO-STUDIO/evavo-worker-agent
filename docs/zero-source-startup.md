# Zero-source startup contract

The Opportunity Intelligence / Outbound Agent must be able to begin safely even when the operator has not supplied any manual opportunity sources.

This is not a special case. It is the default resilience model for a new installation, a reset environment, or a source list that has become stale, duplicate-heavy, or low-yield.

## Safe startup order

1. **Bootstrap durable source-expansion seeds**
   - Route: `POST /admin/opportunities/sources/expansion/bootstrap`
   - Writes local seed memory only.
   - No network calls.
   - No AI calls.
   - No email or outreach.
   - Requires explicit confirmation.

2. **Run a tiny bounded source-expansion scan**
   - Route: `POST /admin/opportunities/sources/expansion/scan`
   - The scan path also calls seed bootstrap before selecting due seeds, so a scheduled or manual scan can recover from empty seed memory.
   - Fetches only capped public seed pages.
   - Stores candidate-source memory only.
   - Does not save live opportunity sources.

3. **Use fallback guidance from the scan result**
   - Manual scan responses include a `fallback` object with:
     - `state`
     - `nextMethod`
     - `reason`
     - `steps`
     - `guardrail`
   - Scheduled source-expansion ticks log equivalent fallback summaries into events.

4. **Rotate discovery method before increasing depth**
   - If pages are thin: try sitemap/robots or public-link graph discovery.
   - If links do not score: try query hints or filter review.
   - If results are duplicates: review candidate/source-origin state before spending more budget.
   - If fetches fail: review source health or cooldowns before retrying.

5. **Use query hints when memory is exhausted**
   - Route: `POST /admin/opportunities/sources/expansion/query-hints/generate`
   - Generates local search-pattern memory only.
   - Does not search the web automatically.
   - Operators can open searches manually, screen public result URLs, and resolve selected URLs.

6. **Resolve human-reviewed URLs into candidate memory**
   - Route: `POST /admin/opportunities/sources/expansion/query-hints/resolve`
   - Requires confirmation.
   - Accepts capped, human-reviewed public URLs.
   - Scores, filters, and dedupes into `source_expansion_candidates` only.
   - Does not save live opportunity sources.

7. **Promote only through review gates**
   - Candidate-source promotion remains separate and confirm-gated.
   - Source-health judgement should be checked before spending more budget.
   - Live opportunity-source creation must preserve origin.

## Fallback states

The system should treat the following scan outcomes as structured guidance rather than failure:

- `no_due_seeds`
  - Next: bootstrap or rotate strategy.
  - Guardrail: do not raise caps first.

- `all_fetches_failed`
  - Next: review source health or try sitemap discovery.
  - Guardrail: do not keep retrying failing seeds without cooldown/health review.

- `thin_seed_pages`
  - Next: sitemap/robots or public-link graph discovery.
  - Guardrail: rotate method before increasing depth.

- `links_without_candidates`
  - Next: query hints or filter/scoring review.
  - Guardrail: avoid weak manual saves.

- `known_or_duplicate_candidates`
  - Next: candidate review or origin rotation.
  - Guardrail: do not treat duplicate rediscovery as new coverage.

- `fresh_candidates_found`
  - Next: candidate review.
  - Guardrail: live source save still requires explicit confirmation.

## Policy boundary

Zero-source startup must never become uncontrolled scraping.

The allowed behaviour is:

- public-source-only discovery
- capped fetches
- candidate-memory-first storage
- origin preservation
- no private/authenticated areas
- no AI by default
- no email by default
- no automatic live source promotion
- explicit confirmation before writes that promote sources or run networked scans

The goal is for the agent to keep moving intelligently from zero without becoming noisy, unsafe, or opaque.
