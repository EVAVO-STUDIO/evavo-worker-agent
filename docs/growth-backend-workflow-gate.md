# Growth backend workflow gate

The Worker repository has an automated GitHub Actions validation gate for Growth backend changes.

```text
.github/workflows/growth-backend-validation.yml
```

The workflow must keep these safeguards visible:

```text
Growth Backend Validation
contents: read
timeout-minutes: 10
node-version: 24
npm ci
npm run growth:backend:aggregate:check
npm run growth:backend:check:local
npm run growth:backend:final:print
```

Print this workflow-gate summary locally with:

```powershell
npm run growth:backend:workflow:print
```

The workflow complements the local PowerShell runbook. It does not deploy the Worker and does not require production secrets.

Local validation remains:

```powershell
cd C:\GitRepos\evavo-worker-agent
git pull
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run growth:backend:check:local
npm run growth:backend:final:print
```
