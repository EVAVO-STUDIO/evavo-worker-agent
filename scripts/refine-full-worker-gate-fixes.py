from pathlib import Path
import sys


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, text: str) -> None:
    (ROOT / path).write_text(text, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    if old not in text:
        if new in text:
            return
        raise SystemExit(f"stale replacement in {path}: {old}")
    write(path, text.replace(old, new, 1))


# Capability reporting derives the unknown account-wide posture from the
# versioned zero-cost envelope instead of duplicating a static literal.
activity_guard_path = "scripts/check-growth-activity-budget.mjs"
activity_guard = read(activity_guard_path)
old_activity_block = '''  "manualResearchAdmissionIntegrated: true",
  "adaptiveSourceSelectionIntegrated: true",
  "adaptiveSourceSelectionEnabled: true",
  "accountWideCloudUsageKnown: false",
'''
new_activity_block = '''  "manualResearchAdmissionIntegrated: true",
  "adaptiveSourceSelectionIntegrated: true",
  "adaptiveSourceSelectionEnabled: true",
  "accountWideCloudUsageKnown: zeroCostEnvelope.accountWideUsageKnown",
'''
if new_activity_block not in activity_guard:
    if old_activity_block not in activity_guard:
        raise SystemExit("activity budget capability posture is stale")
    activity_guard = activity_guard.replace(old_activity_block, new_activity_block, 1)
write(activity_guard_path, activity_guard)

activity_source_path = "tests/growthActivityBudgetSource.test.ts"
activity_source = read(activity_source_path)
old_activity_source = '''    "manualResearchAdmissionIntegrated: true",
    "accountWideCloudUsageKnown: false",
'''
new_activity_source = '''    "manualResearchAdmissionIntegrated: true",
    "accountWideCloudUsageKnown: zeroCostEnvelope.accountWideUsageKnown",
'''
if new_activity_source not in activity_source:
    if old_activity_source not in activity_source:
        raise SystemExit("activity budget source capability posture is stale")
    activity_source = activity_source.replace(old_activity_source, new_activity_source, 1)
write(activity_source_path, activity_source)


# The safety-gate inventory must validate the guarded TypeScript test command,
# not require the superseded raw `node --test` command.
safety_path = "scripts/check-safety-gate-completeness.mjs"
safety = read(safety_path)
safety = safety.replace('  "test:core": "node --test",\n', "", 1)
anchor = '''for (const [scriptName, expectedCommand] of Object.entries(requiredSafetyCommands)) {
  if (scripts[scriptName] !== expectedCommand) errors.push(`package.json must expose ${scriptName} as ${expectedCommand}`);
  if (!checkLocal.includes(`npm run ${scriptName}`)) errors.push(`check:local must include ${scriptName}`);
}
'''
replacement = '''for (const [scriptName, expectedCommand] of Object.entries(requiredSafetyCommands)) {
  if (scripts[scriptName] !== expectedCommand) errors.push(`package.json must expose ${scriptName} as ${expectedCommand}`);
  if (!checkLocal.includes(`npm run ${scriptName}`)) errors.push(`check:local must include ${scriptName}`);
}
const coreTestCommand = String(scripts["test:core"] || "");
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
if (!checkLocal.includes("npm run test:typescript-loader:check")) {
  errors.push("check:local must execute test:typescript-loader:check");
}
if (checkLocal.indexOf("npm run test:typescript-loader:check") > checkLocal.indexOf("npm run test:core")) {
  errors.push("check:local must guard TypeScript test resolution before test:core");
}
'''
if replacement not in safety:
    if anchor not in safety:
        raise SystemExit("safety gate test-command anchor is stale")
    safety = safety.replace(anchor, replacement, 1)
write(safety_path, safety)


# Route parity validates the semantic output of the workflow meta-check and the
# actual production workflow separately. A validation-only workflow may use a
# writable token without weakening the production contract.
parity_path = "scripts/check-growth-route-parity.mjs"
parity = read(parity_path)
replace_once(
    parity_path,
    '''requireTokens("Worker workflow parity", workflowParity, [
  'permissions:\n  contents: read',
  'node-version: "24"',
''',
    '''requireTokens("Worker workflow parity", workflowParity, [
  "readOnlyWorkflowPermissions: true",
  'node-version: "24"',
''',
)
parity = read(parity_path)
old_workflow_tokens = '''requireTokens("Worker contract workflow", workflow, [
  "Verify Growth route parity",
'''
new_workflow_tokens = '''requireTokens("Worker contract workflow", workflow, [
  "permissions:\n  contents: read",
  "Verify Growth route parity",
'''
if new_workflow_tokens not in parity:
    if old_workflow_tokens not in parity:
        raise SystemExit("route parity production workflow anchor is stale")
    parity = parity.replace(old_workflow_tokens, new_workflow_tokens, 1)
write(parity_path, parity)
