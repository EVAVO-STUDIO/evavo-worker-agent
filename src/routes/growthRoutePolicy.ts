export type GrowthRouteHandlerId =
  | "approval-requests"
  | "operator-artifacts"
  | "capabilities"
  | "blackboard"
  | "strategy-memory"
  | "campaign-intelligence"
  | "growth-fallback";

export type GrowthRoutePolicy = Readonly<{
  handlerId: GrowthRouteHandlerId;
  priority: number;
  paths?: readonly string[];
  prefix?: string;
  authentication: "handler-enforced";
  mutationPosture: "read-only" | "mixed-internal";
  confirmation: "not-required" | "handler-enforced";
  callsExternalNetwork: false;
  callsAI: false;
  canSendEmail: false;
  canPostSocial: false;
  canSubmitForms: false;
}>;

const exact = (handlerId: GrowthRouteHandlerId, priority: number, paths: readonly string[], mutationPosture: GrowthRoutePolicy["mutationPosture"], confirmation: GrowthRoutePolicy["confirmation"]): GrowthRoutePolicy =>
  Object.freeze({
    handlerId,
    priority,
    paths: Object.freeze([...paths]),
    authentication: "handler-enforced",
    mutationPosture,
    confirmation,
    callsExternalNetwork: false,
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
  });

export const GROWTH_ROUTE_POLICIES: readonly GrowthRoutePolicy[] = Object.freeze([
  exact("approval-requests", 10, [
    "/admin/growth/approval-requests",
    "/admin/growth/approval-requests/status",
  ], "mixed-internal", "handler-enforced"),
  exact("operator-artifacts", 15, [
    "/admin/growth/operator/artifacts",
  ], "mixed-internal", "not-required"),
  exact("capabilities", 20, [
    "/admin/growth/capabilities",
  ], "read-only", "not-required"),
  exact("blackboard", 30, [
    "/admin/growth/blackboard",
    "/admin/growth/blackboard/facts",
    "/admin/growth/blackboard/entities",
    "/admin/growth/blackboard/relationships",
    "/admin/growth/blackboard/signals",
    "/admin/growth/blackboard/assets",
  ], "mixed-internal", "handler-enforced"),
  exact("strategy-memory", 40, [
    "/admin/growth/strategy-memory",
    "/admin/growth/objectives",
    "/admin/growth/key-results",
    "/admin/growth/segments",
    "/admin/growth/offers",
    "/admin/growth/positioning",
    "/admin/growth/runtime-constraints",
  ], "mixed-internal", "handler-enforced"),
  exact("campaign-intelligence", 50, [
    "/admin/growth/autonomy",
    "/admin/growth/cycle",
    "/admin/growth/cycle/events",
    "/admin/growth/cycle/record",
    "/admin/growth/operator",
    "/admin/growth/campaigns",
    "/admin/growth/experiments",
    "/admin/growth/decisions",
    "/admin/growth/decisions/plan",
    "/admin/growth/metrics",
    "/admin/growth/evidence",
    "/admin/growth/learning",
  ], "mixed-internal", "handler-enforced"),
  Object.freeze({
    handlerId: "growth-fallback",
    priority: 60,
    prefix: "/admin/growth",
    authentication: "handler-enforced",
    mutationPosture: "mixed-internal",
    confirmation: "handler-enforced",
    callsExternalNetwork: false,
    callsAI: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
  }),
]);

export function resolveGrowthRouteHandlerId(pathname: string): GrowthRouteHandlerId | null {
  for (const policy of GROWTH_ROUTE_POLICIES) {
    if (policy.paths?.includes(pathname)) return policy.handlerId;
    if (policy.prefix && (pathname === policy.prefix || pathname.startsWith(`${policy.prefix}/`))) return policy.handlerId;
  }
  return null;
}
