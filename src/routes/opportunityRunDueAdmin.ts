import type { Env } from "../db";
import { logEvent } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { acquireManualResearchLease, manualResearchLeaseConflict, releaseManualResearchLease } from "../core/manualResearchLease";
import { readAutonomySettings } from "../engineAutonomy";
import { runOpportunityAutonomy } from "../opportunityAutonomy";

type JsonResponse = (data: any, init?: ResponseInit) => Response;

const MANUAL_OPPORTUNITY_RUN_LEASE = "opportunity-run-due";

export async function handleOpportunityRunDueAdmin(request: Request, env: Env, pathname: string, json: JsonResponse): Promise<Response> {
  if (!(await isAdminRequestAuthorized(request, env))) return json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (request.method === "OPTIONS") {
    return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });
  }
  if (pathname !== "/admin/opportunities/run-due") return json({ ok: false, error: "Not found" }, { status: 404 });
  if (request.method !== "POST") return json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: { allow: "POST" } });

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

  const lease = await acquireManualResearchLease(env, MANUAL_OPPORTUNITY_RUN_LEASE, 900);
  if (!lease) {
    await logEvent(env, "opportunity_run_due_conflict", "Confirmed manual opportunity run rejected because the same research action is already in progress.");
    return json(manualResearchLeaseConflict(MANUAL_OPPORTUNITY_RUN_LEASE), { status: 409 });
  }

  try {
    const settings = await readAutonomySettings(env);
    if (!settings.opportunityDiscoveryEnabled) {
      await logEvent(env, "opportunity_run_due_skip", "Manual opportunity run skipped because opportunity discovery is disabled.");
      return json({ ok: false, error: "opportunity_discovery_disabled", settings });
    }

    const summary = await runOpportunityAutonomy(env, settings);
    await logEvent(env, "opportunity_run_due_ok", `Manual opportunity run finished with ${summary.runStatus} | sources ${summary.sourcesChecked} | successful ${summary.successfulSources} | saved ${summary.saved} | failed ${summary.failed}`);

    return json({
      ok: summary.runStatus !== "failed",
      mode: "opportunity_run_due",
      leaseContract: lease.contract,
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
        concurrentDuplicateRunAllowed: false,
        automaticRetryAllowed: false,
      },
    });
  } finally {
    await releaseManualResearchLease(env, lease).catch(() => false);
  }
}
