import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHECK_NAME = "check-typescript-test-loader";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");
const errors = [];

function requireTokens(label, content, tokens) {
  for (const token of tokens) {
    if (!content.includes(token)) errors.push(`${label} is missing: ${token}`);
  }
}

function forbidTokens(label, content, tokens) {
  for (const token of tokens) {
    if (content.includes(token)) errors.push(`${label} contains forbidden token: ${token}`);
  }
}

const loader = read("scripts/typescript-test-loader.mjs");
const packageJson = JSON.parse(read("package.json"));
const testCommand = String(packageJson.scripts?.["test:core"] ?? "");
const loaderCheckCommand = String(packageJson.scripts?.["test:typescript-loader:check"] ?? "");
const localCommand = String(packageJson.scripts?.["check:local"] ?? "");

requireTokens("TypeScript test loader", loader, [
  "REPOSITORY_ROOT = await realpath(",
  "CANDIDATE_SUFFIXES = Object.freeze([",
  '".ts"',
  '".tsx"',
  '"/index.ts"',
  '"/index.tsx"',
  "function insideRepository(filePath)",
  "path.relative(REPOSITORY_ROOT, filePath)",
  "!relative.startsWith(\"..\")",
  "function eligibleSpecifier(specifier, parentURL)",
  'specifier.startsWith(".")',
  "!path.extname(specifier)",
  "!specifier.includes(\"\\0\")",
  "!specifier.includes(\"?\")",
  "!specifier.includes(\"#\")",
  "export async function resolve(specifier, context, nextResolve)",
  "return await nextResolve(specifier, context)",
  "if (!eligibleSpecifier(specifier, context.parentURL)) throw originalError",
  "if (!insideRepository(unresolvedPath)) throw originalError",
  "await access(candidate)",
  "const resolved = await realpath(candidate)",
  "if (!insideRepository(resolved)) throw originalError",
  "shortCircuit: true",
]);
forbidTokens("TypeScript test loader", loader, [
  "fetch(",
  "http:",
  "https:",
  "child_process",
  "spawn(",
  "exec(",
  "process.env",
  "node_modules",
  "specifier.startsWith(\"node:\")",
  "specifier.startsWith(\"@\")",
  "specifier.startsWith(\"/\")",
  "writeFile",
  "rm(",
  "unlink(",
]);

requireTokens("Core test command", testCommand, [
  "node",
  "--experimental-strip-types",
  "--experimental-transform-types",
  "--experimental-loader ./scripts/typescript-test-loader.mjs",
  "--test",
]);
if (loaderCheckCommand !== "node scripts/check-typescript-test-loader.mjs") {
  errors.push("package.json must expose test:typescript-loader:check as the focused loader guard");
}
if (!localCommand.includes("npm run test:typescript-loader:check")) {
  errors.push("check:local must run test:typescript-loader:check before test:core");
}
if (localCommand.indexOf("npm run test:typescript-loader:check") > localCommand.indexOf("npm run test:core")) {
  errors.push("check:local must guard the loader before running core tests");
}

if (errors.length) {
  console.error(`${CHECK_NAME} failed:\n`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("TypeScript test loader check passed.");
console.log("- extensionless resolution is limited to relative TypeScript files inside the real repository root");
console.log("- package, URL, absolute, query, fragment and NUL-bearing specifiers are not intercepted");
console.log("- the loader performs no network, subprocess, environment, mutation or deletion operation");
console.log("- the guarded loader runs before the repository core test suite");
