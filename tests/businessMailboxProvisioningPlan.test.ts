import assert from "node:assert/strict";
import test from "node:test";

import { DESIRED_EVAVO_MAILBOXES } from "../src/core/businessMailboxRegistry";
import { buildMailboxProvisioningPlan } from "../src/core/businessMailboxProvisioningPlan";

test("preserves Greg and refuses early Relationship Manager use", () => {
  const plan = buildMailboxProvisioningPlan({
    mailbox: DESIRED_EVAVO_MAILBOXES.eva,
    preserveMailboxes: [DESIRED_EVAVO_MAILBOXES.greg],
    authoritativeMailControlPathAvailable: true,
    authoritativeDnsControlPathAvailable: true,
  });
  assert.equal(plan.address, "eva@evavo.com.au");
  assert.ok(plan.preserveAddresses.includes("greg@evavo.com.au"));
  assert.equal(plan.mayUseBeforeCompletion, false);
  assert.equal(plan.steps.at(-1)?.kind, "enable_relationship_manager");
});

test("reports missing mail and DNS control paths instead of pretending provisioning is possible", () => {
  const plan = buildMailboxProvisioningPlan({
    mailbox: DESIRED_EVAVO_MAILBOXES.hello,
    preserveMailboxes: [DESIRED_EVAVO_MAILBOXES.greg],
    authoritativeMailControlPathAvailable: false,
    authoritativeDnsControlPathAvailable: false,
  });
  assert.ok(plan.blockers.includes("authoritative_mail_control_path_unavailable"));
  assert.ok(plan.blockers.includes("authoritative_dns_control_path_unavailable"));
});

test("verifies inbound, send-as, signature and authentication independently", () => {
  const plan = buildMailboxProvisioningPlan({
    mailbox: DESIRED_EVAVO_MAILBOXES.eva,
    preserveMailboxes: [DESIRED_EVAVO_MAILBOXES.greg],
    authoritativeMailControlPathAvailable: true,
    authoritativeDnsControlPathAvailable: true,
  });
  const kinds = new Set(plan.steps.map((item) => item.kind));
  for (const expected of ["verify_inbound", "verify_send_as", "verify_signature", "verify_spf", "verify_dkim", "verify_dmarc", "round_trip_test"] as const) {
    assert.ok(kinds.has(expected));
  }
});
