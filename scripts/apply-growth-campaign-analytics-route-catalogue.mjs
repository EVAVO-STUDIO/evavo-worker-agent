import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const cataloguePath = path.join(repoRoot, 'src/routes/routeCataloguePlanner.ts');

if (!fs.existsSync(cataloguePath)) {
  console.error(`Missing ${cataloguePath}`);
  process.exit(1);
}

let source = fs.readFileSync(cataloguePath, 'utf8');
let changed = false;

const anchor = '  route({ id: "growth_decision_plan", method: "POST", path: "/admin/growth/decisions/plan?confirm=1", label: "Plan growth decision", section: "growth", safety: "confirm_required", readOnly: false, requiresConfirm: true, writesTables: ["growth_decisions", "growth_candidate_actions"], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Confirm-plans a deterministic next-best campaign decision and candidate action set." }),';

const additions = [
  '  route({ id: "growth_autonomy", method: "GET", path: "/admin/growth/autonomy", label: "Growth autonomous runtime", section: "growth", safety: "read_only", readOnly: true, requiresConfirm: false, writesTables: [], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Reads the supervised autonomous runtime contract, cognition stages, current focus, governance gates, strategy memory, and hard external-action blocks." }),',
  '  route({ id: "growth_strategy_memory", method: "GET", path: "/admin/growth/strategy-memory", label: "Growth strategy memory", section: "growth", safety: "read_only", readOnly: true, requiresConfirm: false, writesTables: [], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Reads active Growth objectives, key results, target segments, offers, positioning, and runtime constraints." }),',
  '  route({ id: "growth_objectives", method: "GET", path: "/admin/growth/objectives?limit=25", label: "Growth objectives", section: "growth", safety: "read_only", readOnly: true, requiresConfirm: false, writesTables: [], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Lists strategic Growth objectives." }),',
  '  route({ id: "growth_objective_save", method: "POST", path: "/admin/growth/objectives?confirm=1", label: "Save Growth objective", section: "growth", safety: "confirm_required", readOnly: false, requiresConfirm: true, writesTables: ["growth_objectives"], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Confirm-saves one internal Growth objective." }),',
  '  route({ id: "growth_key_results", method: "GET", path: "/admin/growth/key-results?limit=50", label: "Growth key results", section: "growth", safety: "read_only", readOnly: true, requiresConfirm: false, writesTables: [], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Lists key results linked to Growth objectives." }),',
  '  route({ id: "growth_key_result_save", method: "POST", path: "/admin/growth/key-results?confirm=1", label: "Save Growth key result", section: "growth", safety: "confirm_required", readOnly: false, requiresConfirm: true, writesTables: ["growth_key_results"], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Confirm-saves one internal Growth key result." }),',
  '  route({ id: "growth_segments", method: "GET", path: "/admin/growth/segments?limit=25", label: "Growth target segments", section: "growth", safety: "read_only", readOnly: true, requiresConfirm: false, writesTables: [], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Lists strategic target segments for the Growth Operator." }),',
  '  route({ id: "growth_segment_save", method: "POST", path: "/admin/growth/segments?confirm=1", label: "Save Growth segment", section: "growth", safety: "confirm_required", readOnly: false, requiresConfirm: true, writesTables: ["growth_target_segments"], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Confirm-saves one internal target segment." }),',
  '  route({ id: "growth_offers", method: "GET", path: "/admin/growth/offers?limit=25", label: "Growth offers", section: "growth", safety: "read_only", readOnly: true, requiresConfirm: false, writesTables: [], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Lists Growth offer profiles." }),',
  '  route({ id: "growth_offer_save", method: "POST", path: "/admin/growth/offers?confirm=1", label: "Save Growth offer", section: "growth", safety: "confirm_required", readOnly: false, requiresConfirm: true, writesTables: ["growth_offer_profiles"], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Confirm-saves one internal offer profile." }),',
  '  route({ id: "growth_positioning", method: "GET", path: "/admin/growth/positioning?limit=25", label: "Growth positioning", section: "growth", safety: "read_only", readOnly: true, requiresConfirm: false, writesTables: [], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Lists positioning and voice profiles for the Growth Operator." }),',
  '  route({ id: "growth_positioning_save", method: "POST", path: "/admin/growth/positioning?confirm=1", label: "Save Growth positioning", section: "growth", safety: "confirm_required", readOnly: false, requiresConfirm: true, writesTables: ["growth_positioning_profiles"], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Confirm-saves one internal positioning profile." }),',
  '  route({ id: "growth_runtime_constraints", method: "GET", path: "/admin/growth/runtime-constraints?limit=50", label: "Growth runtime constraints", section: "growth", safety: "read_only", readOnly: true, requiresConfirm: false, writesTables: [], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Lists hard and soft runtime constraints for the autonomous Growth Operator." }),',
  '  route({ id: "growth_runtime_constraint_save", method: "POST", path: "/admin/growth/runtime-constraints?confirm=1", label: "Save Growth runtime constraint", section: "growth", safety: "confirm_required", readOnly: false, requiresConfirm: true, writesTables: ["growth_runtime_constraints"], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Confirm-saves one internal runtime constraint." }),',
  '  route({ id: "growth_cycle", method: "GET", path: "/admin/growth/cycle", label: "Growth operator cycle", section: "growth", safety: "read_only", readOnly: true, requiresConfirm: false, writesTables: [], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Reads the full read-only operator cycle report, including readiness, loop plan, campaign briefs, capability summary, and blockers." }),',
  '  route({ id: "growth_cycle_events", method: "GET", path: "/admin/growth/cycle/events?limit=25", label: "Growth cycle events", section: "growth", safety: "read_only", readOnly: true, requiresConfirm: false, writesTables: [], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Lists recorded Growth operator cycle snapshots." }),',
  '  route({ id: "growth_cycle_record", method: "POST", path: "/admin/growth/cycle/record?confirm=1", label: "Record Growth cycle", section: "growth", safety: "confirm_required", readOnly: false, requiresConfirm: true, writesTables: ["growth_operator_cycle_events"], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Confirm-records the current read-only Growth operator cycle report as an internal event snapshot." }),',
  '  route({ id: "growth_metrics", method: "GET", path: "/admin/growth/metrics?limit=25", label: "Growth campaign metrics", section: "growth", safety: "read_only", readOnly: true, requiresConfirm: false, writesTables: [], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Lists campaign metric snapshots for campaign health review." }),',
  '  route({ id: "growth_metric_save", method: "POST", path: "/admin/growth/metrics?confirm=1", label: "Save growth metric snapshot", section: "growth", safety: "confirm_required", readOnly: false, requiresConfirm: true, writesTables: ["growth_campaign_metrics"], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Confirm-saves one internal campaign metric snapshot." }),',
  '  route({ id: "growth_evidence", method: "GET", path: "/admin/growth/evidence?limit=25", label: "Growth evidence", section: "growth", safety: "read_only", readOnly: true, requiresConfirm: false, writesTables: [], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Lists evidence items used by the campaign decision brain." }),',
  '  route({ id: "growth_evidence_save", method: "POST", path: "/admin/growth/evidence?confirm=1", label: "Save growth evidence", section: "growth", safety: "confirm_required", readOnly: false, requiresConfirm: true, writesTables: ["growth_evidence_items"], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Confirm-saves one internal campaign evidence item." }),',
  '  route({ id: "growth_learning", method: "GET", path: "/admin/growth/learning?limit=25", label: "Growth learning notes", section: "growth", safety: "read_only", readOnly: true, requiresConfirm: false, writesTables: [], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Lists Growth campaign learning notes and recommendations." }),',
  '  route({ id: "growth_learning_save", method: "POST", path: "/admin/growth/learning?confirm=1", label: "Save growth learning note", section: "growth", safety: "confirm_required", readOnly: false, requiresConfirm: true, writesTables: ["growth_learning_notes"], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Confirm-saves one internal Growth learning note." }),',
];

if (!source.includes(anchor)) {
  console.error('FAIL growth_decision_plan route catalogue anchor not found.');
  process.exit(1);
}

for (const addition of additions) {
  const idMatch = addition.match(/id: "([^"]+)"/);
  const id = idMatch ? idMatch[1] : addition.slice(0, 80);
  if (source.includes(`id: "${id}"`)) {
    console.log(`OK   route already present: ${id}`);
    continue;
  }
  source = source.replace(anchor, `${anchor}\n${addition}`);
  changed = true;
  console.log(`ADD  route catalogue item: ${id}`);
}

if (changed) {
  fs.writeFileSync(cataloguePath, source);
  console.log('Growth campaign analytics route catalogue patch applied.');
} else {
  console.log('Growth campaign analytics route catalogue was already up to date.');
}
