import { RouteCatalogueItem, route } from "./routeCatalogueTypes";

const readDescription = "Reads stored Business Autopilot metadata only. It does not send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.";
const writeDescription = "Confirm-saves Business Autopilot internal metadata only. It does not send, post, comment, submit forms, call AI, browse, buy ads, execute browser actions, or mutate external systems.";
const historicalReviewDescription = "Confirm-saves one internal historical review record only. It does not create deliverable copy, approvals, external execution permission, network activity or third-party state changes.";

function readRoute(id: string, path: string, label: string): RouteCatalogueItem {
  return route({
    id,
    method: "GET",
    path,
    label,
    section: "business_autopilot",
    safety: "read_only",
    readOnly: true,
    requiresConfirm: false,
    writesTables: [],
    callsNetwork: false,
    callsAI: false,
    canSendEmail: false,
    costRisk: "none",
    operatorFacing: true,
    operationsHubRecommended: true,
    description: readDescription,
  });
}

function writeRoute(id: string, path: string, label: string, writesTables: string[], description = writeDescription): RouteCatalogueItem {
  return route({
    id,
    method: "POST",
    path,
    label,
    section: "business_autopilot",
    safety: "confirm_required",
    readOnly: false,
    requiresConfirm: true,
    writesTables,
    callsNetwork: false,
    callsAI: false,
    canSendEmail: false,
    costRisk: "none",
    operatorFacing: true,
    operationsHubRecommended: true,
    description,
  });
}

export const businessAutopilotRouteCatalogue: RouteCatalogueItem[] = [
  readRoute("business_organizations", "/admin/business/organizations?limit=25", "Business organizations"),
  readRoute("business_people", "/admin/business/people?limit=25", "Business people"),
  readRoute("business_websites", "/admin/business/websites?limit=25", "Business websites"),
  readRoute("business_pages", "/admin/business/pages?limit=25", "Business pages"),
  readRoute("business_website_audit_runs", "/admin/business/website-audit-runs?limit=25", "Business website audit runs"),
  readRoute("business_audit_observations", "/admin/business/audit-observations?limit=25", "Business audit observations"),
  readRoute("business_audit_observation_candidates", "/admin/business/audit-observation-candidates?limit=25", "Business audit observation candidates"),
  readRoute("business_signals", "/admin/business/signals?limit=25", "Business signals"),
  readRoute("business_opportunities", "/admin/business/opportunities?limit=25", "Business opportunities"),
  readRoute("business_service_matches", "/admin/business/service-matches?limit=25", "Business service matches"),
  readRoute("business_audit_packs", "/admin/business/audit-packs?limit=25", "Business audit packs"),
  readRoute("business_action_drafts", "/admin/business/action-drafts?limit=25", "Historical Business review records"),
  readRoute("business_approval_requests", "/admin/business/approval-requests?limit=25", "Historical Business approval-shaped records"),
  readRoute("business_suppression_list", "/admin/business/suppression?limit=25", "Business suppression list"),
  readRoute("business_content_ideas", "/admin/business/content-ideas?limit=25", "Business content ideas"),
  readRoute("business_followups", "/admin/business/followups?limit=25", "Business followups"),
  readRoute("business_learning_events", "/admin/business/learning?limit=25", "Business learning events"),
  writeRoute("business_organization_save", "/admin/business/organizations?confirm=1", "Save business organization", ["business_organizations"]),
  writeRoute("business_person_save", "/admin/business/people?confirm=1", "Save business person", ["business_people"]),
  writeRoute("business_website_save", "/admin/business/websites?confirm=1", "Save business website", ["business_websites"]),
  writeRoute("business_page_save", "/admin/business/pages?confirm=1", "Save business page", ["business_pages"]),
  writeRoute("business_website_audit_run_save", "/admin/business/website-audit-runs?confirm=1", "Save business website audit run", ["business_website_audit_runs"]),
  writeRoute("business_audit_observation_save", "/admin/business/audit-observations?confirm=1", "Save business audit observation", ["business_audit_observations"]),
  writeRoute("business_signal_save", "/admin/business/signals?confirm=1", "Save business signal", ["business_signals"]),
  writeRoute("business_opportunity_save", "/admin/business/opportunities?confirm=1", "Save business opportunity", ["business_opportunities"]),
  writeRoute("business_service_match_save", "/admin/business/service-matches?confirm=1", "Save business service match", ["business_service_matches"]),
  writeRoute("business_audit_pack_save", "/admin/business/audit-packs?confirm=1", "Save business audit pack", ["business_audit_packs"]),
  writeRoute("business_action_draft_build", "/admin/business/action-drafts/build?confirm=1", "Save internal historical review record", ["business_action_drafts"], historicalReviewDescription),
  writeRoute("business_suppression_save", "/admin/business/suppression?confirm=1", "Save business suppression", ["business_suppression_list"]),
  writeRoute("business_content_idea_save", "/admin/business/content-ideas?confirm=1", "Save business content idea", ["business_content_ideas"]),
  writeRoute("business_followup_save", "/admin/business/followups?confirm=1", "Save business followup", ["business_followups"]),
  writeRoute("business_learning_event_save", "/admin/business/learning?confirm=1", "Save business learning event", ["business_learning_events"]),
];

export const businessAutopilotReadRouteIds = businessAutopilotRouteCatalogue
  .filter((item) => item.readOnly)
  .map((item) => item.id);

export const businessAutopilotConfirmRouteIds = businessAutopilotRouteCatalogue
  .filter((item) => item.requiresConfirm)
  .map((item) => item.id);
