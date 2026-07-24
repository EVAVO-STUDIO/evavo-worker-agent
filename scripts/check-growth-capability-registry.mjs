import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const registryPath = path.join(repoRoot, 'src/core/growthCapabilities.ts');
const bridgePath = path.join(repoRoot, 'src/core/growthBridgeReadiness.ts');
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
const bridge = read('src/core/growthBridgeReadiness.ts', bridgePath);
const route = read('src/routes/growthCapabilitiesAdmin.ts', routePath);
const index = read('src/index.ts', indexPath);
const doc = read('docs/growth-capability-registry.md', docPath);

for (const id of expectedCapabilityIds) mustContain('capability registry', registry, id);
for (const id of expectedLevelIds) mustContain('autonomy levels', registry, id);

for (const token of [
  'growth_capabilities_v2_registry_only',
  'scheduledExecutionEnabled: false',
  'scheduledExternalResearchEnabled: false',
  'manualResearchRequiresAuthentication: true',
  'manualResearchRequiresConfirmation: true',
  'manualResearchIsBounded: true',
  'manualResearchSavesReviewItemsOnly: true',
  'draftingEnabled: false',
  'browserExecutionEnabled: false',
  'externalDeliveryEnabled: false',
  'autonomousCampaignsEnabled: false',
  'bridgeReadiness: growthBridgeReadiness',
  'executesCapabilities: false',
  'touchesExternalChannel: false',
]) mustContain('capability registry', registry, token);

for (const token of [
  'growth_worker_bridge_v1',
  'sourceSystem: "evavo-worker-agent"',
  'canonicalTarget: "next-website:supabase:growth_*"',
  'workerRole: "discovery_candidate_research_memory"',
  'transport: "server_to_server_only"',
  'promotionMode: "proposal_only"',
  'bridgeEnabled: false',
  'routeInventoryComplete: false',
  'clientBrowserAccess: false',
  'adminTokenBrowserExposure: false',
  'draftingEnabled: false',
  'externalExecutionEnabled: false',
  'ownerApprovalRequired: true',
  'idempotencyRequired: true',
  'auditRequired: true',
  'worker_post_route_inventory_pending',
  'next_website_ingestion_endpoint_not_implemented',
  'cross_repo_contract_tests_not_implemented',
  'canonical_auto_promotion',
]) mustContain('bridge readiness contract', bridge, token);

for (const forbidden of [
  'growth_capabilities_v1_autonomy_execution_contract',
  'currentImplementation: "planned", notes: ["Draft-only.',
  'currentImplementation: "planned", notes: ["Preparation only.',
]) {
  if (registry.includes(forbidden)) {
    failed = true;
    console.error(`FAIL capability registry contains stale execution posture: ${forbidden}`);
  }
}

for (const forbidden of [
  'ADMIN_TOKEN',
  'providerToken',
  'accessToken',
  'refreshToken',
  'serviceRoleKey',
  'bridgeEnabled: true',
  'routeInventoryComplete: true',
  'clientBrowserAccess: true',
  'externalExecutionEnabled: true',
]) {
  if (bridge.includes(forbidden)) {
    failed = true;
    console.error(`FAIL bridge readiness contract contains unsafe or premature posture: ${forbidden}`);
  }
}

mustContain('capability route', route, 'mode: "growth_capabilities"');
mustContain('capability route', route, 'listGrowthCapabilities');
mustContain('capability docs', doc, 'GET /admin/growth/capabilities');
mustContain('capability docs', doc, 'Scheduled external execution is disabled');
mustContain('capability docs', doc, 'Draft generation is disabled');
mustContain('capability docs', doc, 'External delivery is blocked');

if (index.includes('handleGrowthCapabilitiesAdmin') && index.includes('/admin/growth/capabilities')) {
  console.log('OK   src/index.ts wires the Growth capabilities route');
} else {
  failed = true;
  console.error('FAIL src/index.ts does not wire /admin/growth/capabilities yet');
}

if (failed) {
  console.error('Growth capability registry check failed.');
  process.exit(1);
}

console.log('Growth capability registry check passed.');
console.log('- protected capability metadata now includes explicit cross-repo bridge readiness');
console.log('- bridge remains disabled until route inventory, ingestion and cross-repo contract tests exist');
