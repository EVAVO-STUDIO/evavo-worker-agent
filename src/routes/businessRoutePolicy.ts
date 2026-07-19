export type BusinessRouteHandlerId = "people" | "website-audit" | "business-fallback";

export type BusinessRoutePolicy = Readonly<{
  id: BusinessRouteHandlerId;
  priority: number;
  authentication: "handler-enforced";
  mutationPosture: "mixed-internal";
  confirmation: "handler-enforced";
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

const policies: readonly BusinessRoutePolicy[] = Object.freeze([
  Object.freeze({
    id: "people",
    priority: 10,
    authentication: "handler-enforced",
    mutationPosture: "mixed-internal",
    confirmation: "handler-enforced",
    callsExternalNetwork: false,
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    matches: (pathname: string) => pathname === "/admin/business/people",
  }),
  Object.freeze({
    id: "website-audit",
    priority: 20,
    authentication: "handler-enforced",
    mutationPosture: "mixed-internal",
    confirmation: "handler-enforced",
    callsExternalNetwork: false,
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    matches: (pathname: string) => websiteAuditPaths.includes(pathname as (typeof websiteAuditPaths)[number]),
  }),
  Object.freeze({
    id: "business-fallback",
    priority: 30,
    authentication: "handler-enforced",
    mutationPosture: "mixed-internal",
    confirmation: "handler-enforced",
    callsExternalNetwork: false,
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
    matches: (pathname: string) => pathname === "/admin/business" || pathname.startsWith("/admin/business/"),
  }),
]);

export const BUSINESS_ROUTE_POLICIES: readonly BusinessRoutePolicy[] = policies;
export const BUSINESS_WEBSITE_AUDIT_PATHS: readonly string[] = websiteAuditPaths;

export function resolveBusinessRouteHandlerId(pathname: string): BusinessRouteHandlerId | null {
  return policies.find((policy) => policy.matches(pathname))?.id ?? null;
}
