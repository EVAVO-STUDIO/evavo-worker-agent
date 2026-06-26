import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(repoRoot, 'migrations');
const dbName = process.env.D1_DATABASE_NAME || 'evavo_outbound_agent';
const remoteFlag = process.argv.includes('--local') ? '' : ' --remote';

if (!fs.existsSync(migrationsDir)) {
  console.error(`Could not find migrations directory: ${migrationsDir}`);
  process.exit(1);
}

const files = fs.readdirSync(migrationsDir)
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort((a, b) => a.localeCompare(b));

if (!files.length) {
  console.error('No numeric migration SQL files found.');
  process.exit(1);
}

console.log(`cd ${repoRoot}`);
console.log('');
for (const file of files) {
  console.log(`npx wrangler d1 execute ${dbName}${remoteFlag} --file migrations/${file}`);
}
console.log('');
console.log('Notes:');
console.log('- Run these in order after git pull.');
console.log('- Use -- --local with npm run db:migrations:print to print local-D1 commands instead of remote commands.');
console.log('- Schema migrations that add columns are one-time only. Data backfill migrations may be rerun when needed.');
