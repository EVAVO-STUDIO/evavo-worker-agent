#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const policy = fs.readFileSync(path.join(root, "src/routes/workerRoutePolicy.ts"), "utf8");
const dispatcher = fs.readFileSync(path.join(root, "src/index.ts"), "utf8");
const errors = [];

const expected = [
  { id: "health", exposure: "public", authentication: "none", mutation: "read-only", priority: 10 },
  { id: "admin", exposure: "protected", authentication: "handler-enforced", mutation: "mixed-internal", priority: 20 },
  { id: "tools", exposure: "protected", authentication: "handler-enforced", mutation: "mixed-internal", priority: 30 },
  { id: "public", exposure: "public", authentication: "none", mutation: "read-only", priority: 40 },
  { id: "root", exposure: "public", authentication: "none", mutation: "read-only", priority: 50 },
];

for (const item of expected) {
  for (const token of [
    `id: "${item.id}"`,
    `exposure: "${item.exposure}"`,
    `authentication: "${item.authentication}"`,
    `mutationPosture: "${item.mutation}"`,
    `priority: ${item.priority}`,
    `matchesWorkerRouteFamily("${item.id}", pathname)`,
  ]) {
    if (!(policy + dispatcher).includes(token)) errors.push(`Missing route policy contract token: ${token}`);
  }

  const dispatchToken = `matchesWorkerRouteFamily("${item.id}", pathname)`;
  const occurrences = dispatcher.split(dispatchToken).length - 1;
  if (occurrences !== 1) errors.push(`Route family must be dispatched exactly once: ${item.id} (${occurrences})`);
}

for (const token of [
  'export type WorkerRouteFamilyId = "health" | "admin" | "tools" | "public" | "root"',
  "WORKER_ROUTE_FAMILY_POLICIES",
  "getWorkerRouteFamilyPolicy",
  "matchesWorkerRouteFamily",
  'matches: (pathname: string) => pathname === "/health"',
  'matches: (pathname: string) => pathname.startsWith("/admin")',
  'matches: (pathname: string) => pathname.startsWith("/tools")',
  'matches: (pathname: string) => pathname.startsWith("/public")',
  'matches: (pathname: string) => pathname === "/" || pathname === ""',
]) {
  if (!policy.includes(token)) errors.push(`Missing typed route policy implementation: ${token}`);
}

const priorities = [...policy.matchAll(/priority:\s*(\d+)/g)].map((match) => Number(match[1]));
if (priorities.length !== expected.length) errors.push(`Expected ${expected.length} route priorities, received ${priorities.length}`);
if (new Set(priorities).size !== priorities.length) errors.push("Worker route policy priorities must be unique");
for (let index = 1; index < priorities.length; index += 1) {
  if (priorities[index] <= priorities[index - 1]) errors.push("Worker route policy priorities must be strictly increasing");
}

const healthPosition = dispatcher.indexOf('matchesWorkerRouteFamily("health", pathname)');
const adminPosition = dispatcher.indexOf('matchesWorkerRouteFamily("admin", pathname)');
const toolsPosition = dispatcher.indexOf('matchesWorkerRouteFamily("tools", pathname)');
const publicPosition = dispatcher.indexOf('matchesWorkerRouteFamily("public", pathname)');
const rootPosition = dispatcher.indexOf('matchesWorkerRouteFamily("root", pathname)');
const notFoundPosition = dispatcher.indexOf('return jsonResponse({ ok: false, error: "not_found" }');
if (!(healthPosition >= 0 && healthPosition < adminPosition && adminPosition < toolsPosition && toolsPosition < publicPosition && publicPosition < rootPosition && rootPosition < notFoundPosition)) {
  errors.push("Typed route-family dispatch order must remain health, admin, tools, public, root, not-found");
}

for (const unsafe of [
  'id: "health",\n    exposure: "protected"',
  'id: "public",\n    exposure: "protected"',
  'id: "admin",\n    authentication: "none"',
  'id: "tools",\n    authentication: "none"',
  'id: "health",\n    mutationPosture: "mixed-internal"',
  'id: "public",\n    mutationPosture: "mixed-internal"',
]) {
  if (policy.includes(unsafe)) errors.push(`Unsafe route-family policy detected: ${unsafe.replaceAll("\n", " ")}`);
}

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "typed-worker-route-policy",
  routeFamilies: expected.map((item) => item.id),
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
