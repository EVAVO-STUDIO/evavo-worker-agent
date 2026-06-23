export type OpportunityEvidence = {
  sourceUrl: string;
  linkText: string;
  nearbyText: string;
  matchedTerms: string[];
  detectedDeadlineText?: string;
  detectedValueText?: string;
  disqualifierText?: string;
};

export type OpportunityScoreBreakdown = {
  typeScore: number;
  intentScore: number;
  sourceAuthorityScore: number;
  evavoFitScore: number;
  urgencyScore: number;
  valueScore: number;
  effortScore: number;
  riskPenalty: number;
  learningAdjustment: number;
  total: number;
};

export type OpportunityCandidate = {
  url: string;
  title: string;
  opportunityType: string;
  score: number;
  confidence: "low" | "medium" | "high";
  signals: string[];
  recommendedAction: string;
  evidence?: OpportunityEvidence;
  scoreBreakdown?: OpportunityScoreBreakdown;
};

const TYPE_SIGNALS: Array<{ type: string; score: number; terms: string[] }> = [
  { type: "government_grant", score: 32, terms: ["grant", "funding", "voucher", "rebate", "business support", "innovation fund"] },
  { type: "tender", score: 34, terms: ["tender", "procurement", "supplier panel", "request for tender", "rft", "rfq", "request for quote"] },
  { type: "rfp_or_eoi", score: 32, terms: ["request for proposal", "rfp", "expression of interest", "eoi", "invitation to quote"] },
  { type: "agency_partner", score: 34, terms: ["white label", "overflow", "contract developer", "digital partner", "agency partner", "implementation partner"] },
  { type: "tech_help_needed", score: 30, terms: ["website redesign", "website redevelopment", "new website", "web developer", "wordpress help", "shopify help", "technical support", "digital transformation"] },
  { type: "contract_role_signal", score: 22, terms: ["digital producer", "web producer", "front end", "frontend", "ux designer", "web designer", "contract role"] },
  { type: "partnership_opening", score: 24, terms: ["partner with us", "partnership", "sponsorship", "collaboration", "vendor", "suppliers", "become a supplier"] },
  { type: "award_or_accelerator", score: 18, terms: ["award", "accelerator", "incubator", "challenge", "startup program"] },
];

const NEGATIVE_TERMS = ["privacy policy", "terms of use", "login", "sign in", "cookie", "accessibility", "subscribe", "newsletter", "media release", "annual report"];
const DISQUALIFIER_TERMS = ["closed", "applications closed", "expired", "students only", "not accepting", "archived", "past event"];
const HIGH_INTENT_TERMS = ["closes", "closing date", "applications close", "apply now", "submit proposal", "register interest", "request a quote", "funding available", "seeking", "looking for", "needed", "required", "suppliers wanted", "open now"];
const EVAVO_FIT_TERMS = ["website", "web app", "app", "digital", "ux", "ui", "automation", "ecommerce", "e-commerce", "platform", "portal", "interactive", "3d", "ar", "vr", "ai", "chatbot", "software"];
const VALUE_TERMS = ["funding", "grant", "$", "aud", "budget", "contract", "tender", "procurement"];
const DEADLINE_PATTERN = /(closes?\s+[^.]{0,80}|closing date\s+[^.]{0,80}|applications close\s+[^.]{0,80}|deadline\s+[^.]{0,80})/i;
const VALUE_PATTERN = /(\$\s?[0-9][0-9,]*(?:\.[0-9]+)?|AUD\s?[0-9][0-9,]*|funding\s+(?:of|up to)?\s?\$?\s?[0-9][0-9,]*)/i;

function normalizeText(value: string): string {
  return value.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: string, terms: string[]): string[] {
  const haystack = text.toLowerCase();
  return terms.filter((term) => haystack.includes(term.toLowerCase()));
}

function confidenceFor(score: number): "low" | "medium" | "high" {
  if (score >= 65) return "high";
  if (score >= 38) return "medium";
  return "low";
}

function actionFor(type: string, score: number): string {
  if (score >= 70) return type === "government_grant" ? "shortlist_and_check_eligibility" : "shortlist_and_prepare_response";
  if (score >= 45) return "watch_and_investigate";
  return "keep_as_low_priority_signal";
}

function absoluteUrl(href: string, baseUrl: string): string | null {
  try {
    const url = new URL(href, baseUrl);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function nearbyText(html: string, startIndex: number, endIndex: number): string {
  const before = html.slice(Math.max(0, startIndex - 700), startIndex);
  const after = html.slice(endIndex, Math.min(html.length, endIndex + 900));
  return normalizeText(`${before} ${after}`).slice(0, 1400);
}

function firstPattern(text: string, pattern: RegExp): string | undefined {
  const match = text.match(pattern);
  return match?.[0]?.replace(/\s+/g, " ").trim().slice(0, 160);
}

function scoreCandidate(title: string, url: string, sourceUrl: string, contextText: string): OpportunityCandidate | null {
  const combined = `${title} ${url} ${contextText}`;
  const negativeMatches = includesAny(`${title} ${url}`, NEGATIVE_TERMS);
  if (negativeMatches.length > 0) return null;

  let opportunityType = "unknown";
  let typeScore = 0;
  const signals: string[] = [];
  const matchedTerms: string[] = [];

  for (const bucket of TYPE_SIGNALS) {
    const matches = includesAny(combined, bucket.terms);
    if (!matches.length) continue;
    const bucketScore = bucket.score + Math.min(20, matches.length * 6);
    if (bucketScore > typeScore) {
      opportunityType = bucket.type;
      typeScore = bucketScore;
    }
    matchedTerms.push(...matches);
    signals.push(...matches.map((match) => `${bucket.type}:${match}`));
  }

  const highIntent = includesAny(combined, HIGH_INTENT_TERMS);
  const evavoFit = includesAny(combined, EVAVO_FIT_TERMS);
  const valueTerms = includesAny(combined, VALUE_TERMS);
  const disqualifiers = includesAny(combined, DISQUALIFIER_TERMS);
  const sourceAuthorityScore = /\.gov\.au|grants?|tenders?|procurement|business\.gov\.au/i.test(url) || /\.gov\.au|business\.gov\.au/i.test(sourceUrl) ? 10 : 0;
  const intentScore = Math.min(24, highIntent.length * 8);
  const evavoFitScore = Math.min(18, evavoFit.length * 4);
  const valueScore = valueTerms.length ? 8 : 0;
  const urgencyScore = highIntent.some((term) => /close|deadline/i.test(term)) ? 6 : 0;
  const effortScore = opportunityType === "tender" || opportunityType === "rfp_or_eoi" ? 6 : 0;
  const riskPenalty = Math.min(24, disqualifiers.length * 12);

  if (highIntent.length) signals.push(...highIntent.map((match) => `intent:${match}`));
  if (evavoFit.length) signals.push(...evavoFit.map((match) => `evavo_fit:${match}`));
  if (valueTerms.length) signals.push(...valueTerms.map((match) => `value:${match}`));
  if (disqualifiers.length) signals.push(...disqualifiers.map((match) => `risk:${match}`));

  if (/jobs|careers|work-with-us|join-us/i.test(url) && opportunityType === "unknown") {
    opportunityType = "contract_role_signal";
    typeScore = Math.max(typeScore, 18);
    signals.push("path:jobs_or_careers");
  }

  const learningAdjustment = 0;
  let score = typeScore + intentScore + sourceAuthorityScore + evavoFitScore + valueScore + urgencyScore - effortScore - riskPenalty + learningAdjustment;
  if (score < 18) return null;
  score = Math.max(0, Math.min(100, score));

  const evidence: OpportunityEvidence = {
    sourceUrl,
    linkText: title,
    nearbyText: contextText.slice(0, 1000),
    matchedTerms: Array.from(new Set([...matchedTerms, ...highIntent, ...evavoFit, ...valueTerms])).slice(0, 24),
    detectedDeadlineText: firstPattern(combined, DEADLINE_PATTERN),
    detectedValueText: firstPattern(combined, VALUE_PATTERN),
    disqualifierText: disqualifiers.length ? disqualifiers.join(", ") : undefined,
  };

  const scoreBreakdown: OpportunityScoreBreakdown = {
    typeScore,
    intentScore,
    sourceAuthorityScore,
    evavoFitScore,
    urgencyScore,
    valueScore,
    effortScore,
    riskPenalty,
    learningAdjustment,
    total: score,
  };

  return {
    url,
    title: title || url,
    opportunityType,
    score,
    confidence: confidenceFor(score),
    signals: Array.from(new Set(signals)).slice(0, 24),
    recommendedAction: actionFor(opportunityType, score),
    evidence,
    scoreBreakdown,
  };
}

export function extractOpportunityCandidates(html: string, sourceUrl: string, limit = 50): OpportunityCandidate[] {
  const anchorRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const seen = new Set<string>();
  const candidates: OpportunityCandidate[] = [];
  let match: RegExpExecArray | null;

  while ((match = anchorRegex.exec(html)) !== null && seen.size < 800) {
    const url = absoluteUrl(match[1], sourceUrl);
    const title = normalizeText(match[2]);
    if (!url || seen.has(url) || !title || title.length < 3) continue;
    seen.add(url);
    const context = nearbyText(html, match.index, match.index + match[0].length);
    const candidate = scoreCandidate(title, url, sourceUrl, context);
    if (candidate) candidates.push(candidate);
  }

  return candidates.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title)).slice(0, Math.max(1, Math.min(100, limit)));
}

export function summarizeOpportunityPreview(candidates: OpportunityCandidate[]) {
  const byType = candidates.reduce<Record<string, number>>((acc, candidate) => {
    acc[candidate.opportunityType] = (acc[candidate.opportunityType] || 0) + 1;
    return acc;
  }, {});

  return {
    total: candidates.length,
    highConfidence: candidates.filter((candidate) => candidate.confidence === "high").length,
    mediumConfidence: candidates.filter((candidate) => candidate.confidence === "medium").length,
    byType,
    topScore: candidates[0]?.score || 0,
  };
}
