import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');
const dbName = process.env.D1_DATABASE_NAME || 'evavo_outbound_agent';
const remoteFlag = process.argv.includes('--local') ? '' : ' --remote';

const commands = [
  {
    label: 'Confirm strategy score table exists',
    sql: "SELECT name FROM sqlite_master WHERE type='table' AND name='source_expansion_strategy_scores';",
  },
  {
    label: 'Confirm origin-yield columns exist',
    sql: "PRAGMA table_info(source_expansion_strategy_scores);",
  },
  {
    label: 'Show latest strategy rows with origin-yield counts',
    sql: "SELECT strategy, quality_score, recommendation, origin_saved_count, origin_query_hint_count, origin_public_link_graph_count, origin_sitemap_count, origin_source_expansion_count, updated_at_iso FROM source_expansion_strategy_scores ORDER BY updated_at_iso DESC LIMIT 10;",
  },
  {
    label: 'Show saved source origin note counts',
    sql: "SELECT CASE WHEN notes LIKE '%origin=query_hint%' THEN 'query_hint' WHEN notes LIKE '%origin=public_link_graph%' THEN 'public_link_graph' WHEN notes LIKE '%origin=sitemap%' THEN 'sitemap' WHEN notes LIKE '%origin=source_expansion%' THEN 'source_expansion' WHEN notes LIKE '%origin=source_candidate_preview%' THEN 'source_candidate_preview' WHEN notes LIKE '%origin=%' THEN 'other_origin' ELSE 'manual_or_unknown' END AS origin, COUNT(*) AS count FROM opportunity_sources GROUP BY origin ORDER BY count DESC;",
  },
];

console.log(`cd ${repoRoot}`);
console.log('');
for (const command of commands) {
  console.log(`# ${command.label}`);
  console.log(`npx wrangler d1 execute ${dbName}${remoteFlag} --command "${command.sql.replaceAll('"', '\\"')}"`);
  console.log('');
}
console.log('Notes:');
console.log('- Run npm run db:migrations:check first if you are unsure whether your local repo has the latest migration files.');
console.log('- Use -- --local with npm run db:verify:print to print local-D1 verification commands.');
console.log('- If the origin-yield columns are missing, apply migrations/0010_source_expansion_strategy_origin_yield.sql.');
console.log('- If counts look stale, rerun migrations/0011_source_expansion_strategy_origin_yield_backfill.sql and then rerun source expansion learning.');
