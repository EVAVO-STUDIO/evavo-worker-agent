# Growth Route Parity

Date: 2026-07-24

This document defines the Worker side of the static route-parity contract shared with `EVAVO-STUDIO/next-website`.

## Contract

The mirrored fixture is:

```text
fixtures/growth-worker-route-parity-v1.json
```

The mirrored pure parser is:

```text
src/core/growthWorkerRouteParity.ts
```

Its contract version is:

```text
growth_worker_route_parity_v1
```

The same bytes must exist at:

```text
next-website/tests/fixtures/growth-worker-route-parity-v1.json
next-website/src/server/growth-autopilot/growthWorkerRouteParity.ts
```

The fixture pins:

- the website and Worker repository names;
- `/api/private/growth/worker-proposals`;
- `growth_worker_proposal_v1`;
- `growth_worker_request_v1`;
- `growth_worker_bridge_v2`;
- `growth_worker_route_inventory_v2`;
- website Next adapter and page-handler versions;
- website page state;
- bridge and delivery disabled posture;
- the exact blockers required by that page state.

The parser accepts unknown input, requires exact fields and canonical JSON, freezes its result and rejects premature bridge or delivery enablement.

## Conditional blocker posture

### Current page-absent state

```text
pageState: absent
bridgeEnabled: false
deliveryEnabled: false
blockers:
  - next_website_ingestion_endpoint_not_implemented
  - cross_repo_contract_tests_not_implemented
```

### Approved page-present state before delivery

```text
pageState: present
bridgeEnabled: false
deliveryEnabled: false
blockers:
  - worker_proposal_delivery_not_implemented
  - cross_repo_contract_tests_not_implemented
```

The present state must not retain `next_website_ingestion_endpoint_not_implemented`. This fixes the previous contradictory shape where `pageState: present` was nominally allowed but the validator still required the absent-page blocker.

The Worker still performs no proposal HTTP delivery.

The following remain disabled:

- browser access;
- Worker admin-token exposure;
- canonical Growth promotion;
- email sending;
- social posting;
- form submission;
- provider write-back;
- external execution;
- scheduled delivery.

## Validation

Run:

```powershell
node scripts/check-growth-route-parity.mjs
```

The guard validates Worker source, the local fixture and the pure route-state parser.

When a sibling `next-website` checkout exists, it additionally requires:

- byte-for-byte fixture equality;
- byte-for-byte parser equality;
- website page state equal to fixture state;
- matching request, bridge, inventory, Next adapter and page-handler versions;
- the reserved page path;
- the website byte-for-byte page source contract;
- the conditional blocker set matching `pageState`.

For a non-sibling checkout:

```powershell
$env:EVAVO_NEXT_WEBSITE_REPO_PATH = "C:\path\to\next-website"
node scripts/check-growth-route-parity.mjs
```

## Transition rule

The Worker readiness blocker must change only in the same reviewed sequence that adds the exact website page.

After the page exists:

- set both mirrored fixtures to `pageState: present`;
- remove `next_website_ingestion_endpoint_not_implemented`;
- add `worker_proposal_delivery_not_implemented`;
- make the same blocker replacement in Worker and website readiness parsing;
- keep `bridgeEnabled: false`;
- keep delivery absent and unscheduled;
- preserve `cross_repo_contract_tests_not_implemented` until live HTTP acceptance, safe replay, replay rejection and authentication smoke exists;
- keep canonical promotion and external execution disabled.

Static fixture and parser parity are not live bridge evidence.
