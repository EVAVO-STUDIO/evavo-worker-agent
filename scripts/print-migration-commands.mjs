import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(repoRoot, 'migrations');
const dbName = process.env.D1_DATABASE_NAME || 'evavo_outbound_agent';
const remoteFlag = process.argv.includes('--local') ? '' : ' --remote';

function argValue(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return '';
  return process.argv[index + 1] || '';
}

function migrationMatches(file, value) {
  if (!value) return false;
  return file === value || file.startsWith(value) || file.includes(value);
}

const fromValue = argValue('--from');
const onlyValue = argValue('--only');

if (!fs.existsSync(migrationsDir)) {
  console.error(`Could not find migrations directory: ${migrationsDir}`);
  process.exit(1);
}

const allFiles = fs.readdirSync(migrationsDir)
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort((a, b) => a.localeCompare(b));

if (!allFiles.length) {
  console.error('No numeric migration SQL files found.');
  process.exit(1);
}

let files = allFiles;

if (onlyValue) {
  files = allFiles.filter((file) => migrationMatches(file, onlyValue));
  if (!files.length) {
    console.error(`No migration matched --only ${onlyValue}`);
    process.exit(1);
  }
}

if (fromValue && !onlyValue) {
  const fromIndex = allFiles.findIndex((file) => migrationMatches(file, fromValue));
  if (fromIndex === -1) {
    console.error(`No migration matched --from ${fromValue}`);
    process.exit(1);
  }
  files = allFiles.slice(fromIndex);
}

console.log(`cd ${repoRoot}`);
console.log('');
for (const file of files) {
  console.log(`npx wrangler d1 execute ${dbName}${remoteFlag} --file migrations/${file}`);
}
console.log('');
console.log('Notes:');
console.log('- Run git pull first, then npm run db:migrations:check.');
console.log('- Use -- --local with npm run db:migrations:print to print local-D1 commands instead of remote commands.');
console.log('- Use -- --from 0011 to print from one migration onward.');
console.log('- Use -- --only 0011 to print one matching migration command.');
console.log('- Schema migrations that add columns are one-time only. Data backfill migrations may be rerun when needed.');
