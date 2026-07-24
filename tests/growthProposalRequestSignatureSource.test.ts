import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const source = fs.readFileSync(path.join(root, "src/core/growthProposalRequestSignature.ts"), "utf8");
const docs = fs.readFileSync(path.join(root, "docs/growth-proposal-request-signature.md"), "utf8");
const requestFixture = fs.readFileSync(path.join(root, "fixtures/growth-worker-request-v1.json"), "utf8");
const index = fs.readFileSync(path.join(root, "src/index.ts"), "utf8");

function requires(content: string, tokens: readonly string[], label: string): void {
  for (const token of tokens) assert.ok(content.includes(token), `${label} missing ${token}`);
}

function forbids(content: string, tokens: readonly string[], label: string): void {
  for (const token of tokens) assert.equal(content.includes(token), false, `${label} contains ${token}`);
}

test("signed Growth request producer remains pure, canonical and transport-disabled", () => {
  requires(source, [
    "growth_worker_request_v1",
    "/api/private/growth/worker-proposals",
    "application/json",
    "GROWTH_PROPOSAL_REQUEST_MAX_BODY_BYTES = 48_000",
    "GROWTH_PROPOSAL_REQUEST_NONCE_BYTES = 32",
    "GROWTH_PROPOSAL_REQUEST_SIGNING_SKEW_SECONDS = 30",
    "x-evavo-growth-contract-version",
    "x-evavo-growth-key-id",
    "x-evavo-growth-request-id",
    "x-evavo-growth-timestamp",
    "x-evavo-growth-nonce",
    "x-evavo-growth-content-sha256",
    "x-evavo-growth-signature",
    "requireExactKeys(record, PACKET_KEYS",
    "requireExactKeys(\n      objectValue(item",
    "JSON.stringify(value) !== JSON.stringify(canonical)",
    "GROWTH_PROPOSAL_REQUEST_PACKET_NOT_CANONICAL",
    "crypto.getRandomValues(bytes)",
    "crypto.subtle.digest(\"SHA-256\"",
    "crypto.subtle.importKey(",
    "crypto.subtle.sign(\"HMAC\"",
    "canonicalGrowthProposalRequest",
    "signGrowthProposalRequest",
    "Object.freeze({",
  ], "signer source");

  forbids(source, [
    "fetch(",
    "process.env",
    "env.DB",
    ".prepare(",
    "waitUntil(",
    "setTimeout(",
    "ADMIN_TOKEN",
    "EVAVO_GROWTH_WORKER_ADMIN_TOKEN",
    "PRIVATE_SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "providerToken",
    "accessToken",
    "refreshToken",
    "authorization:",
    "wrangler",
    "canonicalPromotionRequested: true",
    "externalExecutionRequested: true",
  ], "signer source");

  assert.equal(index.includes("growthProposalRequestSignature"), false, "signer must not be wired into the Worker dispatcher");
  assert.equal(index.includes("/api/private/growth/worker-proposals"), false, "next-website path must not become a Worker route");
});

test("signed Growth request documentation preserves dedicated credential and no-send posture", () => {
  requires(docs, [
    "pure producer",
    "does not send the request",
    "does not send the request, open a network connection, read environment variables, write Worker D1",
    "growth_worker_proposal_v1",
    "growth_worker_request_v1",
    "POST /api/private/growth/worker-proposals",
    "It must not reuse:",
    "`ADMIN_TOKEN`",
    "Supabase service-role key",
    "The secret is not included in the fixture itself.",
    "requires byte-for-byte equality",
    "A legitimate retry must create a new:",
    "request ID",
    "timestamp",
    "nonce",
    "The receiving database distinguishes a safe proposal replay from a captured-request replay.",
    "does not yet:",
    "load a bridge secret from `Env`",
    "send an HTTP request",
    "enable `bridgeEnabled`",
    "perform canonical promotion or external execution",
  ], "signer docs");
});

test("canonical signed fixture is secret-free and proposal-only", () => {
  requires(requestFixture, [
    "\"contractVersion\": \"growth_worker_request_v1\"",
    "\"pathname\": \"/api/private/growth/worker-proposals\"",
    "\"contentType\": \"application/json\"",
    "\"x-evavo-growth-content-sha256\"",
    "\"x-evavo-growth-signature\"",
    "d09ae9a464d3b6e0b77f483287d1d96b2290fe068a8dc4e6f592ef707ef702ce",
    "2f991b05142c37c1439aec59d5d12ec89620d7d831171f0ef79e55d617d16b5f",
    "\\\"proposalMode\\\":\\\"proposal_only\\\"",
    "\\\"externalExecutionRequested\\\":false",
    "\\\"canonicalPromotionRequested\\\":false",
  ], "signed fixture");
  forbids(requestFixture, [
    "test-only-growth-worker-bridge-secret",
    "ADMIN_TOKEN",
    "service-role-key",
    "providerToken",
  ], "signed fixture");
});
