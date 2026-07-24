import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const registryPath = path.join(repoRoot, 'src/core/growthCapabilities.ts');
const bridgePath = path.join(repoRoot, 'src/core/growthBridgeReadiness.ts');
const inventoryPath = path.join(repoRoot, 'src/core/growthBusinessRouteInventory.ts');
const growthPolicyPath = path.join(repoRoot, 'src/routes/growthRoutePolicy.ts');
const businessPolicyPath = path.join(repoRoot, 'src/routes/businessRoutePolicy.ts');
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

function mustNotContain(label, content, token) {
  if (content.includes(token)) {
    failed = true;
    console.error(`FAIL ${label} contains forbidden token ${token}`);
  }
}

const registry = read('src/core/growthCapabilities.ts', registryPath);
const bridge = read('src/core/growthBridgeReadiness.ts', bridgePath);
const inventory = read('src/core/growthBusinessRouteInventory.ts', inventoryPath);
const growthPolicy = read('src/routes/growthRoutePolicy.ts', growthPolicyPath);
const businessPolicy = read('src/routes/businessRoutePolicy.ts', businessPolicyPath);
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
  'routeInventory: listGrowthBusinessRouteInventory()',
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

for (const token of [
  'growth_business_route_inventory_v1',
  'scope: "growth_and_business_admin_route_policies"',
  '"src/routes/growthRoutePolicy.ts"',
  '"src/routes/businessRoutePolicy.ts"',
  'completeForScope: true',
  'completeForAllWorkerPostRoutes: false',
  'bridgeEligible: false',
  'postClassification: readOnly ? "not-supported" : "internal-mutation"',
  'postClassification: retired ? "retired-write-fail-closed" : "internal-mutation"',
  'browserCallable: false',
  'canonicalGrowthPromotion: false',
  'exposesAdminToken: false',
  'callsExternalNetwork: false',
  'callsAI: false',
  'externalExecutionEnabled: false',
  'canonicalGrowthPromotionEnabled: false',
  'entry.writeMethods.length > 0',
]) mustContain('Growth Business route inventory', inventory, token);

for (const token of [
  'GROWTH_ROUTE_POLICIES',
  'authentication: "handler-enforced"',
  'callsExternalNetwork: false',
  'callsAI: false',
  'canSendEmail: false',
  'canPostSocial: false',
  'canSubmitForms: false',
]) mustContain('Growth route policy source', growthPolicy, token);

for (const token of [
  'BUSINESS_ROUTE_POLICIES',
  'writeConfirmation: "handler-enforced"',
  'retiredWritesFailClosed: true',
  'callsExternalNetwork: false',
  'callsAI: false',
  'canSendEmail: false',
  'canPostSocial: false',
  'canSubmitForms: false',
]) mustContain('Business route policy source', businessPolicy, token);

for (const forbidden of [
  'growth_capabilities_v1_autonomy_execution_contract',
  'currentImplementation: "planned", notes: ["Draft-only.',
  'currentImplementation: "planned", notes: ["Preparation only.',
]) mustNotContain('capability registry stale execution posture', registry, forbidden);

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
]) mustNotContain('bridge readiness unsafe or premature posture', bridge, forbidden);

for (const forbidden of [
  'ADMIN_TOKEN',
  'providerToken',
  'accessToken',
  'refreshToken',
  'serviceRoleKey',
  'completeForAllWorkerPostRoutes: true',
  'bridgeEligible: true',
  'browserCallable: true',
  'canonicalGrowthPromotion: true',
  'exposesAdminToken: true',
  'callsExternalNetwork: true',
  'callsAI: true',
  'externalExecutionEnabled: true',
  'canonicalGrowthPromotionEnabled: true',
  'postClassification: "external-execution"',
]) mustNotContain('Growth Business route inventory unsafe or premature posture', inventory, forbidden);

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
console.log('- protected capability metadata includes explicit cross-repo bridge readiness');
console.log('- protected capability metadata includes typed Growth/Business route-policy inventory');
console.log('- scoped inventory is complete for typed Growth/Business policies but not all Worker POST routes');
console.log('- bridge remains disabled until all-Worker route inventory, ingestion and cross-repo contract tests exist');
