import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const checkedFiles = {
  'src/index.ts': [
    'unexpectedWorkerErrorMessage',
    'worker_unexpected_error',
    'The Worker hit an unexpected internal error before a safe response could be returned.',
    'catch {',
  ],
  'src/routes/businessAutopilotAdmin.ts': [
    'schemaMissingMessage',
    'routeFailedMessage',
    'Business Autopilot schema is missing or unavailable.',
    'Business Autopilot route failed before a safe response could be returned.',
    'business_autopilot_schema_missing',
    'business_autopilot_failed',
  ],
  'src/routes/businessAutopilotPeopleAdmin.ts': [
    'schemaMissingMessage',
    'routeFailedMessage',
    'Business people schema is missing or unavailable.',
    'Business people route failed before a safe response could be returned.',
    'business_autopilot_schema_missing',
    'business_people_failed',
  ],
  'src/routes/businessAutopilotWebsiteAdmin.ts': [
    'schemaMissingMessage',
    'routeFailedMessage',
    'Business website/page schema is missing or unavailable.',
    'Business website/page route failed before a safe response could be returned.',
    'business_autopilot_schema_missing',
    'business_website_failed',
  ],
};

const forbiddenPublicLeakTokens = [
  'error: String(err)',
  'error: String(error)',
  'error: err.message',
  'error: error.message',
  'message,',
  'message: error.message',
  'message: err.message',
  'message: String(error)',
  'message: String(err)',
  'const message = error instanceof Error ? error.message : String(error);',
  'const message = err instanceof Error ? err.message : String(err);',
];

let failed = false;
function fail(message) { failed = true; console.error(`FAIL ${message}`); }
function pass(message) { console.log(`OK   ${message}`); }

for (const [relativePath, requiredTokens] of Object.entries(checkedFiles)) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    fail(`${relativePath} is missing`);
    continue;
  }

  pass(`${relativePath} exists`);
  const content = fs.readFileSync(absolutePath, 'utf8');

  for (const token of requiredTokens) {
    if (!content.includes(token)) fail(`${relativePath} missing ${token}`);
    else pass(`${relativePath} contains ${token}`);
  }

  for (const token of forbiddenPublicLeakTokens) {
    if (content.includes(token)) fail(`${relativePath} must not expose raw error token: ${token}`);
    else pass(`${relativePath} does not expose raw error token: ${token}`);
  }
}

if (failed) {
  console.error('Business Autopilot raw-error safety check failed.');
  process.exit(1);
}

console.log('Business Autopilot raw-error safety check passed.');
