# Public research fetch boundary

## Purpose

The active Worker may perform public-source network research only through authenticated, explicitly confirmed and bounded manual routes. This document defines the shared network boundary for those routes.

The boundary is an input, transport and evidence-integrity control. It does not authorise autonomous research, scheduled crawling, drafting, delivery or external state mutation.

## Authoritative contract

The runtime implementation is:

```text
src/core/publicResearchFetch.ts
```

The contract identifier is:

```text
public_research_fetch_v1
```

The regression checker is:

```text
npm run research:public-fetch-safety:check
```

That checker is required by `npm run check:local`, the safety-gate completeness contract and the read-only GitHub Actions Worker contract workflow.

## URL admission

A research URL is accepted only when all of these conditions hold:

- the scheme is `https` or `http`;
- the URL does not contain a username or password;
- the hostname is a public, fully qualified host;
- the hostname is not localhost, a single-label host, an internal suffix or an onion address;
- literal private, loopback, link-local, benchmark, documentation, multicast and reserved IP ranges are rejected;
- only the standard port for the selected scheme is allowed;
- fragments are removed before the request is issued.

The same validator is used when sources, query-hint results and discovered links enter research memory. Rejected URLs must not be stored as runnable source candidates.

## Redirect handling

Automatic redirect following is disabled.

Each redirect response is handled manually. Its `Location` value is resolved against the current public URL and passed through the same URL admission policy before the next request is issued.

The boundary rejects:

- redirects without a location;
- redirect loops;
- redirects beyond the configured maximum;
- redirects to non-public hosts, unsafe schemes, embedded credentials or non-standard ports.

## Runtime limits

The default limits are:

```text
maximum response bytes: 1,048,576
maximum redirects: 4
timeout per request: 12,000 milliseconds
```

Callers may lower these limits. Caller overrides remain bounded by hard minimums and maximums in the shared helper.

Bodies are read as streams. A response is cancelled if its declared or observed size exceeds the allowed byte limit. Routes must not call `response.text()` on an unbounded public response.

HTML research accepts HTML and XHTML content. Robots, sitemap and related public text research uses the bounded text mode and accepts a restricted text, XML or JSON content family.

## Cloudflare runtime enforcement

`wrangler.toml` enables:

```toml
compatibility_flags = ["global_fetch_strictly_public"]
```

This runtime boundary complements source-level URL and redirect validation. It does not replace route authentication, confirmation, request bounds or evidence controls.

## Evidence receipts

Every successful bounded fetch produces a receipt containing:

```text
contract
requestedUrl
finalUrl
status
contentType
redirectCount
bytes
bodySha256
elapsedMs
fetchedAtISO
error
```

Candidate and lead evidence should retain the relevant receipt or its material fields. The final URL and SHA-256 body hash identify the exact retrieved representation without storing the full response body in audit metadata.

Source expansion commits link inserted lead discoveries to the source-run identifier. Historical or review records remain non-executable regardless of any stored URL, status or score.

## Failure semantics

Expected network and policy failures return bounded error codes such as:

```text
invalid_research_url
non_public_research_host
non_standard_port_not_allowed
redirect_loop
too_many_redirects
research_fetch_timeout
response_too_large
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
