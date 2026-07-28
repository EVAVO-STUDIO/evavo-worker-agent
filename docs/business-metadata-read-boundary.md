# Business metadata read query boundary

Business collection reads are authenticated, read-only and internal. They do not call AI, browse, send, post, submit forms, schedule meetings or mutate external systems.

The shared query contract is:

```text
business_metadata_read_query_v1
```

Before Business collection handlers run, the Worker entrypoint validates the exact route query shape. The guard:

- permits only `limit` and the route's documented filter;
- rejects unknown parameters;
- rejects duplicate parameters;
- accepts only canonical base-10 integer limits;
- rejects zero, negative, fractional, exponential, padded and out-of-range limits;
- bounds text filters and rejects empty, padded or control-character values;
- accepts suppression `active` only as `0` or `1`;
- returns finite, non-echoing `400` failures;
- performs no D1 query when validation fails.

The guarded collection routes are organizations, signals, opportunities, service matches, audit packs, historical draft and approval reads, suppression, content ideas, follow-ups, learning, websites, pages, website audit runs, audit observations and audit-observation candidates.

The dynamic Account 360 route and the dedicated people route retain their existing specialised parsers.

Validation is provided by:

```text
tests/businessMetadataReadBoundary.test.ts
tests/businessMetadataReadIndexSource.test.ts
```

Routine validation does not deploy the Worker, apply migrations or call external systems.
