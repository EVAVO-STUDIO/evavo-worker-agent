import assert from "node:assert/strict";
import test from "node:test";

import { decideRelationshipExecutionPreference } from "../src/core/businessRelationshipExecutionPreference";

const base = {
  evavoOwesAction: true,
  actionCanBeCompletedNow: true,
  actionIsSafeAndAuthorised: true,
  recipientNeedsStatusBeforeCompletion: false,
  materialDelayOrRiskChanged: false,
  communicationWouldOnlySayWorkIsInProgress: true,
  externalCommunicationRequiredByCommitment: false,
} as const;

test("does the owed work before sending status theatre when it can safely complete now", () => {
  const result = decideRelationshipExecutionPreference(base);
  assert.equal(result.preferredSequence, "act_without_update");
  assert.equal(result.actionDisposition, "execute_now");
  assert.equal(result.communicationDisposition, "none");
  assert.equal(result.communicationNeeded, false);
});

test("completes first then updates when an outcome update is genuinely useful", () => {
  const result = decideRelationshipExecutionPreference({ ...base, recipientNeedsStatusBeforeCompletion: true });
  assert.equal(result.preferredSequence, "act_then_update");
  assert.equal(result.actionDisposition, "execute_now");
  assert.equal(result.communicationDisposition, "update_after_action");
});

test("updates before completion only when changed timing risk or an explicit commitment makes that useful", () => {
  const result = decideRelationshipExecutionPreference({
    ...base,
    actionCanBeCompletedNow: false,
    actionIsSafeAndAuthorised: false,
    materialDelayOrRiskChanged: true,
    communicationWouldOnlySayWorkIsInProgress: false,
  });
  assert.equal(result.preferredSequence, "update_then_act");
  assert.equal(result.actionDisposition, "defer");
  assert.equal(result.communicationDisposition, "update_before_action");
  assert.equal(result.communicationNeeded, true);
});

test("owed work stays queued when it cannot proceed and a progress-only email adds no value", () => {
  const result = decideRelationshipExecutionPreference({
    ...base,
    actionCanBeCompletedNow: false,
    actionIsSafeAndAuthorised: false,
  });
  assert.equal(result.preferredSequence, "defer_without_update");
  assert.equal(result.actionDisposition, "defer");
  assert.equal(result.communicationDisposition, "none");
  assert.equal(result.communicationNeeded, false);
});

test("no owned work is represented as none, not deferred", () => {
  const result = decideRelationshipExecutionPreference({ ...base, evavoOwesAction: false });
  assert.equal(result.preferredSequence, "none");
  assert.equal(result.actionDisposition, "none");
});
