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


# The helper meta-guard must validate the guarded TypeScript runner rather than
# requiring the obsolete raw `node --test` command.
helper_path = "scripts/check-helper-scripts.mjs"
helper = read(helper_path)
helper = helper.replace('  "test:core": "node --test",\n', "", 1)
old_helper_anchor = '''const localGate = String(scripts["check:local"] || "");
for (const name of Object.keys(expectedScripts)) {
'''
new_helper_anchor = '''const coreTestCommand = String(scripts["test:core"] || "");
for (const token of [
  "--experimental-strip-types",
  "--experimental-transform-types",
  "--experimental-loader ./scripts/typescript-test-loader.mjs",
  "--test",
]) {
  if (!coreTestCommand.includes(token)) {
    errors.push(`package.json test:core must retain guarded TypeScript test token: ${token}`);
  }
}
if (scripts["test:typescript-loader:check"] !== "node scripts/check-typescript-test-loader.mjs") {
  errors.push("package.json must expose test:typescript-loader:check through the focused loader guard");
}
const localGate = String(scripts["check:local"] || "");
if (!localGate.includes("npm run test:typescript-loader:check")) {
  errors.push("check:local must run the TypeScript loader guard before test:core");
}
if (localGate.indexOf("npm run test:typescript-loader:check") > localGate.indexOf("npm run test:core")) {
  errors.push("check:local must guard TypeScript test resolution before test:core");
}
for (const name of Object.keys(expectedScripts)) {
'''
if new_helper_anchor not in helper:
    if old_helper_anchor not in helper:
        raise SystemExit("helper-script guarded test anchor is stale")
    helper = helper.replace(old_helper_anchor, new_helper_anchor, 1)
write(helper_path, helper)


# High activity may lower the profile floor, but a stricter legacy score remains
# a conservative secondary cap and must never be weakened by the profile.
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


# The persistent ledger is now integrated into every confirmed manual source
# fetch, while migration application remains a separate deployment fact.
budget_source_path = "tests/growthActivityBudgetSource.test.ts"
budget_source = read(budget_source_path)
budget_source = budget_source.replace(
    '    "manualResearchAdmissionIntegrated: false",',
    '    "manualResearchAdmissionIntegrated: true",',
    1,
)
budget_source = budget_source.replace(
    '  assert.equal(capabilities.includes("manualResearchAdmissionIntegrated: true"), false);',
    '  assert.equal(capabilities.includes("manualResearchAdmissionIntegrated: true"), true);',
    1,
)
budget_source = budget_source.replace(
    '  assert.equal(capabilities.includes("manualResearchAdmissionIntegrated: false"), false);',
    '  assert.equal(capabilities.includes("manualResearchAdmissionIntegrated: false"), false);',
    1,
)
budget_source = budget_source.replace(
    '    "the protected capability registry exposes profile, ledger-contract and hard-limit posture without claiming migration application or network admission integration",',
    '    "the protected capability registry exposes integrated manual admission and source selection without claiming migration application or scheduled research",',
    1,
)
budget_source = budget_source.replace(
    '    "the ledger contract is implemented, while D1 application and manual research integration remain separately truthful milestones",',
    '    "confirmed manual research uses the persistent budget ledger plus adaptive evidence-yield selection and a bounded exploration allowance",',
    1,
)
budget_source = budget_source.replace(
    '    "manual research integration not yet claimed",',
    '    "confirmed manual opportunity research now passes through the persistent ledger before every public fetch",',
    1,
)
budget_source = budget_source.replace(
    '    "one trigger-protected D1 insert is the final concurrency authority",',
    '    "one trigger-protected D1 insert is the final concurrency authority",',
    1,
)
write(budget_source_path, budget_source)


# Source-order inspection must select the completion call inside the handler,
# not the earlier helper declaration.
replace_once(
    "tests/growthInternalOperatorPackRouteSource.test.ts",
    '    "completeClaimSafely(",',
    '    "const completed = await completeClaimSafely(",',
)
operator_source_test = read("tests/growthInternalOperatorPackRouteSource.test.ts")
old_registry_assert = '  assert(registry.includes("internalOperatorPackAdmissionIntegrated: true"));\n'
new_registry_assert = '''  assert(registry.includes("internalOperatorPackAdmissionIntegrated: true"));
  assert(registry.includes("Owner-authenticated, exact-confirmation-gated POST route only."));
  assert(!registry.includes("Owner-authenticated GET route only."));
'''
if new_registry_assert not in operator_source_test:
    if old_registry_assert not in operator_source_test:
        raise SystemExit("operator-pack registry assertion anchor is stale")
    operator_source_test = operator_source_test.replace(old_registry_assert, new_registry_assert, 1)
write("tests/growthInternalOperatorPackRouteSource.test.ts", operator_source_test)
replace_once(
    "src/core/growthCapabilities.ts",
    'notes: ["Owner-authenticated GET route only.", "Generation requires persistent Growth activity-budget admission.",',
    'notes: ["Owner-authenticated, exact-confirmation-gated POST route only.", "Generation requires persistent Growth activity-budget admission.",',
)


# Route parity source tests follow the current source-secret-aware workflow
# contract rather than the superseded v7 identifier.
replace_once(
    "tests/growthRouteParitySource.test.ts",
    '  \'contract: "worker-contract-workflow-v7-growth-route-parity"\',',
    '  \'contract: "worker-contract-workflow-v8-source-secrets"\',',
)


# `minimumResearchCooldownMinutes` and `minimumOpportunityScore` are safety
# floors. Higher values are safer and must be compared in the opposite
# direction from daily/request maxima.
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
        raise SystemExit("zero-cost minimum-limit guard anchor is stale")
    zero_guard = zero_guard.replace(old_zero_anchor, new_zero_anchor, 1)
write(zero_guard_path, zero_guard)


# Make the shared source lease explicit in operator documentation.
replace_once(
    "docs/manual-research-concurrency.md",
    "Opportunity source test, preview, commit-preview and source-health routes share:",
    "Opportunity source test, preview, commit-preview and source-health routes share a key:",
)
