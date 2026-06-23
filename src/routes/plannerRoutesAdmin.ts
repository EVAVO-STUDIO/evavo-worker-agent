import { Env, getAdminToken } from "../db";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

type RouteSafety = "read_only" | "confirm_required" | "settings_gated" | "public_read_only";
type RouteSection = "cockpit" | "planner" | "sources" | "opportunities" | "drafts" | "safety" | "public";

type RouteCatalogueItem = {
  id: string;
  method: string;
  path: string;
  label: string;
  section: RouteSection;
  safety: RouteSafety;
  readOnly: boolean;
  requiresConfirm: boolean;
  writesTables: string[];
  callsNetwork: boolean;
  callsAI: boolean;
  canSendEmail: boolean;
  costRisk: "none" | "low" | "medium" | "high";
  operatorFacing: boolean;
  operationsHubRecommended: boolean;
  description: string;
};

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

function route(item: RouteCatalogueItem): RouteCatalogueItem {
  return item;
}

const routes: RouteCatalogueItem[] = [
  route({
    id: "planner_report",
    method: "GET",
    path: "/admin/planner",
    label: "Planner report",
    section: "planner",
    safety: "read_only",
    readOnly: true,
    requiresConfirm: false,
    writesTables: [],
    callsNetwork: false,
    callsAI: false,
    canSendEmail: false,
    costRisk: "none",
    operatorFacing: true,
    operationsHubRecommended: true,
    description: "Full planner state, safe actions, blocked actions, samples, and recommended next action.",
  }),
  route({
    id: "planner_dashboard",
    method: "GET",
    path: "/admin/planner/dashboard?compact=1",
    label: "Planner dashboard",
    section: "cockpit",
    safety: "read_only",
    readOnly: true,
    requiresConfirm: false,
    writesTables: [],
    callsNetwork: false,
    callsAI: false,
    canSendEmail: false,
    costRisk: "none",
    operatorFacing: true,
    operationsHubRecommended: true,
    description: "Compact cockpit payload with risk, badges, checklist, counts, latest audit summaries, and refresh hints.",
  }),
  route({
    id: "autonomy_settings",
    method: "GET",
    path: "/admin/settings/autonomy",
    label: "Autonomy settings",
    section: "safety",
    safety: "read_only",
    readOnly: true,
    requiresConfirm: false,
    writesTables: [],
    callsNetwork: false,
    callsAI: false,
    canSendEmail: false,
    costRisk: "none",
    operatorFacing: true,
    operationsHubRecommended: true,
    description: "Reads the current autonomy mode, toggles, caps, and resolved policy used by scheduled and manual runs.",
  }),
  route({
    id: "autonomy_settings_save",
    method: "POST",
    path: "/admin/settings/autonomy",
    label: "Save autonomy settings",
    section: "safety",
    safety: "settings_gated",
    readOnly: false,
    requiresConfirm: false,
    writesTables: ["settings"],
    callsNetwork: false,
    callsAI: false,
    canSendEmail: false,
    costRisk: "none",
    operatorFacing: true,
    operationsHubRecommended: true,
    description: "Saves autonomy mode, free-safe toggles, and caps. Does not run discovery, AI, or sending by itself.",
  }),
  route({
    id: "opportunity_run_due",
    method: "POST",
    path: "/admin/opportunities/run-due",
    label: "Run due opportunities",
    section: "opportunities",
    safety: "confirm_required",
    readOnly: false,
    requiresConfirm: true,
    writesTables: ["opportunity_sources", "opportunities", "events"],
    callsNetwork: true,
    callsAI: false,
    canSendEmail: false,
    costRisk: "low",
    operatorFacing: true,
    operationsHubRecommended: true,
    description: "Confirmed free-safe manual run for due opportunity sources. Saves high-score review items only; no AI, sending, posting, or applying.",
  }),
];

function groupedRoutes() {
  return routes.reduce<Record<string, RouteCatalogueItem[]>>((acc, route) => {
    acc[route.section] = acc[route.section] || [];
    acc[route.section].push(route);
    return acc;
  }, {});
}

export async function handlePlannerRoutesAdmin(request: Request, env: Env, _pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });

  return json({
    ok: true,
    mode: "planner_route_catalogue",
    contractVersion: "planner_routes_v3_compact",
    generatedAtISO: new Date().toISOString(),
    summary: {
      total: routes.length,
      operatorFacing: routes.filter((item) => item.operatorFacing).length,
      operationsHubRecommended: routes.filter((item) => item.operationsHubRecommended).length,
      confirmRequired: routes.filter((item) => item.requiresConfirm).length,
      networkCalling: routes.filter((item) => item.callsNetwork).length,
      aiCalling: routes.filter((item) => item.callsAI).length,
      emailCapable: routes.filter((item) => item.canSendEmail).length,
    },
    safetyRules: {
      noAdminTokenInWebsiteCode: true,
      preferServerSideProxyForOperationsHub: true,
      requireExplicitConfirmForWriteOrNetworkActions: true,
      aiAndSendingRemainSettingsGated: true,
    },
    integration: {
      recommendedOperationsHubEntry: "/ops/outbound-agent",
      recommendedOperationsHubConfig: "/ops/outbound-agent-config",
      recommendedQuickLinkLabel: "Outbound Agent Cockpit",
      recommendedDefaultView: "/admin/planner/dashboard?compact=1",
      recommendedSettingsView: "/admin/settings/autonomy",
      recommendedOpportunityRun: "/admin/opportunities/run-due",
      recommendedOpportunityView: "/admin/opportunities/summary",
      recommendedOpportunityLearningView: "/admin/opportunities/learning",
    },
    groups: groupedRoutes(),
    routes,
  });
}
