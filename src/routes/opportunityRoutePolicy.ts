export type OpportunityRouteHandlerId =
  | "run-due"
  | "runs"
  | "source-health-action"
  | "origin-metrics"
  | "expansion-budget-recommendations"
  | "public-directory-scan"
  | "query-hint-resolver"
  | "source-expansion"
  | "source-candidates"
  | "source-health"
  | "scoring-diagnostics"
  | "discovery"
  | "learning"
  | "review"
  | "opportunities-fallback";

export type OpportunityMutationPosture = "read-only" | "mixed-internal";
export type OpportunityNetworkPosture = "none" | "read-only-research" | "handler-defined";

export type OpportunityRoutePolicy = Readonly<{
  id: OpportunityRouteHandlerId;
  priority: number;
  authentication: "handler-enforced";
  mutationPosture: OpportunityMutationPosture;
  confirmation: "not-required" | "handler-enforced";
  networkPosture: OpportunityNetworkPosture;
  canSendEmail: false;
  canPostSocial: false;
  canSubmitForms: false;
  matches(pathname: string): boolean;
}>;

const exact = (paths: readonly string[]) => (pathname: string): boolean => paths.includes(pathname);

const policies: readonly OpportunityRoutePolicy[] = Object.freeze([
  { id: "run-due", priority: 10, authentication: "handler-enforced", mutationPosture: "mixed-internal", confirmation: "handler-enforced", networkPosture: "handler-defined", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: exact(["/admin/opportunities/run-due"]) },
  { id: "runs", priority: 20, authentication: "handler-enforced", mutationPosture: "read-only", confirmation: "not-required", networkPosture: "none", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: (pathname) => pathname === "/admin/opportunities/runs" || pathname.startsWith("/admin/opportunities/runs/") },
  { id: "source-health-action", priority: 30, authentication: "handler-enforced", mutationPosture: "mixed-internal", confirmation: "handler-enforced", networkPosture: "handler-defined", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: (pathname) => /^\/admin\/opportunities\/sources\/[^/]+\/health-action$/.test(pathname) },
  { id: "origin-metrics", priority: 40, authentication: "handler-enforced", mutationPosture: "read-only", confirmation: "not-required", networkPosture: "none", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: exact(["/admin/opportunities/sources/origin-metrics"]) },
  { id: "expansion-budget-recommendations", priority: 50, authentication: "handler-enforced", mutationPosture: "read-only", confirmation: "not-required", networkPosture: "none", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: exact(["/admin/opportunities/sources/expansion/budget-recommendations"]) },
  { id: "public-directory-scan", priority: 60, authentication: "handler-enforced", mutationPosture: "mixed-internal", confirmation: "handler-enforced", networkPosture: "read-only-research", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: exact(["/admin/opportunities/sources/expansion/public-directory-scan"]) },
  { id: "query-hint-resolver", priority: 70, authentication: "handler-enforced", mutationPosture: "mixed-internal", confirmation: "handler-enforced", networkPosture: "handler-defined", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: exact(["/admin/opportunities/sources/expansion/query-hints/resolve"]) },
  { id: "source-expansion", priority: 80, authentication: "handler-enforced", mutationPosture: "mixed-internal", confirmation: "handler-enforced", networkPosture: "handler-defined", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: (pathname) => pathname.startsWith("/admin/opportunities/sources/expansion/") },
  { id: "source-candidates", priority: 90, authentication: "handler-enforced", mutationPosture: "mixed-internal", confirmation: "handler-enforced", networkPosture: "none", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: exact(["/admin/opportunities/sources/candidates/preview", "/admin/opportunities/sources/candidates/commit"]) },
  { id: "source-health", priority: 100, authentication: "handler-enforced", mutationPosture: "read-only", confirmation: "not-required", networkPosture: "none", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: exact(["/admin/opportunities/sources/health"]) },
  { id: "scoring-diagnostics", priority: 110, authentication: "handler-enforced", mutationPosture: "read-only", confirmation: "not-required", networkPosture: "none", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: exact(["/admin/opportunities/scoring-diagnostics"]) },
  { id: "discovery", priority: 120, authentication: "handler-enforced", mutationPosture: "mixed-internal", confirmation: "handler-enforced", networkPosture: "read-only-research", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: (pathname) => pathname.startsWith("/admin/opportunities/sources/") && (pathname.endsWith("/test") || pathname.endsWith("/preview") || pathname.endsWith("/commit-preview")) },
  { id: "learning", priority: 130, authentication: "handler-enforced", mutationPosture: "mixed-internal", confirmation: "handler-enforced", networkPosture: "none", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: exact(["/admin/opportunities/learning"]) },
  { id: "review", priority: 140, authentication: "handler-enforced", mutationPosture: "mixed-internal", confirmation: "handler-enforced", networkPosture: "none", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: (pathname) => pathname === "/admin/opportunities/reviews" || pathname === "/admin/opportunities/strategy-scores" || (pathname.startsWith("/admin/opportunities/") && pathname.endsWith("/review")) },
  { id: "opportunities-fallback", priority: 150, authentication: "handler-enforced", mutationPosture: "mixed-internal", confirmation: "handler-enforced", networkPosture: "handler-defined", canSendEmail: false, canPostSocial: false, canSubmitForms: false, matches: (pathname) => pathname.startsWith("/admin/opportunities") },
].map((policy) => Object.freeze(policy)));

export const OPPORTUNITY_ROUTE_POLICIES: readonly OpportunityRoutePolicy[] = policies;

export function resolveOpportunityRouteHandlerId(pathname: string): OpportunityRouteHandlerId | null {
  return policies.find((policy) => policy.matches(pathname))?.id ?? null;
}
