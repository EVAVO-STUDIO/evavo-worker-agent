import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const checks = [
  {
    label: 'Business data model',
    path: 'docs/business-autopilot-data-model.md',
    tokens: [
      'Website/page relationship layer',
      'business_organizations',
      'business_websites',
      'business_pages',
      'business_website_audit_runs',
      'business_audit_observations',
      'business_audit_observation_candidates',
      'business_signals',
      'business_opportunities',
      'business_audit_packs',
      'business_action_drafts',
      'business_approval_requests',
      'GET  /admin/business/websites?limit=25',
      'POST /admin/business/websites?confirm=1',
      'GET  /admin/business/pages?limit=25',
      'POST /admin/business/pages?confirm=1',
      'GET  /admin/business/website-audit-runs?limit=25',
      'POST /admin/business/website-audit-runs?confirm=1',
      'GET  /admin/business/audit-observations?limit=25',
      'POST /admin/business/audit-observations?confirm=1',
      'GET  /admin/business/audit-observation-candidates?limit=25',
      'business_website_save',
      'business_page_save',
      'business_website_audit_run_save',
      'business_audit_observation_save',
      'observation candidates are read-only and unsaved',
      'no crawling',
      'no fetching',
      'no network calls from metadata routes',
    ],
  },
  {
    label: 'Business website/page route doc',
    path: 'docs/business-autopilot-website-page-routes.md',
    tokens: [
      'Business Autopilot website and page routes',
      'business_websites',
      'business_pages',
      'business_website_audit_runs',
      'business_audit_observations',
      'business_audit_observation_candidates',
      'business_website_save',
      'business_page_save',
      'business_website_audit_run_save',
      'business_audit_observation_save',
      'GET /admin/business/websites?limit=25',
      'GET /admin/business/pages?limit=25',
      'GET /admin/business/website-audit-runs?limit=25',
      'GET /admin/business/audit-observations?limit=25',
      'GET /admin/business/audit-observation-candidates?limit=25',
      'POST /admin/business/websites?confirm=1',
      'POST /admin/business/pages?confirm=1',
      'POST /admin/business/website-audit-runs?confirm=1',
      'POST /admin/business/audit-observations?confirm=1',
      'observationCandidates',
      'review candidates from stored internal metadata only',
      'do not crawl, fetch, send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems',
    ],
  },
  {
    label: 'Business validation doc',
    path: 'docs/business-autopilot-validation.md',
    tokens: [
      'business_websites',
      'business_pages',
      'business_website_save',
      'business_page_save',
      '/admin/business/websites?limit=5',
      '/admin/business/pages?limit=5',
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
  console.error('Business website/page docs check failed.');
  process.exit(1);
}

console.log('Business website/page docs check passed.');
