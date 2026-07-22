import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const generatedFiles = [
  'src/index.ts',
  'src/routes/routeCataloguePlanner.ts',
];

const plannerPath = path.join(repoRoot, 'src/routes/routeCataloguePlanner.ts');
const businessImport = 'import { businessAutopilotRouteCatalogue } from "./businessAutopilotRouteCatalogue";';
const businessSpread = '...businessAutopilotRouteCatalogue,';
const retiredBusinessRouteIds = [
  'business_action_draft_save',
  'business_approval_request_save',
];

let failed = false;
const fail = (message) => { failed = true; console.error(`FAIL ${message}`); };
const pass = (message) => console.log(`OK   ${message}`);

for (const relativePath of generatedFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) fail(`${relativePath} is missing`);
  else pass(`${relativePath} exists`);
}

if (fs.existsSync(plannerPath)) {
  const planner = fs.readFileSync(plannerPath, 'utf8');
  const importCount = planner.split(businessImport).length - 1;
  const spreadCount = planner.split(businessSpread).length - 1;

  if (importCount !== 1) fail(`routeCataloguePlanner.ts must contain exactly one Business catalogue import; found ${importCount}`);
  else pass('Business catalogue import exists exactly once');

  if (spreadCount !== 1) fail(`routeCataloguePlanner.ts must contain exactly one Business catalogue spread; found ${spreadCount}`);
  else pass('Business catalogue spread exists exactly once');

  for (const routeId of retiredBusinessRouteIds) {
    if (planner.includes(routeId)) fail(`routeCataloguePlanner.ts must not embed retired Business route id ${routeId}`);
    else pass(`routeCataloguePlanner.ts excludes retired Business route id ${routeId}`);
  }

  if (!planner.includes('...growthAutonomousDiscoveryRouteCatalogue,')) {
    fail('routeCataloguePlanner.ts is missing the Growth discovery catalogue spread');
  } else {
    pass('Growth discovery catalogue spread remains present');
  }
}

const status = spawnSync('git', ['status', '--short', '--', ...generatedFiles], {
  cwd: repoRoot,
  encoding: 'utf8',
});

if (status.status !== 0) {
  fail(`git status failed: ${status.stderr || status.stdout}`);
} else {
  const output = status.stdout.trim();
  if (output) {
    fail(`generated route wiring files have uncommitted changes:\n${output}\nRun npm run growth:wiring:apply and npm run growth:route-catalogue:apply, review the diff, then commit or restore these generated files before deploy.`);
  } else {
    pass('generated route wiring files are clean');
  }
}

console.log(JSON.stringify({
  passed: !failed,
  activeRepository: 'EVAVO-STUDIO/evavo-worker-agent',
  contract: 'generated-route-wiring-v2-catalogue-integrity',
  businessCatalogueImportCountRequired: 1,
  businessCatalogueSpreadCountRequired: 1,
  retiredBusinessRouteIdsForbiddenInPlanner: retiredBusinessRouteIds,
  generatedFiles,
}, null, 2));

if (failed) {
  console.error('Generated route wiring clean check failed.');
  process.exitCode = 1;
} else {
  console.log('Generated route wiring clean check passed.');
}
