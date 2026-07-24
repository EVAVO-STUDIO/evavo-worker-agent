# Growth proposal delivery key configuration

The Growth Research Worker can select a tenant-scoped signing key for a future proposal delivery request, but key selection does not send or schedule that request.

## Current code

```text
src/core/growthProposalDeliveryKeyConfiguration.ts
fixtures/growth-worker-key-registry-v1.json
tests/growthProposalDeliveryKeyConfiguration.test.ts
```

The mirrored receiving-side registry lives in `EVAVO-STUDIO/next-website`.

## Contract

The registry version is:

```text
growth_worker_key_registry_v1
```

The reserved Worker binding name is:

```text
EVAVO_GROWTH_WORKER_PROPOSAL_KEYS_JSON
```

The module currently parses an explicitly supplied object or JSON string. It does not read the binding from `Env`, `process.env`, global state or Worker D1.

## Exact registry shape

```json
{
  "contractVersion": "growth_worker_key_registry_v1",
  "keys": [
    {
      "keyId": "worker-primary-2026-07",
      "secret": "<dedicated bridge signing secret>",
      "organisationId": "<uuid>",
      "workspaceId": "<uuid>",
      "state": "active",
      "notBefore": "<UTC timestamp>",
      "expiresAt": "<UTC timestamp>"
    }
  ]
}
```

Unknown or missing registry and key-entry fields fail closed.

## Rotation model

Each configured organisation/workspace must have exactly one `active` key. It may also have at most one `retiring` key.

The intended rotation sequence is:

```text
existing active key -> retiring
replacement key     -> active
```

Rules:

- only the active key can be selected for new request signing;
- a retiring key is recorded only so the receiving system can accept a short overlap during rotation;
- the Worker selector never returns a retiring key for signing;
- every key ID is globally unique within the registry;
- a secret cannot be reused by another key or tenant;
- every key is bound to one organisation and workspace;
- the active key must have at least five minutes remaining;
- a retiring key may have at most seven days remaining;
- total key lifetime may not exceed 180 days;
- future, expired, reversed or malformed validity windows fail closed.

The receiving system must apply the same tenant scope and validity rules before signature verification.

## Configuration limits

```text
maximum JSON bytes: 16,000
maximum keys: 8
minimum secret bytes: 32
maximum secret bytes: 512
maximum key lifetime: 180 days
active minimum remaining lifetime: 5 minutes
retiring maximum remaining lifetime: 7 days
```

Key IDs are bounded opaque identifiers. Paths, traversal-like `..` segments, leading punctuation and trailing punctuation are rejected.

## Secret handling

The registry contains signing secrets in memory, so it is server/Worker-only.

The public registry summary contains only:

```text
contractVersion
keyCount
activeKeyCount
retiringKeyCount
tenantCount
acceptsRetiringKeysForVerificationOnly: true
selectsRetiringKeysForSigning: false
exposesSecrets: false
```

`JSON.stringify(registry)` returns that summary. It does not return key IDs, tenant IDs or secrets.

The canonical fixture uses test-only secrets. No production credential belongs in the repository.

## Construction and authenticity

The implementation class and construction token are module-private. A caller cannot construct a trusted registry directly.

`assertGrowthProposalDeliveryKeyRegistry` accepts only an object created by the validated parser. Structural copies and forged objects fail closed.

## Relationship to request signing

The selected active key can be passed to:

```text
signGrowthProposalRequest
```

The deterministic test proves that the selected key reproduces the canonical `growth_worker_request_v1` fixture, including its body hash and HMAC signature.

Key selection and request signing remain separate modules. Neither module performs transport.

## Current non-capabilities

This module does not:

- call `fetch`;
- read `Env` or `process.env`;
- read or write Worker D1;
- import the Worker dispatcher;
- expose an HTTP route;
- run from a scheduled entrypoint;
- retry delivery;
- log secrets;
- create or promote canonical Growth records;
- send email, post content, submit forms or mutate providers;
- enable `bridgeEnabled`.

A later delivery orchestrator must be a separate, explicitly reviewed boundary with bounded transport, safe retries, delivery audit state and no reuse of `ADMIN_TOKEN`.