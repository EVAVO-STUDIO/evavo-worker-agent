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

The aggregate command contract checker validates the Worker backend validation docs, the backend final printer tokens, and the expected package script wiring.

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
