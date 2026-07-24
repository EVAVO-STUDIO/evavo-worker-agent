# Review mutation boundary

The EVAVO Growth Research Worker stores operator review decisions as internal planning metadata. A review may update an internal status or learning score, but it never authorises drafting, sending, posting, applying, browser automation or any other external execution.

## Request boundary

Every protected review mutation requires:

- authenticated `ADMIN_TOKEN` access;
- `Content-Type: application/json`;
- a streamed and structurally bounded JSON object;
- the exact JSON boolean `confirm: true`;
- a path-safe record identifier;
- bounded text fields without unsafe control characters;
- a SHA-256 request-body receipt that excludes the raw body.

Numeric or string confirmation compatibility values are not accepted. Query-string confirmation is not accepted.

## Concurrency

Modern draft and opportunity reviews acquire a per-record D1 lease before reading mutable review context. They also acquire a hashed learning-scope lease before changing a shared strategy score. This prevents:

- duplicate concurrent decisions for one record;
- lost score increments from reviews that share a learning bucket;
- a stale holder releasing a newer lease.

The legacy `/admin/drafts/:id/approve` and `/admin/drafts/:id/reject` compatibility routes use the same `draft-review:<draft-id>` lease as the modern draft-review route. A legacy decision therefore cannot race a modern review for the same draft. The compatibility route does not change a learning score and does not acquire a strategy lease.

Source-candidate commits use one broad commit lease because they may add several reviewed source records in one bounded operation.

A conflict returns HTTP `409` with `research_action_in_progress`. It does not enqueue, wait, retry automatically or switch to a scheduled executor.

## Source-candidate admission

A source-candidate commit accepts at most 25 reviewed URLs. Each URL must be HTTPS and must pass the same `public_research_fetch_v2` URL-admission policy used by bounded manual research.

The route and application service independently reject:

- private, loopback, link-local, reserved, internal, onion and single-label hosts;
- embedded URL credentials;
- non-standard ports;
- sensitive query parameters such as access tokens, API keys, passwords, sessions and request signatures;
- malformed or non-HTTPS URLs;
- URLs outside the reviewed deterministic or expansion-candidate set.

Validation does not fetch the URL. Source-candidate commits remain network-free internal metadata writes.

When selected candidates have expansion evidence, their metadata is loaded with one parameterised D1 `WHERE url IN (...)` query rather than one query per selected URL. This keeps the bounded 25-item commit predictable and avoids an unnecessary N+1 read pattern.

## Atomic writes

A modern draft review commits its review row, strategy score, draft status, applicable lead status and audit event in one D1 batch.

A legacy draft compatibility decision commits its lead status, draft status and audit event in one D1 batch while the shared draft lease is held.

An opportunity review commits its review row, opportunity status, strategy score and audit event in one D1 batch.

A source-candidate commit places all accepted `opportunity_sources` inserts, applicable `source_expansion_candidates` marker updates and one audit event in the same D1 batch. A failure therefore does not leave only part of the reviewed selection saved.

The audit event records a request-body fingerprint and a review-only, non-executable posture. It never stores the administrator token or raw request body.

## Rating and text rules

Opportunity ratings are exact integers from 1 through 5. Numeric strings and fractional values are rejected. Supplying both the current and legacy name for one rating is rejected as ambiguous.

Reasons, reviewer names, notes, actor names and strategy keys have explicit length limits. Long text fails validation rather than being silently accepted into an unbounded database write.

## External capability posture

Review routes:

- do not call public networks;
- do not call AI;
- do not send email;
- do not post social content;
- do not submit forms;
- do not apply for opportunities;
- do not create executable deliverables.

An `approved`, `shortlisted` or similar stored status remains internal review metadata only. Legacy compatibility naming does not weaken this posture.
