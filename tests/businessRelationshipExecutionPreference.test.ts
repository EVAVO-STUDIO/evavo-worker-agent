import assert from "node:assert/strict";
import test from "node:test";

import { decideRelationshipExecutionPreference } from "../src/core/businessRelationshipExecutionPreference";

test("does the owed work before sending status theatre when it can safely complete now", () => {
  const result = decideRelationshipExecutionPreference({
    evavoOwesAction: true,
    actionCanBeCompletedNow: true,
    actionIsSafeAndAuthorised: true,
    recipientNeedsStatusBeforeCompletion: false,
    materialDelayOrRiskChanged: false,
    communicationWouldOnlySayWorkIsInProgress: true,
    externalCommunicationRequiredByCommitment: false,
  });
  assert.equal(result.preferredSequence, "act_without_update");
  assert.equal(result.communicationNeeded, false);
});

test("completes first then updates when an outcome update is genuinely useful", () => {
  const result = decideRelationshipExecutionPreference({
    evavoOwesAction: true,
    actionCanBeCompletedNow: true,
    actionIsSafeAndAuthorised: true,
    recipientNeedsStatusBeforeCompletion: true,
    materialDelayOrRiskChanged: false,
    communicationWouldOnlySayWorkIsInProgress: false,
    externalCommunicationRequiredByCommitment: false,
  });
  assert.equal(result.preferredSequence, "act_then_update");
  assert.equal(result.communicationNeeded, true);
});

test("updates before completion only when changed timing risk or an explicit commitment makes that useful", () => {
  const result = decideRelationshipExecutionPreference({
    evavoOwesAction: true,
    actionCanBeCompletedNow: false,
    actionIsSafeAndAuthorised: false,
    recipientNeedsStatusBeforeCompletion: false,
    materialDelayOrRiskChanged: true,
    communicationWouldOnlySayWorkIsInProgress: false,
    externalCommunicationRequiredByCommitment: false,
  });
  assert.equal(result.preferredSequence, "update_then_act");
  assert.equal(result.communicationNeeded, true);
});
