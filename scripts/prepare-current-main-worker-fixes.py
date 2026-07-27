from pathlib import Path
import sys


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        if new in text:
            return
        raise SystemExit(f"stale replacement in {path}: {old}")
    write(path, text.replace(old, new, 1))


# The helper guard must look for the actual whitespace regex rather than
# interpreting \s as an invalid string escape and searching for /s/.
replace_once(
    "scripts/check-helper-scripts.mjs",
    '  "/\\s/.test(value)",',
    '  "/\\\\s/.test(value)",',
)


# Cooldown minutes and opportunity scores are safety floors. Higher values are
# more conservative and must not be evaluated as maximum ceilings.
replace_once(
    "src/core/growthZeroCostEnvelope.ts",
    '''function limitsWithinHardLimits(limits: GrowthActivityLimits): boolean {
  const keys = Object.keys(GROWTH_ACTIVITY_HARD_LIMITS) as Array<keyof GrowthActivityLimits>;
  return keys.every((key) => limits[key] <= GROWTH_ACTIVITY_HARD_LIMITS[key]);
}
''',
    '''const MINIMUM_HARD_LIMIT_KEYS = new Set<keyof GrowthActivityLimits>([
  "minimumResearchCooldownMinutes",
  "minimumOpportunityScore",
]);

function limitsWithinHardLimits(limits: GrowthActivityLimits): boolean {
  const keys = Object.keys(GROWTH_ACTIVITY_HARD_LIMITS) as Array<keyof GrowthActivityLimits>;
  return keys.every((key) => MINIMUM_HARD_LIMIT_KEYS.has(key)
    ? limits[key] >= GROWTH_ACTIVITY_HARD_LIMITS[key]
    : limits[key] <= GROWTH_ACTIVITY_HARD_LIMITS[key]);
}
''',
)
zero_guard_path = "scripts/check-growth-zero-cost-envelope.mjs"
zero_guard = read(zero_guard_path)
old_zero_anchor = '''  "reservationWithinFreeLimits",
  "profilesRemainNonExecuting",
'''
new_zero_anchor = '''  "reservationWithinFreeLimits",
  "profilesRemainNonExecuting",
  "MINIMUM_HARD_LIMIT_KEYS",
  '"minimumResearchCooldownMinutes"',
  '"minimumOpportunityScore"',
  "MINIMUM_HARD_LIMIT_KEYS.has(key)",
  "limits[key] >= GROWTH_ACTIVITY_HARD_LIMITS[key]",
  "limits[key] <= GROWTH_ACTIVITY_HARD_LIMITS[key]",
'''
if new_zero_anchor not in zero_guard:
    if old_zero_anchor not in zero_guard:
        raise SystemExit("zero-cost guard anchor is stale")
    zero_guard = zero_guard.replace(old_zero_anchor, new_zero_anchor, 1)
write(zero_guard_path, zero_guard)


# A stricter stored minimum score remains a conservative secondary cap. High
# activity may increase bounded throughput but must not lower that score.
replace_once(
    "tests/growthActivityBudgetSettings.test.ts",
    '''  for (const [settings, expectedLimit] of [
    [
      { ...BASE, mode: "assisted_discovery", dailySourceLimit: 16, maxNetworkCallsPerRun: 8, minOpportunityScore: 55 },
      8,
    ],
    [
      { ...BASE, mode: "assisted_discovery", dailySourceLimit: 15, maxNetworkCallsPerRun: 9, minOpportunityScore: 55 },
      9,
    ],
    [
      { ...BASE, mode: "assisted_discovery", dailySourceLimit: 15, maxNetworkCallsPerRun: 8, minOpportunityScore: 54 },
      8,
    ],
  ] as const) {
    const high = resolveGrowthActivitySettings(settings);
    assert.equal(high.intensity, "high");
    assert.equal(high.effectiveSourceLimitPerRun, expectedLimit);
    assert.equal(high.effectiveMinimumOpportunityScore, 45);
  }
''',
    '''  for (const [settings, expectedLimit, expectedMinimumScore] of [
    [
      { ...BASE, mode: "assisted_discovery", dailySourceLimit: 16, maxNetworkCallsPerRun: 8, minOpportunityScore: 55 },
      8,
      55,
    ],
    [
      { ...BASE, mode: "assisted_discovery", dailySourceLimit: 15, maxNetworkCallsPerRun: 9, minOpportunityScore: 55 },
      9,
      55,
    ],
    [
      { ...BASE, mode: "assisted_discovery", dailySourceLimit: 15, maxNetworkCallsPerRun: 8, minOpportunityScore: 54 },
      8,
      54,
    ],
  ] as const) {
    const high = resolveGrowthActivitySettings(settings);
    assert.equal(high.intensity, "high");
    assert.equal(high.effectiveSourceLimitPerRun, expectedLimit);
    assert.equal(high.effectiveMinimumOpportunityScore, expectedMinimumScore);
  }
''',
)


# The persistent ledger and adaptive selector are already integrated into every
# confirmed manual opportunity fetch. Keep migration application separate.
budget_source_path = "tests/growthActivityBudgetSource.test.ts"
budget_source = read(budget_source_path)
replacements = [
    ('    "manualResearchAdmissionIntegrated: false",', '    "manualResearchAdmissionIntegrated: true",'),
    ('    "accountWideCloudUsageKnown: false",', '    "accountWideCloudUsageKnown: zeroCostEnvelope.accountWideUsageKnown",'),
    ('  assert.equal(capabilities.includes("manualResearchAdmissionIntegrated: true"), false);', '  assert.equal(capabilities.includes("manualResearchAdmissionIntegrated: true"), true);'),
    ('    "the protected capability registry exposes profile, ledger-contract and hard-limit posture without claiming migration application or network admission integration",', '    "the protected capability registry exposes integrated manual admission and source selection without claiming migration application or scheduled research",'),
    ('    "the ledger contract is implemented, while D1 application and manual research integration remain separately truthful milestones",', '    "confirmed manual research uses the persistent budget ledger plus adaptive evidence-yield selection and a bounded exploration allowance",'),
    ('    "manual research integration not yet claimed",', '    "confirmed manual opportunity research now passes through the persistent ledger before every public fetch",'),
]
for old, new in replacements:
    if old in budget_source:
        budget_source = budget_source.replace(old, new, 1)
    elif new not in budget_source:
        raise SystemExit(f"activity source test anchor is stale: {old}")
write(budget_source_path, budget_source)

activity_guard_path = "scripts/check-growth-activity-budget.mjs"
activity_guard = read(activity_guard_path)
activity_guard = activity_guard.replace(
    '  "accountWideCloudUsageKnown: false",',
    '  "accountWideCloudUsageKnown: zeroCostEnvelope.accountWideUsageKnown",',
    1,
)
if '  "accountWideCloudUsageKnown: zeroCostEnvelope.accountWideUsageKnown",' not in activity_guard:
    raise SystemExit("activity budget dynamic usage posture is stale")
write(activity_guard_path, activity_guard)


# Operator-pack generation is a confirmed POST with persistent budget
# accounting. Source-order inspection must select the call inside the handler.
replace_once(
    "tests/growthInternalOperatorPackRouteSource.test.ts",
    '    "completeClaimSafely(",',
    '    "const completed = await completeClaimSafely(",',
)
operator_test_path = "tests/growthInternalOperatorPackRouteSource.test.ts"
operator_test = read(operator_test_path)
old_operator_assert = '  assert(registry.includes("internalOperatorPackAdmissionIntegrated: true"));\n'
new_operator_assert = '''  assert(registry.includes("internalOperatorPackAdmissionIntegrated: true"));
  assert(registry.includes("Owner-authenticated, exact-confirmation-gated POST route only."));
  assert(!registry.includes("Owner-authenticated GET route only."));
'''
if new_operator_assert not in operator_test:
    if old_operator_assert not in operator_test:
        raise SystemExit("operator-pack source assertion is stale")
    operator_test = operator_test.replace(old_operator_assert, new_operator_assert, 1)
write(operator_test_path, operator_test)
replace_once(
    "src/core/growthCapabilities.ts",
    'notes: ["Owner-authenticated GET route only.", "Generation requires persistent Growth activity-budget admission.",',
    'notes: ["Owner-authenticated, exact-confirmation-gated POST route only.", "Generation requires persistent Growth activity-budget admission.",',
)


# Route-parity source tests follow the current source-secret-aware production
# workflow contract.
replace_once(
    "tests/growthRouteParitySource.test.ts",
    '  \'contract: "worker-contract-workflow-v7-growth-route-parity"\',',
    '  \'contract: "worker-contract-workflow-v8-source-secrets"\',',
)


# Make the shared source lease explicit in operator documentation.
replace_once(
    "docs/manual-research-concurrency.md",
    "Opportunity source test, preview, commit-preview and source-health routes share:",
    "Opportunity source test, preview, commit-preview and source-health routes share a key:",
)


# Align the operating-posture guard with the reviewed manual-only documents.
posture_path = "scripts/check-readme-operating-posture.mjs"
posture = read(posture_path)
posture_replacements = [
    (
        '''  "Automatic retries and alternate executors are disabled.",
  "do not start research automatically",
''',
        '''  "Automatic retries and alternate executors are disabled.",
  "Zero-source startup is not an autonomous recovery mode, scheduled discovery mode, crawl queue or execution pipeline.",
  "These are review outcomes, not instructions for automatic continuation.",
''',
    ),
    (
        '''  "This document records a future-state design vocabulary",
  "It is not an active-runtime contract",
  "The active Worker is manual-research-only.",
  "Cron must not fetch public pages, discover opportunities, expand sources or enqueue network work.",
  "No autonomous fetch queue or scheduled research mode is enabled.",
''',
        '''  "This document describes the guarded research architecture for EVAVO Growth discovery.",
  "That phrase describes a target design, not the active runtime.",
  "The current Worker performs no autonomous or scheduled network research.",
  "A future automated research loop additionally requires account-wide free-quota metering",
  "No autonomous fetch queue or scheduled research mode is enabled.",
''',
    ),
    (
        '''  "There is no autonomous or scheduled fetch queue in the active Worker.",
  "no candidate was automatically promoted",
''',
        '''  "There is no autonomous or scheduled fetch queue consumer in the active Worker.",
  "Saving this row does not perform a request. It cannot schedule, retry or execute network work.",
  "Feedback does not approve external action and cannot promote a candidate into canonical Growth automatically.",
''',
    ),
    (
        '''  "This policy is authoritative for source discovery and public-source research in the active EVAVO Growth Research Worker.",
  "Scheduled external research, autonomous discovery, background crawling, fetch queues, drafting, sending and third-party mutation are disabled.",
''',
        '''  "This Growth source discovery safety policy is authoritative for source discovery and public-source research in the active EVAVO Growth Research Worker.",
  "Scheduled external research, autonomous discovery, background crawling, executable fetch queues, drafting, sending and third-party mutation are disabled.",
''',
    ),
    (
        '''forbidTokens("Discovery architecture", content.architecture, [
  "Autonomous research, supervised action.",
  "The system may autonomously:",
''',
        '''forbidTokens("Discovery architecture", content.architecture, [
  "The system may autonomously:",
''',
    ),
    (
        '''forbidTokens("Zero-source runbook", content.runbook, [
  "Fetch work must be queued and bounded.",
  "queued_for_research",
  "Queue fetch work",
]);
''',
        '''forbidTokens("Zero-source runbook", content.runbook, [
  "Fetch work must be queued and bounded.",
  "The active Worker consumes `growth_fetch_queue` as an execution queue.",
  "Scheduled processing executes queued network work.",
]);
''',
    ),
]
for old, new in posture_replacements:
    if old in posture:
        posture = posture.replace(old, new, 1)
    elif new not in posture:
        raise SystemExit("operating-posture guard anchor is stale")
write(posture_path, posture)


# Broad admin writes already use bounded JSON and exact confirmation. Validate
# that sequence and explicitly reject the removed raw JSON/coercion patterns.
broad_path = "scripts/check-broad-admin-write-safety.mjs"
broad = read(broad_path)
old_broad_tokens = '''  'pathname === "/admin/leads" && request.method === "POST"',
  "const body = await request.clone().json()",
  "if (!confirmed(body))",
  'error: "confirm_required"',
'''
new_broad_tokens = '''  "manualMetadataWriteRequiresConfirmation(pathname, request.method)",
  "readBoundedJsonObject(request.clone(), {",
  "boundedJsonFailurePayload(parsed)",
  "if (!isExplicitJsonConfirmation(parsed.value))",
  'error: "confirm_required"',
  "confirmationCoercionAllowed: false",
  "requestReceipt",
'''
if new_broad_tokens not in broad:
    if old_broad_tokens not in broad:
        raise SystemExit("broad admin token anchor is stale")
    broad = broad.replace(old_broad_tokens, new_broad_tokens, 1)
old_broad_order = '''const authPosition = wrapper.indexOf("await isAdminRequestAuthorized(request, env)");
const optionsPosition = wrapper.indexOf('request.method === "OPTIONS"');
const bodyPosition = wrapper.indexOf("const body = await request.clone().json()");
const confirmPosition = wrapper.indexOf("if (!confirmed(body))");
const delegatePosition = wrapper.indexOf("return handleAdminImplementation(request, env, pathname, ctx, json)");
if (!(authPosition >= 0 && optionsPosition > authPosition && bodyPosition > optionsPosition && confirmPosition > bodyPosition && delegatePosition > confirmPosition)) {
  errors.push("Broad admin wrapper must authenticate before OPTIONS and confirm manual record insertion before delegation");
}
'''
new_broad_order = '''const authPosition = wrapper.indexOf("await isAdminRequestAuthorized(request, env)");
const optionsPosition = wrapper.indexOf('request.method === "OPTIONS"');
const scopePosition = wrapper.indexOf("if (manualMetadataWriteRequiresConfirmation(pathname, request.method))");
const bodyPosition = wrapper.indexOf("readBoundedJsonObject(request.clone(), {");
const failurePosition = wrapper.indexOf("boundedJsonFailurePayload(parsed)");
const confirmPosition = wrapper.indexOf("if (!isExplicitJsonConfirmation(parsed.value))");
const delegatePosition = wrapper.indexOf("return handleAdminImplementation(request, env, pathname, ctx, json)");
if (!(
  authPosition >= 0 &&
  optionsPosition > authPosition &&
  scopePosition > optionsPosition &&
  bodyPosition > scopePosition &&
  failurePosition > bodyPosition &&
  confirmPosition > failurePosition &&
  delegatePosition > confirmPosition
)) {
  errors.push("Broad admin wrapper must authenticate before OPTIONS, bound manual record insertion, require exact confirmation, and delegate last");
}
for (const stale of [
  "request.clone().json()",
  "const body = await request.clone().json()",
  "if (!confirmed(body))",
  "body?.confirm === 1",
  'body?.confirm === "1"',
]) {
  if (wrapper.includes(stale)) errors.push(`Protected broad admin wrapper contains stale unsafe token: ${stale}`);
}
'''
if new_broad_order not in broad:
    if old_broad_order not in broad:
        raise SystemExit("broad admin order anchor is stale")
    broad = broad.replace(old_broad_order, new_broad_order, 1)
write(broad_path, broad)


# Scheduled autonomy uses setSetting only to force legacy execution flags off
# and logEvent only for internal audit/learning records. Validate those exact
# uses instead of banning the helpers by name.
autonomy_path = "scripts/check-autonomy-capability-truthfulness.mjs"
autonomy = read(autonomy_path)
autonomy = autonomy.replace('  "setSetting(",\n', "", 1)
autonomy = autonomy.replace('  "logEvent(",\n', "", 1)
engine_contract = '''for (const token of [
  'import { getSetting, logEvent, setSetting } from "./db"',
  'setSetting(env, "engine_enabled", "0")',
  'setSetting(env, "draft_cap_per_day", "0")',
  'setSetting(env, "send_cap_per_day", "0")',
  'setSetting(env, "drafting_enabled", "0")',
  'setSetting(env, "sending_enabled", "0")',
  "Scheduled autonomy is permanently review-first.",
  "cron execution never drafts, sends, discovers,",
  "it never fetches sources or runs discovery",
  'logEvent(env, "source_expansion_learning_tick_ok"',
  'logEvent(env, "source_expansion_learning_tick_skip"',
  'logEvent(env, "tick_skip"',
  '"tick_ok"',
]) {
  if (!engine.includes(token)) errors.push(`Scheduled autonomy defensive boundary is missing: ${token}`);
}
for (const forbidden of [
  'setSetting(env, "engine_enabled", "1")',
  'setSetting(env, "draft_cap_per_day", "1")',
  'setSetting(env, "send_cap_per_day", "1")',
  'setSetting(env, "drafting_enabled", "1")',
  'setSetting(env, "sending_enabled", "1")',
  "fetch(",
  "runOpportunityAutonomy(",
  "runSourceExpansion(",
  "runDraftOnce(",
  "runSendApproved(",
  "sendEmail(",
]) {
  if (engine.includes(forbidden)) errors.push(`Scheduled autonomy engine contains forbidden capability: ${forbidden}`);
}

'''
engine_anchor = '''for (const token of [
  'from "../core/boundedJsonRequest"',
'''
if engine_contract not in autonomy:
    if engine_anchor not in autonomy:
        raise SystemExit("autonomy guard engine anchor is stale")
    autonomy = autonomy.replace(engine_anchor, engine_contract + engine_anchor, 1)
write(autonomy_path, autonomy)
