import assert from "node:assert/strict";
import test from "node:test";

import { resolveRoleOpeningTruth } from "../src/core/businessRoleOpeningTruth";

test("absence of a confirmed opening never becomes a claim that EVAVO is not hiring", () => {
  const result = resolveRoleOpeningTruth({ evidence: [] });
  assert.equal(result.status, "no_confirmed_open_role");
  assert.equal(result.maySayRoleExists, false);
  assert.equal(result.maySayNotHiring, false);
  assert.match(result.safeExternalWording, /confirmed current opening/i);
});

test("authoritative open role can be described truthfully", () => {
  const result = resolveRoleOpeningTruth({
    targetRoleId: "role-1",
    evidence: [
      { id: "ev-1", source: "operations_core", observedAt: "2026-09-04T02:45:00Z", roleId: "role-1", roleLabel: "Graduate Designer", state: "open", authoritative: true, sourceRef: "operations:role-1" },
    ],
  });
  assert.equal(result.status, "confirmed_open");
  assert.equal(result.maySayRoleExists, true);
});

test("closed role evidence does not authorise a global not-hiring claim", () => {
  const result = resolveRoleOpeningTruth({
    targetRoleId: "role-1",
    evidence: [
      { id: "ev-2", source: "operations_core", observedAt: "2026-09-04T02:45:00Z", roleId: "role-1", roleLabel: "Graduate Designer", state: "closed", authoritative: true, sourceRef: "operations:role-1" },
    ],
  });
  assert.equal(result.status, "confirmed_not_open");
  assert.equal(result.maySayNotHiring, false);
  assert.match(result.safeExternalWording, /isn't currently open/i);
});

test("conflicting role evidence fails closed", () => {
  const result = resolveRoleOpeningTruth({
    targetRoleId: "role-1",
    evidence: [
      { id: "ev-open", source: "operations_core", observedAt: "2026-09-04T02:45:00Z", roleId: "role-1", state: "open", authoritative: true, sourceRef: "operations:open" },
      { id: "ev-closed", source: "operator", observedAt: "2026-09-04T02:46:00Z", roleId: "role-1", state: "closed", authoritative: true, sourceRef: "operator:closed" },
    ],
  });
  assert.equal(result.status, "conflicting");
  assert.equal(result.maySayRoleExists, false);
});
