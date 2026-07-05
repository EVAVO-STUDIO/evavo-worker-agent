const commands = String.raw`
# EVAVO Growth backend workflow gate
# Automated GitHub Actions validation for Worker Growth backend and Business Autopilot backend changes.

Workflow file:
.github/workflows/growth-backend-validation.yml

Expected workflow safeguards:
- Growth Backend Validation
- contents: read
- timeout-minutes: 10
- node-version: 24
- npm ci
- npm run growth:backend:aggregate:check
- npm run growth:backend:check:local
- npm run growth:backend:final:print

Backend local check must include:
- npm run growth:backend:aggregate:check
- npm run check:local
- npm run business:autopilot:check
- npm run business:website-pages:docs:check

Business website/page docs checker must guard:
- docs/business-autopilot-data-model.md
- docs/business-autopilot-website-page-routes.md
- docs/business-autopilot-validation.md
- business_websites
- business_pages
- business_website_save
- business_page_save
- /admin/business/websites
- /admin/business/pages

Local equivalent:
cd C:\GitRepos\evavo-worker-agent
git pull
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run business:website-pages:docs:check
npm run growth:backend:check:local
npm run growth:backend:final:print
`;

console.log(commands.trim());
