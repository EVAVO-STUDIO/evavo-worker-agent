# Business metadata write boundary

The Business Autopilot Worker stores internal review metadata only. Its active metadata routes do not send email, post or comment on social platforms, submit forms, schedule meetings, execute browser actions, call AI, buy advertising or mutate external providers.

This document defines the request boundary for active Business metadata POST routes.

## Contract

The shared boundary contract is:

```text
business_metadata_write_boundary_v1
```

Every active generic Business POST must:

- authenticate through the central Worker admin-token boundary;
- reject every query parameter, including `?confirm=1`;
- read no more than 32 KiB of UTF-8 JSON;
- bound JSON depth, node count, array length, string length and key length;
- require an object body;
- require the exact JSON boolean `confirm: true`;
- require one route-specific entity wrapper;
- reject unknown top-level and entity fields;
- reject nested credential-shaped keys;
- reject invalid field shapes and out-of-range scores;
- return only a reduced request receipt, never the body hash or raw input;
- preserve `externalExecutionAllowed: false`.

Confirmation coercion is not allowed. Values such as `1`, `"1"`, `false` and `null` do not confirm a write.

## Active request wrappers

```text
/admin/business/organizations          { confirm: true, organization: { ... } }
/admin/business/signals                { confirm: true, signal: { ... } }
/admin/business/opportunities          { confirm: true, opportunity: { ... } }
/admin/business/service-matches        { confirm: true, serviceMatch: { ... } }
/admin/business/audit-packs            { confirm: true, auditPack: { ... } }
/admin/business/action-drafts/build    { confirm: true, draftRequest: { ... } }
/admin/business/suppression            { confirm: true, suppression: { ... } }
/admin/business/content-ideas          { confirm: true, contentIdea: { ... } }
/admin/business/followups              { confirm: true, followup: { ... } }
/admin/business/learning               { confirm: true, learningEvent: { ... } }
```

The dedicated people route has an equivalent bounded exact-confirmation boundary:

```text
/admin/business/people                 { confirm: true, person: { ... } }
```

Website, page, website-audit-run and audit-observation routes are separate route handlers and must retain equivalent bounded write contracts before they are treated as fully aligned.

## Score fields

Score-bearing generic routes accept only finite JSON numbers from `0` through `100`, or explicit `null` where the persistence layer supports clearing an observation.

An explicit zero is a valid observed score. A missing field is not equivalent to zero. String numbers are rejected.

Learning-event `scoreDelta` is separate from Account 360 score provenance and is bounded from `-10` through `10`.

## Sensitive-key rejection

Nested keys are rejected when they look like credentials or transport authority, including normalized forms containing:

```text
token
secret
password
apiKey
privateKey
serviceRole
bearer
authorization
cookie
```

The error response does not echo the rejected value.

## Reduced request receipt

Successful writes may return:

```json
{
  "contract": "bounded_admin_json_request_v1",
  "boundaryContract": "business_metadata_write_boundary_v1",
  "bytes": 412,
  "bodyHashAvailable": true
}
```

The SHA-256 body hash is computed by the bounded JSON reader but is not returned to the browser by this boundary.

## Historical routes that remain disabled

These direct write routes remain disabled and return `410 Gone`:

```text
POST /admin/business/action-drafts
POST /admin/business/approval-requests
```

The retained `/admin/business/action-drafts/build` route stores an internal historical review record only. It discards requested deliverable content and cannot create execution authority.

## Validation

The executable contracts are:

```text
tests/businessMetadataWriteBoundary.test.ts
tests/businessMetadataWriteRouteSource.test.ts
```

They verify exact confirmation, query rejection, field allowlists, sensitive-key rejection, bounded payloads, safe error responses and route-level removal of legacy raw-body fallbacks.

Routine validation does not deploy the Worker, apply D1 migrations or call external systems.
