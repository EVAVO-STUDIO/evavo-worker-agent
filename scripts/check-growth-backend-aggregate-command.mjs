import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const backendAggregateCheck = 'npm run growth:backend:aggregate:check';
const backendLocalCheck = 'npm run growth:backend:check:local';
const workerFinalGatePrint = 'npm run worker:final-gate:print';
const workerPowerShellCheck = 'npm run worker:powershell:check';
const generatedRoutesCheck = 'npm run growth:generated-routes:check';
const backendWorkflowGateDoc = 'docs/growth-backend-workflow-gate.md';
const businessAutopilotRawErrorSafetyCheck = 'npm run business:autopilot:raw-error-safety:check';
const businessPeopleDocsCheck = 'npm run business:people:docs:check';
const businessWebsitePageDocsCheck = 'npm run business:website-pages:docs:check';
const predeployCommand = `${generatedRoutesCheck} && ${workerPowerShellCheck} && ${backendAggregateCheck} && npm run check:local`;

const expectedPackageScripts = {
  'predeploy': predeployCommand,
  'deploy': 'wrangler deploy',
  'business:autopilot:raw-error-safety:check': 'node scripts/check-business-autopilot-raw-error-safety.mjs',
  'business:people:docs:check': 'node scripts/check-business-people-docs.mjs',
  'business:website-pages:docs:check': 'node scripts/check-business-website-page-docs.mjs',
  'growth:backend:check:local': 'npm run growth:backend:aggregate:check && npm run check:local',
  'growth:backend:aggregate:check': 'node scripts/check-growth-backend-aggregate-command.mjs',
  'growth:backend:final:print': 'node scripts/print-growth-final-backend-validation.mjs',
  'growth:backend:workflow:print': 'node scripts/print-growth-backend-workflow-gate.mjs',
  'growth:generated-routes:check': 'node scripts/check-generated-route-wiring-clean.mjs',
  'worker:final-gate:print': 'node scripts/print-worker-final-local-gate.mjs',
  'worker:powershell:check': 'node scripts/check-worker-powershell-runners.mjs',
};

const businessPeopleTokens = [businessPeopleDocsCheck, 'business_people', 'business_person_save', '/admin/business/people'];
const businessWebsitePageTokens = [businessWebsitePageDocsCheck, 'business_websites', 'business_pages', 'business_website_save', 'business_page_save', '/admin/business/websites', '/admin/business/pages'];

const rawErrorSafetyScriptTokens = [
  'Business Autopilot raw-error safety check',
  'checkedFiles',
  'forbiddenPublicLeakTokens',
  'worker_unexpected_error',
  'Business Autopilot schema is missing or unavailable.',
  'Business people schema is missing or unavailable.',
  'Business website/page schema is missing or unavailable.',
  'error: String(err)',
  'message: String(error)',
];

const rawErrorSafetyPrinterTokens = [
  businessAutopilotRawErrorSafetyCheck,
  'Worker error-safety note',
  'Business Autopilot raw-error safety checks',
  'generic Worker root and Business Autopilot route errors',
  'no raw String(error), String(err), error.message or err.message public error payloads',
];

const workflowTokens = [
  'Growth Backend Validation',
  'contents: read',
  'timeout-minutes: 10',
  'node-version: 24',
  'npm ci',
  backendAggregateCheck,
  businessPeopleDocsCheck,
  businessWebsitePageDocsCheck,
  'Check Worker PowerShell runners',
  workerPowerShellCheck,
  'Check generated route wiring clean',
  generatedRoutesCheck,
  'Print Worker final local gate',
  workerFinalGatePrint,
  backendLocalCheck,
  'npm run growth:backend:final:print',
  'Check Business people docs',
  'Check Business website page docs',
];

const requiredFileTokens = {
  '.github/workflows/growth-backend-validation.yml': workflowTokens,
  'README.md': [
    'docs/growth-backend-validation.md',
    backendLocalCheck,
    workerFinalGatePrint,
    'Run the guarded core Worker checks:',
    'npm run growth:route-contract:print',
    'npm run growth:campaigns:smoke:print',
    'npm run growth:strategy:smoke:print',
    'npm run growth:blackboard:smoke:print',
  ],
  'scripts/check-business-autopilot-raw-error-safety.mjs': rawErrorSafetyScriptTokens,
  'scripts/check-generated-route-wiring-clean.mjs': [
    'Generated route wiring clean check passed.',
    'src/index.ts',
    'src/routes/routeCataloguePlanner.ts',
    'generated route wiring files are clean',
  ],
  'scripts/check-worker-powershell-runners.mjs': [
    'Worker PowerShell runner check passed.',
    'Run-BusinessOperatorWorkerRunbook.ps1',
    'Run-WorkerFinalGate.ps1',
    'npm run check:local',
    'npm run growth:backend:check:local',
    'npm run db:verify:print',
    'npm run deploy',
    'Migrations 0021 and 0022 should not be rerun',
  ],
  'scripts/print-growth-backend-workflow-gate.mjs': [
    'EVAVO Growth backend workflow gate',
    'Expected explicit workflow step',
    'Check Business people docs',
    'Check Business website page docs',
    backendLocalCheck,
    'npm run check:local',
    'npm run business:autopilot:check',
    ...businessPeopleTokens,
    ...businessWebsitePageTokens,
  ],
  'docs/growth-backend-workflow-gate.md': [
    'Growth backend workflow gate',
    'The workflow includes explicit CI steps',
    'Check Business people docs',
    'Check Business website page docs',
    backendAggregateCheck,
    backendLocalCheck,
    'npm run check:local',
    'npm run business:autopilot:check',
    ...businessPeopleTokens,
    ...businessWebsitePageTokens,
  ],
  'scripts/print-growth-final-backend-validation.mjs': [
    backendLocalCheck,
    workerFinalGatePrint,
    'Worker supplies the inner payload safety posture',
    'npm run business:autopilot:check',
    businessAutopilotRawErrorSafetyCheck,
    businessPeopleDocsCheck,
    businessWebsitePageDocsCheck,
    'Business Autopilot note',
    'Business people docs checks',
    'Business website/page docs checks',
    'business_people',
    'business_person_save',
    'business_websites',
    'business_pages',
    'business_website_save',
    'business_page_save',
    '/admin/business/people?limit=5',
    '/admin/business/websites?limit=5',
    '/admin/business/pages?limit=5',
    'npm run business:route-contract:print',
    'npm run business:autopilot:readonly:print',
    'npm run growth:route-safety-flags:check',
    'npm run growth:review-queue:check',
    'npm run check:local',
    ...rawErrorSafetyPrinterTokens,
  ],
  'docs/growth-backend-validation.md': [
    backendWorkflowGateDoc,
    backendAggregateCheck,
    backendLocalCheck,
    workerFinalGatePrint,
    workerPowerShellCheck,
    generatedRoutesCheck,
    businessPeopleDocsCheck,
    businessWebsitePageDocsCheck,
    'Worker is the backend source of truth',
    'Backend responsibility boundary',
    'route catalogue metadata',
    'inner Worker payload safety posture',
    'confirmation-gated metadata-write route posture',
    'legacy compatibility safety flags',
    'backend final validation printer',
    'Business people metadata route docs',
    'Business people docs checks',
    'Business website/page metadata route docs',
    'Business website/page docs checks',
    'business_people',
    'business_person_save',
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
  ],
};

let failed = false;
function fail(message) { failed = true; console.error(`FAIL ${message}`); }
function pass(message) { console.log(`OK   ${message}`); }

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
  const checkLocal = scripts['check:local'] || '';
  for (const requiredStep of [businessAutopilotRawErrorSafetyCheck, businessPeopleDocsCheck, businessWebsitePageDocsCheck, workerPowerShellCheck]) {
    if (checkLocal.includes(requiredStep)) pass(`check:local includes ${requiredStep}`);
    else fail(`check:local missing ${requiredStep}`);
  }
  const predeploy = scripts.predeploy || '';
  for (const requiredStep of [generatedRoutesCheck, workerPowerShellCheck, backendAggregateCheck, 'npm run check:local']) {
    if (predeploy.includes(requiredStep)) pass(`predeploy includes ${requiredStep}`);
    else fail(`predeploy missing ${requiredStep}`);
  }
}

for (const [relativePath, tokens] of Object.entries(requiredFileTokens)) {
  const content = readFile(relativePath);
  if (!content) continue;
  pass(`${relativePath} exists`);
  for (const token of tokens) {
    if (content.includes(token)) pass(`${relativePath} contains ${token}`);
    else fail(`${relativePath} missing ${token}`);
  }
}

if (failed) {
  console.error('Growth backend aggregate command check failed.');
  process.exit(1);
}

console.log('Growth backend aggregate command check passed.');
