import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const migrationsDir = path.join(repoRoot, "migrations");
const expectedDatabaseName = "evavo_outbound_agent";
const databaseName = process.env.D1_DATABASE_NAME || expectedDatabaseName;
const isLocal = process.argv.includes("--local");
const isRemote = process.argv.includes("--remote");

function argumentValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? "" : process.argv[index + 1] || "";
}

function exactMatches(files, value) {
  if (!value) return [];
  if (value.endsWith(".sql")) return files.filter((file) => file === value);
  return files.filter((file) => file === value || file.startsWith(`${value}_`));
}

if (isLocal === isRemote) {
  console.error("Select exactly one target: --local or --remote.");
  console.error("Examples:");
  console.error("  npm run db:migrations:print -- --local");
  console.error("  npm run db:migrations:print -- --remote");
  process.exit(1);
}

if (isRemote && databaseName !== expectedDatabaseName) {
  console.error(`Remote command printing is restricted to ${expectedDatabaseName}; received ${databaseName}.`);
  process.exit(1);
}

const fromValue = argumentValue("--from");
const onlyValue = argumentValue("--only");

if (fromValue && onlyValue) {
  console.error("Use only one selector: --from or --only.");
  process.exit(1);
}

if (!fs.existsSync(migrationsDir)) {
  console.error(`Could not find migrations directory: ${migrationsDir}`);
  process.exit(1);
}

const allFiles = fs.readdirSync(migrationsDir)
  .filter((file) => /^\d{4}_.+\.sql$/.test(file))
  .sort((a, b) => a.localeCompare(b));

if (!allFiles.length) {
  console.error("No numeric migration SQL files found.");
  process.exit(1);
}

let files = allFiles;

if (onlyValue) {
  const matches = exactMatches(allFiles, onlyValue);
  if (matches.length !== 1) {
    console.error(matches.length ? `--only ${onlyValue} is ambiguous:` : `No migration matched --only ${onlyValue}`);
    for (const file of matches) console.error(`- ${file}`);
    if (matches.length) console.error("Use the complete migration filename.");
    process.exit(1);
  }
  files = matches;
}

if (fromValue) {
  const matches = exactMatches(allFiles, fromValue);
  if (matches.length !== 1) {
    console.error(matches.length ? `--from ${fromValue} is ambiguous:` : `No migration matched --from ${fromValue}`);
    for (const file of matches) console.error(`- ${file}`);
    if (matches.length) console.error("Use the complete migration filename.");
    process.exit(1);
  }
  files = allFiles.slice(allFiles.indexOf(matches[0]));
}

const targetFlag = isRemote ? "--remote" : "--local";
const acknowledgement = isRemote ? ` --confirm-database ${expectedDatabaseName}` : "";

console.log(JSON.stringify({
  target: isRemote ? "remote" : "local",
  databaseName,
  migrationCount: files.length,
  ordering: "full-filename-lexicographic",
  executionDefault: "dry-run",
}, null, 2));
console.log("");
console.log(`cd ${repoRoot}`);
console.log("");
for (const file of files) {
  console.log(`npm run db:migration:one -- ${file} ${targetFlag}${acknowledgement}`);
}
console.log("");
console.log("Notes:");
console.log("- These are dry-run helper commands. Add --execute and the required acknowledgement only after checking applied state.");
console.log("- One-time schema migrations require --confirm-unapplied when executing.");
console.log("- Known rerunnable data migrations require --allow-rerun when executing.");
console.log("- Duplicate numeric prefixes are ordered by complete filename and require full filenames for --from or --only selection.");
console.log("- Run git pull and npm run db:migrations:check before using these commands.");
