import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const required = {
  'src/routes/routeCatalogueTypes.ts': [
    'canSendEmail: boolean',
    'canPostSocial: boolean',
    'canSubmitForms: boolean',
    'canPostSocial: false',
    'canSubmitForms: false',
  ],
  'src/routes/growthAdmin.ts': [
    'function safetyBase()',
    'readOnly: true',
    'internalMetadataOnly: true',
    'externalStateChange: false',
    'callsAI: false',
    'callsNetwork: false',
    'canSendEmail: false',
    'canPostSocial: false',
    'canSubmitForms: false',
    'sendsEmail: false',
    'postsPublicly: false',
    'submitsForms: false',
    'mode: "growth_brief"',
    '...brief, safety: safety()',
  ],
  'src/routes/growthCapabilitiesAdmin.ts': [
    'readSafety',
    'readOnly: true',
    'internalMetadataOnly: true',
    'externalStateChange: false',
    'callsAI: false',
    'callsNetwork: false',
    'canSendEmail: false',
    'canPostSocial: false',
    'canSubmitForms: false',
  ],
  'src/routes/growthAutonomousDiscoveryAdmin.ts': [
    'readSafety',
    'writeSafety',
    'readOnly: true',
    'readOnly: false',
    'internalMetadataOnly: true',
    'externalStateChange: false',
    'callsAI: false',
    'callsNetwork: false',
    'canSendEmail: false',
    'canPostSocial: false',
    'canSubmitForms: false',
    'They do not crawl, browse, send, post, call AI, submit forms, spend, or mutate external systems.',
  ],
  'src/routes/growthAutonomousDiscoveryRouteCatalogue.ts': [
    'growthAutonomousDiscoveryRouteCatalogue',
    'safety: "read_only"',
    'safety: "confirm_required"',
    'readOnly: true',
    'readOnly: false',
    'requiresConfirm: true',
    'writesTables: []',
    'callsNetwork: false',
    'callsAI: false',
    'canSendEmail: false',
    'must not be browser-proxied',
  ],
  'src/routes/growthCampaignIntelligenceAdmin.ts': [
    'readSafety',
    'writeSafety',
    'canSendEmail: false',
    'canPostSocial: false',
    'canSubmitForms: false',
  ],
  'src/routes/growthStrategyMemoryAdmin.ts': [
    'readSafety',
    'writeSafety',
    'canSendEmail: false',
    'canPostSocial: false',
    'canSubmitForms: false',
  ],
  'src/routes/growthBlackboardAdmin.ts': [
    'readSafety',
    'writeSafety',
    'canSendEmail: false',
    'canPostSocial: false',
    'canSubmitForms: false',
  ],
  'src/core/growthOperatorLoop.ts': [
    'canSendEmail: false',
    'canPostSocial: false',
    'canSubmitForms: false',
  ],
  'scripts/print-growth-route-contract-check.mjs': [
    'canSendEmail',
    'canPostSocial',
    'canSubmitForms',
    'no social posting',
    'no form submission',
    'metadata-only posture',
  ],
  'scripts/check-helper-scripts.mjs': [
    'canSendEmail: false',
    'canPostSocial: false',
    'canSubmitForms: false',
    'src/routes/growthAutonomousDiscoveryAdmin.ts',
    'src/routes/growthAutonomousDiscoveryRouteCatalogue.ts',
    'src/routes/routeCatalogueTypes.ts',
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
  console.error('Growth route safety flag check failed.');
  process.exit(1);
}

console.log('Growth route safety flag check passed.');
