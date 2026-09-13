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
  "It does **not** provide outbound execution.",
  "Historical draft-shaped and approval-shaped records are non-deliverable, non-executable and non-authoritative.",
  "The authoritative model is research-memory-first, metadata-first, review-first and non-executing.",
  "Confirmation is the exact JSON boolean `true`; query-string, numeric and string coercions are rejected.",
  "bounded_admin_json_request_v1",
  "public_research_fetch_v2",
  "Persisted opportunity candidates are internal review records only and cannot become drafts, approvals or external actions.",
  "GitHub repository visibility must be private",
  "repository confidentiality remains a release and governance blocker",
  "npm run check:local",
  "npm run worker:repository-visibility:check",
  "node .\\scripts\\check-worker-repository-visibility.mjs --live",
  "GitHub-hosted validation is not part of the active execution architecture.",
  "Cloudflare runtime scheduling is separate from GitHub Actions.",
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
  "worker:source-secret-safety:check",
  "worker:repository-visibility:check",
  "worker:workflow-action-pinning:check",
  "safety:gates:check",
  "docs:operating-posture:check",
  "docs:readme-truthfulness:check",
  "worker:package-identity:check",
  "research:bounded-json-safety:check",
  "research:manual-lease-safety:check",
  "research:public-fetch-safety:check",
  "opportunities:evidence-quality:check",
  "opportunities:execution-boundary-safety:check",
  "business:route-catalogue-truthfulness:check",
  "business:draft-runtime-safety:check",
  "business:historical-type-isolation:check",
  "business:review-record-storage-isolation:check",
  "business:ci-parity:check",
  "planner:catalogue-truthfulness:check",
  "test:core",
  "typecheck",
];
for (const scriptName of requiredFocusedChecks) {
  if (!packageJson.scripts?.[scriptName]) {
    errors.push(`README validation contract expects missing package script: ${scriptName}`);
  }
  if (!readme.includes(`npm run ${scriptName}`)) {
    errors.push(`README focused validation list is missing: npm run ${scriptName}`);
  }
}

const forbidden = [
  "email sending is enabled",
  "draft generation is enabled",
  "repository visibility is optional",
  "public source hosting is approved",
  "source-secret scanning proves repository confidentiality",
  "The GitHub Actions Worker contract workflow runs",
  "The separate Worker repository confidentiality workflow performs",
  "Hosted CI is authoritative",
];
for (const token of forbidden) {
  if (readme.includes(token)) {
    errors.push(`README contains stale top-level capability wording: ${token}`);
  }
}

if (
  packageJson.scripts?.["docs:readme-truthfulness:check"] !==
  "node scripts/check-readme-top-level-truthfulness.mjs"
) {
  errors.push(
    "package.json must expose docs:readme-truthfulness:check as node scripts/check-readme-top-level-truthfulness.mjs",
  );
}
if (
  !String(packageJson.scripts?.["check:local"] ?? "").includes(
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
      contract: "readme-top-level-truthfulness-v6-local-first",
      outboundExecutionDocumentedAsDisabled: true,
      historicalReviewRecordsDocumentedAsNonAuthoritative: true,
      authoritativeModelDocumentedAsNonExecuting: true,
      exactBooleanConfirmationDocumented: true,
      boundedJsonRequestDocumented: true,
      publicResearchFetchV2Documented: true,
      opportunityCandidatesExecutable: false,
      requiredPrivateVisibilityDocumented: true,
      localProviderVisibilityCheckDocumented: true,
      githubActionsDocumentedAsRequired: false,
      cloudflareScheduleSeparatedFromGithubActions: true,
      authoritativeCompleteGateDocumented: true,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exitCode = 1;
