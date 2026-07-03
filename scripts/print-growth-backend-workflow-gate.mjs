const commands = String.raw`
# EVAVO Growth backend workflow gate
# Automated GitHub Actions validation for Worker Growth backend changes.

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

Local equivalent:
cd C:\GitRepos\evavo-worker-agent
git pull
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
npm run growth:backend:check:local
npm run growth:backend:final:print
`;

console.log(commands.trim());
