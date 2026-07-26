import {
  GROWTH_OPERATING_POLICY_VERSION,
  createDefaultGrowthOperatingPolicy,
  effectiveGrowthActivityLevel,
  evaluateGrowthOperatingAction,
  parseGrowthOperatingPolicy,
  zeroGrowthActionEstimate,
  type GrowthActionEstimate,
  type GrowthUsageCounters,
} from "../src/core/growthOperatingPolicy";

function assert(condition: unknown, label: string): asserts condition {
  if (!condition) throw new Error(`ASSERTION_FAILED:${label}`);
}

function expectError(label: string, run: () => unknown, expected: string): void {
  let observed = "";
  try {
    run();
  } catch (error) {
    observed = error instanceof Error ? error.message : String(error);
  }
  assert(observed === expected, `${label}-${observed || "none"}`);
}

function usage(overrides: Partial<GrowthUsageCounters> = {}): GrowthUsageCounters {
  return {
    telemetryStatus: "current",
    runs: 0,
    workerInvocations: 0,
    externalFetches: 0,
    d1RowsRead: 0,
    d1RowsWritten: 0,
    queueOperations: 0,
    browserRenderingSeconds: 0,
    paidModelCalls: 0,
    paidApiCalls: 0,
    adSpendCents: 0,
    candidatesCreated: 0,
    outboundDraftsCreated: 0,
    externalActionsExecuted: 0,
    ...overrides,
  };
}

function estimate(overrides: Partial<GrowthActionEstimate> = {}): GrowthActionEstimate {
  return { ...zeroGrowthActionEstimate(), ...overrides };
}

function run(): void {
  const defaultPolicy = createDefaultGrowthOperatingPolicy();
  assert(defaultPolicy.contractVersion === GROWTH_OPERATING_POLICY_VERSION, "default-version");
  assert(defaultPolicy.activityLevel === "light", "default-light");
  assert(defaultPolicy.autonomyLevel === "draft", "default-draft");
  assert(defaultPolicy.costMode === "free_only", "default-free-only");
  assert(defaultPolicy.requireCurrentUsageTelemetry === true, "default-telemetry-required");
  assert(defaultPolicy.allowTrustedExternalActions === false, "default-trusted-disabled");
  assert(Object.isFrozen(defaultPolicy), "default-frozen");

  const internal = evaluateGrowthOperatingAction({
    policy: defaultPolicy,
    usage: usage(),
    action: {
      actionClass: "research.source_discovery",
      manualInvocation: false,
      explicitApproval: false,
      trustedScope: false,
      targetAllowlisted: false,
      platformPolicyConfirmed: false,
      estimate: estimate({ workerInvocations: 1, d1RowsRead: 100 }),
    },
  });
  assert(internal.outcome === "allow", "internal-allowed");
  assert(internal.reason === "allowed_internal", "internal-reason");

  const draft = evaluateGrowthOperatingAction({
    policy: defaultPolicy,
    usage: usage(),
    action: {
      actionClass: "communication.draft_email",
      manualInvocation: false,
      explicitApproval: false,
      trustedScope: false,
      targetAllowlisted: false,
      platformPolicyConfirmed: false,
      estimate: estimate({ workerInvocations: 1, outboundDraftsCreated: 1 }),
    },
  });
  assert(draft.outcome === "allow" && draft.reason === "allowed_draft", "draft-allowed");

  const sendNeedsApproval = evaluateGrowthOperatingAction({
    policy: defaultPolicy,
    usage: usage(),
    action: {
      actionClass: "communication.send_email",
      manualInvocation: false,
      explicitApproval: false,
      trustedScope: false,
      targetAllowlisted: true,
      platformPolicyConfirmed: true,
      estimate: estimate({ workerInvocations: 1, externalActionsExecuted: 1 }),
    },
  });
  assert(sendNeedsApproval.outcome === "approval_required", "draft-send-approval");
  assert(sendNeedsApproval.reason === "autonomy_draft_only", "draft-send-reason");

  const approvedPolicy = createDefaultGrowthOperatingPolicy({
    activityLevel: "balanced",
    autonomyLevel: "approval",
  });
  const approvedSend = evaluateGrowthOperatingAction({
    policy: approvedPolicy,
    usage: usage(),
    action: {
      actionClass: "communication.send_email",
      manualInvocation: false,
      explicitApproval: true,
      trustedScope: false,
      targetAllowlisted: true,
      platformPolicyConfirmed: true,
      estimate: estimate({ workerInvocations: 1, externalActionsExecuted: 1 }),
    },
  });
  assert(approvedSend.outcome === "allow", "approved-send");
  assert(approvedSend.reason === "allowed_explicit_approval", "approved-send-reason");

  const meetingWithoutApproval = evaluateGrowthOperatingAction({
    policy: createDefaultGrowthOperatingPolicy({ autonomyLevel: "trusted", allowTrustedExternalActions: true }),
    usage: usage(),
    action: {
      actionClass: "calendar.create_meeting",
      manualInvocation: false,
      explicitApproval: false,
      trustedScope: true,
      targetAllowlisted: true,
      platformPolicyConfirmed: true,
      estimate: estimate({ workerInvocations: 1, externalActionsExecuted: 1 }),
    },
  });
  assert(meetingWithoutApproval.outcome === "approval_required", "meeting-always-approval");
  assert(meetingWithoutApproval.reason === "meeting_requires_explicit_approval", "meeting-reason");

  const trustedSend = evaluateGrowthOperatingAction({
    policy: createDefaultGrowthOperatingPolicy({ autonomyLevel: "trusted", allowTrustedExternalActions: true }),
    usage: usage(),
    action: {
      actionClass: "communication.send_email",
      manualInvocation: false,
      explicitApproval: false,
      trustedScope: true,
      targetAllowlisted: true,
      platformPolicyConfirmed: true,
      estimate: estimate({ workerInvocations: 1, externalActionsExecuted: 1 }),
    },
  });
  assert(trustedSend.outcome === "allow", "trusted-send");
  assert(trustedSend.reason === "allowed_trusted_scope", "trusted-send-reason");

  const paidModel = evaluateGrowthOperatingAction({
    policy: approvedPolicy,
    usage: usage(),
    action: {
      actionClass: "analysis.generate_report",
      manualInvocation: false,
      explicitApproval: false,
      trustedScope: false,
      targetAllowlisted: false,
      platformPolicyConfirmed: false,
      estimate: estimate({ paidModelCalls: 1 }),
    },
  });
  assert(paidModel.outcome === "deny", "paid-model-denied");
  assert(paidModel.reason === "free_only_paid_capability_blocked", "paid-model-reason");

  const adSpend = evaluateGrowthOperatingAction({
    policy: approvedPolicy,
    usage: usage(),
    action: {
      actionClass: "advertising.spend",
      manualInvocation: false,
      explicitApproval: true,
      trustedScope: true,
      targetAllowlisted: true,
      platformPolicyConfirmed: true,
      estimate: estimate(),
    },
  });
  assert(adSpend.outcome === "deny" && adSpend.reason === "advertising_spend_blocked", "ad-spend-denied");

  const missingTelemetry = evaluateGrowthOperatingAction({
    policy: approvedPolicy,
    usage: usage({ telemetryStatus: "missing" }),
    action: {
      actionClass: "research.source_discovery",
      manualInvocation: false,
      explicitApproval: false,
      trustedScope: false,
      targetAllowlisted: false,
      platformPolicyConfirmed: false,
      estimate: estimate(),
    },
  });
  assert(missingTelemetry.outcome === "deny", "missing-telemetry-denied");
  assert(missingTelemetry.reason === "usage_telemetry_required", "missing-telemetry-reason");

  const overBudget = evaluateGrowthOperatingAction({
    policy: createDefaultGrowthOperatingPolicy({ activityLevel: "light" }),
    usage: usage({ externalFetches: 48 }),
    action: {
      actionClass: "research.public_fetch",
      manualInvocation: false,
      explicitApproval: false,
      trustedScope: false,
      targetAllowlisted: false,
      platformPolicyConfirmed: false,
      estimate: estimate({ externalFetches: 1 }),
    },
  });
  assert(overBudget.outcome === "deny", "budget-denied");
  assert(overBudget.reason === "daily_budget_exhausted", "budget-reason");

  assert(
    effectiveGrowthActivityLevel(
      createDefaultGrowthOperatingPolicy({ activityLevel: "active" }),
      usage({ externalFetches: 200 }),
    ) === "balanced",
    "active-degrades-to-balanced",
  );
  assert(
    effectiveGrowthActivityLevel(
      createDefaultGrowthOperatingPolicy({ activityLevel: "balanced" }),
      usage({ externalFetches: 130 }),
    ) === "light",
    "balanced-degrades-to-light",
  );
  assert(
    effectiveGrowthActivityLevel(defaultPolicy, usage({ telemetryStatus: "stale" })) === "paused",
    "stale-pauses",
  );

  const labScheduled = evaluateGrowthOperatingAction({
    policy: createDefaultGrowthOperatingPolicy({ activityLevel: "lab" }),
    usage: usage(),
    action: {
      actionClass: "research.site_scan",
      manualInvocation: false,
      explicitApproval: false,
      trustedScope: false,
      targetAllowlisted: false,
      platformPolicyConfirmed: false,
      estimate: estimate({ externalFetches: 1 }),
    },
  });
  assert(labScheduled.outcome === "deny", "lab-scheduled-denied");
  assert(labScheduled.reason === "lab_requires_manual_invocation", "lab-scheduled-reason");

  expectError(
    "unknown-field",
    () => parseGrowthOperatingPolicy({ ...defaultPolicy, extra: true }),
    "GROWTH_OPERATING_POLICY_INVALID",
  );
  expectError(
    "paid-cost-mode",
    () => parseGrowthOperatingPolicy({ ...defaultPolicy, costMode: "paid" }),
    "GROWTH_OPERATING_COST_MODE_INVALID",
  );
  expectError(
    "timezone",
    () => parseGrowthOperatingPolicy({ ...defaultPolicy, timezone: "UTC" }),
    "GROWTH_OPERATING_POLICY_TIMEZONE_INVALID",
  );

  console.log("Growth operating policy contract passed.");
  console.log("- activity, autonomy and cost are separate finite controls");
  console.log("- missing usage telemetry, paid capability estimates and exhausted budgets fail closed");
  console.log("- internal research and drafts can run automatically while external actions remain approval or trusted-scope gated");
  console.log("- meetings always require explicit approval and advertising spend remains blocked");
  console.log("- activity degrades before hard exhaustion and lab mode remains manual-only");
}

run();
