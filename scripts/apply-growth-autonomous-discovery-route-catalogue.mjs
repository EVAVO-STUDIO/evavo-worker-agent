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

const importLine = 'import { RouteCatalogueItem, route } from "./routeCatalogueTypes";';
const discoveryImportLine = 'import { growthAutonomousDiscoveryRouteCatalogue } from "./growthAutonomousDiscoveryRouteCatalogue";';

if (!source.includes(discoveryImportLine)) {
  if (!source.includes(importLine)) {
    console.error('Could not find route catalogue import anchor.');
    process.exit(1);
  }
  source = source.replace(importLine, `${importLine}\n${discoveryImportLine}`);
  changed = true;
}

const spreadLine = '  ...growthAutonomousDiscoveryRouteCatalogue,';
const zeroSourceAnchor = '  route({ id: "zero_source_route_map", method: "GET", path: "/admin/planner/routes", label: "Zero-source route map", section: "planner", safety: "read_only", readOnly: true, requiresConfirm: false, writesTables: [], callsNetwork: false, callsAI: false, canSendEmail: false, costRisk: "none", operatorFacing: true, operationsHubRecommended: true, description: "Read-only route-map guidance for starting with no supplied source list and routing through approved source-recovery checks before discovery." }),';

if (!source.includes(spreadLine)) {
  if (!source.includes(zeroSourceAnchor)) {
    console.error('Could not find zero-source route-map anchor.');
    process.exit(1);
  }
  source = source.replace(zeroSourceAnchor, `${zeroSourceAnchor}\n${spreadLine}`);
  changed = true;
}

if (changed) {
  fs.writeFileSync(cataloguePath, source);
  console.log('Applied Growth autonomous discovery route catalogue wiring.');
} else {
  console.log('Growth autonomous discovery route catalogue wiring already present.');
}
