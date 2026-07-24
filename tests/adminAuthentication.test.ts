import assert from "node:assert/strict";
import test from "node:test";

import type { Env } from "../src/db.ts";
import {
  ADMIN_TOKEN_MAX_BYTES,
  ADMIN_TOKEN_MIN_BYTES,
  isAdminRequestAuthorized,
} from "../src/core/adminAuthentication.ts";

function environment(adminToken?: string): Env {
  return { ADMIN_TOKEN: adminToken } as unknown as Env;
}

function authenticatedRequest(token: string, scheme = "Bearer"): Request {
  return new Request("https://worker.example.com/admin/test", {
    headers: { authorization: `${scheme} ${token}` },
  });
}

test("administrator authentication accepts only an exact bounded bearer credential", async () => {
  const token = "a".repeat(ADMIN_TOKEN_MIN_BYTES);
  assert.equal(await isAdminRequestAuthorized(authenticatedRequest(token), environment(token)), true);
  assert.equal(await isAdminRequestAuthorized(authenticatedRequest(`${token}x`), environment(token)), false);
  assert.equal(await isAdminRequestAuthorized(authenticatedRequest(token, "bearer"), environment(token)), false);
  assert.equal(await isAdminRequestAuthorized(new Request("https://worker.example.com/admin/test"), environment(token)), false);
});

test("weak configured credentials fail closed even when the caller supplies the same value", async () => {
  const weakToken = "w".repeat(ADMIN_TOKEN_MIN_BYTES - 1);
  assert.equal(await isAdminRequestAuthorized(authenticatedRequest(weakToken), environment(weakToken)), false);
});

test("oversized and whitespace-bearing credentials are rejected before comparison", async () => {
  const oversized = "o".repeat(ADMIN_TOKEN_MAX_BYTES + 1);
  const valid = "v".repeat(ADMIN_TOKEN_MIN_BYTES);

  assert.equal(await isAdminRequestAuthorized(authenticatedRequest(oversized), environment(oversized)), false);
  assert.equal(await isAdminRequestAuthorized(authenticatedRequest(`${valid} suffix`), environment(`${valid} suffix`)), false);
  assert.equal(await isAdminRequestAuthorized(authenticatedRequest(valid), environment(` ${valid}`)), false);
});

test("credential byte bounds apply to multibyte input", async () => {
  const multibyte = "é".repeat(Math.floor(ADMIN_TOKEN_MAX_BYTES / 2) + 1);
  assert.ok(new TextEncoder().encode(multibyte).byteLength > ADMIN_TOKEN_MAX_BYTES);
  assert.equal(await isAdminRequestAuthorized(authenticatedRequest(multibyte), environment(multibyte)), false);
});
