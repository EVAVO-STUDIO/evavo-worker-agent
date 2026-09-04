import {
  BUSINESS_HISTORICAL_PATHS,
  isBusinessRoutePath,
  BUSINESS_PEOPLE_PATH,
  BUSINESS_RELATIONSHIP_MANAGER_CYCLE_PATH,
  BUSINESS_WEBSITE_AUDIT_PATHS,
} from "../core/businessRoutePaths";

export {
  BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN,
  BUSINESS_FALLBACK_COLLECTION_PATHS,
  BUSINESS_HISTORICAL_PATHS,
  isBusinessRoutePath,
  BUSINESS_PEOPLE_PATH,
  BUSINESS_READ_QUERY_GUARDED_PATHS,
  BUSINESS_RELATIONSHIP_MANAGER_CYCLE_PATH,
  BUSINESS_ROUTE_PREFIX,
  BUSINESS_WEBSITE_AUDIT_PATHS,
} from "../core/businessRoutePaths";

export type BusinessRouteHandlerId = "account-intelligence" | "relationship-manager" | "people" | "website-audit" | "business-historical" | "business-fallback";

export type BusinessMutationPosture = "read-only" | "mixed-internal" | "historical-read-retired-write";

export type BusinessRoutePolicy = Readonly<{
  id: BusinessRouteHandlerId;
  priority: number;
  authentication: "handler-enforced";
  mutationPosture: BusinessMutationPosture;
  readMethods: readonly "GET"[];
  writeMethods: readonly "POST"[];
  writeConfirmation: "handler-enforced" | "not-applicable";
  callsExternalNetwork: false;
  callsAI: false;
  canSendEmail: false;
  canPostSocial: false;
  canSubmitForms: false;
  historicalOnly: boolean;
  retiredWritesFailClosed: boolean;
  matches(pathname: string): boolean;
}>;

const accountIntelligencePath = /^\/admin\/business\/organizations\/[^/]+\/account-360$/;

const sharedSafety = Object.freeze({
  authentication: "handler-enforced" as const,
  readMethods: Object.freeze(["GET"] as const),
  callsExternalNetwork: false as const,
  callsAI: false as const,
  canSendEmail: false as const,
  canPostSocial: false as const,
  canSubmitForms: false as const,
});

const readOnlySafety = Object.freeze({
  ...sharedSafety,
  writeMethods: Object.freeze([] as const),
  writeConfirmation: "not-applicable" as const,
});

const internalWriteSafety = Object.freeze({
  ...sharedSafety,
  writeMethods: Object.freeze(["POST"] as const),
  writeConfirmation: "handler-enforced" as const,
});

const policies: readonly BusinessRoutePolicy[] = Object.freeze([
  Object.freeze({
    id: "account-intelligence",
    priority: 10,
    mutationPosture: "read-only" as const,
    historicalOnly: false,
    retiredWritesFailClosed: false,
    ...readOnlySafety,
    matches: (pathname: string) => accountIntelligencePath.test(pathname),
  }),
  Object.freeze({
    id: "relationship-manager",
    priority: 15,
    mutationPosture: "mixed-internal" as const,
    historicalOnly: false,
    retiredWritesFailClosed: false,
    ...internalWriteSafety,
    matches: (pathname: string) => pathname === BUSINESS_RELATIONSHIP_MANAGER_CYCLE_PATH,
  }),
  Object.freeze({
    id: "people",
    priority: 20,
    mutationPosture: "mixed-internal" as const,
    historicalOnly: false,
    retiredWritesFailClosed: false,
    ...internalWriteSafety,
    matches: (pathname: string) => pathname === BUSINESS_PEOPLE_PATH,
  }),
  Object.freeze({
    id: "website-audit",
    priority: 30,
    mutationPosture: "mixed-internal" as const,
    historicalOnly: false,
    retiredWritesFailClosed: false,
    ...internalWriteSafety,
    matches: (pathname: string) => BUSINESS_WEBSITE_AUDIT_PATHS.includes(pathname as (typeof BUSINESS_WEBSITE_AUDIT_PATHS)[number]),
  }),
  Object.freeze({
    id: "business-historical",
    priority: 40,
    mutationPosture: "historical-read-retired-write" as const,
    historicalOnly: true,
    retiredWritesFailClosed: true,
    ...internalWriteSafety,
    matches: (pathname: string) => BUSINESS_HISTORICAL_PATHS.includes(pathname as (typeof BUSINESS_HISTORICAL_PATHS)[number]),
  }),
  Object.freeze({
    id: "business-fallback",
    priority: 50,
    mutationPosture: "mixed-internal" as const,
    historicalOnly: false,
    retiredWritesFailClosed: false,
    ...internalWriteSafety,
    matches: (pathname: string) => isBusinessRoutePath(pathname),
  }),
]);

export const BUSINESS_ROUTE_POLICIES: readonly BusinessRoutePolicy[] = policies;

export function resolveBusinessRouteHandlerId(pathname: string): BusinessRouteHandlerId | null {
  return policies.find((policy) => policy.matches(pathname))?.id ?? null;
}
