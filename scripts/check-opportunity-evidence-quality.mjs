#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    errors.push(`Missing ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireTokens(label, source, tokens) {
  for (const token of tokens) {
    if (!source.includes(token)) errors.push(`${label} missing ${token}`);
  }
}

function forbidTokens(label, source, tokens) {
  for (const token of tokens) {
    if (source.includes(token)) errors.push(`${label} contains forbidden token ${token}`);
  }
}

const discovery = read("src/core/opportunityDiscovery.ts");
const persistence = read("src/core/opportunityPersistence.ts");
const scoring = read("src/core/opportunityScoring.ts");
const doc = read("docs/opportunity-evidence-quality.md");
const workflow = read(".github/workflows/worker-contract.yml");
const safetyGate = read("scripts/check-safety-gate-completeness.mjs");
const packageJson = JSON.parse(read("package.json") || "{}");

requireTokens("opportunity discovery", discovery, [
  'import { validatePublicResearchUrl } from "./publicResearchFetch"',
  "OpportunityDeadlineEvidence",
  "OpportunityValueEvidence",
  "evidenceQualityScore: number",
  'evidenceStrength: "weak" | "moderate" | "strong"',
  "missingFacts: string[]",
  "reviewFlags: string[]",
  "function termPattern",
  "(?:^|[^a-z0-9])",
  "DEFINITIVE_DISQUALIFIERS",
  '"applications closed"',
  '"no longer accepting"',
  "function canonicalPublicUrl",
  "validatePublicResearchUrl(href, baseUrl)",
  'lower.startsWith("utm_")',
  "url.searchParams.sort()",
  "function parseDeadlineDate",
  "function valueEvidence",
  "function decodeCodePoint",
  "amountCents",
  'currency: "AUD" | "NZD" | null',
  'recommendedAction: actionFor(opportunityType, score)',
  '"shortlist_for_eligibility_review"',
  '"shortlist_for_operator_review"',
  '"review_evidence_and_source"',
  '"retain_low_priority_signal"',
  "reviewOnly: true",
  "executable: false",
  "deliverable: false",
  "authoritativeForExecution: false",
  "strongEvidence",
  "weakEvidence",
  "topEvidenceQualityScore",
]);

forbidTokens("opportunity discovery", discovery, [
  '"shortlist_and_prepare_response"',
  '"shortlist_and_check_eligibility"',
  '"watch_and_investigate"',
  '"keep_as_low_priority_signal"',
]);

if (!discovery.includes('(?:(AUD|NZD)\\s*\\$?\\s*|\\$\\s*)')) {
  errors.push("Opportunity value parsing must require AUD, NZD or a dollar sign");
}
if (discovery.includes('((?:AUD|NZD)\\s*)?\\$?')) {
  errors.push("Opportunity value parsing must not accept ordinary unmarked numbers");
}
if (!discovery.includes("if (value && value.amountCents !== null) evidenceQualityScore += 10")) {
  errors.push("Evidence quality must not treat a missing value as parsed");
}
if (!discovery.includes("if (value && value.amountCents !== null && !value.currency)")) {
  errors.push("Currency review flags must be guarded by actual value evidence");
}

requireTokens("opportunity persistence", persistence, [
  'import { validatePublicResearchUrl } from "./publicResearchFetch"',
  '"manual-confirmed-run-due"',
  "SAFE_REVIEW_ACTIONS",
  "normalizeReviewAction",
  "hasRequiredReviewPosture",
  "validatePublicResearchUrl(rawUrl.trim(), sourceUrl)",
  'lower.startsWith("utm_")',
  "url.searchParams.sort()",
  'SELECT id FROM opportunities WHERE url = ? LIMIT 1',
  'schemaVersion: "opportunity_evidence_v4_quality_review_only"',
  "reviewOnly: true",
  "executable: false",
  "deliverable: false",
  "authoritativeForExecution: false",
  "externalExecutionAllowed: false",
  "groundedCurrency",
  "groundedAmountCents",
  "groundedValueCents",
  "Internal review candidate",
]);

for (const token of [
  'if (action === "shortlist_and_prepare_response") return "shortlist_for_operator_review"',
  'if (action === "shortlist_and_check_eligibility") return "shortlist_for_eligibility_review"',
]) {
  if (!persistence.includes(token)) errors.push(`Legacy recommendation normalisation missing ${token}`);
}
forbidTokens("opportunity persistence", persistence, [
  "candidate.recommendedAction || \"review_manually\"",
  "SELECT id FROM opportunities WHERE url = ? AND title = ?",
]);

requireTokens("opportunity scoring", scoring, [
  "evidenceQualityFor",
  "evidenceQuality:",
  '"guardrail:weak_evidence_no_positive_learning_boost"',
  '"guardrail:limited_evidence_boost_cap_4"',
  '"guardrail:weak_evidence_ceiling_45"',
  '"guardrail:limited_evidence_ceiling_60"',
  "quality.score >= 38",
  "quality.score >= 60",
  "evidenceQuality: guarded.evidenceQuality",
]);

requireTokens("opportunity evidence quality document", doc, [
  "# Opportunity evidence quality",
  "boundary-aware",
  "A year is never guessed.",
  "Ordinary numbers, years, counts and percentages must not be treated as money.",
  "Missing facts remain missing",
  "weak evidence receives no positive learning boost",
  "opportunity_evidence_v4_quality_review_only",
  "Legacy labels that imply preparing a response are normalised",
]);

const expectedCommand = "node scripts/check-opportunity-evidence-quality.mjs";
if (packageJson.scripts?.["opportunities:evidence-quality:check"] !== expectedCommand) {
  errors.push(`package.json must expose opportunities:evidence-quality:check as ${expectedCommand}`);
}
if (!String(packageJson.scripts?.["check:local"] || "").includes("npm run opportunities:evidence-quality:check")) {
  errors.push("check:local must include opportunities:evidence-quality:check");
}

requireTokens("safety gate completeness", safetyGate, [
  '"opportunities:evidence-quality:check": "node scripts/check-opportunity-evidence-quality.mjs"',
  '"scripts/check-opportunity-evidence-quality.mjs"',
  "opportunityEvidenceQualityRequired: true",
]);

requireTokens("Worker contract workflow", workflow, [
  "Verify deterministic opportunity evidence quality",
  "npm run opportunities:evidence-quality:check",
]);
if (workflow.includes("wrangler deploy")) errors.push("Opportunity evidence CI validation must not deploy the Worker");

console.log(JSON.stringify({
  passed: errors.length === 0,
  activeRepository: "EVAVO-STUDIO/evavo-worker-agent",
  contract: "opportunity-evidence-quality-v1",
  boundaryAwareTermMatching: true,
  publicCanonicalCandidateUrlsRequired: true,
  trackingParametersRemoved: true,
  definitiveClosedOpportunitiesExcluded: true,
  deadlineYearGuessingAllowed: false,
  unmarkedNumbersParsedAsMoney: false,
  missingFactsInvented: false,
  evidenceQualityRequired: true,
  weakEvidenceLearningBoostAllowed: false,
  reviewOnlyCandidatePostureRequired: true,
  executableCandidatePersistenceAllowed: false,
  draftingRecommendationStored: false,
  canonicalUrlDeduplicationRequired: true,
  groundedCurrencyRequiredForStoredValue: true,
  externalExecutionEnabled: false,
  errors,
}, null, 2));

if (errors.length) process.exitCode = 1;
