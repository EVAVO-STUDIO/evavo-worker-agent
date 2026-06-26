import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const migrationsDir = path.join(repoRoot, 'migrations');

const expected = [
  '0004_opportunity_intelligence.sql',
  '0005_opportunity_review_learning.sql',
  '0006_opportunity_run_audit.sql',
  '0007_source_expansion_memory.sql',
  '0008_source_expansion_strategy_quality.sql',
  '0009_source_expansion_query_hints.sql',
  '0010_source_expansion_strategy_origin_yield.sql',
  '0011_source_expansion_strategy_origin_yield_backfill.sql',
];

const missing = [];
const present = [];

for (const file of expected) {
  const fullPath = path.join(migrationsDir, file);
  if (fs.existsSync(fullPath)) present.push(file);
  else missing.push(file);
}

console.log(`Migration directory: ${migrationsDir}`);
console.log(`Expected migrations: ${expected.length}`);
console.log(`Present: ${present.length}`);

if (missing.length) {
  console.error('');
  console.error('Missing migration file(s):');
  for (const file of missing) console.error(`- ${file}`);
  console.error('');
  console.error('Run git pull, then rerun npm run db:migrations:check.');
  process.exit(1);
}

console.log('All expected migration files are present.');
console.log('Run npm run db:migrations:print to print current Wrangler commands.');
