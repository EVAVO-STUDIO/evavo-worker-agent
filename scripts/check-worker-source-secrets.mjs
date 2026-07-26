#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const errors = [];
const MAX_SCANNED_FILE_BYTES = 2 * 1024 * 1024;
const SELF_PATH = "scripts/check-worker-source-secrets.mjs";
const ALLOWED_ENV_FILES = new Set([".env.example", ".dev.vars.example"]);
const EXCLUDED_DIRECTORIES = new Set([
  ".git",
  ".wrangler",
  "node_modules",
  "dist",
  "coverage",
]);
const CREDENTIAL_URL_PATTERN = /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|https?):\/\/[^\s/:@]+:[^\s/@]+@[^\s"'`<>]+/gi;
const RESERVED_FIXTURE_HOSTS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "localhost",
  "127.0.0.1",
  "::1",
]);

function normalizePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
}

function read(relativePath) {
  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) {
    errors.push(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolute, "utf8");
}

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label}: missing ${token}`);
  }
}

function requireOrder(label, source, tokens) {
  let previous = -1;
  for (const token of tokens) {
    const current = source.indexOf(token, previous + 1);
    if (current < 0 || current <= previous) {
      errors.push(`${label}: invalid ordering at ${token}`);
      return;
    }
    previous = current;
  }
}

function trackedFiles() {
  const result = spawnSync("git", ["ls-files", "-z"], {
    cwd: root,
    encoding: "buffer",
  });
  if (result.status === 0 && result.stdout?.length) {
    return result.stdout
      .toString("utf8")
      .split("\0")
      .map(normalizePath)
      .filter(Boolean);
  }

  const files = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) files.push(normalizePath(path.relative(root, absolute)));
    }
  }
  walk(root);
  return files;
}

function isForbiddenEnvironmentFile(relativePath) {
  const name = path.posix.basename(relativePath);
  if (ALLOWED_ENV_FILES.has(name)) return false;
  return (
    name === ".env" ||
    name.startsWith(".env.") ||
    name === ".dev.vars" ||
    name.startsWith(".dev.vars.")
  );
}

function isProbablyBinary(buffer) {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8_192));
  return sample.includes(0);
}

function placeholderValue(value) {
  const normalized = value
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .toLowerCase();
  if (!normalized) return true;
  return (
    normalized.startsWith("<") ||
    normalized.startsWith("${") ||
    normalized.startsWith("$env:") ||
    normalized.includes("replace_me") ||
    normalized.includes("placeholder") ||
    normalized.includes("example") ||
    normalized.includes("change_me") ||
    normalized.includes("your_") ||
    normalized.includes("test_only") ||
    normalized === "undefined" ||
    normalized === "null"
  );
}

function isReservedFixtureCredentialUrl(raw) {
  try {
    const hostname = new URL(raw).hostname.replace(/^\[|\]$/g, "").toLowerCase();
    return (
      RESERVED_FIXTURE_HOSTS.has(hostname) ||
      hostname.endsWith(".example") ||
      hostname.endsWith(".test") ||
      hostname.endsWith(".invalid")
    );
  } catch {
    return false;
  }
}

const signatureRules = [
  ["private-key-material", /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/],
  ["github-classic-token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
  ["github-fine-grained-token", /\bgithub_pat_[A-Za-z0-9_]{30,}\b/],
  ["aws-access-key", /\bAKIA[0-9A-Z]{16}\b/],
  ["google-api-key", /\bAIza[0-9A-Za-z_-]{30,}\b/],
  ["stripe-live-key", /\b(?:sk|rk)_live_[0-9A-Za-z]{16,}\b/],
  ["resend-live-key", /\bre_[0-9A-Za-z]{20,}\b/],
  ["slack-token", /\bxox[baprs]-[0-9A-Za-z-]{20,}\b/],
  ["supabase-secret-key", /\bsb_secret_[0-9A-Za-z_-]{20,}\b/],
];

const sensitiveAssignment = new RegExp(
  String.raw`^\s*(?:export\s+)?(?:ADMIN_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|OPENAI_API_KEY|RESEND_API_KEY|STRIPE_API_KEY|STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|UPSTASH_REDIS_REST_TOKEN)\s*=\s*(.+?)\s*$`,
  "i",
);

function scanText(relativePath, source) {
  for (const [rule, pattern] of signatureRules) {
    if (pattern.test(source)) errors.push(`${relativePath}: ${rule}`);
  }

  CREDENTIAL_URL_PATTERN.lastIndex = 0;
  for (const match of source.matchAll(CREDENTIAL_URL_PATTERN)) {
    if (!isReservedFixtureCredentialUrl(match[0])) {
      errors.push(`${relativePath}: credential-bearing-url`);
    }
  }

  for (const line of source.split(/\r?\n/)) {
    const match = line.match(sensitiveAssignment);
    if (!match) continue;
    const value = match[1].split(/\s+#/, 1)[0].trim();
    if (!placeholderValue(value)) {
      errors.push(`${relativePath}: non-placeholder sensitive assignment`);
    }
  }

  if (path.posix.basename(relativePath) === ".npmrc") {
    for (const line of source.split(/\r?\n/)) {
      const match = line.match(/(?:^|:)_authToken\s*=\s*(.+)$/i);
      if (match && !placeholderValue(match[1])) {
        errors.push(`${relativePath}: npm authentication token`);
      }
    }
  }
}

for (const fixture of [
  { value: "https://user:password@example.com/path", allowed: true },
  { value: "postgres://user:password@db.example.invalid/app", allowed: true },
  { value: "mysql://user:password@production.internal/app", allowed: false },
]) {
  if (isReservedFixtureCredentialUrl(fixture.value) !== fixture.allowed) {
    errors.push(`credential URL fixture classification failed: ${fixture.value}`);
  }
}

const files = trackedFiles();
for (const relativePath of files) {
  if (isForbiddenEnvironmentFile(relativePath)) {
    errors.push(`${relativePath}: tracked environment file is forbidden`);
    continue;
  }
  if (relativePath === SELF_PATH) continue;

  const absolute = path.join(root, relativePath);
  if (!fs.existsSync(absolute)) continue;
  const stat = fs.statSync(absolute);
  if (!stat.isFile() || stat.size > MAX_SCANNED_FILE_BYTES) continue;
  const buffer = fs.readFileSync(absolute);
  if (isProbablyBinary(buffer)) continue;
  scanText(relativePath, buffer.toString("utf8"));
}

const gitignore = read(".gitignore");
for (const token of [
  ".env",
  ".env.*",
  "!.env.example",
  ".dev.vars",
  ".dev.vars.*",
  "!.dev.vars.example",
  ".wrangler/",
  "npm-audit.json",
]) {
  if (!gitignore.split(/\r?\n/).includes(token)) {
    errors.push(`.gitignore: missing ${token}`);
  }
}

const example = read(".dev.vars.example");
for (const token of [
  "ADMIN_TOKEN=",
  "replace_me_with_a_random_server_only_token",
  "PUBLIC_BASE_URL=",
  "Never commit .dev.vars",
]) {
  if (!example.includes(token)) errors.push(`.dev.vars.example: missing ${token}`);
}

const packageJson = JSON.parse(read("package.json") || "{}");
const expectedCommand = "node scripts/check-worker-source-secrets.mjs";
if (packageJson.scripts?.["worker:source-secret-safety:check"] !== expectedCommand) {
  errors.push(
    `package.json must expose worker:source-secret-safety:check as ${expectedCommand}`,
  );
}
const localGate = String(packageJson.scripts?.["check:local"] || "");
if (!localGate.includes("npm run worker:source-secret-safety:check")) {
  errors.push("check:local must include worker:source-secret-safety:check");
}
if (
  localGate.indexOf("npm run worker:source-secret-safety:check") >
  localGate.indexOf("npm run scripts:check")
) {
  errors.push("tracked-source secret safety must run before helper and aggregate checks");
}

const safetyGate = read("scripts/check-safety-gate-completeness.mjs");
requireTokens("safety-gate completeness", safetyGate, [
  '"worker:source-secret-safety:check": "node scripts/check-worker-source-secrets.mjs"',
  '"scripts/check-worker-source-secrets.mjs"',
  '".dev.vars.example"',
  '"docs/worker-source-secret-posture.md"',
  'contract: "safety-gate-completeness-v8-source-secrets"',
  "workerTrackedSourceSecretSafetyRequired: true",
  "safeWorkerVariableTemplateRequired: true",
]);

const workflow = read(".github/workflows/worker-contract.yml");
requireTokens("Worker contract workflow", workflow, [
  '      - ".gitignore"',
  '      - ".dev.vars.example"',
  "Verify tracked-source secret safety",
  "npm run worker:source-secret-safety:check",
  "npm ci --no-audit --no-fund",
  "permissions:\n  contents: read",
  "persist-credentials: false",
  "npm run check:local",
]);
requireOrder("Worker contract workflow", workflow, [
  "npm ci --no-audit --no-fund",
  "npm run worker:source-secret-safety:check",
  "node scripts/check-worker-contract-workflow.mjs",
  "npm run check:local",
]);
for (const forbidden of ["wrangler deploy", "ADMIN_TOKEN:", "PUBLIC_CONTROL_KEY:"]) {
  if (workflow.includes(forbidden)) {
    errors.push(`Worker contract workflow contains forbidden material: ${forbidden}`);
  }
}

const readme = read("README.md");
requireTokens("README source-secret posture", readme, [
  "## Source-secret and repository posture",
  "npm run worker:source-secret-safety:check",
  "GitHub currently reports this repository as **public**",
  "Repository visibility is an administrative GitHub setting",
  "This source-hardening pass did not change that setting",
  "docs/worker-source-secret-posture.md",
  ".dev.vars.example",
]);

const sourcePosture = read("docs/worker-source-secret-posture.md");
requireTokens("Worker source-secret operating document", sourcePosture, [
  "# Worker tracked-source secret posture",
  "npm run worker:source-secret-safety:check",
  "The repository is currently reported by GitHub as public",
  "an administrator must change the repository visibility in GitHub settings",
  "That setting change is separate from this source hardening and was not performed by the connector",
  "Do not solve an exposure by merely adding the file to `.gitignore`",
]);

console.log(
  JSON.stringify(
    {
      passed: errors.length === 0,
      activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
      contract: "worker-tracked-source-secret-safety-v3-fixture-aware",
      trackedFilesInspected: files.length,
      maximumScannedFileBytes: MAX_SCANNED_FILE_BYTES,
      trackedEnvironmentFilesAllowed: [...ALLOWED_ENV_FILES],
      realEnvironmentFilesTracked: false,
      privateKeyMaterialAllowed: false,
      liveProviderTokensAllowed: false,
      nonReservedCredentialBearingUrlsAllowed: false,
      reservedFixtureCredentialUrlsAllowed: true,
      rawSecretValuesPrinted: false,
      localGateRunsBeforeAggregateChecks: true,
      safetyCompletenessRequired: true,
      focusedReadOnlyCiRequired: true,
      sourcePostureDocumentationRequired: true,
      repositoryVisibilityEnforcedBySource: false,
      repositoryVisibilityChangedByThisContract: false,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exitCode = 1;
