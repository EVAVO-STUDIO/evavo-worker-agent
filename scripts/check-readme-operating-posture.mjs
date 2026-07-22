#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

const documents = {
  readme: "README.md",
  zeroSourceStartup: "docs/zero-source-startup.md",
  zeroSourceCatalogue: "docs/zero-source-route-catalogue.md",
  architecture: "docs/growth-autonomous-discovery-architecture.md",
  runbook: "docs/growth-zero-source-research-runbook.md",
  sourcePolicy: "docs/growth-source-discovery-safety-policy.md",
  autonomyAgent: "docs/growth-autonomy-agent.md",
  channelPolicy: "docs/growth-channel-policy.md",
  actionModel: "docs/growth-engagement-action-model.md",
  costGovernor: "docs/growth-cost-governor.md",
  campaignIntelligence: "docs/growth-campaign-intelligence.md",
  businessArchitecture: "docs/business-autopilot-architecture.md",
  businessGovernance: "docs/business-autopilot-governance-policy.md",
  businessCompliance: "docs/business-autopilot-compliance-policy.md",
};

const content = {};
for (const [key, relativePath] of Object.entries(documents)) {
  const absolutePath = path.join(root, relativePath);
  content[key] = fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, "utf8") : "";
  if (!content[key]) errors.push(`Missing operating document: ${relativePath}`);
}

const packagePath = path.join(root, "package.json");
const packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};
if (!fs.existsSync(packagePath)) errors.push("Missing package.json");

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} posture is missing: ${token}`);
  }
}

function forbidTokens(label, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) errors.push(`${label} contains stale execution capability: ${token}`);
  }
}

requireTokens("README", content.readme, [
  "# EVAVO Growth Research Worker",
  "It does **not** provide outbound execution.",
  "Scheduled work is internal-only",
  "Scheduled work cannot fetch public sources, expand source candidates, discover opportunities, generate drafts or perform external actions.",
  "Public-source research is manual-only, authenticated, explicitly confirmed, bounded and review-only.",
]);

requireTokens("Zero-source startup", content.zeroSourceStartup, [
  "The active EVAVO Growth Research Worker is manual-research-only.",
  "Scheduled external research is disabled.",
  "Cron must not fetch public pages, expand sources or discover opportunities.",
  "Every network-capable action requires an explicit confirmed POST request.",
  "Results are saved as internal review metadata only.",
  "Automatic retries and alternate executors are disabled.",
  "do not start research automatically",
]);

requireTokens("Zero-source route catalogue", content.zeroSourceCatalogue, [
  "Zero-source operation is manual-only.",
  "scheduledExecutionEnabled: false",
  "scheduledExternalResearchEnabled: false",
  "manualResearchRequiresAuthentication: true",
  "manualResearchRequiresConfirmation: true",
  "manualResearchIsBounded: true",
  "manualResearchSavesReviewItemsOnly: true",
  "Historical fields such as `engineEnabled`, source-expansion settings or old run statuses are compatibility data only.",
  "Disabled compatibility routes must fail closed.",
]);

requireTokens("Discovery architecture", content.architecture, [
  "This document records a future-state design vocabulary",
  "It is not an active-runtime contract",
  "The active Worker is manual-research-only.",
  "Cron must not fetch public pages, discover opportunities, expand sources or enqueue network work.",
  "No autonomous fetch queue or scheduled research mode is enabled.",
]);

requireTokens("Zero-source runbook", content.runbook, [
  "The active Worker does not perform autonomous or scheduled network research.",
  "manual, authenticated, explicitly confirmed and bounded workflow",
  "saved as internal review metadata only",
  "There is no autonomous or scheduled fetch queue in the active Worker.",
  "no candidate was automatically promoted",
]);

requireTokens("Source discovery policy", content.sourcePolicy, [
  "This policy is authoritative for source discovery and public-source research in the active EVAVO Growth Research Worker.",
  "Scheduled external research, autonomous discovery, background crawling, fetch queues, drafting, sending and third-party mutation are disabled.",
  "shared ADMIN_TOKEN authentication succeeded",
  "route is classified as bounded manual research",
  "result is stored only as internal review metadata",
  "No candidate may be automatically promoted into an executable lead, campaign, draft or external action.",
]);

requireTokens("Autonomy agent", content.autonomyAgent, [
  "This document preserves historical future-state design vocabulary.",
  "It is not an active-runtime contract, implementation authorisation or roadmap for enabling outbound execution.",
  "manual_research_review_only",
  "Approval metadata does not enable an action",
  "draftingEnabled: false",
  "externalDeliveryEnabled: false",
  "autonomousCampaignsEnabled: false",
]);

requireTokens("Channel policy", content.channelPolicy, [
  "This document is the authoritative channel-classification policy for the active EVAVO Growth Research Worker.",
  "Approval records, channel policies, stored settings and historical modes are internal metadata only.",
  "emailSendingEnabled: false",
  "socialPostingEnabled: false",
  "formSubmissionEnabled: false",
  "The active Worker has one execution classification:",
  "Explicit confirmation authorises only the specific bounded internal metadata write or manual public-source research action named by the route.",
]);

requireTokens("Engagement action model", content.actionModel, [
  "This document defines the active internal action taxonomy for the EVAVO Growth Research Worker.",
  "The Worker does not draft, queue, approve for delivery or execute engagement actions.",
  "The following historical lifecycle states are non-executable compatibility data only:",
  "No route, approval object, stored setting, channel class or budget state may activate them.",
  "There is no execution stage in the active Worker.",
]);

requireTokens("Cost governor", content.costGovernor, [
  "This document defines cost controls for the active EVAVO Growth Research Worker.",
  "A budget profile can restrict an allowed internal action. It cannot enable a disabled capability.",
  "The active posture is `manual_research_safe`.",
  "scheduled network fetches/day: 0",
  "AI calls/day: 0",
  "draft generations/day: 0",
  "public actions/day: 0",
  "contact actions/day: 0",
  "Automatic retries are disabled.",
  "Cron must not consume a network budget",
  "Their current-runtime limits are always zero.",
  "The active runtime does not earn execution capability through outcomes.",
]);

requireTokens("Campaign intelligence", content.campaignIntelligence, [
  "The implementation is **metadata only**.",
  "growth_operator_cycle_v3_strategy_blackboard_read_only",
  "growth_autonomous_runtime_v3_strategy_blackboard",
  "The second identifier is retained for compatibility with existing clients and stored records.",
  "Confirmation does not authorise drafting, delivery, network research or external mutation.",
  "All scores, readiness values, reasons and recommended commands are advisory metadata only.",
  "There is no later execution phase authorised by this document.",
]);

requireTokens("Business Autopilot architecture", content.businessArchitecture, [
  "This document defines the active internal architecture for EVAVO Business Autopilot.",
  "Evidence-backed internal decisions and review metadata only.",
  "Current runtime posture",
  "There is no active execution layer.",
  "Level 0: authenticated internal intelligence and review metadata",
  "No approval, policy, stored setting, budget profile or historical status may activate these capabilities.",
  "Historical labels such as draft-only, approval-required execution, capped campaign mode and broad external autonomy are not active levels.",
  "It must not produce deliverable drafts or execute external activity.",
]);

requireTokens("Business Autopilot governance", content.businessGovernance, [
  "This policy is authoritative for the active EVAVO Business Autopilot runtime.",
  "Research manually when explicitly confirmed. Store internal review metadata. Never execute externally.",
  "No approval record, historical status, budget profile, channel policy, operator preference or stored setting may activate a blocked action.",
  "There is no scheduled crawler, background queue, automatic retry executor or alternate fallback path.",
  "authoritativeForExecution: false",
  "externalUseAllowed: false",
  "The effective external-execution kill switch is permanently on.",
  "It does not draft deliverable content and does not execute external actions.",
]);

requireTokens("Business Autopilot compliance", content.businessCompliance, [
  "The active Worker is internal, authenticated, review-first and non-executing.",
  "Compliance metadata can block or classify internal work. It cannot enable a disabled capability.",
  "Email sending is disabled.",
  "Social publishing and commenting are disabled.",
  "Contact-form submission is disabled.",
  "Suppression records take priority over opportunity scores, recommendations, approvals and historical action statuses.",
  "authoritativeForExecution: false",
  "The active Worker must not append a new external execution attempt.",
  "Nothing in this policy is a checklist for enabling delivery.",
]);

forbidTokens("README", content.readme, [
  "Scheduled work is limited to bounded research",
  "scheduled public-source research",
  "email sending is enabled",
  "draft generation is enabled",
]);

forbidTokens("Zero-source startup", content.zeroSourceStartup, [
  "a scheduled or manual scan can recover",
  "Scheduled source-expansion ticks",
  "The goal is for the agent to keep moving intelligently from zero",
  "no email by default",
]);

forbidTokens("Zero-source route catalogue", content.zeroSourceCatalogue, [
  "engineEnabled: true",
  "sourceExpansionEnabled: true",
  "Run opportunity discovery only after source memory exists",
  "POST /admin/opportunities/run-due",
  "no email or outreach by default",
  "the actual write/network steps remain the existing confirm-gated bootstrap, scan",
]);

forbidTokens("Discovery architecture", content.architecture, [
  "Autonomous research, supervised action.",
  "The system may autonomously:",
  "The current build target is Levels 1 through 4 only.",
  "add crawl policy and queued fetch execution",
]);

forbidTokens("Zero-source runbook", content.runbook, [
  "Fetch work must be queued and bounded.",
  "queued_for_research",
  "Queue fetch work",
]);

forbidTokens("Source discovery policy", content.sourcePolicy, [
  "This policy governs autonomous source discovery",
  "Before queueing fetches for a domain",
  "Later queued fetch routes may use `callsNetwork: true`",
  "max queue depth per domain",
]);

forbidTokens("Autonomy agent", content.autonomyAgent, [
  "The agent is an autonomous EVAVO growth employee:",
  "It can research, classify, draft, queue, and execute allowed actions",
  "### approved_autopilot",
  "### owned_channel_autopilot",
  "7. Controlled execution",
]);

forbidTokens("Channel policy", content.channelPolicy, [
  "Default mode: `owned_channel_autopilot`",
  "Default mode: `approved_autopilot`",
  "approved low-volume sends/submissions",
  "Action can execute autonomously only if all gates pass",
  "scheduled EVAVO posts under configured cadence",
]);

forbidTokens("Engagement action model", content.actionModel, [
  "3. `drafted`",
  "4. `queued`",
  "5. `approved`",
  "6. `executed`",
  "## Execution envelope",
  "## Default execution order",
  "send permissioned/warm email",
]);

forbidTokens("Cost governor", content.costGovernor, [
  "### research_budgeted",
  "### growth_budgeted",
  "AI drafts/day: 5",
  "public actions/day: 3",
  "contact actions/day: 5",
  "Before execution:",
  "Good outcomes may increase caps gradually.",
]);

forbidTokens("Campaign intelligence", content.campaignIntelligence, [
  "Initial candidate action types:",
  "Execution remains a later phase",
  "before future approval-gated execution exists",
]);

forbidTokens("Business Autopilot architecture", content.businessArchitecture, [
  "The system should autonomously research, organise, score, draft, monitor, and recommend.",
  "### Level 1: Draft-only",
  "### Level 2: Approval-required execution",
  "### Level 4: Capped campaign mode",
  "send approved email",
  "publish approved owned social post",
]);

forbidTokens("Business Autopilot governance", content.businessGovernance, [
  "Research autonomously. Draft helpfully. Execute only under governed approval.",
  "Any action that can change external state requires an approval request and execution record.",
  "approved_to_send",
  "External actions must support caps before execution is enabled",
  "only read-only and draft-only actions may proceed",
]);

forbidTokens("Business Autopilot compliance", content.businessCompliance, [
  "The first implementation is metadata-only and draft-only.",
  "Before any email send endpoint can be enabled",
  "Owned social publishing requires:",
  "Draft generation may occur without consent checks",
  "Before enabling any send/post/submit endpoint",
]);

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
  documentsChecked: Object.values(documents),
  zeroSourceStartupDocumentedAsManualOnly: true,
  zeroSourceCatalogueDocumentedAsManualOnly: true,
  scheduledExternalResearchDocumentedAsDisabled: true,
  manualResearchAuthenticationDocumented: true,
  manualResearchConfirmationDocumented: true,
  manualResearchBoundedDocumented: true,
  manualResearchReviewOnlyDocumented: true,
  automaticRetriesDocumentedAsDisabled: true,
  aiAndDraftBudgetsDocumentedAsZero: true,
  campaignIntelligenceDocumentedAsMetadataOnly: true,
  businessAutopilotDocumentedAsNonExecuting: true,
  draftingDocumentedAsDisabled: true,
  outboundExecutionDocumentedAsDisabled: true,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
