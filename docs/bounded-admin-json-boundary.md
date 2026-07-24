# Bounded admin JSON boundary

## Purpose

Authenticated routes still receive untrusted request bytes. Authentication does not make a body small, valid, well-shaped or safe to merge into internal metadata.

The shared boundary for confirmed manual research and source-management requests is:

```text
src/core/boundedJsonRequest.ts
bounded_admin_json_request_v1
```

It is an input-integrity and resource-governance control. It does not grant research, mutation, drafting or delivery permission.

## Media type

A bounded JSON route accepts:

```text
application/json
application/*+json
```

Parameters such as `charset=utf-8` are allowed. Other media types fail with HTTP 415 and:

```text
json_content_type_required
```

## Byte limit

The default maximum request body size is 65,536 bytes.

The boundary checks a valid decimal `Content-Length` before reading. It also streams and counts the actual bytes, so a missing, false or smaller declared length cannot bypass the observed limit.

Oversized bodies fail with HTTP 413 and:

```text
request_body_too_large
```

The stream is cancelled once the observed limit is exceeded.

## Encoding and syntax

The body must be valid UTF-8 and valid JSON.

Failures use stable codes:

```text
invalid_content_length
request_body_read_failed
invalid_utf8_json
invalid_json
json_object_required
```

The root must be a JSON object. Arrays, strings, numbers, booleans and `null` are not accepted as route bodies.

## Structural limits

The shared parser applies bounded limits to:

- nesting depth;
- total visited nodes;
- array length;
- string length;
- key length.

The keys `__proto__`, `prototype` and `constructor` are rejected at any depth. This prevents untrusted route data from becoming a prototype-pollution primitive when code later copies or merges an object.

## Confirmation

Confirmation is the exact JSON boolean `true`:

```json
{
  "confirm": true
}
```

The following are not confirmation:

```json
{
  "confirm": 1
}
```

```json
{
  "confirm": "1"
}
```

```json
{
  "confirm": "true"
}
```

Query-string confirmation is not accepted.

Confirmation authorises only the specific bounded manual research action or named internal metadata write handled by the route. It is never drafting, approval-to-execution or external-delivery permission.

## Request receipt

A valid body produces a compact internal receipt:

```text
contract
bytes
bodySha256
```

The SHA-256 fingerprint lets an operator correlate the exact confirmed request without retaining or echoing the full body. The full request body is never logged or returned.

Rejected responses include a stable error code, the request-body contract and the configured byte limit. They do not include raw request content, unsafe URLs, credentials or parser exception messages.

## Defence in depth

Legacy source routes are checked centrally before dispatch and again by their handler. Other manual research handlers enforce the boundary directly before acquiring a research lease or reading settings.

The required validation commands are:

```powershell
npm run research:bounded-json-safety:check
npm run test:core
```

Both are part of `npm run check:local` and the read-only Worker contract workflow.

## Explicitly prohibited

The boundary must not be weakened to permit:

- confirmation through a URL query parameter;
- numeric or string confirmation coercion;
- unbounded `request.json()` or `request.text()` reads;
- parsing before authentication;
- raw body logging;
- automatic retries after a rejected request;
- scheduled fallback execution;
- external state mutation.
