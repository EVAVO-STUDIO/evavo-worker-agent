#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const liveRequested = process.argv.includes("--live");
const expectedRepository = "EVAVO-STUDIO/evavo-worker-agent";
const workflowPath = ".github/workflows/worker-repository-confidentiality.yml";
const documentationPath = "docs/worker-repository-confidentiality.md";
const responseMaxBytes = 65_536;
const requestTimeoutMs = 8_000;

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`missing_required_file:${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label}_missing:${token}`);
  }
}

function forbidTokens(label, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) errors.push(`${label}_forbidden:${token}`);
  }
}

const workflow = read(workflowPath);
const documentation = read(documentationPath);

requireTokens("workflow", workflow, [
  "name: Worker repository confidentiality",
  "contents: read",
  "persist-credentials: false",
  "node-version: \"24\"",
  "GITHUB_TOKEN: ${{ github.token }}",
  "node scripts/check-worker-repository-visibility.mjs --live",
  "schedule:",
  "cron: \"17 3 * * *\"",
]);
forbidTokens("workflow", workflow, [
  "contents: write",
  "pull-requests: write",
  "id-token: write",
  "wrangler deploy",
  "vercel deploy",
  "npm install",
  "npm ci",
  "secrets.",
  "ADMIN_TOKEN",
]);

requireTokens("documentation", documentation, [
  "# Worker repository confidentiality",
  "private: true",
  "visibility: private",
  "archived: false",
  "GitHub reported the repository as public",
  "node scripts/check-worker-repository-visibility.mjs --live",
  "npm run worker:repository-visibility:check",
  "read-only `contents` permission",
  "performs no deployment",
  "does not rename or redeploy the Cloudflare Worker",
  "Making the repository private does not revoke a credential",
]);

const tokenShapeValid = (value) => {
  if (typeof value !== "string" || value.trim() !== value || /\s/.test(value)) {
    return false;
  }
  const bytes = Buffer.byteLength(value, "utf8");
  return bytes >= 20 && bytes <= 4_096;
};

async function readJsonBounded(response) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > responseMaxBytes) {
    await response.body?.cancel().catch(() => undefined);
    throw new Error("repository_metadata_response_too_large");
  }
  if (!response.body) throw new Error("repository_metadata_body_missing");

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      if (!next.value) continue;
      total += next.value.byteLength;
      if (total > responseMaxBytes) {
        await reader.cancel("repository_metadata_response_too_large").catch(
          () => undefined,
        );
        throw new Error("repository_metadata_response_too_large");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const value = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("repository_metadata_shape_invalid");
  }
  return value;
}

async function verifyLiveVisibility() {
  const repository = String(process.env.GITHUB_REPOSITORY || "").trim();
  if (repository !== expectedRepository) {
    errors.push("live_repository_context_invalid");
    return null;
  }

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "";
  if (!tokenShapeValid(token)) {
    errors.push("live_repository_token_missing_or_invalid");
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    const response = await fetch(
      `https://api.github.com/repos/${expectedRepository}`,
      {
        method: "GET",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "User-Agent": "EVAVO-Worker-Repository-Confidentiality-Check",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    );
    if (response.status !== 200) {
      await response.body?.cancel().catch(() => undefined);
      errors.push(`repository_metadata_http_${response.status}`);
      return null;
    }
    const contentType = String(response.headers.get("content-type") || "");
    if (!contentType.toLowerCase().includes("application/json")) {
      await response.body?.cancel().catch(() => undefined);
      errors.push("repository_metadata_content_type_invalid");
      return null;
    }

    const metadata = await readJsonBounded(response);
    if (metadata.full_name !== expectedRepository) {
      errors.push("repository_metadata_identity_mismatch");
    }
    if (metadata.private !== true) errors.push("repository_visibility_not_private");
    if (metadata.visibility !== "private") {
      errors.push("repository_visibility_label_not_private");
    }
    if (metadata.archived !== false) errors.push("repository_archived");

    return {
      fullName: metadata.full_name || null,
      private: metadata.private === true,
      visibility: metadata.visibility || null,
      archived: metadata.archived === true,
    };
  } catch (error) {
    errors.push(
      error instanceof Error && error.name === "AbortError"
        ? "repository_metadata_timeout"
        : error instanceof Error && /^[a-z0-9_]+$/.test(error.message)
          ? error.message
          : "repository_metadata_request_failed",
    );
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const liveMetadata = liveRequested ? await verifyLiveVisibility() : null;

console.log(
  JSON.stringify(
    {
      passed: errors.length === 0,
      activeRepository: expectedRepository,
      contract: "worker-repository-confidentiality-v1-live-metadata",
      requiredVisibility: "private",
      requiredPrivateFlag: true,
      requiredArchivedFlag: false,
      staticPolicyVerified: true,
      liveRequested,
      liveRepositoryVisibilityVerified:
        liveRequested &&
        liveMetadata?.private === true &&
        liveMetadata?.visibility === "private" &&
        liveMetadata?.archived === false,
      liveMetadata,
      tokenLogged: false,
      responseBodyLogged: false,
      repositoryMutationPerformed: false,
      deploymentPerformed: false,
      errors,
    },
    null,
    2,
  ),
);

if (errors.length) process.exitCode = 1;
