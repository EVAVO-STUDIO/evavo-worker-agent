#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const readmePath = path.join(root, "README.md");
const packagePath = path.join(root, "package.json");

const readme = fs.existsSync(readmePath)
  ? fs.readFileSync(readmePath, "utf8")
  : "";
const packageJson = fs.existsSync(packagePath)
  ? JSON.parse(fs.readFileSync(packagePath, "utf8"))
  : {};

if (!readme) errors.push("README.md is missing");
if (!fs.existsSync(packagePath)) errors.push("package.json is missing");

const required = [
  "The active Worker is a governed, review-first opportunity-intelligence system.",
  "historical review records and private operational reporting",
  "It does **not** provide outbound execution.",
  "Historical draft-shaped and approval-shaped records are non-deliverable, non-executable and non-authoritative.",
  "historical review-record and strategy-score routes",
  "Historical labels and schema families are retained only for data compatibility.",
  "They do not describe enabled drafting, approvals-to-execution, campaigns or external delivery.",
  "The authoritative model is research-memory-first, metadata-first, review-first and non-executing.",
  "Confirmation is the exact JSON boolean `true`; query-string, numeric and string coercions are rejected.",
  "Confirmed research and source-management JSON bodies are media-type checked, stream-bounded, structure-bounded and SHA-256 fingerprinted.",
  "Sensitive query credentials and binary response bodies are rejected.",
  "Paired source-health and source-run audit updates use a D1 transaction.",
  "bounded_admin_json_request_v1",
  "public_research_fetch_v2",
  "Sitemap research traverses sitemap indexes to a maximum depth of two",
  "Opportunity extraction is deterministic, boundary-aware and evidence-quality-scored.",
  "Missing deadlines, values, currencies, eligibility and scope remain missing rather than being inferred.",
  "Historical source and review learning may calibrate grounded evidence but cannot promote weak evidence into high confidence.",
  "Persisted opportunity candidates are internal review records only and cannot become drafts, approvals or external actions.",
  "GitHub currently reports this repository as **public**.",
  "The required repository posture is `private: true`, `visibility: private` and `archived: false`.",
  "repository confidentiality remains a release and governance blocker",
  "Source-secret safety and private repository visibility are independent requirements; passing one does not prove the other.",
  "The separate Worker repository confidentiality workflow performs a bounded live GitHub metadata read",
  "It remains red while the repository is public and performs no repository mutation or deployment.",
  "The focused commands are useful for diagnosing one contract, but `npm run check:local` remains the authoritative complete gate.",
];

for (const token of required) {
  if (!readme.includes(token)) {
    errors.push(`README missing truthful top-level posture: ${token}`);
  }
}

for (const document of [
  "docs/worker-source-secret-posture.md",
  "docs/worker-repository-confidentiality.md",
  "docs/bounded-admin-json-boundary.md",
  "docs/public-research-fetch-boundary.md",
  "docs/opportunity-evidence-quality.md",
  "docs/manual-research-concurrency.md",
]) {
  if (!readme.includes(document)) {
    errors.push(`README operating document list is missing: ${document}`);
  }
}

const requiredFocusedChecks = [
  "npm run worker:source-secret-safety:check",
  "npm run worker:repository-visibility:check",
  "npm run safety:gates:check",
  "npm run docs:operating-posture:check",
  "npm run docs:readme-truthfulness:check",
  "npm run worker:package-identity:check",
  "npm run research:bounded-json-safety:check",
  "npm run research:manual-lease-safety:check",
  "npm run research:public-fetch-safety:check",
  "npm run opportunities:evidence-quality:check",
  "npm run opportunities:execution-boundary-safety:check",
  "npm run business:route-catalogue-truthfulness:check",
  "npm run business:draft-runtime-safety:check",
  "npm run business:historical-type-isolation:check",
  "npm run business:review-record-storage-isolation:check",
  "npm run business:ci-parity:check",
  "npm run planner:catalogue-truthfulness:check",
  "npm run test:core",
  "npm run typecheck",
];

for (const command of requiredFocusedChecks) {
  if (!readme.includes(command)) {
    errors.push(`README focused validation list is missing: ${command}`);
  }
  const scriptName = command.replace("npm run ", "");
  if (!packageJson.scripts?.[scriptName]) {
    errors.push(`README advertises missing package script: ${scriptName}`);
  }
}

for (const token of [
  "$env:GITHUB_REPOSITORY = \"EVAVO-STUDIO/evavo-worker-agent\"",
  "$env:GITHUB_TOKEN = \"<read-only GitHub token>\"",
  "node .\\scripts\\check-worker-repository-visibility.mjs --live",
]) {
  if (!readme.includes(token)) {
    errors.push(`README live repository verification is missing: ${token}`);
  }
}

const forbidden = [
  "audit metadata, approval records and private operational reporting",
  "draft-review and strategy-score routes",
  "Some historical architecture documents describe future governed execution concepts.",
  "Review and promote candidates through explicit confirmation gates.",
  "The authoritative model is research-memory-first, metadata-first, review-first and approval-gated.",
  "Learning may promote weak evidence into high confidence.",
  "Missing opportunity facts may be inferred from source context.",
  "shortlist and prepare response",
  "Query-string confirmation is supported",
  "numeric confirmation is accepted",
  "public_research_fetch_v1",
  "automatic retry executor",
  "repository visibility is optional",
  "public source hosting is approved",
  "source-secret scanning proves repository confidentiality",
];

for (const token of forbidden) {
  if (readme.includes(token)) {
    errors.push(`README contains stale top-level capability wording: ${token}`);
  }
}

const expectedCommand =
  "node scripts/check-readme-top-level-truthfulness.mjs";
if (packageJson.scripts?.["docs:readme-truthfulness:check"] !== expectedCommand) {
  errors.push(
    `package.json must expose docs:readme-truthfulness:check as ${expectedCommand}`,
  );
}
if (
  !String(packageJson.scripts?.["check:local"] || "").includes(
    "npm run docs:readme-truthfulness:check",
  )
) {
  errors.push("check:local must include docs:readme-truthfulness:check");
}

console.log(
  JSON.stringify(
    {
      passed: errors.length === 0,
      activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
      contract:
        "readme-top-level-truthfulness-v5-repository-confidentiality",
      outboundExecutionDocumentedAsDisabled: true,
      historicalReviewRecordsDocumentedAsNonAuthoritative: true,
      approvalToExecutionDocumentedAsDisabled: true,
      authoritativeModelDocumentedAsNonExecuting: true,
      exactBooleanConfirmationDocumented: true,
      boundedJsonRequestDocumented: true,
      publicResearchFetchV2Documented: true,
      sensitiveQueryAndBinaryRejectionDocumented: true,
      researchTransactionAtomicityDocumented: true,
      boundedSitemapIndexTraversalDocumented: true,
      deterministicEvidenceQualityDocumented: true,
      missingFactsRemainMissing: true,
      weakEvidenceLearningPromotionAllowed: false,
      opportunityCandidatesExecutable: false,
      publicRepositoryVisibilityDocumentedAsBlocker: true,
      requiredPrivateVisibilityDocumented: true,
      liveRepositoryMetadataCheckDocumented: true,
      sourceSecretScanTreatedAsVisibilityProof: false,
      authoritativeCompleteGateDocumented: true,
      focusedSafetyChecksDocumented: true,
      focusedCommandsBackedByPackageScripts: true,
      deterministicCoreTestsDocumented: true,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exitCode = 1;
