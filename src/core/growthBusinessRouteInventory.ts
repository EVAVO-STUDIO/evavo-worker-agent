import {
  GROWTH_ROUTE_POLICIES,
  type GrowthRoutePolicy,
} from "../routes/growthRoutePolicy";
import {
  BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN,
  BUSINESS_HISTORICAL_PATHS,
  BUSINESS_RELATIONSHIP_MANAGER_CYCLE_PATH,
  BUSINESS_ROUTE_POLICIES,
  BUSINESS_WEBSITE_AUDIT_PATHS,
  type BusinessRouteHandlerId,
  type BusinessRoutePolicy,
} from "../routes/businessRoutePolicy";
import {
  OPPORTUNITY_ROUTE_POLICIES,
  type OpportunityRouteHandlerId,
  type OpportunityRoutePolicy,
} from "../routes/opportunityRoutePolicy";
import {
  OPERATIONS_ROUTE_POLICIES,
  type OperationsRouteHandlerId,
  type OperationsRoutePolicy,
} from "../routes/operationsRoutePolicy";

export const GROWTH_WORKER_ROUTE_INVENTORY_VERSION = "growth_worker_route_inventory_v3" as const;
export const GROWTH_WORKER_ROUTE_INVENTORY_PENDING_GROUPS = Object.freeze([] as const);

export const GROWTH_BUSINESS_ROUTE_INVENTORY_VERSION = GROWTH_WORKER_ROUTE_INVENTORY_VERSION;
export const GROWTH_BUSINESS_ROUTE_INVENTORY_PENDING_GROUPS = GROWTH_WORKER_ROUTE_INVENTORY_PENDING_GROUPS;

export type GrowthWorkerRouteInventoryPendingGroup = (typeof GROWTH_WORKER_ROUTE_INVENTORY_PENDING_GROUPS)[number];
export type GrowthBusinessRouteInventoryPendingGroup = GrowthWorkerRouteInventoryPendingGroup;

export type WorkerPostClassification =
  | "not-supported"
  | "internal-preview"
  | "metadata-write"
  | "internal-mutation"
  | "external-dry-run"
  | "external-execution"
  | "retired-write-fail-closed";

export type GrowthWorkerRouteInventoryEntry = Readonly<{
  routeFamily: "growth" | "business" | "opportunity" | "operations" | "admin-fallback";
  handlerId: string;
  priority: number;
  ownership: Readonly<
    | { kind: "exact"; paths: readonly string[] }
    | { kind: "prefix"; prefix: string }
    | { kind: "pattern"; pattern: string }
  >;
  readMethods: readonly "GET"[];
  writeMethods: readonly "POST"[];
  postClassification: WorkerPostClassification;
  authentication: "handler-enforced";
  confirmation: "not-required" | "not-applicable" | "handler-enforced" | "handler-defined";
  networkPosture: "none" | "read-only-research";
  callsExternalNetwork: boolean;
  callsAI: false;
  canSendEmail: false;
  canPostSocial: false;
  canSubmitForms: false;
  externalStateChange: false;
  historicalOnly: boolean;
  retiredWritesFailClosed: boolean;
  legacyExecutionFailClosed: boolean;
  browserCallable: false;
  canonicalGrowthPromotion: false;
}>;

export type GrowthBusinessRouteInventoryEntry = GrowthWorkerRouteInventoryEntry;

const GET_ONLY = Object.freeze(["GET"] as const);
const NO_READS = Object.freeze([] as const);
const NO_WRITES = Object.freeze([] as const);
const POST_ONLY = Object.freeze(["POST"] as const);

const OPPORTUNITY_EXTERNAL_DRY_RUN_IDS = new Set<OpportunityRouteHandlerId>([
  "run-due",
  "public-directory-scan",
  "source-expansion",
  "discovery",
]);

const OPPORTUNITY_POST_ONLY_IDS = new Set<OpportunityRouteHandlerId>([
  "run-due",
  "source-health-action",
  "public-directory-scan",
  "query-hint-resolver",
  "source-candidates",
  "discovery",
  "learning",
]);

function ownershipForGrowth(policy: GrowthRoutePolicy): GrowthWorkerRouteInventoryEntry["ownership"] {
  if (policy.paths) return Object.freeze({ kind: "exact" as const, paths: Object.freeze([...policy.paths]) });
  if (policy.prefix) return Object.freeze({ kind: "prefix" as const, prefix: policy.prefix });
  throw new Error(`GROWTH_ROUTE_POLICY_OWNERSHIP_MISSING:${policy.handlerId}`);
}

function growthEntry(policy: GrowthRoutePolicy): GrowthWorkerRouteInventoryEntry {
  const writes = policy.writeMethods.includes("POST");
  return Object.freeze({
    routeFamily: "growth",
    handlerId: policy.handlerId,
    priority: policy.priority,
    ownership: ownershipForGrowth(policy),
    readMethods: Object.freeze([...policy.readMethods]),
    writeMethods: Object.freeze([...policy.writeMethods]),
    postClassification: writes ? "internal-mutation" : "not-supported",
    authentication: policy.authentication,
    confirmation: policy.confirmation,
    networkPosture: "none",
    callsExternalNetwork: false,
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    externalStateChange: false,
    historicalOnly: false,
    retiredWritesFailClosed: false,
    legacyExecutionFailClosed: false,
    browserCallable: false,
    canonicalGrowthPromotion: false,
  });
}

function businessOwnership(handlerId: BusinessRouteHandlerId): GrowthWorkerRouteInventoryEntry["ownership"] {
  switch (handlerId) {
    case "account-intelligence":
      return Object.freeze({ kind: "pattern", pattern: BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN });
    case "relationship-manager":
      return Object.freeze({ kind: "exact", paths: Object.freeze([BUSINESS_RELATIONSHIP_MANAGER_CYCLE_PATH]) });
    case "people":
      return Object.freeze({ kind: "exact", paths: Object.freeze(["/admin/business/people"]) });
    case "website-audit":
      return Object.freeze({ kind: "exact", paths: Object.freeze([...BUSINESS_WEBSITE_AUDIT_PATHS]) });
    case "business-historical":
      return Object.freeze({ kind: "exact", paths: Object.freeze([...BUSINESS_HISTORICAL_PATHS]) });
    case "business-fallback":
      return Object.freeze({ kind: "prefix", prefix: "/admin/business" });
  }
}

function businessEntry(policy: BusinessRoutePolicy): GrowthWorkerRouteInventoryEntry {
  const readOnly = policy.mutationPosture === "read-only";
  const preview = policy.mutationPosture === "internal-preview";
  const retired = policy.mutationPosture === "historical-read-retired-write";
  return Object.freeze({
    routeFamily: "business",
    handlerId: policy.id,
    priority: policy.priority,
    ownership: businessOwnership(policy.id),
    readMethods: Object.freeze([...policy.readMethods]),
    writeMethods: Object.freeze([...policy.writeMethods]),
    postClassification: preview ? "internal-preview" : readOnly ? "not-supported" : retired ? "retired-write-fail-closed" : "internal-mutation",
    authentication: policy.authentication,
    confirmation: policy.writeConfirmation,
    networkPosture: "none",
    callsExternalNetwork: false,
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    externalStateChange: false,
    historicalOnly: policy.historicalOnly,
    retiredWritesFailClosed: policy.retiredWritesFailClosed,
    legacyExecutionFailClosed: false,
    browserCallable: false,
    canonicalGrowthPromotion: false,
  });
}

function opportunityOwnership(handlerId: OpportunityRouteHandlerId): GrowthWorkerRouteInventoryEntry["ownership"] {
  switch (handlerId) {
    case "run-due":
      return Object.freeze({ kind: "exact", paths: Object.freeze(["/admin/opportunities/run-due"]) });
    case "runs":
      return Object.freeze({ kind: "prefix", prefix: "/admin/opportunities/runs" });
    case "source-health-action":
      return Object.freeze({ kind: "pattern", pattern: "/admin/opportunities/sources/:sourceId/health-action" });
    case "origin-metrics":
      return Object.freeze({ kind: "exact", paths: Object.freeze(["/admin/opportunities/sources/origin-metrics"]) });
    case "expansion-budget-recommendations":
      return Object.freeze({ kind: "exact", paths: Object.freeze(["/admin/opportunities/sources/expansion/budget-recommendations"]) });
    case "public-directory-scan":
      return Object.freeze({ kind: "exact", paths: Object.freeze(["/admin/opportunities/sources/expansion/public-directory-scan"]) });
    case "query-hint-resolver":
      return Object.freeze({ kind: "exact", paths: Object.freeze(["/admin/opportunities/sources/expansion/query-hints/resolve"]) });
    case "source-expansion":
      return Object.freeze({ kind: "prefix", prefix: "/admin/opportunities/sources/expansion" });
    case "source-candidates":
      return Object.freeze({ kind: "exact", paths: Object.freeze(["/admin/opportunities/sources/candidates/preview", "/admin/opportunities/sources/candidates/commit"]) });
    case "source-health":
      return Object.freeze({ kind: "exact", paths: Object.freeze(["/admin/opportunities/sources/health"]) });
    case "scoring-diagnostics":
      return Object.freeze({ kind: "exact", paths: Object.freeze(["/admin/opportunities/scoring-diagnostics"]) });
    case "discovery":
      return Object.freeze({ kind: "pattern", pattern: "/admin/opportunities/sources/:sourceId/(test|preview|commit-preview)" });
    case "learning":
      return Object.freeze({ kind: "exact", paths: Object.freeze(["/admin/opportunities/learning"]) });
    case "review":
      return Object.freeze({ kind: "pattern", pattern: "/admin/opportunities/(reviews|strategy-scores|:opportunityId/review)" });
    case "opportunities-fallback":
      return Object.freeze({ kind: "prefix", prefix: "/admin/opportunities" });
  }
}

function opportunityEntry(policy: OpportunityRoutePolicy): GrowthWorkerRouteInventoryEntry {
  const readOnly = policy.mutationPosture === "read-only";
  const callsExternalNetwork = OPPORTUNITY_EXTERNAL_DRY_RUN_IDS.has(policy.id);
  return Object.freeze({
    routeFamily: "opportunity",
    handlerId: policy.id,
    priority: policy.priority,
    ownership: opportunityOwnership(policy.id),
    readMethods: OPPORTUNITY_POST_ONLY_IDS.has(policy.id) ? NO_READS : GET_ONLY,
    writeMethods: readOnly ? NO_WRITES : POST_ONLY,
    postClassification: readOnly ? "not-supported" : callsExternalNetwork ? "external-dry-run" : "internal-mutation",
    authentication: policy.authentication,
    confirmation: policy.confirmation,
    networkPosture: callsExternalNetwork ? "read-only-research" : "none",
    callsExternalNetwork,
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    externalStateChange: false,
    historicalOnly: false,
    retiredWritesFailClosed: false,
    legacyExecutionFailClosed: false,
    browserCallable: false,
    canonicalGrowthPromotion: false,
  });
}

function operationsOwnership(handlerId: OperationsRouteHandlerId): GrowthWorkerRouteInventoryEntry["ownership"] {
  switch (handlerId) {
    case "legacy-admin-safety":
      return Object.freeze({ kind: "pattern", pattern: "/admin/(run|settings|overview|drafts/:draftId/(approve|reject))" });
    case "autonomy-settings":
      return Object.freeze({ kind: "exact", paths: Object.freeze(["/admin/settings/autonomy"]) });
    case "planner-routes":
      return Object.freeze({ kind: "exact", paths: Object.freeze(["/admin/planner/routes"]) });
    case "planner":
      return Object.freeze({ kind: "prefix", prefix: "/admin/planner" });
    case "source-batch":
      return Object.freeze({ kind: "exact", paths: Object.freeze(["/admin/sources/run-tiny"]) });
    case "sources":
      return Object.freeze({ kind: "pattern", pattern: "/admin/(sources/**|seeds)" });
    case "draft-review":
      return Object.freeze({ kind: "prefix", prefix: "/admin/draft-review" });
    case "strategy-scores":
      return Object.freeze({ kind: "prefix", prefix: "/admin/strategy-scores" });
  }
}

function operationsEntry(policy: OperationsRoutePolicy): GrowthWorkerRouteInventoryEntry {
  const writes = policy.writeMethods.includes("POST");
  const callsExternalNetwork = policy.networkPosture === "read-only-research";
  return Object.freeze({
    routeFamily: "operations",
    handlerId: policy.id,
    priority: policy.priority,
    ownership: operationsOwnership(policy.id),
    readMethods: Object.freeze([...policy.readMethods]),
    writeMethods: Object.freeze([...policy.writeMethods]),
    postClassification: !writes ? "not-supported" : callsExternalNetwork ? "external-dry-run" : "internal-mutation",
    authentication: policy.authentication,
    confirmation: policy.writeConfirmation,
    networkPosture: policy.networkPosture,
    callsExternalNetwork,
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    externalStateChange: false,
    historicalOnly: false,
    retiredWritesFailClosed: false,
    legacyExecutionFailClosed: policy.id === "legacy-admin-safety",
    browserCallable: false,
    canonicalGrowthPromotion: false,
  });
}

const adminFallbackEntry: GrowthWorkerRouteInventoryEntry = Object.freeze({
  routeFamily: "admin-fallback",
  handlerId: "historical-leads",
  priority: 1000,
  ownership: Object.freeze({ kind: "exact", paths: Object.freeze(["/admin/leads"]) }),
  readMethods: GET_ONLY,
  writeMethods: POST_ONLY,
  postClassification: "metadata-write",
  authentication: "handler-enforced",
  confirmation: "handler-enforced",
  networkPosture: "none",
  callsExternalNetwork: false,
  callsAI: false,
  canSendEmail: false,
  canPostSocial: false,
  canSubmitForms: false,
  externalStateChange: false,
  historicalOnly: true,
  retiredWritesFailClosed: false,
  legacyExecutionFailClosed: false,
  browserCallable: false,
  canonicalGrowthPromotion: false,
});

const entries: readonly GrowthWorkerRouteInventoryEntry[] = Object.freeze([
  ...GROWTH_ROUTE_POLICIES.map(growthEntry),
  ...BUSINESS_ROUTE_POLICIES.map(businessEntry),
  ...OPPORTUNITY_ROUTE_POLICIES.map(opportunityEntry),
  ...OPERATIONS_ROUTE_POLICIES.map(operationsEntry),
  adminFallbackEntry,
]);

export function listGrowthWorkerRouteInventory() {
  const postClassifications = entries.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.postClassification] = (counts[entry.postClassification] ?? 0) + 1;
    return counts;
  }, {});

  return Object.freeze({
    contractVersion: GROWTH_WORKER_ROUTE_INVENTORY_VERSION,
    scope: "all_protected_worker_post_route_owners",
    sourceOfTruth: Object.freeze([
      "src/index.ts",
      "src/routes/workerRoutePolicy.ts",
      "src/routes/growthRoutePolicy.ts",
      "src/routes/businessRoutePolicy.ts",
      "src/routes/opportunityRoutePolicy.ts",
      "src/routes/operationsRoutePolicy.ts",
      "src/routes/adminProtected.ts",
      "src/routes/admin.ts",
      "src/routes/tools.ts",
    ]),
    dispatchCoverage: Object.freeze({
      postRouteOwnerFamilies: Object.freeze(["growth", "business", "opportunity", "operations", "admin-fallback"] as const),
      protectedGetOnlyFamilies: Object.freeze(["tools"] as const),
      publicReadOnlyFamilies: Object.freeze(["health", "public", "root"] as const),
    }),
    completeForScope: true,
    completeForAllWorkerPostRoutes: true,
    bridgeEligible: false,
    unclassifiedPostRouteGroups: GROWTH_WORKER_ROUTE_INVENTORY_PENDING_GROUPS,
    entries,
    summary: Object.freeze({
      routeGroups: entries.length,
      postCapableGroups: entries.filter((entry) => entry.writeMethods.length > 0).length,
      readOnlyGroups: entries.filter((entry) => entry.writeMethods.length === 0).length,
      internalPreviewGroups: entries.filter((entry) => entry.postClassification === "internal-preview").length,
      metadataWriteGroups: entries.filter((entry) => entry.postClassification === "metadata-write").length,
      internalMutationGroups: entries.filter((entry) => entry.postClassification === "internal-mutation").length,
      externalDryRunGroups: entries.filter((entry) => entry.postClassification === "external-dry-run").length,
      retiredWriteGroups: entries.filter((entry) => entry.retiredWritesFailClosed).length,
      legacyExecutionFailClosedGroups: entries.filter((entry) => entry.legacyExecutionFailClosed).length,
      externalExecutionGroups: entries.filter((entry) => entry.postClassification === "external-execution").length,
      unclassifiedPostRouteGroups: GROWTH_WORKER_ROUTE_INVENTORY_PENDING_GROUPS.length,
      postClassifications: Object.freeze(postClassifications),
    }),
    safety: Object.freeze({
      browserCallable: false,
      exposesAdminToken: false,
      inventoryIncludesBoundedReadOnlyResearch: entries.some((entry) => entry.callsExternalNetwork),
      inventoryIncludesExternalExecution: false,
      registryRouteCallsExternalNetwork: false,
      callsAI: false,
      canSendEmail: false,
      canPostSocial: false,
      canSubmitForms: false,
      canonicalGrowthPromotionEnabled: false,
    }),
  });
}

export const listGrowthBusinessRouteInventory = listGrowthWorkerRouteInventory;
