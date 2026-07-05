import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const backendAggregateCheck = 'npm run growth:backend:aggregate:check';
const backendLocalCheck = 'npm run growth:backend:check:local';
const backendWorkflowGateDoc = 'docs/growth-backend-workflow-gate.md';
const businessWebsitePageDocsCheck = 'npm run business:website-pages:docs:check';

const expectedPackageScripts = {
  'business:website-pages:docs:check': 'node scripts/check-business-website-page-docs.mjs',
  'growth:backend:check:local': 'npm run growth:backend:aggregate:check && npm run check:local',
  'growth:backend:aggregate:check': 'node scripts/check-growth-backend-aggregate-command.mjs',
  'growth:backend:final:print': 'node scripts/print-growth-final-backend-validation.mjs',
  'growth:backend:workflow:print': 'node scripts/print-growth-backend-workflow-gate.mjs',
};

const businessWebsitePageTokens = [
  businessWebsitePageDocsCheck,
  'business_websites',
  'business_pages',
  'business_website_save',
  'business_page_save',
  '/admin/business/websites',
  '/admin/business/pages',
];

const workflowTokens = [
  'Growth Backend Validation',
  'contents: read',
  'timeout-minutes: 10',
  'node-version: 24',
  'npm ci',
  backendAggregateCheck,
  businessWebsitePageDocsCheck,
  backendLocalCheck,
  'npm run growth:backend:final:print',
  'Check Business website page docs',
];

const requiredFileTokens = {
  '.github/workflows/growth-backend-validation.yml': workflowTokens,
  'README.md': [
    'docs/growth-backend-validation.md',
    backendLocalCheck,
    'Run the guarded core Worker checks:',
    'npm run growth:route-contract:print',
    'npm run growth:campaigns:smoke:print',
    'npm run growth:strategy:smoke:print',
    'npm run growth:blackboard:smoke:print',
  ],
  'package.json': [
    businessWebsitePageDocsCheck,
    'node scripts/check-business-website-page-docs.mjs',
    'npm run business:autopilot:check && npm run business:website-pages:docs:check',
  ],
  'scripts/print-growth-backend-workflow-gate.mjs': [
    'EVAVO Growth backend workflow gate',
    'Expected explicit workflow step',
    'Check Business website page docs',
    backendLocalCheck,
    'npm run check:local',
    'npm run business:autopilot:check',
    ...businessWebsitePageTokens,
  ],
  'docs/growth-backend-workflow-gate.md': [
    'Growth backend workflow gate',
    'The workflow includes an explicit CI step',
    'Check Business website page docs',
    backendAggregateCheck,
    backendLocalCheck,
    'npm run check:local',
    'npm run business:autopilot:check',
    ...businessWebsitePageTokens,
  ],
  'scripts/print-growth-final-backend-validation.mjs': [
    backendLocalCheck,
    'Worker supplies the inner payload safety posture',
    'npm run business:autopilot:check',
    businessWebsitePageDocsCheck,
    'Business Autopilot note',
    'Business website/page docs checks',
    'business_websites',
    'business_pages',
    'business_website_save',
    'business_page_save',
    '/admin/business/websites?limit=5',
    '/admin/business/pages?limit=5',
    'npm run business:route-contract:print',
    'npm run business:autopilot:readonly:print',
    'npm run growth:route-safety-flags:check',
    'npm run growth:review-queue:check',
    'npm run check:local',
  ],
  'docs/growth-backend-validation.md': [
    backendWorkflowGateDoc,
    backendAggregateCheck,
    backendLocalCheck,
    businessWebsitePageDocsCheck,
    'Worker is the backend source of truth',
    'Backend responsibility boundary',
    'route catalogue metadata',
    'inner Worker payload safety posture',
    'confirmation-gated metadata-write route posture',
    'legacy compatibility safety flags',
    'backend final validation printer',
    'Business website/page metadata route docs',
    'Business website/page docs checks',
    'business_websites',
    'business_pages',
    'business_website_save',
    'business_page_save',
    'no AI calls',
    'no arbitrary network calls',
    'no email sending',
    'no social posting',
    'no third-party commenting',
    'no form submission',
    'no browser execution',
    'no external state change',
    'inner payload safety posture',
    'Confirmed metadata-write routes',
    'metadata-only posture',
    'npm run growth:ops:check:local',
    'npm run business:ops:websites-pages:print',
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
