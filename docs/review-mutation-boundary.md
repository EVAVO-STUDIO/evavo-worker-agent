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

Draft and opportunity reviews acquire a per-record D1 lease before reading mutable review context. They also acquire a hashed learning-scope lease before changing a shared strategy score. This prevents:

- duplicate concurrent decisions for one record;
- lost score increments from reviews that share a learning bucket;
- a stale holder releasing a newer lease.

Source-candidate commits use one broad commit lease because they may add several reviewed source records in one bounded operation.

A conflict returns HTTP `409` with `research_action_in_progress`. It does not enqueue, wait, retry automatically or switch to a scheduled executor.

## Atomic writes

A draft review commits its review row, strategy score, draft status, applicable lead status and audit event in one D1 batch.

An opportunity review commits its review row, opportunity status, strategy score and audit event in one D1 batch.

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

An `approved`, `shortlisted` or similar stored status remains internal review metadata only.
