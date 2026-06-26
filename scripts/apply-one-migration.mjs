import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(repoRoot, 'migrations');
const dbName = process.env.D1_DATABASE_NAME || 'evavo_outbound_agent';
const isLocal = process.argv.includes('--local');
const shouldExecute = process.argv.includes('--execute');
const migrationArg = process.argv.find((arg) => /^\d{4}/.test(arg)) || '';

function usage() {
  console.log('Usage:');
  console.log('  npm run db:migration:one -- 0011');
  console.log('  npm run db:migration:one -- 0011 --execute');
  console.log('  npm run db:migration:one -- 0011 --local --execute');
  console.log('');
  console.log('Default mode is dry-run. Pass --execute to run Wrangler.');
}

function migrationMatches(file, value) {
  if (!value) return false;
  return file === value || file.startsWith(value) || file.includes(value);
}

if (!migrationArg) {
  usage();
  process.exit(1);
}

if (!fs.existsSync(migrationsDir)) {
  console.error(`Could not find migrations directory: ${migrationsDir}`);
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir)
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort((a, b) => a.localeCompare(b));

const matches = files.filter((file) => migrationMatches(file, migrationArg));

if (!matches.length) {
  console.error(`No migration matched ${migrationArg}`);
  process.exit(1);
}

if (matches.length > 1) {
  console.error(`Migration argument ${migrationArg} matched multiple files:`);
  for (const file of matches) console.error(`- ${file}`);
  console.error('Use a more specific prefix or filename.');
  process.exit(1);
}

const file = matches[0];
const commandArgs = ['wrangler', 'd1', 'execute', dbName];
if (!isLocal) commandArgs.push('--remote');
commandArgs.push('--file', `migrations/${file}`);

console.log(`cd ${repoRoot}`);
console.log(`npx ${commandArgs.join(' ')}`);

if (!shouldExecute) {
  console.log('');
  console.log('Dry-run only. Add --execute to run this migration.');
  process.exit(0);
}

console.log('');
console.log(`Executing ${file} against ${isLocal ? 'local' : 'remote'} D1 database ${dbName}...`);
const result = spawnSync('npx', commandArgs, {
  cwd: repoRoot,
  stdio: 'inherit',
  shell: process.platform === 'win32',
});

process.exit(result.status ?? 1);
