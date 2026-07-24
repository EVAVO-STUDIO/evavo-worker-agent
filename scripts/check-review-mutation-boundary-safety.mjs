#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    errors.push(`Missing ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolute, "utf8");
}

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} missing ${token}`);
  }
}

function forbidTokens(label, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) errors.push(`${label} contains forbidden token ${token}`);
  }
}

const helper = read("src/core/reviewMutationSafety.ts");
const helperTests = read("tests/reviewMutationSafety.test.ts");
const draftRoute = read("src/routes/draftReviewAdmin.ts");
const draftCore = read("src/core/draftReview.ts");
const opportunityRoute = read("src/routes/opportunityReviewAdmin.ts");
const opportunityCore = read("src/core/opportunityReview.ts");
const candidateRoute = read("src/routes/opportunitySourceCandidatesAdmin.ts");
const doc = read("docs/review-mutation-boundary.md");
const workflow = read(".github/workflows/worker-contract.yml");
const packageJson = JSON.parse(read("package.json") || "{}");

requireTokens("review mutation helper", helper, [
  'REVIEW_MUTATION_CONTRACT = "review_mutation_boundary_v1"',
  "validReviewRecordId",
  "boundedReviewText",
  "boundedReviewRating",
  "reviewLeaseKey",
  'crypto.subtle.digest("SHA-256"',
  "FORBIDDEN_TEXT_CONTROL",
]);

requireTokens("review mutation helper tests", helperTests, [
  'test("review record identifiers are narrow and path safe"',
  'test("review text is bounded, typed and control-character safe"',
  'test("review ratings require exact integer values between one and five"',
  'test("review lease keys are deterministic, bounded and scope separated"',
]);

for (const [label, source] of [
  ["draft review route", draftRoute],
  ["opportunity review route", opportunityRoute],
  ["source candidate commit route", candidateRoute],
]) {
  requireTokens(label, source, [
    'from "../core/boundedJsonRequest"',
    'from "../core/manualResearchLease"',
    "readBoundedJsonObject",
    "boundedJsonFailurePayload",
    "isExplicitJsonConfirmation",
    "requiredPayload: { confirm: true }",
    "confirmationCoercionAllowed: false",
    "requestReceipt",
    "bodySha256",
    "manualResearchLeaseConflict",
    "status: 409",
    "finally {",
  ]);
  forbidTokens(label, source, [
    "request.json()",
    "request.clone().json()",
    'body?.confirm === 1',
    'body?.confirm === "1"',
    'searchParams.get("confirm")',
    "setTimeout(",
    "waitUntil(",
  ]);
}

requireTokens("draft review route", draftRoute, [
  "validReviewRecordId(draftId)",
  "boundedReviewText(parsed.value.reason, \"reason\", 500)",
  "boundedReviewText(parsed.value.notes, \"notes\", 4_000",
  'const draftActionKey = `draft-review:${draftId}`',
  'reviewLeaseKey("draft-strategy", [strategyKey])',
  "releaseManualResearchLease(env, strategyLease)",
  "releaseManualResearchLease(env, draftLease)",
  "concurrentDuplicateReviewAllowed: false",
  "concurrentStrategyScoreMutationAllowed: false",
]);

const draftConfirmPosition = draftRoute.indexOf("if (!isExplicitJsonConfirmation(parsed.value))");
const draftRecordLeasePosition = draftRoute.indexOf("const draftLease = await acquireManualResearchLease");
const draftStrategyLeasePosition = draftRoute.indexOf("strategyLease = await acquireManualResearchLease");
const draftMutationPosition = draftRoute.indexOf("const result = await reviewDraft");
if (
  draftConfirmPosition < 0 ||
  draftRecordLeasePosition < 0 ||
  draftStrategyLeasePosition < 0 ||
  draftMutationPosition < 0 ||
  !(draftConfirmPosition < draftRecordLeasePosition
    && draftRecordLeasePosition < draftStrategyLeasePosition
    && draftStrategyLeasePosition < draftMutationPosition)
) {
  errors.push("Draft confirmation and both exclusion scopes must precede the review mutation");
}

requireTokens("draft review application service", draftCore, [
  "DRAFT_REVIEW_DECISIONS",
  "normalizeDraftStrategyKey",
  "await env.DB.batch(statements)",
  "INSERT INTO draft_reviews",
  "INSERT INTO strategy_scores",
  "UPDATE drafts SET status",
  "UPDATE leads SET status",
  "INSERT INTO events",
  "mutationAndAuditAtomic: true",
  "reviewOnly: true",
  "executable: false",
  "externalExecutionAllowed: false",
]);
forbidTokens("draft review application service", draftCore, [
  "logEvent(",
  "updateDraft(",
  "updateLead(",
  "sendEmail(",
  "fetch(",
]);

requireTokens("opportunity review route", opportunityRoute, [
  "validReviewRecordId(opportunityId)",
  "boundedReviewText(parsed.value.reason, \"reason\", 500)",
  "boundedReviewRating",
  'const opportunityActionKey = `opportunity-review:${opportunityId}`',
  'reviewLeaseKey(\n      "opportunity-strategy"',
  "releaseManualResearchLease(env, strategyLease)",
  "releaseManualResearchLease(env, opportunityLease)",
  "concurrentDuplicateReviewAllowed: false",
  "concurrentStrategyScoreMutationAllowed: false",
]);

const opportunityConfirmPosition = opportunityRoute.indexOf("if (!isExplicitJsonConfirmation(parsed.value))");
const opportunityRecordLeasePosition = opportunityRoute.indexOf("const opportunityLease = await acquireManualResearchLease");
const opportunityStrategyLeasePosition = opportunityRoute.indexOf("strategyLease = await acquireManualResearchLease");
const opportunityMutationPosition = opportunityRoute.indexOf("const result = await applyOpportunityReview");
if (
  opportunityConfirmPosition < 0 ||
  opportunityRecordLeasePosition < 0 ||
  opportunityStrategyLeasePosition < 0 ||
  opportunityMutationPosition < 0 ||
  !(opportunityConfirmPosition < opportunityRecordLeasePosition
    && opportunityRecordLeasePosition < opportunityStrategyLeasePosition
    && opportunityStrategyLeasePosition < opportunityMutationPosition)
) {
  errors.push("Opportunity confirmation and both exclusion scopes must precede the review mutation");
}

requireTokens("opportunity review application service", opportunityCore, [
  "OPPORTUNITY_REVIEW_DECISIONS",
  "opportunityStrategyScope",
  "await env.DB.batch([",
  "INSERT INTO opportunity_reviews",
  "UPDATE opportunities SET status",
  "UPDATE opportunity_strategy_scores",
  "INSERT INTO opportunity_strategy_scores",
  "VALUES (?, 'opportunity_review', ?, NULL, ?)",
  "requestBodySha256: input.requestBodySha256",
  "reviewStatusScoreAndAuditAtomic: true",
  "reviewOnly: true",
  "executable: false",
  "externalExecutionAllowed: false",
]);
forbidTokens("opportunity review application service", opportunityCore, [
  "logEvent(",
  "sendEmail(",
  "fetch(",
]);

requireTokens("source candidate commit route", candidateRoute, [
  "normalizedCandidateUrls",
  "value.length > 25",
  'parsed.protocol !== "https:"',
  'SOURCE_CANDIDATE_COMMIT_LEASE = "opportunity-source-candidates-commit"',
  "const lease = await acquireManualResearchLease",
  "concurrentDuplicateCommitAllowed: false",
  "publicHttpsCandidateUrlsOnly: true",
  "maximumCandidateCount: 25",
  "externalExecutionAllowed: false",
]);

requireTokens("review mutation boundary document", doc, [
  "# Review mutation boundary",
  "exact JSON boolean `confirm: true`",
  "per-record D1 lease",
  "hashed learning-scope lease",
  "one D1 batch",
  "do not call AI",
  "do not send email",
  "do not apply for opportunities",
]);

const expectedCommand = "node scripts/check-review-mutation-boundary-safety.mjs";
if (packageJson.scripts?.["review:mutation-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose review:mutation-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run review:mutation-safety:check")) {
  errors.push("check:local must include review:mutation-safety:check");
}
requireTokens("Worker contract workflow", workflow, [
  "Verify review mutation safety",
  "npm run review:mutation-safety:check",
]);
if (workflow.includes("wrangler deploy")) errors.push("Review mutation validation must not deploy the Worker");

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "review-mutation-boundary-safety-v1",
  exactBooleanConfirmationRequired: true,
  boundedRequestBodyRequired: true,
  requestFingerprintRequired: true,
  perRecordLeaseRequired: true,
  sharedLearningScopeLeaseRequired: true,
  draftReviewWritesAtomic: true,
  opportunityReviewWritesAtomic: true,
  sourceCandidateCommitLeaseRequired: true,
  callsNetwork: false,
  callsAI: false,
  sendsEmail: false,
  postsExternally: false,
  appliesExternally: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
