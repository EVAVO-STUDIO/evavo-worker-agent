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

function normalizePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\//, "");
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
  [
    "credential-bearing-url",
    /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|https?):\/\/[^\s/:@]+:[^\s/@]+@[^\s]+/i,
  ],
];

const sensitiveAssignment = new RegExp(
  String.raw`^\s*(?:export\s+)?(?:ADMIN_TOKEN|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|OPENAI_API_KEY|RESEND_API_KEY|STRIPE_API_KEY|STRIPE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|UPSTASH_REDIS_REST_TOKEN)\s*=\s*(.+?)\s*$`,
  "i",
);

function scanText(relativePath, source) {
  for (const [rule, pattern] of signatureRules) {
    if (pattern.test(source)) errors.push(`${relativePath}: ${rule}`);
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

const gitignorePath = path.join(root, ".gitignore");
const gitignore = fs.existsSync(gitignorePath)
  ? fs.readFileSync(gitignorePath, "utf8")
  : "";
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

const examplePath = path.join(root, ".dev.vars.example");
const example = fs.existsSync(examplePath)
  ? fs.readFileSync(examplePath, "utf8")
  : "";
for (const token of [
  "ADMIN_TOKEN=",
  "replace_me_with_a_random_server_only_token",
  "PUBLIC_BASE_URL=",
  "Never commit .dev.vars",
]) {
  if (!example.includes(token)) errors.push(`.dev.vars.example: missing ${token}`);
}

const packagePath = path.join(root, "package.json");
const packageJson = fs.existsSync(packagePath)
  ? JSON.parse(fs.readFileSync(packagePath, "utf8"))
  : {};
const expectedCommand = "node scripts/check-worker-source-secrets.mjs";
if (packageJson.scripts?.["worker:source-secret-safety:check"] !== expectedCommand) {
  errors.push(
    `package.json must expose worker:source-secret-safety:check as ${expectedCommand}`,
  );
}
if (
  !String(packageJson.scripts?.["check:local"] || "").includes(
    "npm run worker:source-secret-safety:check",
  )
) {
  errors.push("check:local must include worker:source-secret-safety:check");
}

console.log(
  JSON.stringify(
    {
      passed: errors.length === 0,
      activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
      contract: "worker-tracked-source-secret-safety-v1",
      trackedFilesInspected: files.length,
      maximumScannedFileBytes: MAX_SCANNED_FILE_BYTES,
      trackedEnvironmentFilesAllowed: [...ALLOWED_ENV_FILES],
      realEnvironmentFilesTracked: false,
      privateKeyMaterialAllowed: false,
      liveProviderTokensAllowed: false,
      credentialBearingUrlsAllowed: false,
      rawSecretValuesPrinted: false,
      repositoryVisibilityEnforcedBySource: false,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exitCode = 1;
