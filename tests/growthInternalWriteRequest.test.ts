import assert from "node:assert/strict";
import test from "node:test";

import {
  GROWTH_INTERNAL_WRITE_REQUEST_VERSION,
  growthInternalWriteFailurePayload,
  readGrowthInternalWriteRequest,
} from "../src/core/growthInternalWriteRequest";

function request(
  body: unknown,
  options: Readonly<{ contentType?: string; rawBody?: string }> = {},
): Request {
  return new Request("https://worker.example/admin/growth/strategy", {
    method: "POST",
    headers: { "content-type": options.contentType ?? "application/json" },
    body: options.rawBody ?? JSON.stringify(body),
  });
}

test("exact confirmed Growth writes return immutable body and canonical receipt", async () => {
  const result = await readGrowthInternalWriteRequest(request({
    confirm: true,
    goal: {
      title: "Example goal",
      tags: ["priority", "review"],
    },
  }));
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("expected success");
  assert.equal(result.contractVersion, GROWTH_INTERNAL_WRITE_REQUEST_VERSION);
  assert.equal(result.exactBooleanConfirmation, true);
  assert.equal(result.confirmationCoercionAllowed, false);
  assert.equal(result.sensitiveInputKeysAllowed, false);
  assert.match(result.bodySha256, /^[0-9a-f]{64}$/);
  assert.equal("confirm" in result.body, false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.body), true);
  assert.equal(Object.isFrozen(result.body.goal), true);
  assert.equal(Object.isFrozen((result.body.goal as { tags: string[] }).tags), true);
});

test("query confirmation and confirmation coercion do not affect the JSON contract", async () => {
  for (const body of [{}, { confirm: 1 }, { confirm: "true" }, { confirm: false }]) {
    const result = await readGrowthInternalWriteRequest(
      new Request("https://worker.example/admin/growth/strategy?confirm=1", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("expected failure");
    assert.equal(result.error, "confirm_required");
    assert.deepEqual(result.requiredPayload, { confirm: true });
    assert.equal(result.confirmationCoercionAllowed, false);
    const payload = growthInternalWriteFailurePayload(result);
    assert.equal(payload.error, "confirm_required");
    assert.deepEqual(payload.requiredPayload, { confirm: true });
  }
});

test("credential-shaped keys are rejected recursively and never echoed", async () => {
  for (const field of [
    { accessToken: "must-not-echo" },
    { oauthAccessToken: "must-not-echo" },
    { providerApiKey: "must-not-echo" },
    { integration: { serviceRoleSecret: "must-not-echo" } },
    { accountPasswordHint: "must-not-echo" },
  ]) {
    const result = await readGrowthInternalWriteRequest(request({
      confirm: true,
      goal: { title: "Example", ...field },
    }));
    assert.equal(result.ok, false);
    if (result.ok) throw new Error("expected failure");
    assert.equal(result.error, "forbidden_growth_input_key");
    assert(!JSON.stringify(result).includes("must-not-echo"));
    assert(!JSON.stringify(growthInternalWriteFailurePayload(result)).includes("must-not-echo"));
  }
});

test("bounded JSON failures retain finite safe diagnostics", async () => {
  const nonJson = await readGrowthInternalWriteRequest(request(
    { confirm: true },
    { contentType: "text/plain" },
  ));
  assert.equal(nonJson.ok, false);
  if (nonJson.ok) throw new Error("expected failure");
  assert.equal(nonJson.status, 415);
  assert.equal(nonJson.error, "json_content_type_required");
  assert.equal(nonJson.boundedJsonFailure?.maxBytes, 32_768);

  const invalid = await readGrowthInternalWriteRequest(request(
    null,
    { rawBody: "{" },
  ));
  assert.equal(invalid.ok, false);
  if (invalid.ok) throw new Error("expected failure");
  assert.equal(invalid.error, "invalid_json");
  assert.equal(invalid.requiredPayload, null);
});
