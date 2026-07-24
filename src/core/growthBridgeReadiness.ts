import {
  GROWTH_WORKER_ROUTE_INVENTORY_PENDING_GROUPS,
  GROWTH_WORKER_ROUTE_INVENTORY_VERSION,
  type GrowthWorkerRouteInventoryPendingGroup,
} from "./growthBusinessRouteInventory";
import {
  GROWTH_WORKER_ROUTE_CURRENT_BLOCKERS,
  type GrowthWorkerRouteBlockingReason,
} from "./growthWorkerRouteParity";

export const GROWTH_BRIDGE_CONTRACT_VERSION = "growth_worker_bridge_v2" as const;

export type GrowthBridgePacketKind =
  | "account_candidate"
  | "opportunity_signal"
  | "evidence_packet"
  | "analysis_recommendation"
  | "next_action_proposal";

export type GrowthBridgeBlockingReason = GrowthWorkerRouteBlockingReason;

export type GrowthBridgeReadiness = Readonly<{
  contractVersion: typeof GROWTH_BRIDGE_CONTRACT_VERSION;
  sourceSystem: "evavo-worker-agent";
  canonicalTarget: "next-website:supabase:growth_*";
  workerRole: "discovery_candidate_research_memory";
  direction: "worker_to_next_website";
  transport: "server_to_server_only";
  promotionMode: "proposal_only";
  bridgeEnabled: false;
  routeInventoryComplete: true;
  routeInventoryVersion: typeof GROWTH_WORKER_ROUTE_INVENTORY_VERSION;
  routeInventoryScope: "all_protected_worker_post_route_owners";
  routeInventoryCompleteForScope: true;
  routeInventoryCompleteForAllWorkerPostRoutes: true;
  routeInventoryIncludesBoundedReadOnlyResearch: true;
  routeInventoryExternalExecutionGroups: 0;
  unclassifiedPostRouteGroups: readonly GrowthWorkerRouteInventoryPendingGroup[];
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
  routeInventoryComplete: true,
  routeInventoryVersion: GROWTH_WORKER_ROUTE_INVENTORY_VERSION,
  routeInventoryScope: "all_protected_worker_post_route_owners",
  routeInventoryCompleteForScope: true,
  routeInventoryCompleteForAllWorkerPostRoutes: true,
  routeInventoryIncludesBoundedReadOnlyResearch: true,
  routeInventoryExternalExecutionGroups: 0,
  unclassifiedPostRouteGroups: GROWTH_WORKER_ROUTE_INVENTORY_PENDING_GROUPS,
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
  blockingReasons: GROWTH_WORKER_ROUTE_CURRENT_BLOCKERS,
});
