import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const checks = [
  {
    label: 'Business people route doc',
    path: 'docs/business-autopilot-people-routes.md',
    tokens: [
      'Business Autopilot people routes',
      'business_people',
      'business_person_save',
      'GET /admin/business/people?limit=25',
      'POST /admin/business/people?confirm=1',
      'allowed_use',
      'contact_status',
      'do not enrich contacts, scrape profiles, send email, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems',
    ],
  },
  {
    label: 'Business data model',
    path: 'docs/business-autopilot-data-model.md',
    tokens: [
      'business_people',
      'allowed_use',
      'contact_status',
      'People route layer',
      'GET  /admin/business/people?limit=25',
      'POST /admin/business/people?confirm=1',
      'business_person_save',
      'People/contact-context relationship',
      'allowed-use review',
      'contactability check',
    ],
  },
  {
    label: 'Business validation doc',
    path: 'docs/business-autopilot-validation.md',
    tokens: [
      'Business people records',
      'Business people admin routes',
      'docs/business-autopilot-people-routes.md',
      'business_people',
      'business_person_save',
      '/admin/business/people?limit=5',
    ],
  },
];

let failed = false;
function fail(message) { failed = true; console.error(`FAIL ${message}`); }
function pass(message) { console.log(`OK   ${message}`); }

for (const check of checks) {
  const filePath = path.join(repoRoot, check.path);
  if (!fs.existsSync(filePath)) {
    fail(`${check.label} is missing at ${check.path}`);
    continue;
  }
  pass(`${check.label} exists`);
  const content = fs.readFileSync(filePath, 'utf8');
  for (const token of check.tokens) {
    if (!content.includes(token)) fail(`${check.label} missing ${token}`);
    else pass(`${check.label} contains ${token}`);
  }
}

if (failed) {
  console.error('Business people docs check failed.');
  process.exit(1);
}

console.log('Business people docs check passed.');
