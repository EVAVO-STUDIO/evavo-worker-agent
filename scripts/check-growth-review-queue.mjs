import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const required = {
  'migrations/0019_growth_approval_requests.sql': [
    'growth_approval_requests',
    'payload_json',
    'review_checklist_json',
    'explicit_blocks_json',
    'audit_reason_json',
    'safety_json',
  ],
  'src/core/growthApprovalRequests.ts': [
    'GrowthApprovalRequestInput',
    'listGrowthApprovalRequests',
    'saveGrowthApprovalRequest',
    'updateGrowthApprovalRequestStatus',
    'hydrateGrowthApprovalRequest',
    'growth_approval_requests',
  ],
  'src/routes/growthApprovalRequestsAdmin.ts': [
    'handleGrowthApprovalRequestsAdmin',
    'listGrowthApprovalRequests',
    'saveGrowthApprovalRequest',
    'updateGrowthApprovalRequestStatus',
    '0019_growth_approval_requests.sql',
  ],
  'src/index.ts': [
    'handleGrowthApprovalRequestsAdmin',
    'approval-requests',
  ],
  'src/routes/routeCataloguePlanner.ts': [
    'growth_approval_requests',
    'growth_approval_request_save',
    'growth_approval_request_status',
  ],
  'scripts/check-migrations-present.mjs': [
    '0019_growth_approval_requests.sql',
  ],
  'scripts/print-growth-route-contract-check.mjs': [
    'growth_approval_requests',
    'growth_approval_request_save',
    'growth_approval_request_status',
    'Read Growth approval requests',
  ],
};

let failed = false;
for (const [file, tokens] of Object.entries(required)) {
  const full = path.join(root, file);
  if (!fs.existsSync(full)) {
    failed = true;
    console.error(`FAIL ${file} is missing`);
    continue;
  }
  console.log(`OK   ${file} exists`);
  const text = fs.readFileSync(full, 'utf8');
  for (const token of tokens) {
    if (!text.includes(token)) {
      failed = true;
      console.error(`FAIL ${file} missing ${token}`);
    } else {
      console.log(`OK   ${file} contains ${token}`);
    }
  }
}

if (failed) {
  console.error('Growth review queue check failed.');
  process.exit(1);
}

console.log('Growth review queue check passed.');
