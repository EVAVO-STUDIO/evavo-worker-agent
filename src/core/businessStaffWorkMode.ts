import type { StaffPriorityDecision } from "./businessStaffPriorityEngine";

export const BUSINESS_STAFF_WORK_MODE_CONTRACT = "business_staff_work_mode_v1" as const;

export type StaffWorkMode = "interrupt_now" | "handle_today" | "scheduled_queue" | "monitor" | "ignore";

export type StaffWorkModeInput = Readonly<{
  priority: StaffPriorityDecision;
  requiresHumanDecision: boolean;
  waitingOnCounterparty: boolean;
  actionableNow: boolean;
  duplicateOrSuperseded: boolean;
  suppressionActive: boolean;
  acknowledgedOnly: boolean;
  materialNewInformation: boolean;
}>;

export type StaffWorkModeDecision = Readonly<{
  contract: typeof BUSINESS_STAFF_WORK_MODE_CONTRACT;
  mode: StaffWorkMode;
  reasons: readonly string[];
}>;

export function decideStaffWorkMode(input: StaffWorkModeInput): StaffWorkModeDecision {
  const reasons: string[] = [];

  if (input.suppressionActive || input.duplicateOrSuperseded) {
    reasons.push(input.suppressionActive
      ? "An active suppression rule means no communication work should proceed."
      : "The item is duplicate or superseded and should not consume staff attention.");
    return { contract: BUSINESS_STAFF_WORK_MODE_CONTRACT, mode: "ignore", reasons };
  }

  if (input.acknowledgedOnly && !input.materialNewInformation) {
    reasons.push("The message is acknowledgement-only and adds no material information or obligation.");
    return { contract: BUSINESS_STAFF_WORK_MODE_CONTRACT, mode: "ignore", reasons };
  }

  if (input.waitingOnCounterparty && !input.actionableNow) {
    reasons.push("EVAVO is waiting on the counterparty and there is no useful action to take yet.");
    return { contract: BUSINESS_STAFF_WORK_MODE_CONTRACT, mode: "monitor", reasons };
  }

  if (input.priority.band === "critical" && input.actionableNow) {
    reasons.push("Critical, actionable work should interrupt lower-value queued activity.");
    return { contract: BUSINESS_STAFF_WORK_MODE_CONTRACT, mode: "interrupt_now", reasons };
  }

  if ((input.priority.band === "high" || input.requiresHumanDecision) && input.actionableNow) {
    reasons.push(input.requiresHumanDecision
      ? "A material human decision is required and should be surfaced today rather than buried in a queue."
      : "High-priority actionable work should be completed today.");
    return { contract: BUSINESS_STAFF_WORK_MODE_CONTRACT, mode: "handle_today", reasons };
  }

  if (input.actionableNow) {
    reasons.push("The work is actionable but does not justify interrupting higher-priority responsibilities.");
    return { contract: BUSINESS_STAFF_WORK_MODE_CONTRACT, mode: "scheduled_queue", reasons };
  }

  reasons.push("There is no useful action available yet; keep the item under observation.");
  return { contract: BUSINESS_STAFF_WORK_MODE_CONTRACT, mode: "monitor", reasons };
}
