import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const indexPath = new URL("../src/index.ts", import.meta.url);
const handlerPath = new URL("../src/routes/businessRelationshipManagerAdmin.ts", import.meta.url);

test("worker entrypoint routes dedicated Relationship Manager cycles before generic fallback", async () => {
  const source = await readFile(indexPath, "utf8");
  assert.match(source, /handleBusinessRelationshipManagerAdmin/);
  const relationshipCase = source.indexOf('case "relationship-manager"');
  const fallbackCase = source.indexOf('case "business-fallback"');
  assert.ok(relationshipCase >= 0);
  assert.ok(fallbackCase >= 0);
  assert.ok(relationshipCase < fallbackCase);
  assert.match(source.slice(relationshipCase, fallbackCase), /handleBusinessRelationshipManagerAdmin/);
});

test("Relationship Manager preview handler is bounded and structurally non-executable", async () => {
  const source = await readFile(handlerPath, "utf8");
  assert.match(source, /readBoundedJsonObject/);
  assert.match(source, /isAdminRequestAuthorized/);
  assert.match(source, /rawMessageBodiesExposed:\s*false/);
  assert.match(source, /callsExternalNetwork:\s*false/);
  assert.match(source, /callsAI:\s*false/);
  assert.match(source, /sendsEmail:\s*false/);
  assert.match(source, /createsMeetings:\s*false/);
  assert.match(source, /mutatesExternalProviders:\s*false/);
  assert.match(source, /externalExecutionAllowed:\s*false/);
  assert.doesNotMatch(source, /sendEmail\s*\(/);
  assert.doesNotMatch(source, /gmail.*send/i);
});
