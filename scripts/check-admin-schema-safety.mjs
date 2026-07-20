#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const schemaPath = path.join(root, "src", "core", "schema.ts");
const packagePath = path.join(root, "package.json");
const errors = [];

const schema = fs.existsSync(schemaPath) ? fs.readFileSync(schemaPath, "utf8") : "";
const packageJson = fs.existsSync(packagePath) ? JSON.parse(fs.readFileSync(packagePath, "utf8")) : {};

if (!schema) errors.push("Missing authenticated schema report implementation");

for (const token of [
  'contractVersion: "admin_schema_v2_names_only"',
  "SELECT name, type",
  "authenticated: true",
  "readOnly: true",
  "rawSqlExposed: false",
  "rowDataExposed: false",
  "secretsExposed: false",
  "executable: false",
  "callsNetwork: false",
  "callsAI: false",
  "externalStateChange: false",
]) {
  if (!schema.includes(token)) errors.push(`Schema report is missing safe token: ${token}`);
}

for (const forbidden of [
  "SELECT name, type, sql",
  "item.sql",
  "rawSqlExposed: true",
  "rowDataExposed: true",
  "secretsExposed: true",
  "executable: true",
  ".run(",
  ".batch(",
]) {
  if (schema.includes(forbidden)) errors.push(`Schema report contains unsafe token: ${forbidden}`);
}

const expectedCommand = "node scripts/check-admin-schema-safety.mjs";
if (packageJson.scripts?.["admin:schema-safety:check"] !== expectedCommand) {
  errors.push(`package.json must expose admin:schema-safety:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run admin:schema-safety:check")) {
  errors.push("check:local must include admin:schema-safety:check");
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "authenticated-schema-names-only",
  rawSqlExposed: false,
  rowDataExposed: false,
  secretsExposed: false,
  mutatesData: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
