# EVAVO Growth Research Worker agent instructions

This repository is the canonical EVAVO Growth Research Worker. The historical package, Cloudflare Worker and D1 identifiers use `evavo-outbound-agent` for compatibility; they do not authorise outbound execution.

Read this file, `CLAUDE.md`, `.github/copilot-instructions.md`, `evavo.reliability.json`, `README.md` and the applicable source-boundary checks before changing code.

## Current release blocker

The repository is governed as private. Until live GitHub metadata confirms `private: true`, `visibility: private` and `archived: false`, release, deployment and sensitive operation are blocked. Do not weaken, bypass or delete the visibility checks to obtain a green result.

## Mainline development

- Automated work uses `main`; do not create feature, repair, release or validation branches or pull requests.
- Acquire the exclusive resource `repository-main:EVAVO-STUDIO/evavo-worker-agent` before writing.
- Begin from a clean worktree, fetch `origin`, pull `main` with `--ff-only`, and abort if the remote head advances.
- Never force-push. Preserve unrelated work and never stage a dirty repository wholesale.
- Commit one coherent change after the exact checks pass, push it immediately, then request exact-SHA confirmation.
- Do not create another worker or maintenance repository for a capability owned here, in Development Studio or in Operations Core.

## Required validation

Use the committed lockfile and Node 24:

```powershell
node scripts/check-worker-repository-visibility.mjs --live
npm ci --no-audit --no-fund
npm run check:local
npm run growth:generated-routes:check
npm run worker:powershell:check
npm run growth:backend:aggregate:check
npm exec wrangler -- deploy --dry-run --outdir .evavo-confirmation/worker-bundle
```

After a validated push, Development Studio must request the exact current SHA through `.github/workflows/evavo-mainline-confirmation.yml`. Missing provider evidence is not success.

## Capability boundary

Allowed work is bounded public research, internal defensive settings, internal planning and review records, and read-only or review-safe operator surfaces.

The active source must not enable:

- email sending;
- social posting;
- browser automation;
- unreviewed outbound execution;
- credential or billing mutation;
- production repository mutation;
- destructive D1 migration;
- renaming the historical Cloudflare Worker or D1 resources without a separately reviewed migration.

The worker must not deploy merely because a source check passed. Cloudflare deployment requires separate reviewed credentials, an exact source SHA, migration readiness, rollback evidence and a post-deployment health check.

## Failure handling

Classify the first causal failure before editing:

- public repository visibility is a governance blocker, not a source-code defect;
- a zero-step GitHub Actions job is provider infrastructure failure;
- a canceled or skipped provider operation is not a successful build;
- TypeScript, tests, route contracts and Wrangler dry-run defects are source or toolchain failures and require the narrowest reversible repair.

Never claim a deployment, live-private state, migration, runtime test or provider confirmation that did not execute.
