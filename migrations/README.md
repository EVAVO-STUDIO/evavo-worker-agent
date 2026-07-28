# D1 migration order

Run migrations in complete filename order against the `evavo_outbound_agent` D1 database.

The repository intentionally contains two `0006` migrations. Numeric prefixes are therefore not sufficient identifiers; use complete filenames whenever selecting one migration.

## Safe preparation

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull origin main
npm ci
npm run db:migrations:check
npm run db:migration-safety:check
```

`db:migrations:check` requires the checked-in migration inventory to match the reviewed authoritative list exactly. Missing files, unexpected numeric SQL files, invalid duplicate prefixes or ordering drift fail the check.

## Print dry-run commands

Choose the target explicitly:

```powershell
npm run db:migrations:print -- --local
npm run db:migrations:print -- --remote
```

Optional selectors require an unambiguous complete filename when duplicate prefixes exist:

```powershell
npm run db:migrations:print -- --remote --only 0024_business_score_observation_flags.sql
npm run db:migrations:print -- --remote --from 0014_growth_campaign_intelligence.sql
```

The printer emits guarded `db:migration:one` dry-run commands. It does not execute migrations.

## Apply one migration

Target selection is always explicit.

### One-time schema migration, local

```powershell
npm run db:migration:one -- 0024_business_score_observation_flags.sql --local
npm run db:migration:one -- 0024_business_score_observation_flags.sql --local --execute --confirm-unapplied
```

### One-time schema migration, remote

Before execution, verify that the migration has not already been applied.

```powershell
npm run db:verify:print -- --remote
npm run db:migration:one -- 0024_business_score_observation_flags.sql --remote --confirm-database evavo_outbound_agent
npm run db:migration:one -- 0024_business_score_observation_flags.sql --remote --execute --confirm-database evavo_outbound_agent --confirm-unapplied
```

### Rerunnable data migration

`0011_source_expansion_strategy_origin_yield_backfill.sql` is the currently classified rerunnable data migration.

```powershell
npm run db:migration:one -- 0011_source_expansion_strategy_origin_yield_backfill.sql --remote --confirm-database evavo_outbound_agent
npm run db:migration:one -- 0011_source_expansion_strategy_origin_yield_backfill.sql --remote --execute --confirm-database evavo_outbound_agent --allow-rerun
```

## Safety rules

- Never run the root `schema.sql` against the live or migrated D1 database.
- `npm run db:init:local` and `npm run db:init:remote` intentionally fail closed.
- Do not use direct `wrangler d1 execute ... --file` commands for normal migration work; they bypass repository safeguards.
- Pass exactly one of `--local` or `--remote`.
- Remote work is restricted to `evavo_outbound_agent` and requires `--confirm-database evavo_outbound_agent`.
- One-time schema migrations require `--confirm-unapplied` when executing.
- Rerunnable data migrations require `--allow-rerun` when executing.
- A dry run prints the resolved migration, classification, target and Wrangler command before anything can execute.
- Do not infer applied state from filenames. Verify the target database first.
- No repository check or printer mutates D1.

## Reviewed migration inventory

1. `0001_free_safe_core.sql`
2. `0002_draft_review_learning.sql`
3. `0003_source_intelligence.sql`
4. `0004_opportunity_intelligence.sql`
5. `0005_opportunity_review_learning.sql`
6. `0006_agent_settings.sql`
7. `0006_opportunity_run_audit.sql`
8. `0007_source_expansion_memory.sql`
9. `0008_source_expansion_strategy_quality.sql`
10. `0009_source_expansion_query_hints.sql`
11. `0010_source_expansion_strategy_origin_yield.sql`
12. `0011_source_expansion_strategy_origin_yield_backfill.sql`
13. `0012_growth_autonomy_core.sql`
14. `0013_growth_audit_events.sql`
15. `0014_growth_campaign_intelligence.sql`
16. `0015_growth_operator_cycle_events.sql`
17. `0016_growth_strategy_memory.sql`
18. `0017_growth_blackboard.sql`
19. `0018_growth_cycle_memory_snapshots.sql`
20. `0019_growth_approval_requests.sql`
21. `0020_growth_autonomous_discovery.sql`
22. `0021_business_autopilot_foundation.sql`
23. `0022_business_website_audit_records.sql`
24. `0023_growth_activity_budget_ledger.sql`
25. `0024_business_score_observation_flags.sql`

## Migration notes

- `0006_agent_settings.sql` and `0006_opportunity_run_audit.sql` intentionally share the `0006` prefix and are ordered by complete filename.
- `0010_source_expansion_strategy_origin_yield.sql` is a one-time schema migration.
- `0011_source_expansion_strategy_origin_yield_backfill.sql` is rerunnable data maintenance.
- `0012` through `0024` are additive metadata and control-plane migrations. They do not enable sending, posting, form submission, browser automation, AI calls, ad buying or external execution.
- `0023_growth_activity_budget_ledger.sql` atomically admits activity against one daily counter row, stores only hashed domain keys, forbids paid/AI/browser/external-action budgets, prevents claim deletion, and permits only one final completed or failed outcome.
- The `0023` ledger reserves conservative capacity before work begins. It does not claim to measure unrelated Cloudflare account activity and must remain below the reviewed Worker, D1 and Queue planning envelope.
- `0024_business_score_observation_flags.sql` adds one boolean provenance flag beside every Account 360 score. It marks only valid nonzero legacy values as observed, leaves ambiguous legacy zero defaults unobserved, and allows future writes to represent an explicitly observed score of zero without guessing.
- `0024` is one-time schema work. Verify the target first and do not reapply it after the columns exist.
- No one-time migration should be reapplied merely because a report looks stale. Inspect schema and saved metadata first.

## Growth zero-source autonomous discovery data model

Migration `0020_growth_autonomous_discovery.sql` adds the zero-source autonomous discovery data model used for internal plans, candidate metadata, review decisions and feedback. The migration does not enable crawling, sending, posting, form submission, AI calls, or external execution. Runtime policy and authenticated, exact-confirmation route contracts remain authoritative.
