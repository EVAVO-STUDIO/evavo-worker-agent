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
