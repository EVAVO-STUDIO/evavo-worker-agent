# Business metadata read query boundary

Business reads are authenticated, read-only and internal. They do not call AI, browse, send, post, submit forms, schedule meetings or mutate external systems.

The shared query contract is:

```text
business_metadata_read_query_v1
```

## Two-stage validation

Every `GET` request in the exact `/admin/business` route family is structurally preflighted before Business dispatch. That includes:

- static collection routes;
- the dynamic Account 360 route;
- the dedicated people route;
- unknown `/admin/business/**` paths that will later return `404`.

The family preflight bounds and validates query structure before a handler can run. It:

- limits the encoded query string to 2,048 characters;
- limits each request to 16 query parameters;
- limits query keys to 64 safe characters and values to 256 decoded characters;
- rejects duplicate parameters;
- rejects unsafe keys and control characters;
- redacts unsafe or oversized parameter names from failure responses;
- returns finite, non-echoing `400` failures;
- performs no D1 query when validation fails.

After the family preflight succeeds, static collection routes run route-specific parsing. That second stage:

- permits only `limit` and the route's documented filter;
- rejects unknown parameters;
- accepts only canonical base-10 integer limits;
- rejects zero, negative, fractional, exponential, padded and out-of-range limits;
- bounds text filters and rejects empty, padded or control-character values;
- accepts suppression `active` only as `0` or `1`.

Account 360 and people retain their specialised semantic parsers after the shared structural preflight. This preserves their existing route-specific limits and fields without allowing malformed query structure to reach those handlers.

## Canonical route ownership

Business route-family and static path ownership are defined once in:

```text
src/core/businessRoutePaths.ts
```

The registry owns the exact `/admin/business` family prefix, the Account 360 pattern, the people path and every static collection group. The route-policy resolver, family preflight and collection parser consume those constants.

The collection read option map is typed against the complete guarded-path union, so adding a canonical collection path without a query specification fails TypeScript validation rather than silently bypassing the route-specific guard.

The guarded collection routes are organizations, signals, opportunities, service matches, audit packs, historical draft and approval reads, suppression, content ideas, follow-ups, learning, websites, pages, website audit runs, audit observations and audit-observation candidates.

Prefix matching is exact: `/admin/business` and `/admin/business/**` belong to the family, while adjacent paths such as `/admin/businesses` and `/admin/business-like` do not.

## Validation

Validation is provided by:

```text
tests/businessMetadataReadBoundary.test.ts
tests/businessMetadataReadIndexSource.test.ts
tests/businessRoutePathParity.test.ts
scripts/check-business-route-policy.mjs
```

The contracts verify that:

- family preflight runs before collection parsing and Business dispatch;
- Account 360 and people are structurally preflighted but retain specialised semantic parsers;
- every canonical collection path resolves to the intended handler and both read guards;
- unknown Business paths cannot bypass structural query limits;
- adjacent non-Business prefixes are not captured;
- route ownership is not duplicated or omitted.

Routine validation does not deploy the Worker, apply migrations or call external systems.
