export const BUSINESS_RELATIONSHIP_EXECUTION_PREFERENCE_CONTRACT = "business_relationship_execution_preference_v1" as const;

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
  preferredSequence: "act_then_update" | "update_then_act" | "act_without_update" | "communicate_only" | "no_action";
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
      preferredSequence: "no_action",
      communicationNeeded: false,
      reasons: Object.freeze(["EVAVO does not currently own an actionable next step." ]),
    });
  }

  if (input.actionCanBeCompletedNow && input.actionIsSafeAndAuthorised) {
    if (input.recipientNeedsStatusBeforeCompletion || input.materialDelayOrRiskChanged || input.externalCommunicationRequiredByCommitment) {
      reasons.push("Complete the safe authorised work first when practical, then communicate the real outcome rather than status theatre.");
      return Object.freeze({ contract: BUSINESS_RELATIONSHIP_EXECUTION_PREFERENCE_CONTRACT, preferredSequence: "act_then_update", communicationNeeded: true, reasons: Object.freeze(reasons) });
    }
    reasons.push("The owed action can be completed safely now and no useful external update is required.");
    return Object.freeze({ contract: BUSINESS_RELATIONSHIP_EXECUTION_PREFERENCE_CONTRACT, preferredSequence: "act_without_update", communicationNeeded: false, reasons: Object.freeze(reasons) });
  }

  if (input.recipientNeedsStatusBeforeCompletion || input.materialDelayOrRiskChanged || input.externalCommunicationRequiredByCommitment) {
    reasons.push("A useful update is required before completion because expectations, timing or risk materially require it.");
    return Object.freeze({ contract: BUSINESS_RELATIONSHIP_EXECUTION_PREFERENCE_CONTRACT, preferredSequence: "update_then_act", communicationNeeded: true, reasons: Object.freeze(reasons) });
  }

  if (input.communicationWouldOnlySayWorkIsInProgress) {
    reasons.push("Do not create a low-value progress email merely to demonstrate responsiveness.");
    return Object.freeze({ contract: BUSINESS_RELATIONSHIP_EXECUTION_PREFERENCE_CONTRACT, preferredSequence: "no_action", communicationNeeded: false, reasons: Object.freeze(reasons) });
  }

  reasons.push("The action cannot yet be completed and there is no evidence-backed reason to communicate externally now.");
  return Object.freeze({ contract: BUSINESS_RELATIONSHIP_EXECUTION_PREFERENCE_CONTRACT, preferredSequence: "no_action", communicationNeeded: false, reasons: Object.freeze(reasons) });
}
