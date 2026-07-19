#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const indexPath = path.join(root, "src", "index.ts");
const source = fs.readFileSync(indexPath, "utf8");
const errors = [];

function position(token) {
  const index = source.indexOf(token);
  if (index < 0) errors.push(`Missing route dispatcher token: ${token}`);
  return index;
}

function before(earlier, later, reason) {
  const earlierIndex = position(earlier);
  const laterIndex = position(later);
  if (earlierIndex >= 0 && laterIndex >= 0 && earlierIndex >= laterIndex) {
    errors.push(`${reason}: ${earlier} must appear before ${later}`);
  }
}

const fetchStart = position("async fetch(req: Request, env: Env, ctx: any): Promise<Response>");
const health = position('if (pathname === "/health") return await handleHealth(env);');
if (fetchStart >= 0 && health >= 0 && health < fetchStart) errors.push("Health route must be inside the fetch dispatcher");

before('if (pathname === "/health") return await handleHealth(env);', 'if (pathname.startsWith("/admin"))', "Unauthenticated health must be resolved before admin fallbacks");
before('if (pathname === "/admin/opportunities/run-due")', 'if (pathname.startsWith("/admin/opportunities"))', "Specific opportunity command routing");
before('if (isOpportunityRunAuditPath(pathname))', 'if (pathname.startsWith("/admin/opportunities"))', "Opportunity run audit routing");
before('if (isOpportunitySourceHealthActionPath(pathname))', 'if (pathname.startsWith("/admin/opportunities"))', "Opportunity source health action routing");
before('if (isSourceExpansionPath(pathname))', 'if (pathname.startsWith("/admin/opportunities"))', "Source expansion routing");
before('if (isOpportunityReviewPath(pathname))', 'if (pathname.startsWith("/admin/opportunities"))', "Opportunity review routing");
before('if (pathname === "/admin/planner/routes")', 'if (pathname === "/admin/planner" || pathname.startsWith("/admin/planner/"))', "Planner route catalogue routing");
before('if (pathname === "/admin/growth/approval-requests"', 'if (pathname === "/admin/growth" || pathname.startsWith("/admin/growth/"))', "Growth approval routing");
before('if (pathname === "/admin/growth/capabilities")', 'if (pathname === "/admin/growth" || pathname.startsWith("/admin/growth/"))', "Growth capabilities routing");
before('if (pathname === "/admin/growth/blackboard"', 'if (pathname === "/admin/growth" || pathname.startsWith("/admin/growth/"))', "Growth blackboard routing");
before('if (pathname === "/admin/growth/strategy-memory"', 'if (pathname === "/admin/growth" || pathname.startsWith("/admin/growth/"))', "Growth strategy routing");
before('if (pathname === "/admin/growth/autonomy"', 'if (pathname === "/admin/growth" || pathname.startsWith("/admin/growth/"))', "Growth campaign intelligence routing");
before('if (pathname === "/admin/business/people")', 'if (pathname === "/admin/business" || pathname.startsWith("/admin/business/"))', "Business people routing");
before('if (isBusinessWebsitePath(pathname))', 'if (pathname === "/admin/business" || pathname.startsWith("/admin/business/"))', "Business website routing");
before('if (pathname === "/admin/sources/run-tiny")', 'if (pathname.startsWith("/admin/sources")', "Source batch routing");
before('if (pathname.startsWith("/admin/draft-review")', 'if (pathname.startsWith("/admin"))', "Draft review routing");
before('if (pathname.startsWith("/admin"))', 'if (pathname.startsWith("/tools"))', "Admin fallback must not absorb non-admin route families");
before('if (pathname.startsWith("/tools"))', 'if (pathname.startsWith("/public"))', "Tool and public route families remain explicit");
before('if (pathname.startsWith("/public"))', 'if (pathname === "/" || pathname === "")', "Root fallback must follow public routing");
before('if (pathname === "/" || pathname === "")', 'return jsonResponse({ ok: false, error: "not_found" }', "Not-found response must remain last");

const broadFallbacks = [
  'pathname.startsWith("/admin/opportunities")',
  'pathname === "/admin/growth" || pathname.startsWith("/admin/growth/")',
  'pathname === "/admin/business" || pathname.startsWith("/admin/business/")',
  'pathname.startsWith("/admin")',
  'pathname.startsWith("/tools")',
  'pathname.startsWith("/public")',
];
for (const token of broadFallbacks) {
  const occurrences = source.split(token).length - 1;
  if (occurrences !== 1) errors.push(`Broad route fallback must appear exactly once: ${token} (${occurrences})`);
}

const report = {
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "worker-route-precedence",
  guardedRouteFamilies: ["health", "opportunities", "planner", "growth", "business", "sources", "admin", "tools", "public", "root"],
  errors,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
