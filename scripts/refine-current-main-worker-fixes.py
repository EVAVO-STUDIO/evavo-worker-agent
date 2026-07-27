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


def replace_in_section(
    path: str,
    start_marker: str,
    end_marker: str,
    old: str,
    new: str,
) -> None:
    text = read(path)
    start = text.find(start_marker)
    if start < 0:
        raise SystemExit(f"missing section start in {path}: {start_marker}")
    end = text.find(end_marker, start + len(start_marker))
    if end < 0:
        raise SystemExit(f"missing section end in {path}: {end_marker}")
    section = text[start:end]
    if new in section:
        return
    if old not in section:
        raise SystemExit(f"stale section replacement in {path}: {old}")
    section = section.replace(old, new, 1)
    write(path, text[:start] + section + text[end:])


# The pure activity-budget policy owns the fixed account-wide uncertainty flag.
# The capability registry derives the same posture from the versioned zero-cost
# envelope. Keep those assertions in their correct source sections.
replace_in_section(
    "scripts/check-growth-activity-budget.mjs",
    'requireTokens("Growth activity budget contract", budget, [',
    'requireOrder("Growth activity profile order", budget, [',
    '  "accountWideCloudUsageKnown: zeroCostEnvelope.accountWideUsageKnown",',
    '  "accountWideCloudUsageKnown: false",',
)
replace_in_section(
    "scripts/check-growth-activity-budget.mjs",
    'requireTokens("Growth capability activity budget exposure", capabilities, [',
    'forbidTokens("Growth capability activity budget exposure", capabilities, [',
    '  "accountWideCloudUsageKnown: false",',
    '  "accountWideCloudUsageKnown: zeroCostEnvelope.accountWideUsageKnown",',
)
replace_in_section(
    "tests/growthActivityBudgetSource.test.ts",
    '  includesEvery(budget, [',
    '  ], "budget");',
    '    "accountWideCloudUsageKnown: zeroCostEnvelope.accountWideUsageKnown",',
    '    "accountWideCloudUsageKnown: false",',
)
replace_in_section(
    "tests/growthActivityBudgetSource.test.ts",
    '  includesEvery(capabilities, [',
    '  ], "capabilities");',
    '    "accountWideCloudUsageKnown: false",',
    '    "accountWideCloudUsageKnown: zeroCostEnvelope.accountWideUsageKnown",',
)


# Route parity validates the production workflow directly. Its secondary
# workflow-meta-check assertion should inspect the meta-check's semantic output
# rather than require production YAML text to appear inside the checker source.
replace_in_section(
    "scripts/check-growth-route-parity.mjs",
    'requireTokens("Worker workflow parity", workflowParity, [',
    'const workflow = readRequired(".github/workflows/worker-contract.yml");',
    "  'permissions:\\n  contents: read',",
    '  "readOnlyWorkflowPermissions: true",',
)


# Repository confidentiality moved the safety inventory to v9 and replaced the
# earlier source-hardening disclaimer with a stronger independent-requirements
# statement. Keep the secret scanner aligned without treating visibility as a
# source-code mutation.
replace_once(
    "scripts/check-worker-source-secrets.mjs",
    '  \'contract: "safety-gate-completeness-v8-source-secrets"\',',
    '  \'contract: "safety-gate-completeness-v9-repository-confidentiality"\',',
)
replace_once(
    "scripts/check-worker-source-secrets.mjs",
    '  "Repository visibility is an administrative GitHub setting",',
    '  "GitHub repository visibility must be private; current public visibility is a release and governance blocker.",',
)
replace_once(
    "scripts/check-worker-source-secrets.mjs",
    '  "This source-hardening pass did not change that setting",',
    '  "Source-secret safety and private repository visibility are independent requirements; passing one does not prove the other.",',
)


# Historical compatibility already uses the more precise complete-filename
# migration rule and backticked schema filename. Align the checker with those
# authoritative documents instead of weakening either safety statement.
replace_once(
    "scripts/check-historical-data-compatibility.mjs",
    '  "Run migrations in filename order",',
    '  "Run migrations in complete filename order",',
)
replace_once(
    "scripts/check-historical-data-compatibility.mjs",
    '  "schema.sql is a legacy bootstrap reference only",',
    '  "`schema.sql` is a legacy bootstrap reference only",',
)


# Central authentication delegates review-mutation semantics to the current
# v3 source-candidate-atomicity gate, not the retired v1 contract identifier.
replace_once(
    "scripts/check-central-authentication-safety.mjs",
    '  \'contract: "review-mutation-boundary-safety-v1"\',',
    '  \'contract: "review-mutation-boundary-safety-v3-source-candidate-atomicity"\',',
)


# The credential contract must preserve the guarded TypeScript test loader,
# which is stricter and more representative than the retired raw node --test
# command that could not resolve this repository's extensionless TS imports.
replace_once(
    "scripts/check-worker-credential-contract.mjs",
    '''if (packageJson.scripts?.["test:core"] !== "node --test") {
  errors.push("package.json must retain deterministic Node core tests");
}
''',
    '''const coreTestCommand = String(packageJson.scripts?.["test:core"] || "");
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
''',
)
