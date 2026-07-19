import { Env } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { plannerRouteCatalogue } from "./routeCataloguePlanner";
import { sourceRouteCatalogue } from "./routeCatalogueSources";
import { opportunityRouteCatalogue } from "./routeCatalogueOpportunities";
import { safetyRouteCatalogue } from "./routeCatalogueSafety";
import { RouteCatalogueItem } from "./routeCatalogueTypes";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

const routes: RouteCatalogueItem[] = [
  ...plannerRouteCatalogue,
  ...sourceRouteCatalogue,
  ...opportunityRouteCatalogue,
  ...safetyRouteCatalogue,
];

function groupedRoutes() {
  return routes.reduce<Record<string, RouteCatalogueItem[]>>((acc, route) => {
    acc[route.section] = acc[route.section] || [];
    acc[route.section].push(route);
    return acc;
  }, {});
}

export async function handlePlannerRoutesAdmin(request: Request, env: Env, _pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET" } });
  }
  if (request.method !== "GET") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "GET" } });

  return json({
    ok: true,
    mode: "planner_route_catalogue",
    contractVersion: "planner_routes_v4_modular",
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
      noExternalActionWithoutExplicitSettings: true,
    },
    integration: {
      recommendedOperationsHubEntry: "/ops/outbound-agent",
      recommendedOperationsHubConfig: "/ops/outbound-agent-config",
      recommendedQuickLinkLabel: "Outbound Agent Cockpit",
      recommendedDefaultView: "/admin/planner/dashboard?compact=1",
      recommendedSelfTestView: "/admin/planner/dashboard/self-test?compact=1",
      recommendedSettingsView: "/admin/settings/autonomy",
      recommendedOpportunityRun: "/admin/opportunities/run-due",
      recommendedOpportunityView: "/admin/opportunities/summary",
      recommendedOpportunityLearningView: "/admin/opportunities/learning",
    },
    groups: groupedRoutes(),
    routes,
  });
}
