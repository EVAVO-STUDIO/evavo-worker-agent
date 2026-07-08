import { Env } from "../db";
import { listBusinessSignals } from "./businessAutopilotRecords";
import { businessAutopilotReadSafety } from "./businessAutopilotSafety";
import {
  listBusinessAuditObservations,
  listBusinessPages,
  listBusinessWebsiteAuditRuns,
  listBusinessWebsites,
} from "./businessAutopilotWebsiteRecords";

export type BusinessAuditObservationCandidate = {
  id: string;
  websiteId?: string | null;
  organizationId?: string | null;
  pageId?: string | null;
  signalId?: string | null;
  auditRunId?: string | null;
  category: string;
  severity: string;
  title: string;
  evidenceSummary: string;
  recommendation: string;
  confidenceScore: number;
  source: "internal_metadata";
  safetyNote: string;
};

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function score(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, Math.round(parsed))) : fallback;
}

function normalizeDomain(value?: string | null) {
  if (!value) return "";
  return value.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
}

function sameWebsite(left: any, right: any) {
  if (left?.websiteId && right?.id && left.websiteId === right.id) return true;
  if (left?.organizationId && right?.organizationId && left.organizationId === right.organizationId) return true;
  const leftDomain = normalizeDomain(left?.domain || left?.url || left?.evidenceUrl);
  const rightDomain = normalizeDomain(right?.domain || right?.url);
  return Boolean(leftDomain && rightDomain && leftDomain === rightDomain);
}

function hasObservationFor(records: any[], candidate: Partial<BusinessAuditObservationCandidate>) {
  return records.some((record) => {
    if (candidate.signalId && record?.signalId === candidate.signalId) return true;
    if (candidate.pageId && record?.pageId === candidate.pageId && record?.category === candidate.category) return true;
    if (candidate.auditRunId && record?.auditRunId === candidate.auditRunId && record?.category === candidate.category) return true;
    if (candidate.websiteId && record?.websiteId === candidate.websiteId && record?.category === candidate.category) return true;
    return false;
  });
}

function candidateFromSignal(signal: any, website: any, page: any): BusinessAuditObservationCandidate {
  const signalType = text(signal?.signalType, "evidence");
  const strength = score(signal?.signalStrength, 50);
  return {
    id: `signal:${signal?.id || website?.id || page?.id || signalType}`,
    websiteId: signal?.websiteId || website?.id || null,
    organizationId: signal?.organizationId || website?.organizationId || page?.organizationId || null,
    pageId: signal?.pageId || page?.id || null,
    signalId: signal?.id || null,
    auditRunId: null,
    category: signalType,
    severity: strength >= 75 ? "high" : strength >= 45 ? "medium" : "info",
    title: `Review ${signalType} evidence`,
    evidenceSummary: text(signal?.evidenceSummary, "Internal evidence signal exists but needs a clearer observation summary."),
    recommendation: "Decide whether this signal should become an audit observation, audit pack item or no-op learning note.",
    confidenceScore: score(signal?.confidenceScore, Math.max(35, strength)),
    source: "internal_metadata",
    safetyNote: "Derived from stored internal metadata only; no fetch, crawl, AI call, send, post, form submission, browser automation or external mutation is performed.",
  };
}

function candidateFromAuditRun(run: any, website: any): BusinessAuditObservationCandidate {
  const readiness = score(run?.readinessScore, 0);
  const risk = score(run?.riskScore, 0);
  const category = risk >= 65 ? "risk" : "audit_readiness";
  return {
    id: `audit-run:${run?.id || website?.id || category}`,
    websiteId: run?.websiteId || website?.id || null,
    organizationId: run?.organizationId || website?.organizationId || null,
    pageId: null,
    signalId: null,
    auditRunId: run?.id || null,
    category,
    severity: risk >= 65 ? "high" : readiness >= 60 ? "medium" : "info",
    title: risk >= 65 ? "Review website audit risk" : "Review website audit readiness",
    evidenceSummary: text(run?.summary, `Stored audit run metadata is available with readiness ${readiness} and risk ${risk}.`),
    recommendation: risk >= 65 ? "Check whether the risk should suppress, delay or reshape the review path." : "Convert useful run metadata into concrete audit observations before drafting.",
    confidenceScore: score(run?.confidenceScore, Math.max(readiness, 40)),
    source: "internal_metadata",
    safetyNote: "Derived from stored internal metadata only; no fetch, crawl, AI call, send, post, form submission, browser automation or external mutation is performed.",
  };
}

function pageBelongsToWebsite(page: any, website: any) {
  if (page?.websiteId && page.websiteId === website?.id) return true;
  if (page?.organizationId && website?.organizationId && page.organizationId === website.organizationId) return true;
  const websiteUrl = text(website?.url, "");
  return Boolean(websiteUrl && typeof page?.url === "string" && page.url.startsWith(websiteUrl));
}

export async function buildBusinessAuditObservationCandidates(env: Env, limit = 25) {
  const safeLimit = Math.max(1, Math.min(50, Math.round(Number(limit) || 25)));
  const [websites, pages, signals, auditRuns, observations] = await Promise.all([
    listBusinessWebsites(env, 100),
    listBusinessPages(env, 100),
    listBusinessSignals(env, 100),
    listBusinessWebsiteAuditRuns(env, 100),
    listBusinessAuditObservations(env, 100),
  ]);

  const candidates: BusinessAuditObservationCandidate[] = [];

  for (const website of websites) {
    const websitePages = pages.filter((page) => pageBelongsToWebsite(page, website));
    const websiteSignals = signals.filter((signal) => sameWebsite(signal, website) || websitePages.some((page) => signal?.pageId && signal.pageId === page.id));
    const websiteAuditRuns = auditRuns.filter((run) => sameWebsite(run, website));

    for (const signal of websiteSignals) {
      const page = websitePages.find((item) => item?.id && item.id === signal?.pageId);
      const candidate = candidateFromSignal(signal, website, page);
      if (!hasObservationFor(observations, candidate)) candidates.push(candidate);
    }

    for (const run of websiteAuditRuns) {
      const candidate = candidateFromAuditRun(run, website);
      if (!hasObservationFor(observations, candidate)) candidates.push(candidate);
    }

    if (websitePages.length === 0 && !hasObservationFor(observations, { websiteId: website?.id, category: "page_coverage" })) {
      candidates.push({
        id: `page-coverage:${website?.id || website?.domain || website?.url}`,
        websiteId: website?.id || null,
        organizationId: website?.organizationId || null,
        pageId: null,
        signalId: null,
        auditRunId: null,
        category: "page_coverage",
        severity: "medium",
        title: "Review missing page coverage",
        evidenceSummary: "Website metadata exists but no structured page rows are linked yet.",
        recommendation: "Add page metadata before treating this website as audit-ready.",
        confidenceScore: 55,
        source: "internal_metadata",
        safetyNote: "Derived from stored internal metadata only; no fetch, crawl, AI call, send, post, form submission, browser automation or external mutation is performed.",
      });
    }
  }

  return candidates
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
    .slice(0, safeLimit);
}

export function businessAuditObservationCandidatePayload(candidates: BusinessAuditObservationCandidate[]) {
  return {
    ok: true,
    observationCandidates: candidates,
    count: candidates.length,
    mode: "business_audit_observation_candidates",
    reviewOnly: true,
    safety: businessAutopilotReadSafety(),
  };
}
