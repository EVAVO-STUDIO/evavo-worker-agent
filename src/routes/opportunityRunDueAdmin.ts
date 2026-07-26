import type { Env } from "../db";
import { logEvent } from "../db";
import { isAdminRequestAuthorized } from "../core/adminAuthentication";
import { boundedJsonFailurePayload, isExplicitJsonConfirmation, readBoundedJsonObject } from "../core/boundedJsonRequest";
import { GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION } from "../core/growthActivityBudgetLedger";
import { resolveGrowthActivitySettings } from "../core/growthActivityBudgetSettings";
import { acquireManualResearchLease, manualResearchLeaseConflict, releaseManualResearchLease } from "../core/manualResearchLease";
import { OPPORTUNITY_SOURCE_SELECTION_VERSION } from "../core/opportunitySourceSelection";
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

  const parsed = await readBoundedJsonObject(request);
  if (!parsed.ok) return json(boundedJsonFailurePayload(parsed), { status: parsed.status });
  if (!isExplicitJsonConfirmation(parsed.value)) {
    return json({
      ok: false,
      error: "confirm_required",
      requiredPayload: { confirm: true },
      confirmationCoercionAllowed: false,
      requestBodyContract: parsed.contract,
      safety: {
        callsAI: false,
        sendsEmail: false,
        postsExternally: false,
        savesReviewItemsOnly: true,
        persistentBudgetAdmissionRequired: true,
        automaticRetryAllowed: false,
      },
    }, { status: 400 });
  }

  const requestReceipt = {
    contract: parsed.contract,
    bytes: parsed.bytes,
    bodySha256: parsed.bodySha256,
  };

  const lease = await acquireManualResearchLease(env, MANUAL_OPPORTUNITY_RUN_LEASE, 900);
  if (!lease) {
    await logEvent(env, "opportunity_run_due_conflict", "Confirmed manual opportunity run rejected because the same research action is already in progress.");
    return json({ ...manualResearchLeaseConflict(MANUAL_OPPORTUNITY_RUN_LEASE), requestReceipt }, { status: 409 });
  }

  try {
    const settings = await readAutonomySettings(env);
    const activity = resolveGrowthActivitySettings(settings);
    if (!activity.manualResearchConfigured) {
      await logEvent(env, "opportunity_run_due_skip", "Manual opportunity run skipped because the engine, opportunity discovery or selected Growth activity profile is disabled.");
      return json({
        ok: false,
        error: "manual_research_not_configured",
        requestReceipt,
        settings: {
          mode: settings.mode,
          engineEnabled: settings.engineEnabled,
          freeSafeOnly: settings.freeSafeOnly,
          opportunityDiscoveryEnabled: settings.opportunityDiscoveryEnabled,
        },
        activity: {
          contractVersion: activity.contractVersion,
          sourceSelectionContractVersion: OPPORTUNITY_SOURCE_SELECTION_VERSION,
          intensity: activity.intensity,
          selectedBy: activity.selectedBy,
          manualResearchConfigured: activity.manualResearchConfigured,
          effectiveSourceLimitPerRun: activity.effectiveSourceLimitPerRun,
          effectiveMinimumOpportunityScore: activity.effectiveMinimumOpportunityScore,
          persistentBudgetAdmissionRequired: true,
        },
        safety: {
          callsAI: false,
          sendsEmail: false,
          postsExternally: false,
          savesReviewItemsOnly: true,
          persistentBudgetAdmissionRequired: true,
          automaticRetryAllowed: false,
        },
      });
    }

    const summary = await runOpportunityAutonomy(env, settings, {
      requestBodySha256: parsed.bodySha256,
      ownerApproved: true,
      explicitlyConfirmed: true,
    });
    const sourceSelection = "sourceSelection" in summary && summary.sourceSelection
      ? summary.sourceSelection
      : {
          considered: 0,
          selected: 0,
          explorationSelected: 0,
          exploitationSelected: 0,
        };
    await logEvent(
      env,
      "opportunity_run_due_ok",
      `Manual opportunity run finished with ${summary.runStatus} | activity ${summary.budget.intensity} | source-pool ${sourceSelection.considered} | explored ${sourceSelection.explorationSelected} | exploited ${sourceSelection.exploitationSelected} | checked ${summary.sourcesChecked} | admitted ${summary.budget.admittedSourceClaims} | budget-denied ${summary.budget.policyDeniedSourceClaims + summary.budget.raceDeniedSourceClaims} | successful ${summary.successfulSources} | saved ${summary.saved} | failed ${summary.failed}`,
    );

    return json({
      ok: summary.runStatus !== "failed",
      mode: "opportunity_run_due",
      leaseContract: lease.contract,
      requestReceipt,
      settings: {
        mode: settings.mode,
        engineEnabled: settings.engineEnabled,
        freeSafeOnly: settings.freeSafeOnly,
        opportunityDiscoveryEnabled: settings.opportunityDiscoveryEnabled,
        dailySourceLimit: settings.dailySourceLimit,
        maxNetworkCallsPerRun: settings.maxNetworkCallsPerRun,
        minOpportunityScore: settings.minOpportunityScore,
      },
      activity: {
        contractVersion: activity.contractVersion,
        ledgerContractVersion: GROWTH_ACTIVITY_BUDGET_LEDGER_VERSION,
        sourceSelectionContractVersion: OPPORTUNITY_SOURCE_SELECTION_VERSION,
        intensity: activity.intensity,
        selectedBy: activity.selectedBy,
        legacyControlsAreSecondaryCaps: activity.legacyControlsAreSecondaryCaps,
        effectiveSourceLimitPerRun: activity.effectiveSourceLimitPerRun,
        effectiveMinimumOpportunityScore: activity.effectiveMinimumOpportunityScore,
        persistentBudgetAdmissionRequired: true,
        adaptiveSourceSelectionEnabled: true,
        migrationRequired: "0023_growth_activity_budget_ledger.sql",
      },
      summary,
      safety: {
        callsAI: false,
        sendsEmail: false,
        postsExternally: false,
        autoApplies: false,
        savesReviewItemsOnly: true,
        concurrentDuplicateRunAllowed: false,
        persistentBudgetAdmissionRequired: true,
        accountWideCloudUsageKnown: false,
        automaticRetryAllowed: false,
      },
    });
  } finally {
    await releaseManualResearchLease(env, lease).catch(() => false);
  }
}
