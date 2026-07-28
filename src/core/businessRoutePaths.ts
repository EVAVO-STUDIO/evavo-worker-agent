export const BUSINESS_ROUTE_PREFIX = "/admin/business" as const;

export const BUSINESS_ACCOUNT_INTELLIGENCE_PATTERN =
  "/admin/business/organizations/:organizationId/account-360" as const;

export const BUSINESS_PEOPLE_PATH = "/admin/business/people" as const;

export const BUSINESS_WEBSITE_AUDIT_PATHS = Object.freeze([
  "/admin/business/websites",
  "/admin/business/pages",
  "/admin/business/website-audit-runs",
  "/admin/business/audit-observations",
  "/admin/business/audit-observation-candidates",
] as const);

export const BUSINESS_HISTORICAL_PATHS = Object.freeze([
  "/admin/business/action-drafts",
  "/admin/business/approval-requests",
] as const);

export const BUSINESS_FALLBACK_COLLECTION_PATHS = Object.freeze([
  "/admin/business/organizations",
  "/admin/business/signals",
  "/admin/business/opportunities",
  "/admin/business/service-matches",
  "/admin/business/audit-packs",
  "/admin/business/suppression",
  "/admin/business/content-ideas",
  "/admin/business/followups",
  "/admin/business/learning",
] as const);

export const BUSINESS_READ_QUERY_GUARDED_PATHS = Object.freeze([
  ...BUSINESS_FALLBACK_COLLECTION_PATHS,
  ...BUSINESS_WEBSITE_AUDIT_PATHS,
  ...BUSINESS_HISTORICAL_PATHS,
] as const);

export type BusinessReadQueryGuardedPath =
  (typeof BUSINESS_READ_QUERY_GUARDED_PATHS)[number];

export function isBusinessRoutePath(pathname: string): boolean {
  return pathname === BUSINESS_ROUTE_PREFIX || pathname.startsWith(`${BUSINESS_ROUTE_PREFIX}/`);
}
