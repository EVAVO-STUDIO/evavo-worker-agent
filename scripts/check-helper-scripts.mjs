import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const helperScripts = [
  'scripts/apply-one-migration.mjs',
  'scripts/check-helper-scripts.mjs',
  'scripts/check-migrations-present.mjs',
  'scripts/print-d1-verification-commands.mjs',
  'scripts/print-growth-route-contract-check.mjs',
  'scripts/print-growth-smoke-commands.mjs',
  'scripts/print-migration-commands.mjs',
  'scripts/print-next-ops-smoke-commands.mjs',
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
    'growth:route-contract:print': 'node scripts/print-growth-route-contract-check.mjs',
    'growth:smoke:print': 'node scripts/print-growth-smoke-commands.mjs',
    'ops:smoke:print': 'node scripts/print-next-ops-smoke-commands.mjs',
    'scripts:check': 'node scripts/check-helper-scripts.mjs',
    'check:local': 'npm run scripts:check && npm run db:migrations:check && npm run typecheck',
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
