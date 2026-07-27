# Growth proposal request signature

The Growth Research Worker can prepare a signed, proposal-only HTTP request for a future `next-website` ingestion boundary.

This module is a pure producer. It does not send the request, open a network connection, read environment variables, write Worker D1, call AI, mutate a provider or promote a canonical Growth record.

## Current code

```text
src/core/growthProposalPacket.ts
src/core/growthProposalRequestSignature.ts
src/core/growthProposalDeliveryKeyConfiguration.ts
fixtures/growth-worker-proposal-v1.json
fixtures/growth-worker-request-v1.json
fixtures/growth-worker-key-registry-v1.json
tests/growthProposalRequestSignature.test.ts
tests/growthProposalDeliveryKeyConfiguration.test.ts
tests/growthProposalDeliveryKeyConfigurationSource.test.ts
docs/growth-proposal-delivery-key-configuration.md
```

## Contracts

Proposal body:

```text
growth_worker_proposal_v1
```

Signed request:

```text
growth_worker_request_v1
```

Tenant key registry:

```text
growth_worker_key_registry_v1
```

Reserved target:

```text
POST /api/private/growth/worker-proposals
Content-Type: application/json
```

The target route is not called by the signer. Deployment configuration and transport remain disabled until receiving-route review, explicit key loading, nonce persistence, rate limiting and end-to-end smoke coverage are completed together.

## Dedicated credential

The request uses a dedicated bridge signing secret and key ID.

It must not reuse:

- `ADMIN_TOKEN`;
- a private owner session secret;
- a Supabase service-role key;
- a CRM/provider token;
- an Operations Core launch secret.

The bridge secret stays in Worker secret storage. It is passed into the signer by trusted server-side orchestration and is never returned in the signed request object, body, headers, logs or fixtures.

The deterministic fixture uses documented test-only secrets. The secret is not included in the fixture itself. No production credential belongs in the repository or compatibility fixtures.

## Tenant-scoped key selection

`src/core/growthProposalDeliveryKeyConfiguration.ts` parses an explicitly supplied `growth_worker_key_registry_v1` registry and selects the one active key assigned to an organisation/workspace.

The selector enforces:

- exact configuration and key-entry fields;
- tenant UUID scope;
- exactly one active key per configured tenant;
- at most one retiring key per tenant;
- unique key IDs and no secret reuse;
- bounded secret, registry and key counts;
- bounded validity windows;
- a short active/retiring overlap for rotation;
- active-key selection only for new signing.

A retiring key is never returned for new Worker request signing. It exists only so the receiver can accept a short rotation overlap.

The selector does not read `Env`, `process.env`, Worker D1 or runtime configuration. It does not call the signer or transport. Key selection, signing and future delivery remain separate review boundaries.

## Canonical packet prerequisite

`signGrowthProposalRequest` accepts only a packet that is already exact canonical output from `buildGrowthProposalPacket`.

Before signing it:

1. checks the exact packet field set;
2. checks every evidence item has the exact evidence field set;
3. rebuilds the packet through the authoritative packet builder;
4. requires byte-for-byte equality between the supplied packet JSON and rebuilt canonical JSON.

A cast object with altered version, source system, proposal mode, execution flag, promotion flag, field order or normalized value is rejected instead of silently repaired.

## Signed components

The exact HMAC input is:

```text
version:growth_worker_request_v1
method:POST
path:/api/private/growth/worker-proposals
content-type:application/json
key-id:<key ID>
request-id:<request ID>
timestamp:<Unix seconds>
nonce:<32-byte unpadded base64url nonce>
content-sha256:<lowercase SHA-256 of compact body bytes>
```

The signature header is:

```text
x-evavo-growth-signature: sha256=<lowercase HMAC-SHA256 hex>
```

Other required headers are:

```text
x-evavo-growth-contract-version
x-evavo-growth-key-id
x-evavo-growth-request-id
x-evavo-growth-timestamp
x-evavo-growth-nonce
x-evavo-growth-content-sha256
```

TLS remains required for transport confidentiality. The HMAC authenticates integrity and source; it is not encryption.

## Freshness and replay posture

The Worker signer emits the current Unix timestamp unless a deterministic test timestamp is provided. A supplied timestamp must be within 30 seconds of the provided clock.

The nonce is 32 cryptographically random bytes encoded as 43-character unpadded base64url.

A legitimate retry must create a new:

- request ID;
- timestamp;
- nonce.

It preserves the same canonical proposal body and proposal idempotency key. The receiving database distinguishes a safe proposal replay from a captured-request replay.

## Canonical fixtures

`fixtures/growth-worker-request-v1.json` is the cross-repository signed-request compatibility fixture.

`fixtures/growth-worker-key-registry-v1.json` is the matching tenant key-rotation fixture.

The Worker tests prove that:

- the producer emits the exact signed-request fixture object;
- compact body bytes equal `JSON.stringify` of the proposal fixture;
- SHA-256 matches an independent Node computation;
- HMAC-SHA256 matches an independent Node computation;
- header names and values match the receiving contract;
- the active tenant key selected from the registry reproduces the same request fixture;
- retiring keys are not selected for new signing;
- the secret is absent from body and returned signed-request output.

`next-website` carries the same fixtures under `tests/fixtures` and independently verifies the request and key-registry contracts.

## Fail-closed rules

The signer rejects:

- missing or extra packet fields;
- missing or extra evidence fields;
- noncanonical packet ordering or values;
- execution or canonical-promotion flags;
- weak or whitespace-modified secrets;
- path-shaped or traversal-shaped key IDs and request IDs;
- malformed or noncanonical nonces;
- stale, future or fractional signing timestamps;
- malformed body hashes in the canonical input builder;
- invalid clocks.

The key selector rejects:

- unknown or missing registry fields;
- duplicate key IDs;
- reused secrets;
- invalid tenant UUIDs;
- no active key or multiple active keys for a tenant;
- multiple retiring keys for a tenant;
- future, expired or reversed key windows;
- active keys too close to expiry;
- retiring keys with an excessive overlap window;
- registries that are oversized or structurally forged.

## Current limits

The current implementation does not yet:

- load a bridge secret from `Env`;
- load the registry from Worker `Env`;
- send an HTTP request;
- retry transport failures;
- record a Worker-side delivery audit event;
- expose a scheduled or admin send route;
- enable `bridgeEnabled`;
- perform canonical promotion or external execution.

Those responsibilities require separate contracts and must not be added to the pure packet builder, tenant key selector or signer modules.
