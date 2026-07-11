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

let failed = false;
const fail = (message) => { failed = true; console.error(`FAIL ${message}`); };
const pass = (message) => console.log(`OK   ${message}`);

for (const relativePath of generatedFiles) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!fs.existsSync(absolutePath)) fail(`${relativePath} is missing`);
  else pass(`${relativePath} exists`);
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

if (failed) {
  console.error('Generated route wiring clean check failed.');
  process.exit(1);
}

console.log('Generated route wiring clean check passed.');
