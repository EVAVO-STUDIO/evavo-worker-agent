#!/usr/bin/env node

const target = process.argv[2] === "remote" ? "remote" : "local";

console.error(JSON.stringify({
  ok: false,
  error: "legacy_schema_initialization_disabled",
  target,
  reason: "schema.sql is a historical bootstrap reference and is not sufficient for the current migrated Worker schema.",
  safeNextSteps: [
    "npm run db:migrations:check",
    "npm run db:migrations:print",
    "Review migrations/README.md",
    "Apply individual migrations deliberately with npm run db:migration:one -- <id> --execute",
  ],
  remoteDatabaseMustNotBeReset: true,
}, null, 2));

process.exitCode = 1;
