import {
  GROWTH_ROUTE_POLICIES,
  type GrowthRoutePolicy,
} from "../routes/growthRoutePolicy";
import {
  BUSINESS_HISTORICAL_PATHS,
  BUSINESS_ROUTE_POLICIES,
  BUSINESS_WEBSITE_AUDIT_PATHS,
  type BusinessRouteHandlerId,
  type BusinessRoutePolicy,
} from "../routes/businessRoutePolicy";

export const GROWTH_BUSINESS_ROUTE_INVENTORY_VERSION = "growth_business_route_inventory_v1" as const;

export type WorkerPostClassification =
  | "not-supported"
  | "metadata-write"
  | "internal-mutation"
  | "external-dry-run"
  | "external-execution"
  | "retired-write-fail-closed";

export type GrowthBusinessRouteInventoryEntry = Readonly<{
  routeFamily: "growth" | "business";
  handlerId: string;
  priority: number;
  ownership: Readonly<
    | { kind: "exact"; paths: readonly string[] }
    | { kind: "prefix"; prefix: string }
  >;
  readMethods: readonly ["GET"];
  writeMethods: readonly [] | readonly ["POST"];
  postClassification: WorkerPostClassification;
  authentication: "handler-enforced";
  confirmation: "not-required" | "handler-enforced";
  callsExternalNetwork: false;
  callsAI: false;
  canSendEmail: false;
  canPostSocial: false;
  canSubmitForms: false;
  historicalOnly: boolean;
  retiredWritesFailClosed: boolean;
  browserCallable: false;
  canonicalGrowthPromotion: false;
}>;

const GET_ONLY = Object.freeze(["GET"] as const);
const NO_WRITES = Object.freeze([] as const);
const POST_ONLY = Object.freeze(["POST"] as const);

function ownershipForGrowth(policy: GrowthRoutePolicy): GrowthBusinessRouteInventoryEntry["ownership"] {
  if (policy.paths) return Object.freeze({ kind: "exact" as const, paths: Object.freeze([...policy.paths]) });
  if (policy.prefix) return Object.freeze({ kind: "prefix" as const, prefix: policy.prefix });
  throw new Error(`GROWTH_ROUTE_POLICY_OWNERSHIP_MISSING:${policy.handlerId}`);
}

function growthEntry(policy: GrowthRoutePolicy): GrowthBusinessRouteInventoryEntry {
  const readOnly = policy.mutationPosture === "read-only";
  return Object.freeze({
    routeFamily: "growth",
    handlerId: policy.handlerId,
    priority: policy.priority,
    ownership: ownershipForGrowth(policy),
    readMethods: GET_ONLY,
    writeMethods: readOnly ? NO_WRITES : POST_ONLY,
    postClassification: readOnly ? "not-supported" : "internal-mutation",
    authentication: policy.authentication,
    confirmation: policy.confirmation,
    callsExternalNetwork: false,
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    historicalOnly: false,
    retiredWritesFailClosed: false,
    browserCallable: false,
    canonicalGrowthPromotion: false,
  });
}

function businessOwnership(handlerId: BusinessRouteHandlerId): GrowthBusinessRouteInventoryEntry["ownership"] {
  switch (handlerId) {
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

function businessEntry(policy: BusinessRoutePolicy): GrowthBusinessRouteInventoryEntry {
  const retired = policy.mutationPosture === "historical-read-retired-write";
  return Object.freeze({
    routeFamily: "business",
    handlerId: policy.id,
    priority: policy.priority,
    ownership: businessOwnership(policy.id),
    readMethods: GET_ONLY,
    writeMethods: POST_ONLY,
    postClassification: retired ? "retired-write-fail-closed" : "internal-mutation",
    authentication: policy.authentication,
    confirmation: policy.writeConfirmation,
    callsExternalNetwork: false,
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    historicalOnly: policy.historicalOnly,
    retiredWritesFailClosed: policy.retiredWritesFailClosed,
    browserCallable: false,
    canonicalGrowthPromotion: false,
  });
}

const entries: readonly GrowthBusinessRouteInventoryEntry[] = Object.freeze([
  ...GROWTH_ROUTE_POLICIES.map(growthEntry),
  ...BUSINESS_ROUTE_POLICIES.map(businessEntry),
]);

export function listGrowthBusinessRouteInventory() {
  const postClassifications = entries.reduce<Record<string, number>>((counts, entry) => {
    counts[entry.postClassification] = (counts[entry.postClassification] ?? 0) + 1;
    return counts;
  }, {});

  return Object.freeze({
    contractVersion: GROWTH_BUSINESS_ROUTE_INVENTORY_VERSION,
    scope: "growth_and_business_admin_route_policies",
    sourceOfTruth: Object.freeze([
      "src/routes/growthRoutePolicy.ts",
      "src/routes/businessRoutePolicy.ts",
    ]),
    completeForScope: true,
    completeForAllWorkerPostRoutes: false,
    bridgeEligible: false,
    unclassifiedPostRouteGroups: Object.freeze([] as string[]),
    entries,
    summary: Object.freeze({
      routeGroups: entries.length,
      postCapableGroups: entries.filter((entry) => entry.writeMethods.length > 0).length,
      readOnlyGroups: entries.filter((entry) => entry.writeMethods.length === 0).length,
      retiredWriteGroups: entries.filter((entry) => entry.retiredWritesFailClosed).length,
      externalExecutionGroups: entries.filter((entry) => entry.postClassification === "external-execution").length,
      postClassifications: Object.freeze(postClassifications),
    }),
    safety: Object.freeze({
      browserCallable: false,
      exposesAdminToken: false,
      callsExternalNetwork: false,
      callsAI: false,
      externalExecutionEnabled: false,
      canonicalGrowthPromotionEnabled: false,
    }),
  });
}
