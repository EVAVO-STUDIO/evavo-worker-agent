import assert from "node:assert/strict";
import test from "node:test";

import {
  DESIRED_EVAVO_MAILBOXES,
  assertMailboxUsable,
  resolveMailboxProvisioningState,
  withMailboxVerification,
} from "../src/core/businessMailboxRegistry";

test("Greg is currently verified for relationship-manager use", () => {
  assert.equal(DESIRED_EVAVO_MAILBOXES.greg.provisioningState, "fully_verified");
  assert.doesNotThrow(() => assertMailboxUsable(DESIRED_EVAVO_MAILBOXES.greg));
});

test("Eva and hello remain desired until receive/send/signature are independently verified", () => {
  assert.equal(DESIRED_EVAVO_MAILBOXES.eva.relationshipManagerMayUse, false);
  assert.equal(DESIRED_EVAVO_MAILBOXES.hello.relationshipManagerMayUse, false);
  assert.throws(() => assertMailboxUsable(DESIRED_EVAVO_MAILBOXES.eva), /NOT_FULLY_VERIFIED/);
});

test("a mailbox becomes fully verified only after receive send-as and signature verification", () => {
  const verification = {
    receiveVerifiedAt: "2026-09-04T02:00:00Z",
    sendAsVerifiedAt: "2026-09-04T02:01:00Z",
    signatureVerifiedAt: "2026-09-04T02:02:00Z",
    evidenceRefs: ["receive-1", "send-1", "signature-1"],
  };
  assert.equal(resolveMailboxProvisioningState(verification), "fully_verified");
  const updated = withMailboxVerification(DESIRED_EVAVO_MAILBOXES.eva, verification, {
    inboundProvider: "cloudflare_email_routing",
    outboundProvider: "gmail_send_as",
  });
  assert.equal(updated.relationshipManagerMayUse, true);
  assert.equal(updated.inboundProvider, "cloudflare_email_routing");
});
