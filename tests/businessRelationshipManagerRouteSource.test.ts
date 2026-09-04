import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const indexPath = new URL("../src/index.ts", import.meta.url);
const handlerPath = new URL("../src/routes/businessRelationshipManagerAdmin.ts", import.meta.url);
const parserPath = new URL("../src/core/businessRelationshipManagerRuntimeInput.ts", import.meta.url);
const cataloguePath = new URL("../src/routes/businessAutopilotRouteCatalogue.ts", import.meta.url);

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

test("Relationship Manager preview handler is bounded, parsed and structurally non-executable", async () => {
  const source = await readFile(handlerPath, "utf8");
  assert.match(source, /readBoundedJsonObject/);
  assert.match(source, /isAdminRequestAuthorized/);
  assert.match(source, /parseRelationshipManagerCommunicationCycleInput/);
  assert.match(source, /rawMessageBodiesExposed:\s*false/);
  assert.match(source, /callerSuppliedTrustedContextAccepted:\s*false/);
  assert.match(source, /previewApprovalGradeReady:\s*false/);
  assert.match(source, /persisted:\s*false/);
  assert.match(source, /canonicalStateMutated:\s*false/);
  assert.match(source, /callsExternalNetwork:\s*false/);
  assert.match(source, /callsAI:\s*false/);
  assert.match(source, /sendsEmail:\s*false/);
  assert.match(source, /createsMeetings:\s*false/);
  assert.match(source, /mutatesExternalProviders:\s*false/);
  assert.match(source, /externalExecutionAllowed:\s*false/);
  assert.doesNotMatch(source, /sendEmail\s*\(/);
  assert.doesNotMatch(source, /gmail.*send/i);
});

test("preview input parser rejects caller supplied trusted context and coercion", async () => {
  const source = await readFile(parserPath, "utf8");
  assert.match(source, /RELATIONSHIP_MANAGER_INPUT_PRECOMPOSED_TRUSTED_CONTEXT_NOT_ACCEPTED/);
  assert.match(source, /RELATIONSHIP_MANAGER_INPUT_CHANNEL_CURRENT_INVALID/);
  assert.match(source, /RELATIONSHIP_MANAGER_INPUT_CANDIDATE_REQUIRED/);
  assert.match(source, /RELATIONSHIP_MANAGER_INPUT_VERIFIED_IDENTITY_SELECTED_REQUIRED/);
  assert.match(source, /requiredBool\(input\.exactAddressMatch/);
});

test("route catalogue describes Relationship Manager as a no-confirm internal preview", async () => {
  const source = await readFile(cataloguePath, "utf8");
  assert.match(source, /business_relationship_manager_cycle_preview/);
  assert.match(source, /function previewRoute/);
  assert.match(source, /method:\s*"POST"/);
  assert.match(source, /safety:\s*"read_only"/);
  assert.match(source, /requiresConfirm:\s*false/);
  assert.match(source, /writesTables:\s*\[\]/);
  assert.match(source, /callsNetwork:\s*false/);
  assert.match(source, /callsAI:\s*false/);
  assert.match(source, /canSendEmail:\s*false/);
});
