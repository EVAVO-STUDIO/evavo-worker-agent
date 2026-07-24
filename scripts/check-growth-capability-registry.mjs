import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const errors = [];

const paths = {
  registry: "src/core/growthCapabilities.ts",
  bridge: "src/core/growthBridgeReadiness.ts",
  routeParity: "src/core/growthWorkerRouteParity.ts",
  inventory: "src/core/growthBusinessRouteInventory.ts",
  growthPolicy: "src/routes/growthRoutePolicy.ts",
  businessPolicy: "src/routes/businessRoutePolicy.ts",
  opportunityPolicy: "src/routes/opportunityRoutePolicy.ts",
  operationsPolicy: "src/routes/operationsRoutePolicy.ts",
  adminProtected: "src/routes/adminProtected.ts",
  admin: "src/routes/admin.ts",
  tools: "src/routes/tools.ts",
  route: "src/routes/growthCapabilitiesAdmin.ts",
  index: "src/index.ts",
  doc: "docs/growth-capability-registry.md",
  routeParityDoc: "docs/growth-route-parity.md",
};

function read(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireTokens(label, content, tokens) {
  for (const token of tokens) {
    if (!content.includes(token)) errors.push(`${label} is missing: ${token}`);
  }
}

function forbidTokens(label, content, tokens) {
  for (const token of tokens) {
    if (content.includes(token)) errors.push(`${label} contains forbidden token: ${token}`);
  }
}

const registry = read(paths.registry);
const bridge = read(paths.bridge);
const routeParity = read(paths.routeParity);
const inventory = read(paths.inventory);
const growthPolicy = read(paths.growthPolicy);
const businessPolicy = read(paths.businessPolicy);
const opportunityPolicy = read(paths.opportunityPolicy);
const operationsPolicy = read(paths.operationsPolicy);
const adminProtected = read(paths.adminProtected);
const admin = read(paths.admin);
const tools = read(paths.tools);
const route = read(paths.route);
const index = read(paths.index);
const doc = read(paths.doc);
const routeParityDoc = read(paths.routeParityDoc);

requireTokens("Growth capability registry", registry, [
  "growth_capabilities_v2_registry_only",
  "listGrowthWorkerRouteInventory",
  "routeInventory: listGrowthWorkerRouteInventory()",
  "bridgeReadiness: growthBridgeReadiness",
  "scheduledExecutionEnabled: false",
  "scheduledExternalResearchEnabled: false",
  "manualResearchRequiresAuthentication: true",
  "manualResearchRequiresConfirmation: true",
  "manualResearchIsBounded: true",
  "manualResearchSavesReviewItemsOnly: true",
  "draftingEnabled: false",
  "browserExecutionEnabled: false",
  "externalDeliveryEnabled: false",
  "autonomousCampaignsEnabled: false",
  "executesCapabilities: false",
  "touchesExternalChannel: false",
]);

for (const id of [
  "research_public_website",
  "score_growth_signal",
  "draft_message",
  "draft_owned_content",
  "prepare_browser_step",
  "create_internal_task",
  "request_approval",
  "external_delivery_approved",
  "record_outcome",
  "generate_growth_brief",
]) requireTokens("Growth capability registry", registry, [id]);

for (const id of [
  "read_only",
  "draft_only",
  "internal_write",
  "approved_external",
  "trusted_bounded_external",
  "autonomous_campaign",
]) requireTokens("Growth autonomy levels", registry, [id]);

requireTokens("Growth bridge readiness", bridge, [
  "growth_worker_bridge_v2",
  'sourceSystem: "evavo-worker-agent"',
  'canonicalTarget: "next-website:supabase:growth_*"',
  'workerRole: "discovery_candidate_research_memory"',
  'transport: "server_to_server_only"',
  'promotionMode: "proposal_only"',
  "GROWTH_WORKER_ROUTE_CURRENT_BLOCKERS",
  "type GrowthWorkerRouteBlockingReason",
  "export type GrowthBridgeBlockingReason = GrowthWorkerRouteBlockingReason",
  "bridgeEnabled: false",
  "routeInventoryComplete: true",
  "routeInventoryVersion: GROWTH_WORKER_ROUTE_INVENTORY_VERSION",
  'routeInventoryScope: "all_protected_worker_post_route_owners"',
  "routeInventoryCompleteForScope: true",
  "routeInventoryCompleteForAllWorkerPostRoutes: true",
  "routeInventoryIncludesBoundedReadOnlyResearch: true",
  "routeInventoryExternalExecutionGroups: 0",
  "unclassifiedPostRouteGroups: GROWTH_WORKER_ROUTE_INVENTORY_PENDING_GROUPS",
  "clientBrowserAccess: false",
  "adminTokenBrowserExposure: false",
  "draftingEnabled: false",
  "externalExecutionEnabled: false",
  "ownerApprovalRequired: true",
  "idempotencyRequired: true",
  "auditRequired: true",
  "blockingReasons: GROWTH_WORKER_ROUTE_CURRENT_BLOCKERS",
  "canonical_auto_promotion",
]);
forbidTokens("Growth bridge readiness", bridge, [
  "growth_worker_bridge_v1",
  "worker_post_route_inventory_pending",
  "routeInventoryComplete: false",
  "routeInventoryCompleteForAllWorkerPostRoutes: false",
  "bridgeEnabled: true",
  "clientBrowserAccess: true",
  "adminTokenBrowserExposure: true",
  "draftingEnabled: true",
  "externalExecutionEnabled: true",
  'blockingReasons: Object.freeze([',
  "ADMIN_TOKEN",
  "providerToken",
  "accessToken",
  "refreshToken",
  "serviceRoleKey",
]);

requireTokens("Growth route parity state", routeParity, [
  "growth_worker_route_parity_v1",
  "GROWTH_WORKER_ROUTE_ABSENT_BLOCKERS",
  "GROWTH_WORKER_ROUTE_PRESENT_BLOCKERS",
  "GROWTH_WORKER_ROUTE_BLOCKERS_BY_PAGE_STATE",
  'GROWTH_WORKER_ROUTE_CURRENT_PAGE_STATE = "absent"',
  "GROWTH_WORKER_ROUTE_CURRENT_BLOCKERS",
  "next_website_ingestion_endpoint_not_implemented",
  "worker_proposal_delivery_not_implemented",
  "cross_repo_contract_tests_not_implemented",
  "growthWorkerRouteBlockersForPageState",
  "parseGrowthWorkerRouteParityContract",
  "parseGrowthWorkerRouteParityJson",
  "assertGrowthWorkerRouteParityPageState",
  "GROWTH_WORKER_ROUTE_PARITY_BLOCKERS_INVALID",
]);
forbidTokens("Growth route parity state", routeParity, [
  "bridgeEnabled: true",
  "deliveryEnabled: true",
  "ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_ADMIN_TOKEN",
  "EVAVO_GROWTH_WORKER_PROPOSAL_KEYS_JSON",
  "fetch(",
  "process.env",
]);

requireTokens("Complete Worker route inventory", inventory, [
  "growth_worker_route_inventory_v2",
  "GROWTH_WORKER_ROUTE_INVENTORY_PENDING_GROUPS = Object.freeze([] as const)",
  "OPPORTUNITY_ROUTE_POLICIES",
  "OPERATIONS_ROUTE_POLICIES",
  'routeFamily: "growth"',
  'routeFamily: "business"',
  'routeFamily: "opportunity"',
  'routeFamily: "operations"',
  'routeFamily: "admin-fallback"',
  'handlerId: "historical-leads"',
  'scope: "all_protected_worker_post_route_owners"',
  "postRouteOwnerFamilies",
  'protectedGetOnlyFamilies: Object.freeze(["tools"]',
  'publicReadOnlyFamilies: Object.freeze(["health", "public", "root"]',
  "completeForScope: true",
  "completeForAllWorkerPostRoutes: true",
  "bridgeEligible: false",
  "unclassifiedPostRouteGroups: GROWTH_WORKER_ROUTE_INVENTORY_PENDING_GROUPS",
  "metadata-write",
  "internal-mutation",
  "external-dry-run",
  "retired-write-fail-closed",
  "legacyExecutionFailClosed",
  "externalExecutionGroups",
  "inventoryIncludesBoundedReadOnlyResearch",
  "inventoryIncludesExternalExecution: false",
  "registryRouteCallsExternalNetwork: false",
  "callsAI: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
  "canonicalGrowthPromotionEnabled: false",
  "export const listGrowthBusinessRouteInventory = listGrowthWorkerRouteInventory",
]);

for (const source of [
  "src/index.ts",
  "src/routes/workerRoutePolicy.ts",
  "src/routes/growthRoutePolicy.ts",
  "src/routes/businessRoutePolicy.ts",
  "src/routes/opportunityRoutePolicy.ts",
  "src/routes/operationsRoutePolicy.ts",
  "src/routes/adminProtected.ts",
  "src/routes/admin.ts",
  "src/routes/tools.ts",
]) requireTokens("Complete Worker route inventory", inventory, [`"${source}"`]);

forbidTokens("Complete Worker route inventory", inventory, [
  "growth_business_route_inventory_v1",
  "completeForAllWorkerPostRoutes: false",
  "bridgeEligible: true",
  "unclassifiedPostRouteGroups: Object.freeze([",
  "browserCallable: true",
  "canonicalGrowthPromotion: true",
  "exposesAdminToken: true",
  "inventoryIncludesExternalExecution: true",
  "registryRouteCallsExternalNetwork: true",
  "callsAI: true",
  "canSendEmail: true",
  "canPostSocial: true",
  "canSubmitForms: true",
  "canonicalGrowthPromotionEnabled: true",
  'postClassification: "external-execution"',
  "ADMIN_TOKEN",
  "providerToken",
  "accessToken",
  "refreshToken",
  "serviceRoleKey",
]);

requireTokens("Growth route policy", growthPolicy, [
  "GROWTH_ROUTE_POLICIES",
  'authentication: "handler-enforced"',
  "callsExternalNetwork: false",
  "callsAI: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
]);
requireTokens("Business route policy", businessPolicy, [
  "BUSINESS_ROUTE_POLICIES",
  'writeConfirmation: "handler-enforced"',
  "retiredWritesFailClosed: true",
  "callsExternalNetwork: false",
  "callsAI: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
]);
requireTokens("Opportunity route policy", opportunityPolicy, [
  "OPPORTUNITY_ROUTE_POLICIES",
  "networkPosture: OpportunityNetworkPosture",
  "read-only-research",
  'authentication: "handler-enforced"',
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
]);
requireTokens("Operations route policy", operationsPolicy, [
  "OPERATIONS_ROUTE_POLICIES",
  "networkPosture: OperationsNetworkPosture",
  "read-only-research",
  'writeConfirmation: "handler-enforced"',
  "callsAI: false",
  "canSendEmail: false",
  "canPostSocial: false",
  "canSubmitForms: false",
]);

requireTokens("Admin fallback confirmation", adminProtected, [
  'pathname === "/admin/leads" && request.method === "POST"',
  "confirm_required",
  "internalMetadataOnly: true",
  "callsNetwork: false",
  "callsAI: false",
  "externalStateChange: false",
]);
requireTokens("Admin fallback owner", admin, [
  'pathname === "/admin/leads" && request.method === "POST"',
  "insertLead",
  "internalMetadataOnly: true",
  "externalStateChange: false",
]);
requireTokens("Protected tools posture", tools, [
  'request.method === "OPTIONS"',
  'allow: "GET"',
  'pathname === "/tools/capabilities" && request.method === "GET"',
]);

requireTokens("Worker dispatcher", index, [
  "switch (resolveOpportunityRouteHandlerId(pathname))",
  "switch (resolveGrowthRouteHandlerId(pathname))",
  "switch (resolveBusinessRouteHandlerId(pathname))",
  "switch (resolveOperationsRouteHandlerId(pathname))",
  'matchesWorkerRouteFamily("admin", pathname)',
  'matchesWorkerRouteFamily("tools", pathname)',
]);
requireTokens("Capability route", route, [
  'mode: "growth_capabilities"',
  "listGrowthCapabilities",
  'request.method !== "GET"',
]);

requireTokens("Capability documentation", doc, [
  "growth_worker_bridge_v2",
  "growth_worker_route_inventory_v2",
  "all_protected_worker_post_route_owners",
  "routeInventoryCompleteForAllWorkerPostRoutes: true",
  "routeInventoryExternalExecutionGroups: 0",
  "unclassifiedPostRouteGroups: 0",
  "Inventory completion does **not** enable the bridge.",
  "next_website_ingestion_endpoint_not_implemented",
  "cross_repo_contract_tests_not_implemented",
  "Every protected POST owner is classified",
  "external-dry-run",
  "GET /admin/growth/capabilities",
]);
requireTokens("Route parity documentation", routeParityDoc, [
  "Growth Route Parity",
  "growth_worker_route_parity_v1",
  "Conditional blocker posture",
  "worker_proposal_delivery_not_implemented",
  "The present state must not retain `next_website_ingestion_endpoint_not_implemented`.",
  "Static fixture and parser parity are not live bridge evidence.",
]);
forbidTokens("Capability documentation", doc, [
  "growth_worker_bridge_v1",
  "growth_business_route_inventory_v1",
  "routeInventoryComplete: false",
  "completeForAllWorkerPostRoutes: false",
  "worker_post_route_inventory_pending",
]);

if (errors.length) {
  console.error("Growth capability registry check failed:\n");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("Growth capability registry check passed.");
console.log("- protected capability metadata publishes growth_worker_bridge_v2 and the complete Worker POST-owner inventory");
console.log("- current readiness blockers come from the mirrored Growth route-state contract rather than a duplicated fixed array");
console.log("- absent and present website page states have distinct exact blocker sets while bridge and delivery remain disabled");
console.log("- Growth, Business, Opportunity, Operations and admin-fallback POST owners are classified from dispatcher policy sources");
console.log("- bounded public research is classified as external-dry-run without external state mutation or delivery capability");
console.log("- no protected Worker POST owner is unclassified and no inventory group permits external execution or canonical promotion");
console.log("- bridge remains disabled until website route validation, Worker proposal delivery and live cross-repository tests exist");
