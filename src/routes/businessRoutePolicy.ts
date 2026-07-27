export type BusinessRouteHandlerId = "account-intelligence" | "people" | "website-audit" | "business-historical" | "business-fallback";

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

export const BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN = "/admin/business/organizations/:organizationId/account-360" as const;

const accountIntelligencePath = /^\/admin\/business\/organizations\/[^/]+\/account-360$/;

const websiteAuditPaths = Object.freeze([
  "/admin/business/websites",
  "/admin/business/pages",
  "/admin/business/website-audit-runs",
  "/admin/business/audit-observations",
  "/admin/business/audit-observation-candidates",
] as const);

const historicalBusinessPaths = Object.freeze([
  "/admin/business/action-drafts",
  "/admin/business/approval-requests",
] as const);

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
    id: "people",
    priority: 20,
    mutationPosture: "mixed-internal" as const,
    historicalOnly: false,
    retiredWritesFailClosed: false,
    ...internalWriteSafety,
    matches: (pathname: string) => pathname === "/admin/business/people",
  }),
  Object.freeze({
    id: "website-audit",
    priority: 30,
    mutationPosture: "mixed-internal" as const,
    historicalOnly: false,
    retiredWritesFailClosed: false,
    ...internalWriteSafety,
    matches: (pathname: string) => websiteAuditPaths.includes(pathname as (typeof websiteAuditPaths)[number]),
  }),
  Object.freeze({
    id: "business-historical",
    priority: 40,
    mutationPosture: "historical-read-retired-write" as const,
    historicalOnly: true,
    retiredWritesFailClosed: true,
    ...internalWriteSafety,
    matches: (pathname: string) => historicalBusinessPaths.includes(pathname as (typeof historicalBusinessPaths)[number]),
  }),
  Object.freeze({
    id: "business-fallback",
    priority: 50,
    mutationPosture: "mixed-internal" as const,
    historicalOnly: false,
    retiredWritesFailClosed: false,
    ...internalWriteSafety,
    matches: (pathname: string) => pathname === "/admin/business" || pathname.startsWith("/admin/business/"),
  }),
]);

export const BUSINESS_ROUTE_POLICIES: readonly BusinessRoutePolicy[] = policies;
export const BUSINESS_WEBSITE_AUDIT_PATHS: readonly string[] = websiteAuditPaths;
export const BUSINESS_HISTORICAL_PATHS: readonly string[] = historicalBusinessPaths;

export function resolveBusinessRouteHandlerId(pathname: string): BusinessRouteHandlerId | null {
  return policies.find((policy) => policy.matches(pathname))?.id ?? null;
}
