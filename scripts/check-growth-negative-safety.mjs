#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const scanRoots = [path.join(root, "src", "routes"), path.join(root, "src", "core")];
const files = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(absolute);
    else if (entry.isFile() && /^growth.*\.ts$/i.test(entry.name)) files.push(absolute);
  }
}

for (const directory of scanRoots) walk(directory);

const forbiddenCapabilityTokens = [
  "canSendEmail: true",
  "canPostSocial: true",
  "canSubmitForms: true",
];

const forbidden = [
  { pattern: /canSendEmail\s*:\s*true/g, reason: "Growth routes must never enable email sending" },
  { pattern: /canPostSocial\s*:\s*true/g, reason: "Growth routes must never enable social posting" },
  { pattern: /canSubmitForms\s*:\s*true/g, reason: "Growth routes must never enable form submission" },
  { pattern: /sendsEmail\s*:\s*true/g, reason: "Growth route evidence must never claim email sending" },
  { pattern: /postsPublicly\s*:\s*true/g, reason: "Growth route evidence must never claim public posting" },
  { pattern: /submitsForms\s*:\s*true/g, reason: "Growth route evidence must never claim form submission" },
  { pattern: /externalStateChange\s*:\s*true/g, reason: "Growth routes must not mutate external systems" },
  { pattern: /(?:MAILCHANNELS_API_KEY|FROM_EMAIL|REPLY_TO_EMAIL)/g, reason: "Growth code must not access outbound email credentials" },
  { pattern: /fetch\s*\(\s*["'`](?:https?:)?\/\//g, reason: "Growth code must not make direct external HTTP calls" },
  { pattern: /must\s+be\s+browser-proxied/gi, reason: "Growth mutation routes must not be exposed through browser proxies" },
];

const violations = [];
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file).replaceAll(path.sep, "/");
  for (const rule of forbidden) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(source))) {
      const line = source.slice(0, match.index).split(/\r?\n/).length;
      violations.push({ file: relative, line, token: match[0], reason: rule.reason });
    }
  }
}

const requiredFiles = [
  "src/routes/growthAdmin.ts",
  "src/routes/growthCapabilitiesAdmin.ts",
  "src/routes/growthCampaignIntelligenceAdmin.ts",
  "src/routes/growthStrategyMemoryAdmin.ts",
  "src/routes/growthBlackboardAdmin.ts",
  "src/core/growthOperatorLoop.ts",
];
for (const relative of requiredFiles) {
  if (!fs.existsSync(path.join(root, relative))) violations.push({ file: relative, line: 0, token: "missing", reason: "Required Growth safety surface is missing" });
}

console.log(JSON.stringify({
  passed: violations.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "growth-negative-safety-scan",
  forbiddenCapabilityTokens,
  checkedFiles: files.map((file) => path.relative(root, file).replaceAll(path.sep, "/")),
  guarantees: [
    "no email sending",
    "no social posting",
    "no form submission",
    "no direct external state mutation",
    "no outbound email credential access",
    "no browser-proxied mutation instruction",
  ],
  violations,
}, null, 2));

if (violations.length) process.exitCode = 1;
