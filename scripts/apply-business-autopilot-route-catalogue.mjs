import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const targetPath = path.join(repoRoot, 'src/routes/routeCataloguePlanner.ts');
const cataloguePath = path.join(repoRoot, 'src/routes/businessAutopilotRouteCatalogue.ts');

for (const requiredPath of [targetPath, cataloguePath]) {
  if (!fs.existsSync(requiredPath)) {
    console.error(`Missing ${path.relative(repoRoot, requiredPath)}`);
    process.exit(1);
  }
}

const catalogue = fs.readFileSync(cataloguePath, 'utf8');
const retiredRouteIds = [
  'business_action_draft_save',
  'business_approval_request_save',
];

for (const routeId of retiredRouteIds) {
  const advertisedPattern = new RegExp(`(?:readRoute|historicalReadRoute|writeRoute|historicalReviewWriteRoute)\(\s*["']${routeId}["']`);
  if (advertisedPattern.test(catalogue)) {
    console.error(`Refusing to wire retired Business route ${routeId}.`);
    process.exit(1);
  }
}

const requiredCataloguePosture = [
  'disabledBusinessAutopilotWriteRouteIds',
  'accountIntelligenceDescription',
  'readRoute("business_account_360"',
  '/admin/business/organizations/:organizationId/account-360?limit=25',
  'D1 remains noncanonical',
  'does not promote state to Supabase',
  'infer relationship or deal health',
  'expose contact details',
  'create meetings',
  'historicalReadDescription',
  'historicalReviewDescription',
  'operationsHubRecommended: false',
  'historicalReadRoute("business_action_drafts"',
  'historicalReadRoute("business_approval_requests"',
  'historicalReviewWriteRoute("business_action_draft_build"',
  'does not create deliverable copy, approvals, external execution permission, network activity or third-party state changes',
];

for (const token of requiredCataloguePosture) {
  if (!catalogue.includes(token)) {
    console.error(`Refusing to wire Business catalogue without required safety posture: ${token}`);
    process.exit(1);
  }
}

let content = fs.readFileSync(targetPath, 'utf8');
const importLine = 'import { businessAutopilotRouteCatalogue } from "./businessAutopilotRouteCatalogue";';
const spreadLine = '  ...businessAutopilotRouteCatalogue,';

if (!content.includes(importLine)) {
  content = content.replace('import { RouteCatalogueItem, route } from "./routeCatalogueTypes";\n', `import { RouteCatalogueItem, route } from "./routeCatalogueTypes";\n${importLine}\n`);
}

if (!content.includes(spreadLine)) {
  const anchor = '  route({ id: "zero_source_route_map"';
  const index = content.indexOf(anchor);
  if (index === -1) {
    console.error('Could not find zero_source_route_map anchor in routeCataloguePlanner.ts');
    process.exit(1);
  }
  const lineEnd = content.indexOf('\n', index);
  if (lineEnd === -1) {
    console.error('Could not find end of zero_source_route_map line in routeCataloguePlanner.ts');
    process.exit(1);
  }
  content = `${content.slice(0, lineEnd + 1)}${spreadLine}\n${content.slice(lineEnd + 1)}`;
}

fs.writeFileSync(targetPath, content);
console.log('Applied Business Autopilot route catalogue wiring after fail-closed posture validation.');
