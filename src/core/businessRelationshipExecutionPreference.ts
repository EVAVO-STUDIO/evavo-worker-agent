export const BUSINESS_RELATIONSHIP_EXECUTION_PREFERENCE_CONTRACT = "business_relationship_execution_preference_v2" as const;

export type RelationshipExecutionPreferenceInput = Readonly<{
  evavoOwesAction: boolean;
  actionCanBeCompletedNow: boolean;
  actionIsSafeAndAuthorised: boolean;
  recipientNeedsStatusBeforeCompletion: boolean;
  materialDelayOrRiskChanged: boolean;
  communicationWouldOnlySayWorkIsInProgress: boolean;
  externalCommunicationRequiredByCommitment: boolean;
}>;

export type RelationshipExecutionPreferenceDecision = Readonly<{
  contract: typeof BUSINESS_RELATIONSHIP_EXECUTION_PREFERENCE_CONTRACT;
  preferredSequence: "act_then_update" | "update_then_act" | "act_without_update" | "defer_without_update" | "none";
  actionDisposition: "execute_now" | "defer" | "none";
  communicationDisposition: "update_after_action" | "update_before_action" | "none";
  communicationNeeded: boolean;
  reasons: readonly string[];
}>;

export function decideRelationshipExecutionPreference(
  input: RelationshipExecutionPreferenceInput,
): RelationshipExecutionPreferenceDecision {
  const reasons: string[] = [];
  if (!input.evavoOwesAction) {
    return Object.freeze({
      contract: BUSINESS_RELATIONSHIP_EXECUTION_PREFERENCE_CONTRACT,
      preferredSequence: "none",
      actionDisposition: "none",
      communicationDisposition: "none",
      communicationNeeded: false,
      reasons: Object.freeze(["EVAVO does not currently own an actionable next step." ]),
    });
  }

  if (input.actionCanBeCompletedNow && input.actionIsSafeAndAuthorised) {
    if (input.recipientNeedsStatusBeforeCompletion || input.materialDelayOrRiskChanged || input.externalCommunicationRequiredByCommitment) {
      reasons.push("Complete the safe authorised work first when practical, then communicate the real outcome rather than status theatre.");
      return Object.freeze({
        contract: BUSINESS_RELATIONSHIP_EXECUTION_PREFERENCE_CONTRACT,
        preferredSequence: "act_then_update",
        actionDisposition: "execute_now",
        communicationDisposition: "update_after_action",
        communicationNeeded: true,
        reasons: Object.freeze(reasons),
      });
    }
    reasons.push("The owed action can be completed safely now and no useful external update is required.");
    return Object.freeze({
      contract: BUSINESS_RELATIONSHIP_EXECUTION_PREFERENCE_CONTRACT,
      preferredSequence: "act_without_update",
      actionDisposition: "execute_now",
      communicationDisposition: "none",
      communicationNeeded: false,
      reasons: Object.freeze(reasons),
    });
  }

  if (input.recipientNeedsStatusBeforeCompletion || input.materialDelayOrRiskChanged || input.externalCommunicationRequiredByCommitment) {
    reasons.push("The owed action remains deferred, but expectations, timing, risk or an explicit commitment make an external update useful now.");
    return Object.freeze({
      contract: BUSINESS_RELATIONSHIP_EXECUTION_PREFERENCE_CONTRACT,
      preferredSequence: "update_then_act",
      actionDisposition: "defer",
      communicationDisposition: "update_before_action",
      communicationNeeded: true,
      reasons: Object.freeze(reasons),
    });
  }

  if (input.communicationWouldOnlySayWorkIsInProgress) {
    reasons.push("Keep the owed action queued, but do not create a low-value progress email merely to demonstrate responsiveness.");
  } else {
    reasons.push("The owed action cannot yet be completed and there is no evidence-backed reason to communicate externally now.");
  }
  return Object.freeze({
    contract: BUSINESS_RELATIONSHIP_EXECUTION_PREFERENCE_CONTRACT,
    preferredSequence: "defer_without_update",
    actionDisposition: "defer",
    communicationDisposition: "none",
    communicationNeeded: false,
    reasons: Object.freeze(reasons),
  });
}
