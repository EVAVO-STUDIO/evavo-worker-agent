from pathlib import Path
import sys


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
PATH = ROOT / "scripts/check-autonomy-capability-truthfulness.mjs"
source = PATH.read_text(encoding="utf-8")


def replace_once(old: str, new: str) -> None:
    global source
    if old not in source:
        if new in source:
            return
        raise SystemExit(f"autonomy guard anchor is stale: {old}")
    source = source.replace(old, new, 1)


replace_once(
    '''for (const forbidden of [
  "request.json()",
  "request.clone().json()",
  "function confirmed(",
  "body?.confirm === 1",
  'body?.confirm === "1"',
  "setSetting(",
  "logEvent(",
  "canRunScheduledEngine: settings.engineEnabled",
''',
    '''for (const forbidden of [
  "request.json()",
  "request.clone().json()",
  "function confirmed(",
  "body?.confirm === 1",
  'body?.confirm === "1"',
  "canRunScheduledEngine: settings.engineEnabled",
''',
)
anchor = '''for (const token of [
  'from "../core/boundedJsonRequest"',
'''
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

for (const token of [
  'from "../core/boundedJsonRequest"',
'''
if engine_contract not in source:
    if anchor not in source:
        raise SystemExit("autonomy guard engine contract anchor is stale")
    source = source.replace(anchor, engine_contract, 1)

PATH.write_text(source, encoding="utf-8")
