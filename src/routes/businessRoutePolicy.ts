export type BusinessRouteHandlerId = "people" | "website-audit" | "business-fallback";

export type BusinessRoutePolicy = Readonly<{
  id: BusinessRouteHandlerId;
  priority: number;
  authentication: "handler-enforced";
  mutationPosture: "mixed-internal";
  readMethods: readonly ["GET"];
  writeMethods: readonly ["POST"];
  writeConfirmation: "handler-enforced";
  callsExternalNetwork: false;
  callsAI: false;
  canSendEmail: false;
  canPostSocial: false;
  canSubmitForms: false;
  matches(pathname: string): boolean;
}>;

const websiteAuditPaths = Object.freeze([
  "/admin/business/websites",
  "/admin/business/pages",
  "/admin/business/website-audit-runs",
  "/admin/business/audit-observations",
  "/admin/business/audit-observation-candidates",
] as const);

const sharedSafety = Object.freeze({
  authentication: "handler-enforced" as const,
  mutationPosture: "mixed-internal" as const,
  readMethods: Object.freeze(["GET"] as const),
  writeMethods: Object.freeze(["POST"] as const),
  writeConfirmation: "handler-enforced" as const,
  callsExternalNetwork: false as const,
  callsAI: false as const,
  canSendEmail: false as const,
  canPostSocial: false as const,
  canSubmitForms: false as const,
});

const policies: readonly BusinessRoutePolicy[] = Object.freeze([
  Object.freeze({
    id: "people",
    priority: 10,
    ...sharedSafety,
    matches: (pathname: string) => pathname === "/admin/business/people",
  }),
  Object.freeze({
    id: "website-audit",
    priority: 20,
    ...sharedSafety,
    matches: (pathname: string) => websiteAuditPaths.includes(pathname as (typeof websiteAuditPaths)[number]),
  }),
  Object.freeze({
    id: "business-fallback",
    priority: 30,
    ...sharedSafety,
    matches: (pathname: string) => pathname === "/admin/business" || pathname.startsWith("/admin/business/"),
  }),
]);

export const BUSINESS_ROUTE_POLICIES: readonly BusinessRoutePolicy[] = policies;
export const BUSINESS_WEBSITE_AUDIT_PATHS: readonly string[] = websiteAuditPaths;

export function resolveBusinessRouteHandlerId(pathname: string): BusinessRouteHandlerId | null {
  return policies.find((policy) => policy.matches(pathname))?.id ?? null;
}
