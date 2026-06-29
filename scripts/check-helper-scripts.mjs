import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const helperScripts = [
  'scripts/apply-growth-operator-route-wiring.mjs',
  'scripts/apply-one-migration.mjs',
  'scripts/check-growth-campaign-intelligence.mjs',
  'scripts/check-growth-capability-registry.mjs',
  'scripts/check-helper-scripts.mjs',
  'scripts/check-migrations-present.mjs',
  'scripts/print-d1-verification-commands.mjs',
  'scripts/print-growth-campaign-intelligence-smoke-commands.mjs',
  'scripts/print-growth-route-contract-check.mjs',
  'scripts/print-growth-smoke-commands.mjs',
  'scripts/print-main-branch-audit.mjs',
  'scripts/print-migration-commands.mjs',
  'scripts/print-next-ops-smoke-commands.mjs',
];

const typeScriptFiles = [
  'src/core/growthCapabilities.ts',
  'src/core/growthCampaignIntelligence.ts',
  'src/core/growthCampaignDecisions.ts',
  'src/routes/growthCapabilitiesAdmin.ts',
  'src/routes/growthCampaignIntelligenceAdmin.ts',
];

const docs = [
  'docs/growth-capability-registry.md',
  'docs/growth-campaign-intelligence.md',
];

const packageJsonPath = path.join(repoRoot, 'package.json');
let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}

function pass(message) {
  console.log(`OK   ${message}`);
}

for (const relativePath of helperScripts) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
    continue;
  }

  const check = spawnSync(process.execPath, ['--check', absolutePath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (check.status !== 0) {
    fail(`${relativePath} has a syntax error`);
    if (check.stderr) console.error(check.stderr.trim());
    continue;
  }

  pass(`${relativePath} exists and parses`);
}

for (const relativePath of typeScriptFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
  } else {
    pass(`${relativePath} exists`);
  }
}

for (const relativePath of docs) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
  } else {
    pass(`${relativePath} exists`);
  }
}

if (!fs.existsSync(packageJsonPath)) {
  fail('package.json is missing');
} else {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const scripts = packageJson.scripts || {};
  const expectedPackageScripts = {
    'db:migration:one': 'node scripts/apply-one-migration.mjs',
    'db:migrations:check': 'node scripts/check-migrations-present.mjs',
    'db:migrations:print': 'node scripts/print-migration-commands.mjs',
    'db:verify:print': 'node scripts/print-d1-verification-commands.mjs',
    'git:main-audit:print': 'node scripts/print-main-branch-audit.mjs',
    'growth:campaigns:check': 'node scripts/check-growth-campaign-intelligence.mjs',
    'growth:campaigns:smoke:print': 'node scripts/print-growth-campaign-intelligence-smoke-commands.mjs',
    'growth:capabilities:check': 'node scripts/check-growth-capability-registry.mjs',
    'growth:route-contract:print': 'node scripts/print-growth-route-contract-check.mjs',
    'growth:smoke:print': 'node scripts/print-growth-smoke-commands.mjs',
    'growth:wiring:apply': 'node scripts/apply-growth-operator-route-wiring.mjs',
    'ops:smoke:print': 'node scripts/print-next-ops-smoke-commands.mjs',
    'scripts:check': 'node scripts/check-helper-scripts.mjs',
    'check:local': 'npm run scripts:check && npm run db:migrations:check && npm run growth:capabilities:check && npm run growth:campaigns:check && npm run typecheck',
  };

  for (const [name, expected] of Object.entries(expectedPackageScripts)) {
    if (scripts[name] !== expected) {
      fail(`package.json script ${name} should be "${expected}"`);
    } else {
      pass(`package.json script ${name} is wired`);
    }
  }
}

if (failed) {
  console.error('Helper script check failed.');
  process.exit(1);
}

console.log('Helper script check passed.');
