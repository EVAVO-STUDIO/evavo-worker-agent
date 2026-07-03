# Growth backend validation

This document records the preferred local validation flow for the Worker side of EVAVO Growth Ops.

## Safety posture

The Worker is the backend source of truth for Growth route metadata and the inner payload safety posture consumed by the Next read-only proxy console.

Current Worker Growth safety requirements:

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

Legacy compatibility fields must also remain false where present:

```text
sendsEmail: false
postsPublicly: false
submitsForms: false
```

Confirmed metadata-write routes must remain server-side only, require explicit confirmation, and advertise metadata-only posture. They must not send email, post socially, submit forms, browse, call AI, call arbitrary network actions, execute browser actions, or perform external state changes.

## Backend responsibility boundary

The Worker owns the backend contract for:

```text
route catalogue metadata
inner Worker payload safety posture
confirmation-gated metadata-write route posture
legacy compatibility safety flags
backend final validation printer
```

The Worker must keep these safety guarantees true for every Growth route catalogue entry and metadata-write route:

```text
no AI calls
no arbitrary network calls
no email sending
no social posting
no form submission
no browser execution
no external state change
```

The Next repo may display and verify this backend posture, but the Worker remains the source of truth for route catalogue metadata and inner Worker payload safety.

## Automated workflow gate

The Worker repository has an automated GitHub Actions gate for Growth backend changes:

```text
.github/workflows/growth-backend-validation.yml
```

Detailed workflow requirements live in:

```text
docs/growth-backend-workflow-gate.md
```

That workflow runs on pull requests and main-branch pushes, uses Node 24, installs with `npm ci`, runs `npm run growth:backend:aggregate:check`, runs `npm run growth:backend:check:local`, and prints `npm run growth:backend:final:print`.

## Preferred local aggregate check

Run this from PowerShell after pulling the latest repo:

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run growth:backend:check:local
```

`growth:backend:check:local` first runs the aggregate command contract checker, then runs the existing full backend local check:

```powershell
npm run growth:backend:aggregate:check
npm run check:local
```

The aggregate command contract checker validates the Worker backend validation docs, the backend final printer tokens, the README runbook, and the expected package script wiring.

The existing backend local check expands to helper-script parsing, migration presence, route delegates, route safety flags, capability registry, campaign intelligence, strategy memory, blackboard, review queue, and TypeScript validation.

## Final backend validation printer

Use this when you want the deploy-and-smoke command set printed for the Worker:

```powershell
npm run growth:backend:final:print
```

The final printer now prefers the aggregate backend check before deploy:

```powershell
npm run growth:backend:check:local
```

After setting `ADMIN_TOKEN` and `WORKER_URL`, the printed smoke command blocks verify the deployed route catalogue, delegated Growth reads, metadata-write confirmation posture, and no email/social/form/AI/network execution flags.

## Cross-repo pairing

After Worker validation, run the Next read-only proxy validation:

```powershell
cd C:\GitRepos\next-website
git pull
npm run growth:ops:check:local
npm run growth:ops:final:print
npm run growth:ops:smoke:print
```

The intended chain is:

```text
Worker supplies route catalogue and inner payload safety.
Next keeps the admin token server-side and exposes only read-only proxy wrappers.
Next smoke checks validate both outer proxy envelope safety and inner Worker payload safety.
```
