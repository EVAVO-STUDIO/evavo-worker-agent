import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const registryPath = path.join(repoRoot, 'src/core/growthCapabilities.ts');
const routePath = path.join(repoRoot, 'src/routes/growthCapabilitiesAdmin.ts');
const indexPath = path.join(repoRoot, 'src/index.ts');
const docPath = path.join(repoRoot, 'docs/growth-capability-registry.md');

const expectedCapabilityIds = [
  'research_public_website',
  'score_growth_signal',
  'draft_message',
  'draft_owned_content',
  'prepare_browser_step',
  'create_internal_task',
  'request_approval',
  'external_delivery_approved',
  'record_outcome',
  'generate_growth_brief',
];

const expectedLevelIds = [
  'read_only',
  'draft_only',
  'internal_write',
  'approved_external',
  'trusted_bounded_external',
  'autonomous_campaign',
];

let failed = false;

function read(relativePath, absolutePath) {
  if (!fs.existsSync(absolutePath)) {
    failed = true;
    console.error(`FAIL ${relativePath} is missing`);
    return '';
  }
  console.log(`OK   ${relativePath} exists`);
  return fs.readFileSync(absolutePath, 'utf8');
}

function mustContain(label, content, token) {
  if (!content.includes(token)) {
    failed = true;
    console.error(`FAIL ${label} missing ${token}`);
  } else {
    console.log(`OK   ${label} contains ${token}`);
  }
}

const registry = read('src/core/growthCapabilities.ts', registryPath);
const route = read('src/routes/growthCapabilitiesAdmin.ts', routePath);
const index = read('src/index.ts', indexPath);
const doc = read('docs/growth-capability-registry.md', docPath);

for (const id of expectedCapabilityIds) mustContain('capability registry', registry, id);
for (const id of expectedLevelIds) mustContain('autonomy levels', registry, id);

mustContain('capability registry', registry, 'growth_capabilities_v1_autonomy_execution_contract');
mustContain('capability registry', registry, 'executesCapabilities: false');
mustContain('capability registry', registry, 'touchesExternalChannel: false');
mustContain('capability route', route, 'mode: "growth_capabilities"');
mustContain('capability route', route, 'listGrowthCapabilities');
mustContain('capability docs', doc, 'GET /admin/growth/capabilities');

if (index.includes('handleGrowthCapabilitiesAdmin') && index.includes('/admin/growth/capabilities')) {
  console.log('OK   src/index.ts wires the Growth capabilities route');
} else {
  failed = true;
  console.error('FAIL src/index.ts does not wire /admin/growth/capabilities yet');
  console.error('      Import handleGrowthCapabilitiesAdmin and route it before the generic /admin/growth/ branch.');
}

if (failed) {
  console.error('Growth capability registry check failed.');
  process.exit(1);
}

console.log('Growth capability registry check passed.');
