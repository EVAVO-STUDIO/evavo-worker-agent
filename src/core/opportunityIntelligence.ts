export type OpportunityRadarType =
  | "government_grant"
  | "government_tender"
  | "rfp"
  | "agency_white_label"
  | "partner_request"
  | "job_portal_outsource_signal"
  | "forum_help_request"
  | "construction_brand_web_need"
  | "business_website_pain"
  | "award_or_accelerator"
  | "unknown";

export type OpportunityRadarInput = {
  url?: string;
  title?: string;
  text?: string;
  sourceType?: string;
  country?: string;
  region?: string;
  category?: string;
};

export type OpportunityRadarScore = {
  type: OpportunityRadarType;
  recommendedAction: "ignore" | "watch" | "shortlist" | "investigate" | "draft_enquiry" | "apply_or_bid";
  totalScore: number;
  fitScore: number;
  urgencyScore: number;
  valueScore: number;
  effortScore: number;
  riskScore: number;
  confidence: "low" | "medium" | "high";
  positiveSignals: string[];
  negativeSignals: string[];
  evidence: string[];
  safety: {
    callsAI: false;
    sendsEmail: false;
    writesToDatabase: false;
    networkFetch: false;
  };
};

type Profile = {
  type: OpportunityRadarType;
  label: string;
  strong: string[];
  medium: string[];
  weak: string[];
  negative: string[];
  baseFit: number;
  baseValue: number;
  baseEffort: number;
  baseRisk: number;
};

export const opportunityRadarProfiles: Profile[] = [
  {
    type: "government_grant",
    label: "Government grant / funding",
    strong: ["grant", "funding", "rebate", "voucher", "program funding", "business grant", "digital grant", "innovation grant"],
    medium: ["government", "business.gov", "council", "state government", "federal", "small business", "applications close", "eligibility"],
    weak: ["round", "stream", "matched funding", "recipient", "guidelines"],
    negative: ["closed", "not accepting", "expired", "archive only", "past round"],
    baseFit: 75,
    baseValue: 85,
    baseEffort: 55,
    baseRisk: 25,
  },
  {
    type: "government_tender",
    label: "Government tender / procurement",
    strong: ["tender", "procurement", "request for tender", "rfq", "supplier panel", "supplier", "tenders"],
    medium: ["digital", "website", "brand", "marketing", "creative", "development", "crm", "portal", "supplier response"],
    weak: ["closing date", "contract", "scope", "evaluation criteria", "statement of requirements"],
    negative: ["materials only", "site works only", "mandatory visit passed", "closed"],
    baseFit: 65,
    baseValue: 90,
    baseEffort: 75,
    baseRisk: 45,
  },
  {
    type: "rfp",
    label: "Private RFP / brief request",
    strong: ["rfp", "request for proposal", "seeking proposals", "looking for a vendor", "expression of interest", "eoi"],
    medium: ["website redesign", "brand refresh", "digital product", "web app", "marketing site", "agency partner", "quote"],
    weak: ["deadline", "brief", "scope", "budget", "timeline"],
    negative: ["no budget", "not hiring", "closed"],
    baseFit: 80,
    baseValue: 75,
    baseEffort: 60,
    baseRisk: 30,
  },
  {
    type: "agency_white_label",
    label: "Agency white-label / overflow partner",
    strong: ["white label", "overflow", "freelance developer", "webflow developer", "shopify developer", "wordpress developer", "react developer", "frontend partner", "implementation partner"],
    medium: ["agency", "studio", "need help", "capacity", "contractor", "project support", "delivery partner", "build partner"],
    weak: ["ongoing", "remote", "australia", "short term", "urgent"],
    negative: ["full time employee", "onsite only", "junior only", "intern"],
    baseFit: 90,
    baseValue: 75,
    baseEffort: 35,
    baseRisk: 20,
  },
  {
    type: "partner_request",
    label: "Partner / referral opportunity",
    strong: ["looking to partner", "partnership opportunity", "referral partner", "implementation partner", "technology partner", "digital partner"],
    medium: ["agency", "consultant", "marketing", "brand", "crm", "automation", "website", "client needs"],
    weak: ["collaborate", "network", "preferred supplier", "vendor"],
    negative: ["commission only", "unclear budget", "not relevant"],
    baseFit: 80,
    baseValue: 70,
    baseEffort: 45,
    baseRisk: 35,
  },
  {
    type: "job_portal_outsource_signal",
    label: "Job post that implies outsourceable work",
    strong: ["contract", "temporary", "project based", "freelance", "part time", "short term", "immediate start"],
    medium: ["website", "digital marketing", "brand", "content", "seo", "frontend", "shopify", "wordpress", "react", "automation"],
    weak: ["hybrid", "remote", "small business", "portfolio", "redesign"],
    negative: ["full time permanent", "salary", "employee only", "must be onsite", "recruitment agency"],
    baseFit: 55,
    baseValue: 55,
    baseEffort: 55,
    baseRisk: 45,
  },
  {
    type: "forum_help_request",
    label: "Forum/help request",
    strong: ["can anyone recommend", "looking for someone", "need a website", "need help with", "recommend a developer", "recommend an agency"],
    medium: ["website", "branding", "seo", "shopify", "wordpress", "google ads", "marketing", "automation", "crm"],
    weak: ["local", "melbourne", "sydney", "australia", "small business"],
    negative: ["cheap", "no budget", "just advice", "diy", "not hiring"],
    baseFit: 70,
    baseValue: 45,
    baseEffort: 30,
    baseRisk: 40,
  },
  {
    type: "construction_brand_web_need",
    label: "Construction/trade firm likely needing brand/web help",
    strong: ["builder", "construction", "renovation", "architect", "property developer", "landscaping", "civil", "trade"],
    medium: ["new website", "rebrand", "brand refresh", "marketing", "seo", "lead generation", "portfolio", "projects"],
    weak: ["victoria", "melbourne", "nsw", "sydney", "queensland", "local"],
    negative: ["apprentice", "labourer", "materials", "equipment hire"],
    baseFit: 80,
    baseValue: 65,
    baseEffort: 45,
    baseRisk: 25,
  },
  {
    type: "business_website_pain",
    label: "Clear business website/brand pain",
    strong: ["website is outdated", "need a new website", "website redesign", "brand refresh", "not getting leads", "poor conversion", "seo help", "digital presence"],
    medium: ["small business", "growing", "launching", "new branch", "new service", "new location", "marketing help"],
    weak: ["contact us", "quote", "consultation", "portfolio"],
    negative: ["already hired", "not looking", "closed business", "template only"],
    baseFit: 85,
    baseValue: 65,
    baseEffort: 40,
    baseRisk: 20,
  },
  {
    type: "award_or_accelerator",
    label: "Award / accelerator / program opening",
    strong: ["accelerator", "incubator", "award", "pitch", "program", "cohort", "applications open"],
    medium: ["startup", "innovation", "digital", "creative", "small business", "grant", "mentoring"],
    weak: ["deadline", "apply", "shortlisted", "benefits"],
    negative: ["closed", "past winners", "archive"],
    baseFit: 55,
    baseValue: 60,
    baseEffort: 50,
    baseRisk: 35,
  },
];

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function normalise(input: OpportunityRadarInput) {
  return [input.url, input.title, input.text, input.sourceType, input.country, input.region, input.category]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();
}

function countMatches(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term.toLowerCase()));
}

function closingDateUrgency(text: string) {
  if (text.includes("closing soon") || text.includes("applications close soon") || text.includes("urgent")) return 18;
  if (text.includes("closing date") || text.includes("applications close") || text.includes("deadline")) return 10;
  if (text.includes("open now") || text.includes("applications open")) return 8;
  return 0;
}

function valueBoost(text: string) {
  let boost = 0;
  if (text.includes("$")) boost += 8;
  if (text.includes("funding") || text.includes("grant") || text.includes("tender") || text.includes("budget")) boost += 8;
  if (text.includes("ongoing") || text.includes("retainer") || text.includes("preferred supplier")) boost += 10;
  if (text.includes("white label") || text.includes("overflow")) boost += 8;
  return boost;
}

function effortPenalty(text: string) {
  let penalty = 0;
  if (text.includes("tender")) penalty += 10;
  if (text.includes("mandatory")) penalty += 8;
  if (text.includes("complex")) penalty += 8;
  if (text.includes("full time permanent")) penalty += 20;
  return penalty;
}

function chooseAction(total: number, type: OpportunityRadarType, negatives: string[]): OpportunityRadarScore["recommendedAction"] {
  if (negatives.length >= 3 || total < 35) return "ignore";
  if (total < 50) return "watch";
  if (type === "government_grant" && total >= 72) return "apply_or_bid";
  if ((type === "government_tender" || type === "rfp") && total >= 75) return "apply_or_bid";
  if ((type === "agency_white_label" || type === "partner_request" || type === "forum_help_request") && total >= 65) return "draft_enquiry";
  if (total >= 62) return "shortlist";
  return "investigate";
}

export function scoreOpportunityRadar(input: OpportunityRadarInput): OpportunityRadarScore {
  const text = normalise(input);
  let best: { profile: Profile; score: number; strong: string[]; medium: string[]; weak: string[]; negative: string[] } | null = null;

  for (const profile of opportunityRadarProfiles) {
    const strong = countMatches(text, profile.strong);
    const medium = countMatches(text, profile.medium);
    const weak = countMatches(text, profile.weak);
    const negative = countMatches(text, profile.negative);
    const score = strong.length * 16 + medium.length * 8 + weak.length * 3 - negative.length * 14;
    if (!best || score > best.score) best = { profile, score, strong, medium, weak, negative };
  }

  const selected = best && best.score > 0 ? best : {
    profile: {
      type: "unknown" as OpportunityRadarType,
      label: "Unknown opportunity",
      strong: [],
      medium: [],
      weak: [],
      negative: [],
      baseFit: 25,
      baseValue: 25,
      baseEffort: 50,
      baseRisk: 50,
    },
    score: 0,
    strong: [],
    medium: [],
    weak: [],
    negative: [],
  };

  const positives = [...selected.strong, ...selected.medium, ...selected.weak];
  const negativeSignals = selected.negative;
  const fitScore = clamp(selected.profile.baseFit + selected.strong.length * 8 + selected.medium.length * 3 - negativeSignals.length * 10);
  const urgencyScore = clamp(30 + closingDateUrgency(text) + (text.includes("urgent") ? 12 : 0));
  const valueScore = clamp(selected.profile.baseValue + valueBoost(text) + selected.strong.length * 3);
  const effortScore = clamp(selected.profile.baseEffort + effortPenalty(text) - (selected.profile.type === "agency_white_label" ? 10 : 0));
  const riskScore = clamp(selected.profile.baseRisk + negativeSignals.length * 12 + (text.includes("commission only") ? 20 : 0));
  const totalScore = clamp(fitScore * 0.38 + valueScore * 0.25 + urgencyScore * 0.14 + (100 - effortScore) * 0.13 + (100 - riskScore) * 0.10);
  const confidence = selected.strong.length >= 2 ? "high" : selected.strong.length >= 1 || selected.medium.length >= 2 ? "medium" : "low";

  return {
    type: selected.profile.type,
    recommendedAction: chooseAction(totalScore, selected.profile.type, negativeSignals),
    totalScore,
    fitScore,
    urgencyScore,
    valueScore,
    effortScore,
    riskScore,
    confidence,
    positiveSignals: positives,
    negativeSignals,
    evidence: [
      `Matched profile: ${selected.profile.label}`,
      ...positives.slice(0, 8).map((term) => `Positive signal: ${term}`),
      ...negativeSignals.slice(0, 5).map((term) => `Negative signal: ${term}`),
    ],
    safety: {
      callsAI: false,
      sendsEmail: false,
      writesToDatabase: false,
      networkFetch: false,
    },
  };
}

export function opportunityRadarProfileSummary() {
  return opportunityRadarProfiles.map((profile) => ({
    type: profile.type,
    label: profile.label,
    strongSignals: profile.strong,
    mediumSignals: profile.medium,
    negativeSignals: profile.negative,
    baseline: {
      fit: profile.baseFit,
      value: profile.baseValue,
      effort: profile.baseEffort,
      risk: profile.baseRisk,
    },
  }));
}
