#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const readmePath = path.join(root, "README.md");
const architecturePath = path.join(root, "docs", "growth-autonomous-discovery-architecture.md");
const runbookPath = path.join(root, "docs", "growth-zero-source-research-runbook.md");
const policyPath = path.join(root, "docs", "growth-source-discovery-safety-policy.md");
const autonomyAgentPath = path.join(root, "docs", "growth-autonomy-agent.md");
const channelPolicyPath = path.join(root, "docs", "growth-channel-policy.md");
const actionModelPath = path.join(root, "docs", "growth-engagement-action-model.md");
const packagePath = path.join(root, "package.json");
const errors = [];

const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";
const architecture = fs.existsSync(architecturePath) ? fs.readFileSync(architecturePath, "utf8") : "";
const runbook = fs.existsSync(runbookPath) ? fs.readFileSync(runbookPath, "utf8") : "";
const policy = fs.existsSync(policyPath) ? fs.readFileSync(policyPath, "utf8") : "";
const autonomyAgent = fs.existsSync(autonomyAgentPath) ? fs.readFileSync(autonomyAgentPath, "utf8") : "";
const channelPolicy = fs.existsSync(channelPolicyPath) ? fs.readFileSync(channelPolicyPath, "utf8") : "";
const actionModel = fs.existsSync(actionModelPath) ? fs.readFileSync(actionModelPath, "utf8") : "";
const packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};

if (!readme) errors.push("Missing README.md");
if (!architecture) errors.push("Missing Growth discovery architecture document");
if (!runbook) errors.push("Missing zero-source research runbook");
if (!policy) errors.push("Missing source discovery safety policy");
if (!autonomyAgent) errors.push("Missing Growth autonomy agent document");
if (!channelPolicy) errors.push("Missing Growth channel policy");
if (!actionModel) errors.push("Missing Growth engagement action model");

for (const token of [
  "# EVAVO Growth Research Worker",
  "It does **not** provide outbound execution.",
  "Scheduled work is internal-only",
  "Scheduled work cannot fetch public sources, expand source candidates, discover opportunities, generate drafts or perform external actions.",
  "Public-source research is manual-only, authenticated, explicitly confirmed, bounded and review-only.",
  "Allowed network activity is read-only public research through explicitly classified, authenticated, confirmation-gated and bounded manual source or opportunity handlers.",
  "run from the scheduled entrypoint",
  "an internal-only Worker schedule",
  "bounded manual public-research capacity",
  "Keep every scheduled external and outbound action disabled.",
]) {
  if (!readme.includes(token)) errors.push(`README operating posture is missing: ${token}`);
}

for (const token of [
  "This document records a future-state design vocabulary",
  "It is not an active-runtime contract",
  "The active Worker is manual-research-only.",
  "Scheduled processing is internal-only.",
  "Cron must not fetch public pages, discover opportunities, expand sources or enqueue network work.",
  "manual network research is authenticated and explicitly confirmed",
  "scheduled external research is disabled",
  "No autonomous fetch queue or scheduled research mode is enabled.",
  "Nothing in this document enables those steps.",
]) {
  if (!architecture.includes(token)) errors.push(`Growth discovery architecture posture is missing: ${token}`);
}

for (const token of [
  "The active Worker does not perform autonomous or scheduled network research.",
  "manual, authenticated, explicitly confirmed and bounded workflow",
  "saved as internal review metadata only",
  "Scheduled processing must not fetch pages, discover opportunities, expand sources or enqueue network work.",
  "There is no autonomous or scheduled fetch queue in the active Worker.",
  "shared authentication succeeded",
  "explicit confirmation is present",
  "no candidate was automatically promoted",
  "scheduled external research remained disabled",
]) {
  if (!runbook.includes(token)) errors.push(`Zero-source runbook posture is missing: ${token}`);
}

for (const token of [
  "This policy is authoritative for source discovery and public-source research in the active EVAVO Growth Research Worker.",
  "The active Worker is manual-research-only.",
  "Scheduled external research, autonomous discovery, background crawling, fetch queues, drafting, sending and third-party mutation are disabled.",
  "shared ADMIN_TOKEN authentication succeeded",
  "explicit confirmation is present",
  "route is classified as bounded manual research",
  "result is stored only as internal review metadata",
  "Cron must not fetch pages, expand sources, discover opportunities or enqueue work.",
  "The active Worker has no autonomous crawl queue, scheduled crawler or background retry loop.",
  "scheduled: false",
  "reviewOnly: true",
  "No candidate may be automatically promoted into an executable lead, campaign, draft or external action.",
]) {
  if (!policy.includes(token)) errors.push(`Source discovery safety policy posture is missing: ${token}`);
}

for (const token of [
  "This document preserves historical future-state design vocabulary.",
  "It is not an active-runtime contract, implementation authorisation or roadmap for enabling outbound execution.",
  "The active EVAVO Growth Research Worker is manual-research-only, review-first and non-executing.",
  "Scheduled processing is internal-only.",
  "These labels are retained only to explain historical records or future design discussions.",
  "They do not correspond to enabled runtime modes.",
  "manual_research_review_only",
  "Approval metadata does not enable an action",
  "No route, capability registry, stored setting or approval state may activate them.",
  "draftingEnabled: false",
  "browserExecutionEnabled: false",
  "externalDeliveryEnabled: false",
  "autonomousCampaignsEnabled: false",
  "scheduledExternalResearchEnabled: false",
]) {
  if (!autonomyAgent.includes(token)) errors.push(`Growth autonomy agent posture is missing: ${token}`);
}

for (const token of [
  "This document is the authoritative channel-classification policy for the active EVAVO Growth Research Worker.",
  "The active Worker is manual-research-only.",
  "Approval records, channel policies, stored settings and historical modes are internal metadata only.",
  "draftingEnabled: false",
  "emailSendingEnabled: false",
  "socialPostingEnabled: false",
  "formSubmissionEnabled: false",
  "browserExecutionEnabled: false",
  "externalStateChangeEnabled: false",
  "The active Worker has one execution classification:",
  "There is no `auto_allowed`, `owned_only`, `approved_autopilot`, `owned_channel_autopilot` or confirmation-to-execution mode in the active runtime.",
  "Explicit confirmation authorises only the specific bounded internal metadata write or manual public-source research action named by the route.",
]) {
  if (!channelPolicy.includes(token)) errors.push(`Growth channel policy posture is missing: ${token}`);
}

for (const token of [
  "This document defines the active internal action taxonomy for the EVAVO Growth Research Worker.",
  "The Worker does not draft, queue, approve for delivery or execute engagement actions.",
  "The following historical lifecycle states are non-executable compatibility data only:",
  "A stored historical status never enables execution.",
  "reviewOnly: true",
  "scheduled: false",
  "callsAI: false",
  "sendsEmail: false",
  "postsExternally: false",
  "submitsForms: false",
  "No route, approval object, stored setting, channel class or budget state may activate them.",
  "There is no execution stage in the active Worker.",
]) {
  if (!actionModel.includes(token)) errors.push(`Growth engagement action model posture is missing: ${token}`);
}

for (const forbidden of [
  "Scheduled work is limited to bounded research",
  "scheduled bounded research",
  "scheduled public-source research",
  "automated outbound execution",
  "email sending is enabled",
  "draft generation is enabled",
  "external state mutation is enabled",
]) {
  if (readme.toLowerCase().includes(forbidden.toLowerCase())) errors.push(`README contains stale or unsafe posture claim: ${forbidden}`);
}

for (const forbidden of [
  "Autonomous research, supervised action.",
  "The system may autonomously:",
  "The current build target is Levels 1 through 4 only.",
  "add crawl policy and queued fetch execution",
]) {
  if (architecture.includes(forbidden)) errors.push(`Growth discovery architecture contains stale current-capability claim: ${forbidden}`);
}

for (const forbidden of [
  "autonomous research / supervised action boundary",
  "Fetch work must be queued and bounded.",
  "queued_for_research",
  "Queue fetch work",
]) {
  if (runbook.includes(forbidden)) errors.push(`Zero-source runbook contains stale execution instruction: ${forbidden}`);
}

for (const forbidden of [
  "This policy governs autonomous source discovery",
  "The autonomous discovery system must not:",
  "Before queueing fetches for a domain",
  "Later queued fetch routes may use `callsNetwork: true`",
  "Autonomous decisions must be internal only.",
  "max queue depth per domain",
]) {
  if (policy.includes(forbidden)) errors.push(`Source discovery policy contains stale autonomous or queue instruction: ${forbidden}`);
}

for (const forbidden of [
  "The agent is an autonomous EVAVO growth employee:",
  "It can research, classify, draft, queue, and execute allowed actions",
  "### draft",
  "### approved_autopilot",
  "### owned_channel_autopilot",
  "5. Draft generation and scoring routes",
  "7. Controlled execution",
]) {
  if (autonomyAgent.includes(forbidden)) errors.push(`Growth autonomy agent document contains stale execution capability: ${forbidden}`);
}

for (const forbidden of [
  "Default mode: `owned_channel_autopilot`",
  "Default mode: `approved_autopilot`",
  "approved low-volume sends/submissions",
  "approval-gated posting when allowed",
  "Action can execute autonomously only if all gates pass",
  "Action must be approved before execution.",
  "Action can execute only on EVAVO-owned channels.",
  "scheduled EVAVO posts under configured cadence",
]) {
  if (channelPolicy.includes(forbidden)) errors.push(`Growth channel policy contains stale delivery capability: ${forbidden}`);
}

for (const forbidden of [
  "3. `drafted`",
  "4. `queued`",
  "5. `approved`",
  "6. `executed`",
  "Can become approved autopilot",
  "Can become owned-channel autopilot",
  "## Execution envelope",
  "Before execution, the Worker must verify:",
  "## Default execution order",
  "send permissioned/warm email",
  "submit contact form",
  "post community reply",
]) {
  if (actionModel.includes(forbidden)) errors.push(`Growth engagement action model contains stale execution capability: ${forbidden}`);
}

const expectedCommand = "node scripts/check-readme-operating-posture.mjs";
if (packageJson.scripts?.["docs:operating-posture:check"] !== expectedCommand) {
  errors.push(`package.json must expose docs:operating-posture:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run docs:operating-posture:check")) {
  errors.push("check:local must include docs:operating-posture:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "repository-operating-posture",
  readmePostureEnforced: true,
  discoveryArchitectureMarkedFutureState: true,
  zeroSourceRunbookManualOnly: true,
  sourceDiscoveryPolicyManualOnly: true,
  autonomyAgentMarkedHistoricalFutureState: true,
  channelPolicyReviewOnly: true,
  engagementActionModelReviewOnly: true,
  autonomousFetchQueueDocumentedAsDisabled: true,
  scheduledExternalResearchDocumentedAsDisabled: true,
  manualResearchAuthenticationDocumented: true,
  manualResearchConfirmationDocumented: true,
  manualResearchBoundedDocumented: true,
  manualResearchReviewOnlyDocumented: true,
  draftingDocumentedAsDisabled: true,
  outboundExecutionDocumentedAsDisabled: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
