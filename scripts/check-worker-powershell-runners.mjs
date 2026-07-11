import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const requiredRunners = {
  'Run-BusinessOperatorWorkerRunbook.ps1': [
    'EVAVO Business Operator Worker runbook',
    'business analyst / sales strategist / BDM / growth manager / operator brain',
    'npm run db:migration:one -- 0021 --execute',
    'npm run db:migration:one -- 0022 --execute',
    'npm run db:verify:print',
    'npm run business:autopilot:readonly:print',
    'npm run growth:backend:check:local',
    'npm run deploy',
    'external execution remains confirm-gated and disabled by default',
  ],
  'Run-WorkerFinalGate.ps1': [
    'EVAVO Worker final local gate',
    'does not run migrations',
    'Migrations 0021 and 0022 should not be rerun',
    'npm run scripts:check',
    'npm run db:migrations:check',
    'npm run business:autopilot:check',
    'npm run business:autopilot:raw-error-safety:check',
    'npm run business:people:docs:check',
    'npm run business:website-pages:docs:check',
    'npm run growth:backend:aggregate:check',
    'npm run check:local',
    'npm run growth:backend:check:local',
    'npm run db:verify:print',
    'npm run deploy',
  ],
};

let failed = false;
const fail = (message) => { failed = true; console.error(`FAIL ${message}`); };
const pass = (message) => console.log(`OK   ${message}`);

for (const [relativePath, tokens] of Object.entries(requiredRunners)) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
    continue;
  }

  pass(`${relativePath} exists`);
  const content = fs.readFileSync(absolutePath, 'utf8');

  if (!content.includes('$ErrorActionPreference = "Stop"')) {
    fail(`${relativePath} must stop on command failure`);
  } else {
    pass(`${relativePath} stops on command failure`);
  }

  if (!content.includes('Test-Path "package.json"')) {
    fail(`${relativePath} must guard repo root with package.json`);
  } else {
    pass(`${relativePath} guards repo root with package.json`);
  }

  for (const token of tokens) {
    if (content.includes(token)) pass(`${relativePath} contains ${token}`);
    else fail(`${relativePath} missing ${token}`);
  }
}

if (failed) {
  console.error('Worker PowerShell runner check failed.');
  process.exit(1);
}

console.log('Worker PowerShell runner check passed.');
