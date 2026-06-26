# D1 migration order

Run migrations in filename order against the `evavo_outbound_agent` D1 database. The safest way to print the current command list from the checked-out repo is:

```powershell
cd C:\GitRepos\evavo-worker-agent

git pull
npm run db:migrations:check
npm run db:migrations:print
```

At the time of writing, the full remote order is:

```powershell
cd C:\GitRepos\evavo-worker-agent

npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0001_free_safe_core.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0002_draft_review_learning.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0003_source_intelligence.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0004_opportunity_intelligence.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0005_opportunity_review_learning.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0006_agent_settings.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0006_opportunity_run_audit.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0007_source_expansion_memory.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0008_source_expansion_strategy_quality.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0009_source_expansion_query_hints.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0010_source_expansion_strategy_origin_yield.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0011_source_expansion_strategy_origin_yield_backfill.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0012_growth_autonomy_core.sql
```

## Notes

- `npm run db:migrations:print` reads the local `migrations/` folder, so run `git pull` first.
- `0006_agent_settings.sql` and `0006_opportunity_run_audit.sql` intentionally share the `0006` prefix. The print helper uses full filename sorting.
- `0010_source_expansion_strategy_origin_yield.sql` is a one-time schema migration. It adds origin-yield columns to `source_expansion_strategy_scores`.
- `0011_source_expansion_strategy_origin_yield_backfill.sql` is a rerunnable data backfill. It refreshes the origin-yield counts for existing strategy rows.
- After applying `0010` and `0011`, run the source expansion learning route again so quality scores and recommendations are recalculated from the persisted origin-yield fields.
- If `0010` has already been applied, do not re-run it unless the database has been reset. Re-run `0011` whenever existing saved-source origin data needs to be backfilled again.
- `0012_growth_autonomy_core.sql` is additive schema only. It creates the Growth Autonomy data model for goals, channels, channel rules, signals, actions, drafts, outcomes, budget ledger, and suppression rules. It does not enable sending, posting, contact-form submission, AI drafting, or public execution.
