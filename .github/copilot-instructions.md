# EVAVO Growth Research Worker Copilot instructions

Follow `AGENTS.md` and `evavo.reliability.json`.

Automated changes use the exclusive repository resource and commit directly to `main` only after the exact npm, TypeScript, route, safety and Wrangler dry-run gates pass. Do not create branches, pull requests or repositories. Pull with `--ff-only`; never force-push.

The repository must be private before release. Do not weaken its live visibility check. Keep outbound email, social posting, browser automation, production-repository mutation and unreviewed external execution disabled. Preserve the historical Cloudflare Worker and D1 identifiers unless an explicit infrastructure migration is approved.

Distinguish provider failures and missing confirmation evidence from real source defects. Never claim a Cloudflare deployment or live-private state that did not execute.
