from pathlib import Path
import sys


ROOT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd().resolve()
PATH = ROOT / "scripts/check-readme-operating-posture.mjs"
source = PATH.read_text(encoding="utf-8")


def replace_once(old: str, new: str) -> None:
    global source
    if old not in source:
        if new in source:
            return
        raise SystemExit(f"operating-posture guard anchor is stale: {old}")
    source = source.replace(old, new, 1)


replace_once(
    '''  "Automatic retries and alternate executors are disabled.",
  "do not start research automatically",
''',
    '''  "Automatic retries and alternate executors are disabled.",
  "Zero-source startup is not an autonomous recovery mode, scheduled discovery mode, crawl queue or execution pipeline.",
  "These are review outcomes, not instructions for automatic continuation.",
''',
)
replace_once(
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
)
replace_once(
    '''  "There is no autonomous or scheduled fetch queue in the active Worker.",
  "no candidate was automatically promoted",
''',
    '''  "There is no autonomous or scheduled fetch queue consumer in the active Worker.",
  "Saving this row does not perform a request. It cannot schedule, retry or execute network work.",
  "Feedback does not approve external action and cannot promote a candidate into canonical Growth automatically.",
''',
)
replace_once(
    '''  "This policy is authoritative for source discovery and public-source research in the active EVAVO Growth Research Worker.",
  "Scheduled external research, autonomous discovery, background crawling, fetch queues, drafting, sending and third-party mutation are disabled.",
''',
    '''  "This Growth source discovery safety policy is authoritative for source discovery and public-source research in the active EVAVO Growth Research Worker.",
  "Scheduled external research, autonomous discovery, background crawling, executable fetch queues, drafting, sending and third-party mutation are disabled.",
''',
)
replace_once(
    '''forbidTokens("Discovery architecture", content.architecture, [
  "Autonomous research, supervised action.",
  "The system may autonomously:",
''',
    '''forbidTokens("Discovery architecture", content.architecture, [
  "The system may autonomously:",
''',
)
replace_once(
    '''forbidTokens("Zero-source runbook", content.runbook, [
  "Fetch work must be queued and bounded.",
  "queued_for_research",
  "Queue fetch work",
]);
''',
    '''forbidTokens("Zero-source runbook", content.runbook, [
  "Fetch work must be queued and bounded.",
  "active queue consumer",
  "scheduled fetch queue consumer",
]);
''',
)

PATH.write_text(source, encoding="utf-8")
