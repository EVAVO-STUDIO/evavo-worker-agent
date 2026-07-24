# Growth Route Parity

Date: 2026-07-24

This document defines the Worker side of the static route-parity contract shared with `EVAVO-STUDIO/next-website`.

## Contract

The mirrored fixture is:

```text
fixtures/growth-worker-route-parity-v1.json
```

Its contract version is:

```text
growth_worker_route_parity_v1
```

The same bytes must exist at:

```text
next-website/tests/fixtures/growth-worker-route-parity-v1.json
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
- exact readiness blockers.

## Current posture

```text
pageState: absent
bridgeEnabled: false
deliveryEnabled: false
next_website_ingestion_endpoint_not_implemented
cross_repo_contract_tests_not_implemented
```

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

The guard validates Worker source and the local fixture.

When a sibling `next-website` checkout exists, it additionally requires:

- byte-for-byte fixture equality;
- website page state equal to fixture state;
- matching request, bridge, inventory, Next adapter and page-handler versions;
- the reserved page path;
- the website byte-for-byte page source contract;
- both current readiness blockers.

For a non-sibling checkout:

```powershell
$env:EVAVO_NEXT_WEBSITE_REPO_PATH = "C:\path\to\next-website"
node scripts/check-growth-route-parity.mjs
```

## Transition rule

The Worker readiness blocker must change only in the same reviewed sequence that adds the exact website page.

After the page exists:

- remove `next_website_ingestion_endpoint_not_implemented`;
- add a truthful post-route blocker;
- keep `bridgeEnabled: false`;
- keep delivery absent and unscheduled;
- preserve `cross_repo_contract_tests_not_implemented` until live HTTP acceptance, replay and authentication smoke exists;
- keep canonical promotion and external execution disabled.

Static fixture parity is not live bridge evidence.
