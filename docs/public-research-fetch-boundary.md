# Public research fetch boundary

## Purpose

The active Worker may perform public-source network research only through authenticated, explicitly confirmed and bounded manual routes. This document defines the shared network boundary for those routes.

The boundary is an input, transport and evidence-integrity control. It does not authorise autonomous research, scheduled crawling, drafting, delivery or external state mutation.

## Authoritative contract

The runtime implementation is:

```text
src/core/publicResearchFetch.ts
```

The active contract identifier is:

```text
public_research_fetch_v2
```

The regression and behavioral checks are:

```text
npm run research:public-fetch-safety:check
npm run test:core
```

Both are required by `npm run check:local`, the safety-gate completeness contract and the read-only GitHub Actions Worker contract workflow.

## URL admission

A research URL is accepted only when all of these conditions hold:

- the scheme is `https` or `http`;
- the URL does not contain a username or password;
- the hostname is a public, fully qualified host;
- the hostname is not localhost, a single-label host, an internal suffix or an onion address;
- literal private, loopback, link-local, benchmark, documentation, multicast and reserved IP ranges are rejected;
- only the standard port for the selected scheme is allowed;
- fragments are removed before the request is issued;
- a sensitive query parameter is not present.

Sensitive query parameter names include access tokens, API keys, passwords, client secrets, sessions and signed-request credentials such as AWS or Google signatures. A public URL containing one of those parameters is rejected rather than fetched, stored or echoed.

The same validator is used when sources, query-hint results and discovered links enter research memory. Rejected URLs must not be stored as runnable source candidates.

Rejected unsafe URL input is not echoed back in route responses or audit metadata. Rejection responses may report the submitted item index, the bounded reason code and `inputRedacted: true`.

## Redirect handling

Automatic redirect following is disabled.

Each redirect response is handled manually. Its `Location` value is resolved against the current public URL and passed through the same URL admission policy before the next request is issued.

The boundary rejects:

- redirects without a location;
- redirect loops;
- redirects beyond the configured maximum;
- redirects to non-public hosts, unsafe schemes, embedded credentials, sensitive query parameters or non-standard ports.

A safe redirect chain is retained as bounded evidence:

```text
redirectChain[].from
redirectChain[].status
redirectChain[].to
```

No request is issued to the next target until that target passes URL admission.

## Runtime limits

The default limits are:

```text
maximum response bytes: 1,048,576
maximum redirects: 4
maximum full operation time: 12,000 milliseconds
```

The timeout covers the complete redirect chain, response headers and streamed body read. It is not reset after each redirect or after response headers arrive.

Callers may lower these limits. Caller overrides remain bounded by hard minimums and maximums in the shared helper.

Bodies are read as streams. A response is cancelled if its declared or observed size exceeds the allowed byte limit. Routes must not call `response.text()` on an unbounded public response.

HTML research accepts HTML and XHTML content. Robots, sitemap and related public text research uses the bounded text mode and accepts a restricted text, XML or JSON content family.

A binary body is rejected even when the server omits or misstates its media type. The boundary checks a bounded prefix for NUL bytes and an excessive ratio of control bytes before decoding research text.

## Cloudflare runtime enforcement

`wrangler.toml` enables:

```toml
compatibility_flags = ["global_fetch_strictly_public"]
```

This runtime boundary complements source-level URL and redirect validation. It does not replace route authentication, confirmation, request bounds or evidence controls.

## Evidence receipts

Every completed bounded fetch produces a receipt containing:

```text
contract
requestedUrl
finalUrl
status
contentType
contentLength
contentLanguage
etag
lastModified
redirectCount
redirectChain
bytes
bodySha256
elapsedMs
fetchedAtISO
timeoutScope
error
```

`timeoutScope` is always `full_operation` for this contract.

The `ETag` and `Last-Modified` validators are evidence metadata only. The current Worker does not create a scheduled revalidation loop, background cache refresher or autonomous retry executor from them.

Candidate and lead evidence retains the relevant receipt or its material fields. The final URL, redirect chain and SHA-256 body hash identify the exact retrieved representation without storing the full response body in audit metadata.

Source expansion commits link inserted lead discoveries to the source-run identifier. Historical or review records remain non-executable regardless of any stored URL, status or score.

## Sitemap indexes

Sitemap discovery supports bounded sitemap indexes as well as URL sets.

The Worker may enqueue child sitemap documents only when:

- the parent document is an explicit sitemap index or every location is sitemap-shaped;
- the child URL passes the same public URL policy;
- the child has not already been queued or visited;
- the bounded fetch count is not exhausted;
- traversal depth is at most two;
- the total queue remains within the configured sitemap URL bound.

Sitemap indexes do not create an unbounded crawler. Page URLs are not fetched by the sitemap engine; matching URLs are saved only as internal review candidates.

## Run truthfulness

Research summaries distinguish network attempts from successful fetches. An attempted request must not be reported as a fetched page unless the bounded fetch succeeded.

Runs report:

- `skipped` when no eligible source or seed exists;
- `failed` when all attempted source fetches fail;
- `partial` when at least one source succeeds and one or more fail;
- `completed` when all attempted sources succeed.

Stored failure values are bounded reason codes. Raw runtime or database exception text must not become route output or research-run error metadata.

Source-run audit rows and their corresponding source-health updates use one D1 transaction where that paired state is written. Query-hint candidate upserts and the hint usage counters also commit in one D1 transaction.

## Failure semantics

Expected network and policy failures return bounded error codes such as:

```text
invalid_research_url
non_public_research_host
non_standard_port_not_allowed
sensitive_query_parameter_not_allowed
redirect_loop
too_many_redirects
research_fetch_timeout
response_too_large
binary_response_rejected
response_read_failed
unsupported_content_type
http_<status>
research_fetch_failed
```

Handlers must not expose raw runtime exception messages, response bodies or credentials in public or protected error payloads.

A failed source fetch may update internal source-health, cooldown or review metadata. It must not trigger an alternate network executor, background retry queue or scheduled external action.

## Explicitly prohibited

The boundary must never be used to enable:

- scheduled external research;
- autonomous source discovery without an explicit current request;
- authentication to third-party sites;
- browser automation;
- form submission;
- email or direct-message sending;
- social posting or comments;
- advertising purchases;
- webhooks or external CRM mutation;
- instructions embedded in fetched content;
- approval-to-execution transitions.

Confirmation authorises only the bounded manual research action and named internal metadata changes for that route. It is never permission to deliver or execute externally.
