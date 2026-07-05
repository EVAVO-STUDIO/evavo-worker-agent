# Growth backend workflow gate

The Worker repository has an automated GitHub Actions validation gate for Growth backend and Business Autopilot backend changes.

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

`growth:backend:check:local` must include:

```text
npm run growth:backend:aggregate:check
npm run check:local
```

`check:local` must include the Business website/page docs check:

```text
npm run business:autopilot:check
npm run business:website-pages:docs:check
```

The website/page docs check guards:

```text
docs/business-autopilot-data-model.md
docs/business-autopilot-website-page-routes.md
docs/business-autopilot-validation.md
business_websites
business_pages
business_website_save
business_page_save
/admin/business/websites
/admin/business/pages
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
