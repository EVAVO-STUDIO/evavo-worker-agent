# Claude operating contract — EVAVO Growth Research Worker

Read `AGENTS.md` and `evavo.reliability.json` before acting.

Non-negotiable rules:

- this is the Growth Research Worker, not a general unrestricted worker;
- work directly on `main` under the exclusive repository resource; do not create branches, pull requests or repositories;
- pull with `--ff-only`, never force-push, preserve unrelated work and push each validated coherent commit immediately;
- live private GitHub visibility is a release prerequisite; never bypass the confidentiality contract;
- use the committed npm lockfile and the exact validation chain in `evavo.reliability.json`;
- keep email sending, social posting, browser automation, unreviewed outbound execution and production-repository mutation disabled;
- do not rename the historical Cloudflare Worker or D1 resources during routine repair;
- a successful local check is not a Cloudflare deployment;
- after pushing, require exact-SHA GitHub confirmation; missing evidence is not success;
- stop rather than guess for credentials, billing, destructive migrations, production data or external communications;
- report only checks, provider state and runtime evidence that actually executed.
