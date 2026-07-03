import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const backendAggregateCheck = 'npm run growth:backend:aggregate:check';
const backendLocalCheck = 'npm run growth:backend:check:local';

const expectedPackageScripts = {
  'growth:backend:check:local': 'npm run growth:backend:aggregate:check && npm run check:local',
  'growth:backend:aggregate:check': 'node scripts/check-growth-backend-aggregate-command.mjs',
  'growth:backend:final:print': 'node scripts/print-growth-final-backend-validation.mjs',
};

const requiredFileTokens = {
  'README.md': [
    'docs/growth-backend-validation.md',
    backendLocalCheck,
    'Run the guarded core Worker checks:',
    'npm run growth:route-contract:print',
    'npm run growth:campaigns:smoke:print',
    'npm run growth:strategy:smoke:print',
    'npm run growth:blackboard:smoke:print',
  ],
  'scripts/print-growth-final-backend-validation.mjs': [
    backendLocalCheck,
    'Worker supplies the inner payload safety posture',
    'npm run growth:route-safety-flags:check',
    'npm run growth:review-queue:check',
    'npm run check:local',
  ],
  'docs/growth-backend-validation.md': [
    backendAggregateCheck,
    backendLocalCheck,
    'Worker is the backend source of truth',
    'Backend responsibility boundary',
    'route catalogue metadata',
    'inner Worker payload safety posture',
    'confirmation-gated metadata-write route posture',
    'legacy compatibility safety flags',
    'backend final validation printer',
    'no AI calls',
    'no arbitrary network calls',
    'no email sending',
    'no social posting',
    'no form submission',
    'no browser execution',
    'no external state change',
    'inner payload safety posture',
    'Confirmed metadata-write routes',
    'metadata-only posture',
    'npm run growth:ops:check:local',
  ],
};

let failed = false;

function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}

function pass(message) {
  console.log(`OK   ${message}`);
}

function readFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
    return null;
  }
  return fs.readFileSync(absolutePath, 'utf8');
}

const packageJsonContent = readFile('package.json');
if (packageJsonContent) {
  const packageJson = JSON.parse(packageJsonContent);
  const scripts = packageJson.scripts || {};
  for (const [name, expected] of Object.entries(expectedPackageScripts)) {
    if (scripts[name] !== expected) fail(`package.json script ${name} should be "${expected}"`);
    else pass(`package.json script ${name} is wired`);
  }
}

for (const [relativePath, tokens] of Object.entries(requiredFileTokens)) {
  const content = readFile(relativePath);
  if (!content) continue;
  pass(`${relativePath} exists`);
  for (const token of tokens) {
    if (!content.includes(token)) fail(`${relativePath} missing ${token}`);
    else pass(`${relativePath} contains ${token}`);
  }
}

if (failed) {
  console.error('Growth backend aggregate command check failed.');
  process.exit(1);
}

console.log('Growth backend aggregate command check passed.');
