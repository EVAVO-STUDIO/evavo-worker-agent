# Growth internal operator pack

Contract:

```text
growth_internal_operator_pack_v1
```

Protected route:

```text
GET /admin/growth/operator/artifacts
```

The Growth Research Worker can now turn saved D1 review models into a deterministic internal operator pack. The pack provides useful BDM, sales-manager, account-manager and Growth-operations preparation without calling an AI model or changing an external system.

## Included artifacts

The pack contains:

- a ranked focus queue;
- saved-signal review briefs;
- a practical internal meeting agenda;
- owner-review follow-up plans and talking points;
- evidence, risk and blocking reminders;
- a bounded Markdown report.

The pack is derived only from saved Worker Growth signals, saved Growth actions and bounded system focus summaries. Missing evidence and missing risk analysis are surfaced explicitly rather than filled with invented facts.

## Activity profile

The route uses the current reviewed Growth activity profile:

```text
Paused
Light
Balanced
High
```

It claims the existing persistent `owner_brief_generate` Growth activity budget before reading the saved review models. This charges the artifact to the same daily Worker-request, D1-read and report-generation envelope already used by Growth activity accounting.

`Paused` rejects generation. `Light`, `Balanced` and `High` may generate packs only while the persistent D1 budget admits the request. A higher profile changes bounded throughput; it does not grant new capability authority.

The route has no automatic retry. If completion accounting fails, reserved usage remains consumed and the request fails closed.

## Route safety

The route:

- requires the Worker admin credential;
- accepts `GET` only;
- accepts no query parameters;
- performs no public fetch;
- calls no AI model;
- sends no email;
- creates no calendar event;
- posts no social or forum content;
- submits no form;
- writes no CRM or provider;
- promotes no canonical Growth record;
- writes only persistent Growth budget-accounting state.

The route is classified by the typed Growth route policy as:

```text
handler: operator-artifacts
mutation posture: mixed-internal
confirmation: not-required
calls external network: false
calls AI: false
can send email: false
can post social: false
can submit forms: false
```

The internal accounting mutation is why the route is not described as a purely read-only D1 operation. Its returned artifact remains non-executing.

## Why this comes before autonomous outreach

A useful Growth system should first become excellent at:

- turning evidence into a clear decision queue;
- preparing account and opportunity reviews;
- making missing evidence visible;
- preparing meeting questions and agendas;
- structuring follow-up reasoning;
- documenting what happens if EVAVO does nothing;
- identifying operational failures that undermine decisions.

Those capabilities provide immediate value with near-zero variable compute cost and low reputation risk. Email delivery, calendar writes, social posting, comments, forms and provider writes remain separate future adapters with separate permissions, approvals, suppression checks, idempotency, audit and channel-specific policies.

## Validation

```powershell
cd C:\GitRepos\evavo-worker-agent

node scripts/check-growth-internal-operator-pack.mjs
node --test tests/growthInternalOperatorPack.test.ts tests/growthInternalOperatorPackRouteSource.test.ts
npm run growth:internal-operator-pack:check
npm run check:local
npm run typecheck
```

The validation chain checks deterministic output, bounded records and Markdown, hostile URLs and timestamps, exact route ownership, budget-before-read ordering, completion-before-success ordering and the absence of AI or external execution paths.
