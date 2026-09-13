#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scriptsDir = path.join(root, "scripts");
const errors = [];
const passes = [];

const requireFile = (relativePath) => {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    errors.push(`Missing required file: ${relativePath}`);
    return;
  }
  passes.push(`${relativePath} exists`);
};

const requireAbsent = (relativePath) => {
  const absolute = path.join(root, relativePath);
  if (fs.existsSync(absolute)) {
    errors.push(`Removed legacy file must remain absent: ${relativePath}`);
  } else {
    passes.push(`${relativePath} remains absent`);
  }
};

if (!fs.existsSync(scriptsDir) || !fs.statSync(scriptsDir).isDirectory()) {
  errors.push("Missing scripts directory.");
} else {
  const helperScripts = fs
    .readdirSync(scriptsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map((entry) => entry.name)
    .sort();
  for (const scriptName of helperScripts) {
    const absolute = path.join(scriptsDir, scriptName);
    const result = spawnSync(process.execPath, ["--check", absolute], {
      encoding: "utf8",
      windowsHide: true,
    });
    if (result.status !== 0) {
      errors.push(
        `${path.posix.join("scripts", scriptName)} does not parse: ${(result.stderr || result.stdout || "unknown syntax error").trim()}`,
      );
    } else {
      passes.push(`${path.posix.join("scripts", scriptName)} parses`);
    }
  }
}

for (const relativePath of [
  "Run-BusinessOperatorWorkerRunbook.ps1",
  "Run-WorkerFinalGate.ps1",
  "src/index.ts",
  "src/db.ts",
  "src/engineAutonomy.ts",
  "src/core/adminAuthentication.ts",
  "src/core/boundedJsonRequest.ts",
  "src/core/manualResearchLease.ts",
  "src/core/publicResearchFetch.ts",
  "src/core/reviewMutationSafety.ts",
  "src/core/draftReview.ts",
  "src/core/opportunityReview.ts",
  "src/core/opportunityDiscovery.ts",
  "src/core/opportunityPersistence.ts",
  "src/core/opportunityScoring.ts",
  "src/core/opportunitySourceDiscovery.ts",
  "src/routes/admin.ts",
  "src/routes/adminProtected.ts",
  "src/routes/autonomySettingsAdmin.ts",
  "src/routes/legacyExecutionSafetyAdmin.ts",
  "src/routes/draftReviewAdmin.ts",
  "src/routes/opportunityReviewAdmin.ts",
  "src/routes/opportunitySourceCandidatesAdmin.ts",
  "src/routes/opportunitySourceHealthActionsAdmin.ts",
  "src/routes/workerRoutePolicy.ts",
  "src/routes/growthRoutePolicy.ts",
  "src/routes/opportunityRoutePolicy.ts",
  "src/routes/businessRoutePolicy.ts",
  "src/routes/operationsRoutePolicy.ts",
  "scripts/check-central-authentication-safety.mjs",
  "scripts/check-worker-credential-contract.mjs",
  "scripts/check-worker-env-contract.mjs",
  "scripts/check-protected-response-safety.mjs",
  "scripts/check-scheduled-entrypoint-safety.mjs",
  "scripts/check-bounded-json-request-safety.mjs",
  "scripts/check-manual-research-lease-safety.mjs",
  "scripts/check-public-research-fetch-safety.mjs",
  "scripts/check-review-mutation-boundary-safety.mjs",
  "scripts/check-opportunity-evidence-quality.mjs",
  "scripts/check-autonomy-capability-truthfulness.mjs",
  "scripts/check-manual-execution-safety.mjs",
  "scripts/check-operations-route-policy.mjs",
  "scripts/check-runtime-capability-config.mjs",
  "scripts/check-package-service-identity.mjs",
  "scripts/check-worker-repository-visibility.mjs",
  "scripts/check-workflow-action-pinning.mjs",
  "tests/adminAuthentication.test.ts",
  "tests/boundedJsonRequest.test.ts",
  "tests/publicResearchFetch.test.ts",
  "tests/reviewMutationSafety.test.ts",
  "tests/opportunitySourceCandidateSaveSource.test.ts",
  "docs/admin-token-security.md",
  "docs/bounded-admin-json-boundary.md",
  "docs/manual-research-concurrency.md",
  "docs/public-research-fetch-boundary.md",
  "docs/review-mutation-boundary.md",
  "docs/opportunity-evidence-quality.md",
  "docs/worker-repository-confidentiality.md",
  "wrangler.toml",
  "package.json",
  "package-lock.json",
]) {
  requireFile(relativePath);
}

requireAbsent("src/engine.ts");
requireAbsent("src/email.ts");

const packagePath = path.join(root, "package.json");
if (fs.existsSync(packagePath)) {
  const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
  if (packageJson.scripts?.["scripts:check"] !== "node scripts/check-helper-scripts.mjs") {
    errors.push("package.json must expose scripts:check as node scripts/check-helper-scripts.mjs");
  }
  if (!String(packageJson.scripts?.["check:local"] ?? "").includes("npm run scripts:check")) {
    errors.push("check:local must include scripts:check");
  }
}

console.log(
  JSON.stringify(
    {
      passed: errors.length === 0,
      activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
      contract: "worker-helper-integrity-v2-local-first",
      helperSyntaxChecked: true,
      criticalRuntimeFilesRequired: true,
      legacyExecutionEngineRequiredAbsent: true,
      legacyEmailSenderRequiredAbsent: true,
      githubWorkflowFilesRequired: false,
      githubActionsRequired: false,
      localSafetyCheckersRemainIndependent: true,
      passCount: passes.length,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exitCode = 1;
