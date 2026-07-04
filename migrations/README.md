# D1 migration order

Run migrations in filename order against the `evavo_outbound_agent` D1 database. The safest way to print the current command list from the checked-out repo is:

```powershell
cd C:\GitRepos\evavo-worker-agent

git pull
npm run db:migrations:check
npm run db:migrations:print
```

For current work, prefer the guarded one-migration helper:

```powershell
npm run db:migration:one -- 0014 --execute
npm run db:migration:one -- 0015 --execute
npm run db:migration:one -- 0016 --execute
npm run db:migration:one -- 0017 --execute
npm run db:migration:one -- 0018 --execute
npm run db:migration:one -- 0019 --execute
npm run db:migration:one -- 0020 --execute
npm run db:migration:one -- 0021 --execute
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
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0013_growth_audit_events.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0014_growth_campaign_intelligence.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0015_growth_operator_cycle_events.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0016_growth_strategy_memory.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0017_growth_blackboard.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0018_growth_cycle_memory_snapshots.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0019_growth_approval_requests.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0020_growth_autonomous_discovery.sql
npx wrangler d1 execute evavo_outbound_agent --remote --file migrations/0021_business_autopilot_foundation.sql
```

## Notes

- `npm run db:migrations:print` reads the local `migrations/` folder, so run `git pull` first.
- `0006_agent_settings.sql` and `0006_opportunity_run_audit.sql` intentionally share the `0006` prefix. The print helper uses full filename sorting.
- `0010_source_expansion_strategy_origin_yield.sql` is a one-time schema migration. It adds origin-yield columns to `source_expansion_strategy_scores`.
- `0011_source_expansion_strategy_origin_yield_backfill.sql` is a rerunnable data backfill. It refreshes the origin-yield counts for existing strategy rows.
- After applying `0010` and `0011`, run the source expansion learning route again so quality scores and recommendations are recalculated from the persisted origin-yield fields.
- If `0010` has already been applied, do not re-run it unless the database has been reset. Re-run `0011` whenever existing saved-source origin data needs to be backfilled again.
- `0012_growth_autonomy_core.sql` is additive schema only. It creates the Growth Autonomy data model for goals, channels, channel rules, signals, actions, drafts, outcomes, budget ledger, and suppression rules. It does not enable sending, posting, contact-form submission, AI drafting, or public execution.
- `0013_growth_audit_events.sql` is additive schema only. It creates the append-only Growth audit trail used to explain future autonomous decisions, metadata saves, safety gates, budget checks, and execution attempts. It does not enable external actions.
- `0014_growth_campaign_intelligence.sql` creates campaign, experiment, metric, evidence, decision, candidate-action, and learning tables for the internal campaign brain.
- `0015_growth_operator_cycle_events.sql` creates durable cycle event records for read-only operator snapshots.
- `0016_growth_strategy_memory.sql` creates objectives, key results, target segments, offer profiles, positioning profiles, and runtime constraints.
- `0017_growth_blackboard.sql` creates facts, entities, relationships, market signals, and asset inventory for the internal knowledge substrate.
- `0018_growth_cycle_memory_snapshots.sql` adds `strategy_json` and `blackboard_json` to cycle events so recorded history preserves the strategy and knowledge state used by each snapshot.
- `0019_growth_approval_requests.sql` creates the internal approval request queue for reviewable, confirmation-gated Growth operator packs.
- `0020_growth_autonomous_discovery.sql` creates the zero-source autonomous discovery data model: research runs, source candidates, robots cache, fetch queue, discovered pages, extracted signals, opportunity scores, agent decisions, and discovery feedback. It is schema-only and does not enable crawling, sending, posting, form submission, AI calls, or external execution.
- `0021_business_autopilot_foundation.sql` creates the broader Business Autopilot metadata foundation: organizations, people, websites, pages, signals, opportunities, service matches, audit packs, action drafts, approval requests, execution records, suppression records, content ideas, content calendar entries, follow-ups, and learning events. It is schema-only and does not enable sending, social posting, commenting, contact-form submission, browser automation, AI calls, ad buying, or external execution.
