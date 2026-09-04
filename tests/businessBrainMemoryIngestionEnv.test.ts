import assert from "node:assert/strict";
import test from "node:test";

import {
  inspectBrainMemoryIngestionEnv,
  requireBrainMemoryIngestionPortFromEnv,
} from "../src/core/businessBrainMemoryIngestionEnv";

const complete = {
  BRAIN_BASE_URL: "http://127.0.0.1:4317",
  BRAIN_API_TOKEN: "a".repeat(32),
  BRAIN_RELATIONSHIP_MEMORY_WRITE_TOKEN: "b".repeat(32),
};

test("complete Brain memory environment yields a v2 scoped writer", () => {
  const status = inspectBrainMemoryIngestionEnv(complete);
  assert.equal(status.configured, true);
  assert.equal(status.complete, true);
  assert.deepEqual(status.missing, []);
  const port = requireBrainMemoryIngestionPortFromEnv(complete);
  assert.equal(port.contract, "business_brain_memory_ingestion_port_v2");
});

test("partial Brain memory configuration fails closed and names missing bindings", () => {
  const partial = {
    BRAIN_BASE_URL: "http://127.0.0.1:4317",
    BRAIN_API_TOKEN: "a".repeat(32),
    BRAIN_RELATIONSHIP_MEMORY_WRITE_TOKEN: undefined,
  };
  const status = inspectBrainMemoryIngestionEnv(partial);
  assert.equal(status.configured, true);
  assert.equal(status.complete, false);
  assert.deepEqual(status.missing, ["BRAIN_RELATIONSHIP_MEMORY_WRITE_TOKEN"]);
  assert.throws(() => requireBrainMemoryIngestionPortFromEnv(partial), /ENV_INCOMPLETE:BRAIN_RELATIONSHIP_MEMORY_WRITE_TOKEN/);
});

test("unconfigured environment is distinguishable from partially configured", () => {
  const empty = {
    BRAIN_BASE_URL: undefined,
    BRAIN_API_TOKEN: undefined,
    BRAIN_RELATIONSHIP_MEMORY_WRITE_TOKEN: undefined,
  };
  const status = inspectBrainMemoryIngestionEnv(empty);
  assert.equal(status.configured, false);
  assert.equal(status.complete, false);
  assert.equal(status.missing.length, 3);
});
