const commands = String.raw`
# EVAVO generated route wiring drift resolution
# Use this when npm run growth:generated-routes:check reports local modifications in:
# - src/index.ts
# - src/routes/routeCataloguePlanner.ts

cd C:\GitRepos\evavo-worker-agent

git status --short
git diff -- src/index.ts src/routes/routeCataloguePlanner.ts

# Option A: regenerate route wiring from repo scripts, then review and commit if expected.
npm run growth:wiring:apply
npm run growth:route-catalogue:apply
git diff -- src/index.ts src/routes/routeCataloguePlanner.ts
npm run growth:generated-routes:check

# If the diff is expected generated wiring:
git add src/index.ts src/routes/routeCataloguePlanner.ts
git commit -m "Apply generated route wiring"
git pull --rebase
git push

# Option B: discard the local generated-file changes if they are not needed.
# Run this instead of Option A's git add/commit/push path:
# git restore src/index.ts src/routes/routeCataloguePlanner.ts
# npm run growth:generated-routes:check

# After either path passes:
npm run business:autopilot:raw-error-safety:check
npm run growth:backend:aggregate:check
npm run check:local
`;

console.log(commands.trim());
