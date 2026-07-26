import assert from "node:assert/strict";
import test from "node:test";

import {
  hydrateGrowthApprovalRequest,
  toGrowthApprovalRequestSummary,
  type GrowthApprovalRequestRow,
} from "../src/core/growthApprovalRequests";

const SECRET_PAYLOAD = "approval-payload-secret-must-not-project";
const SECRET_SETUP_GAP = "private setup detail must not project";
const SECRET_DECISION_NOTE = "private decision note must not project";

function row(): GrowthApprovalRequestRow {
  return {
    id: "approval-0001",
    created_at: "2026-07-26T09:00:00.000Z",
    updated_at: "2026-07-26T10:00:00.000Z",
    status: "pending",
    source: "growth_operator",
    step: "review_candidate",
    route: "/admin/growth/actions",
    method: "POST",
    requires_confirm: 1,
    dashboard_anchor: "growth-review",
    setup_gap: SECRET_SETUP_GAP,
    target_campaign_id: "campaign-0001",
    target_campaign_name: "Example campaign",
    payload_json: JSON.stringify({ genericValue: SECRET_PAYLOAD, anotherField: true }),
    review_checklist_json: JSON.stringify([
      "Verify current public evidence.",
      "Confirm suppression posture.",
    ]),
    explicit_blocks_json: JSON.stringify(["send_email", "post_social"]),
    audit_reason_json: JSON.stringify(["Owner review required."]),
    safety_json: JSON.stringify({
      internalMetadataOnly: true,
      externalStateChange: false,
      privateDetail: "must-not-project",
    }),
    reviewer: "greg",
    decision_note: SECRET_DECISION_NOTE,
    reviewed_at: null,
  };
}

test("Growth approval summaries retain review value without raw payloads or notes", () => {
  const summary = toGrowthApprovalRequestSummary(hydrateGrowthApprovalRequest(row()));
  assert.deepEqual(summary, {
    id: "approval-0001",
    createdAt: "2026-07-26T09:00:00.000Z",
    updatedAt: "2026-07-26T10:00:00.000Z",
    status: "pending",
    source: "growth_operator",
    step: "review_candidate",
    route: "/admin/growth/actions",
    method: "POST",
    requiresConfirm: true,
    dashboardAnchor: "growth-review",
    hasSetupGap: true,
    targetCampaignId: "campaign-0001",
    targetCampaignName: "Example campaign",
    hasPayloadHint: true,
    payloadHintKeyCount: 2,
    reviewChecklist: [
      "Verify current public evidence.",
      "Confirm suppression posture.",
    ],
    explicitBlocks: ["send_email", "post_social"],
    auditReason: ["Owner review required."],
    reviewer: "greg",
    hasDecisionNote: true,
    reviewedAt: null,
    externalStateChange: false,
    callsAI: false,
    callsNetwork: false,
    canSendEmail: false,
    canPostSocial: false,
    canSubmitForms: false,
  });
  const serialised = JSON.stringify(summary);
  assert(!serialised.includes(SECRET_PAYLOAD));
  assert(!serialised.includes(SECRET_SETUP_GAP));
  assert(!serialised.includes(SECRET_DECISION_NOTE));
  assert(!serialised.includes("payloadHint"));
  assert(!serialised.includes("decisionNote"));
  assert(!serialised.includes("safety"));
  assert.equal(Object.isFrozen(summary), true);
  assert.equal(Object.isFrozen(summary.reviewChecklist), true);
  assert.equal(Object.isFrozen(summary.explicitBlocks), true);
});
