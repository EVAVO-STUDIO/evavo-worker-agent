import type { Env } from "../db";
import { getAdminToken, logEvent } from "../db";
import { readAutonomySettings } from "../engineAutonomy";
import { runOpportunityAutonomy } from "../opportunityAutonomy";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

function authorized(request: Request, env: Env): boolean {
  const token = getAdminToken(env);
  return Boolean(token && (request.headers.get("authorization") || "") === `Bearer ${token}`);
}

export async function handleOpportunityRunDueAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (request.method === "OPTIONS") return json({ ok: true });
  if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (pathname !== "/admin/opportunities/run-due") return json({ ok: false, error: "Not found" }, { status: 404 });
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405 });

  const body = await request.json().catch(() => ({}));
  if (body?.confirm !== true) {
    return json({
      ok: false,
      error: "confirm_required",
      requiredPayload: { confirm: true },
      safety: {
        callsAI: false,
        sendsEmail: false,
        postsExternally: false,
        savesReviewItemsOnly: true,
      },
    }, { status: 400 });
  }

  const settings = await readAutonomySettings(env);
  if (!settings.opportunityDiscoveryEnabled) {
    await logEvent(env, "opportunity_run_due_skip", "Manual opportunity run skipped because opportunity discovery is disabled.");
    return json({ ok: false, error: "opportunity_discovery_disabled", settings });
  }

  const summary = await runOpportunityAutonomy(env, settings);
  await logEvent(env, "opportunity_run_due_ok", `Manual opportunity run completed | sources ${summary.sourcesChecked} | saved ${summary.saved} | failed ${summary.failed}`);

  return json({
    ok: true,
    mode: "opportunity_run_due",
    settings: {
      mode: settings.mode,
      freeSafeOnly: settings.freeSafeOnly,
      opportunityDiscoveryEnabled: settings.opportunityDiscoveryEnabled,
      dailySourceLimit: settings.dailySourceLimit,
      maxNetworkCallsPerRun: settings.maxNetworkCallsPerRun,
      minOpportunityScore: settings.minOpportunityScore,
    },
    summary,
    safety: {
      callsAI: false,
      sendsEmail: false,
      postsExternally: false,
      autoApplies: false,
      savesReviewItemsOnly: true,
    },
  });
}
