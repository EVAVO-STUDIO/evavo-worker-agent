import {
  GROWTH_BUSINESS_ROUTE_INVENTORY_PENDING_GROUPS,
  GROWTH_BUSINESS_ROUTE_INVENTORY_VERSION,
  type GrowthBusinessRouteInventoryPendingGroup,
} from "./growthBusinessRouteInventory";

export const GROWTH_BRIDGE_CONTRACT_VERSION = "growth_worker_bridge_v1" as const;

export type GrowthBridgePacketKind =
  | "account_candidate"
  | "opportunity_signal"
  | "evidence_packet"
  | "analysis_recommendation"
  | "next_action_proposal";

export type GrowthBridgeBlockingReason =
  | "worker_post_route_inventory_pending"
  | "next_website_ingestion_endpoint_not_implemented"
  | "cross_repo_contract_tests_not_implemented";

export type GrowthBridgeReadiness = Readonly<{
  contractVersion: typeof GROWTH_BRIDGE_CONTRACT_VERSION;
  sourceSystem: "evavo-worker-agent";
  canonicalTarget: "next-website:supabase:growth_*";
  workerRole: "discovery_candidate_research_memory";
  direction: "worker_to_next_website";
  transport: "server_to_server_only";
  promotionMode: "proposal_only";
  bridgeEnabled: false;
  routeInventoryComplete: false;
  routeInventoryVersion: typeof GROWTH_BUSINESS_ROUTE_INVENTORY_VERSION;
  routeInventoryScope: "growth_and_business_admin_route_policies";
  routeInventoryCompleteForScope: true;
  routeInventoryCompleteForAllWorkerPostRoutes: false;
  unclassifiedPostRouteGroups: readonly GrowthBusinessRouteInventoryPendingGroup[];
  clientBrowserAccess: false;
  adminTokenBrowserExposure: false;
  draftingEnabled: false;
  externalExecutionEnabled: false;
  ownerApprovalRequired: true;
  idempotencyRequired: true;
  auditRequired: true;
  packetKinds: readonly GrowthBridgePacketKind[];
  blockedCapabilities: readonly [
    "email_send",
    "social_post",
    "form_submit",
    "provider_write",
    "canonical_auto_promotion",
  ];
  blockingReasons: readonly GrowthBridgeBlockingReason[];
}>;

export const growthBridgeReadiness: GrowthBridgeReadiness = Object.freeze({
  contractVersion: GROWTH_BRIDGE_CONTRACT_VERSION,
  sourceSystem: "evavo-worker-agent",
  canonicalTarget: "next-website:supabase:growth_*",
  workerRole: "discovery_candidate_research_memory",
  direction: "worker_to_next_website",
  transport: "server_to_server_only",
  promotionMode: "proposal_only",
  bridgeEnabled: false,
  routeInventoryComplete: false,
  routeInventoryVersion: GROWTH_BUSINESS_ROUTE_INVENTORY_VERSION,
  routeInventoryScope: "growth_and_business_admin_route_policies",
  routeInventoryCompleteForScope: true,
  routeInventoryCompleteForAllWorkerPostRoutes: false,
  unclassifiedPostRouteGroups: GROWTH_BUSINESS_ROUTE_INVENTORY_PENDING_GROUPS,
  clientBrowserAccess: false,
  adminTokenBrowserExposure: false,
  draftingEnabled: false,
  externalExecutionEnabled: false,
  ownerApprovalRequired: true,
  idempotencyRequired: true,
  auditRequired: true,
  packetKinds: Object.freeze([
    "account_candidate",
    "opportunity_signal",
    "evidence_packet",
    "analysis_recommendation",
    "next_action_proposal",
  ]),
  blockedCapabilities: Object.freeze([
    "email_send",
    "social_post",
    "form_submit",
    "provider_write",
    "canonical_auto_promotion",
  ]),
  blockingReasons: Object.freeze([
    "worker_post_route_inventory_pending",
    "next_website_ingestion_endpoint_not_implemented",
    "cross_repo_contract_tests_not_implemented",
  ]),
});
