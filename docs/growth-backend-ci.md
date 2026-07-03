# Growth backend CI validation

This repo includes a GitHub Actions workflow for the Worker-side Growth Ops backend contract:

```text
.github/workflows/growth-backend-validation.yml
```

The workflow runs on pushes and pull requests to `main`.

## CI command sequence

```bash
npm ci
npm run growth:backend:aggregate:check
npm run growth:backend:check:local
npm run growth:backend:final:print
```

The aggregate backend check is the canonical Worker validation command:

```powershell
npm run growth:backend:check:local
```

The aggregate-command checker validates that the alias, final printer, and backend validation docs remain wired:

```powershell
npm run growth:backend:aggregate:check
```

## Safety coverage

The CI workflow is intentionally repository-local. It does not deploy, send email, post socially, submit forms, run browser automation, call AI, or call live Worker endpoints. It validates code, scripts, migrations, route delegates, route safety flags, capability registry, campaign intelligence, strategy memory, blackboard, review queue, and TypeScript through the existing local check chain.

The Worker must continue to advertise this Growth safety posture for reads:

```text
readOnly: true
internalMetadataOnly: true
externalStateChange: false
callsAI: false
callsNetwork: false
canSendEmail: false
canPostSocial: false
canSubmitForms: false
```

Confirmed metadata-write routes must remain confirmation-gated, server-side, and metadata-only.
