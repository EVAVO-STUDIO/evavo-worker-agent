
import {
  Env,
  LeadRow,
  LeadSignals,
  tryAcquireLock,
  releaseLock,
  listLeads,
  updateLead,
  insertDraft,
  listDrafts,
  updateDraft,
  logEvent,
  getSetting,
  nowISO,
  uuid,
  bump,
  insertLead,
  parseLeadSignals,
  getLeadById,
  isSuppressed,
} from "./db";
import { sendEmail } from "./email";

type LeadClass =
  | "agency"
  | "dev_shop"
  | "marketing_agency"
  | "ecommerce"
  | "contractor"
  | "local_service"
  | "professional_service"
  | "industrial"
  | "not_fit"
  | "general";

type OpportunityType =
  | "white_label_partnership"
  | "overflow_delivery_support"
  | "site_rebuild"
  | "lead_flow_uplift"
  | "conversion_optimisation"
  | "positioning_improvement"
  | "do_not_pitch";

type QualityTier = "missing" | "weak" | "average" | "strong";
type DraftStrategy =
  | "white_label_partnership"
  | "overflow_delivery_support"
  | "contractor_lead_uplift"
  | "professional_service_uplift"
  | "site_rebuild_offer"
  | "ecommerce_conversion_offer"
  | "light_teardown_offer"
  | "do_not_send";
type ToneMode = "peer" | "consultative" | "direct" | "sharp";

export interface ScanRunSummary {
  scanned: number;
  expanded: number;
  skipped: number;
  failed: number;
  skippedReasons: Record<string, number>;
  candidateDiagnostics: {
    inserted: number;
    duplicatesSkipped: number;
    noiseSkipped: number;
    lowScoreSkipped: number;
    outOfRegionSkipped: number;
    badDomainSkipped: number;
    marketplaceSkipped: number;
    profilesVisited: number;
    fallbackUsed: number;
    noExternalWebsite: number;
    requeuedSources: number;
    inferredRegionAccepted: number;
    sourcePagesRetried: number;
    assetRejected: number;
    weakPageRejected: number;
  };
}

interface ScanResult {
  companyName?: string;
  leadClass: LeadClass;
  opportunityType: OpportunityType;
  qualityTier: QualityTier;
  draftStrategy: DraftStrategy;
  toneMode: ToneMode;
  fitScore: number;
  contactabilityScore: number;
  riskScore: number;
  scoreTotal: number;
  brief: string;
  contactEmail?: string;
  contactPageUrl?: string | null;
  hasContactForm: boolean;
  contactSummary: string;
  siteQualitySummary: string;
  techTags: string[];
  serviceTags: string[];
  outreachAngles: string[];
  avoidSaying: string[];
  groundedFacts: string[];
  title?: string;
  description?: string;
  decisionSummary: string;
  problemSummary: string;
  leverageSummary: string;
  recommendedAngle: string;
  country?: string | null;
  region?: string | null;
}

const MARKETPLACE_ROOTS = new Set(["hipages.com.au", "truelocal.com.au", "yellowpages.com.au"]);
const BAD_DOMAIN_EXACT = new Set([
  "gstatic.com",
  "googleusercontent.com",
  "i1.ypcdn.com",
  "i2.ypcdn.com",
  "i3.ypcdn.com",
  "i4.ypcdn.com",
  "googletagmanager.com",
  "gmpg.org",
  "use.fontawesome.com",
]);
const BAD_DOMAIN_PREFIXES = ["img.", "cdn.", "static.", "assets.", "media.", "fonts.", "images.", "image.", "files."];
const SOCIAL_HOST_PATTERNS = [/facebook\.com$/i, /instagram\.com$/i, /linkedin\.com$/i, /x\.com$/i, /twitter\.com$/i, /youtube\.com$/i, /tiktok\.com$/i, /pinterest\.com$/i];
const ASSET_EXTENSIONS = /\.(?:jpg|jpeg|png|gif|webp|svg|ico|pdf|docx?|xlsx?|css|js|json|xml|txt|map|woff2?|ttf|eot|mp4|mp3|zip)(?:$|\?)/i;
const SOURCE_RETRY_HOURS = 8;
const SOURCE_REFRESH_HOURS = 72;
const SOURCE_MAX_EMPTY_ATTEMPTS = 4;

function emptySummary(): ScanRunSummary {
  return {
    scanned: 0,
    expanded: 0,
    skipped: 0,
    failed: 0,
    skippedReasons: {},
    candidateDiagnostics: {
      inserted: 0,
      duplicatesSkipped: 0,
      noiseSkipped: 0,
      lowScoreSkipped: 0,
      outOfRegionSkipped: 0,
      badDomainSkipped: 0,
      marketplaceSkipped: 0,
      profilesVisited: 0,
      fallbackUsed: 0,
      noExternalWebsite: 0,
      requeuedSources: 0,
      inferredRegionAccepted: 0,
      sourcePagesRetried: 0,
      assetRejected: 0,
      weakPageRejected: 0,
    },
  };
}

function normalizeWebsite(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) throw new Error("Missing website URL");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

function getDomain(raw: string): string {
  try {
    return new URL(normalizeWebsite(raw)).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return String(raw || "").replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
  }
}

function getIsoMs(value: unknown): number {
  if (!value) return 0;
  const ms = new Date(String(value)).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function isBadDomain(domain: string): boolean {
  return BAD_DOMAIN_EXACT.has(domain) || BAD_DOMAIN_PREFIXES.some((prefix) => domain.startsWith(prefix));
}

function isMarketplaceDomain(domain: string): boolean {
  if (MARKETPLACE_ROOTS.has(domain)) return true;
  return Array.from(MARKETPLACE_ROOTS).some((root) => domain.endsWith(`.${root}`));
}

function isSocialDomain(domain: string): boolean {
  return SOCIAL_HOST_PATTERNS.some((pattern) => pattern.test(domain));
}

function isMarketplaceSourcePage(url: string): boolean {
  try {
    const parsed = new URL(normalizeWebsite(url));
    const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();
    return MARKETPLACE_ROOTS.has(host) && /\/find(\/|$)/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function isHardNoiseUrl(url: string): boolean {
  const lower = String(url || "").toLowerCase();
  return (
    ASSET_EXTENSIONS.test(lower) ||
    /mailto:|tel:|javascript:/i.test(lower) ||
    /facebook\.com|instagram\.com|linkedin\.com|x\.com|twitter\.com|youtube\.com|tiktok\.com|pinterest\.com/i.test(lower) ||
    /\/(?:search|category|categories|tag|tags|listing|listings|login|signup|register|privacy|terms|cookies|energy|calculators?|articles?)(\/|$)/i.test(lower) ||
    /[?&](page|sort|filter|session|ref|utm_)/i.test(lower)
  );
}

function isInternalMarketplaceProfileNoise(url: string): boolean {
  const lower = String(url || "").toLowerCase();
  return (
    /hipages\.com\.au\/(?:login|registration|articles|energy|calculators?|find)(\/|$)/i.test(lower) ||
    /yellowpages\.com\.au\/articles(\/|$)/i.test(lower) ||
    /truelocal\.com\.au\/(?:blog|privacy|terms|about)(\/|$)/i.test(lower)
  );
}

function stripHtml(html: string): string {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractTitle(html: string): string {
  return html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || "";
}

function extractDescription(html: string): string {
  return html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1]?.trim() || "";
}

function extractEmails(input: string): string[] {
  const matches = input.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  return Array.from(new Set(matches.map((v) => v.toLowerCase()))).filter((email) => !ASSET_EXTENSIONS.test(email));
}

function guessCompanyName(title: string, domain: string): string {
  if (title) {
    const cleaned = title.split(/[\-|•:·]/)[0].replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }
  return domain.replace(/^www\./i, "");
}

function inferCountryGuess(url: string, text: string): "AU" | "NZ" | "OTHER" {
  const hay = `${url} ${text}`.toLowerCase();
  if (/\.co\.nz\b|\.nz\b|new zealand|auckland|wellington|christchurch|hamilton/.test(hay)) return "NZ";
  if (/\.com\.au\b|\.au\b|australia|melbourne|sydney|brisbane|perth|adelaide|geelong|victoria|queensland|nsw|new south wales/.test(hay)) return "AU";
  return "OTHER";
}

async function fetchHtml(url: string): Promise<string> {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent": "Mozilla/5.0 (compatible; EVAVO-Outbound-Agent/1.0; +https://evavo.com.au)",
        "accept-language": "en-AU,en;q=0.9",
      },
      redirect: "follow",
    });
    const contentType = String(res.headers.get("content-type") || "").toLowerCase();
    if (!res.ok) return "";
    if (contentType && !/text\/html|application\/xhtml\+xml/.test(contentType)) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function absoluteUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

function extractLinks(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  const regex = /href=["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const url = absoluteUrl(match[1], baseUrl);
    if (url) out.push(url);
  }
  return Array.from(new Set(out));
}

function getSourceSignals(lead: LeadRow): any {
  try {
    return parseLeadSignals(lead) || {};
  } catch {
    return {};
  }
}

function isSourceLead(lead: LeadRow): boolean {
  if (/^directory:/i.test(String(lead.discovery_source || ""))) return true;
  return isMarketplaceSourcePage(lead.website_url || "");
}

function looksLikeSourcePage(url: string, html: string): boolean {
  if (isMarketplaceSourcePage(url)) return true;
  const lower = `${url} ${html}`.toLowerCase();
  return /directory|results for|search results|business listings/.test(lower) && /href=/.test(lower);
}

function looksLikeRealBusinessPage(url: string, html: string, title: string, description: string): boolean {
  if (!html.trim()) return false;
  if (isHardNoiseUrl(url)) return false;

  const text = stripHtml(html);
  const lower = `${title} ${description} ${text}`.toLowerCase();

  if (text.length < 350) return false;
  if (/directory|search results|browse businesses|article archive|category listing/i.test(lower)) return false;

  const signals = [
    /about us|about|services|our work|projects|portfolio|contact|enquiry|inquiry|quote|request a quote/i.test(lower),
    /phone|email|call us|get in touch|contact form/i.test(lower),
    /abn|pty ltd|australia|new zealand|melbourne|sydney|brisbane|perth|adelaide|auckland|wellington/i.test(lower),
    /builder|construction|agency|studio|marketing|design|developer|ecommerce|shop|contractor|plumbing|electrical|roofing|joinery|consulting|legal|medical/i.test(lower),
  ].filter(Boolean).length;

  return Boolean(title.trim()) && signals >= 2;
}

function extractCandidateProfileUrls(sourceUrl: string, html: string): { urls: string[]; fallbackUsed: boolean } {
  const source = sourceUrl.toLowerCase();
  const allLinks = extractLinks(html, sourceUrl);
  let strict: string[] = [];

  if (source.includes("truelocal.com.au")) {
    strict = allLinks.filter((u) => /truelocal\.com\.au\/business\//i.test(u));
  } else if (source.includes("yellowpages.com.au")) {
    strict = allLinks.filter((u) => /yellowpages\.com\.au\/[^/]+\/[^/]+-\d+/i.test(u) && !/\/find\//i.test(u) && !/\/articles/i.test(u));
  } else if (source.includes("hipages.com.au")) {
    strict = allLinks.filter((u) => /hipages\.com\.au\/connect\/[a-z0-9-]+/i.test(u));
  }

  strict = strict.filter((u) => !isHardNoiseUrl(u) && !isInternalMarketplaceProfileNoise(u));
  if (strict.length > 0) return { urls: Array.from(new Set(strict)).slice(0, 80), fallbackUsed: false };

  const fallback = allLinks.filter((u) => {
    const domain = getDomain(u);
    if (!isMarketplaceDomain(domain)) return false;
    if (/\/find(\/|$)/i.test(u)) return false;
    if (isHardNoiseUrl(u)) return false;
    if (isInternalMarketplaceProfileNoise(u)) return false;
    return /(business|connect|-\d+$)/i.test(u);
  });

  return { urls: Array.from(new Set(fallback)).slice(0, 80), fallbackUsed: fallback.length > 0 };
}

function extractExternalWebsiteFromProfile(profileUrl: string, html: string): string | null {
  const links = extractLinks(html, profileUrl);

  const preferred = links.filter((url) => {
    const domain = getDomain(url);
    if (!domain) return false;
    if (isBadDomain(domain)) return false;
    if (isMarketplaceDomain(domain)) return false;
    if (isSocialDomain(domain)) return false;
    if (isHardNoiseUrl(url)) return false;
    return /^https?:\/\//i.test(url);
  });

  for (const url of preferred) return normalizeWebsite(url);

  const textUrlMatches = Array.from(html.matchAll(/https?:\/\/[^\s"'<>]+/gi)).map((m) => m[0]);
  for (const raw of textUrlMatches) {
    const domain = getDomain(raw);
    if (!domain) continue;
    if (isBadDomain(domain) || isMarketplaceDomain(domain) || isSocialDomain(domain) || isHardNoiseUrl(raw)) continue;
    return normalizeWebsite(raw);
  }

  return null;
}

function classifyLead(domain: string, html: string, title: string, description: string) {
  const content = `${domain} ${title} ${description} ${html}`.toLowerCase();
  const techTags: string[] = [];
  const serviceTags: string[] = [];

  if (/shopify/.test(content)) techTags.push("shopify");
  if (/wordpress|wp-content/.test(content)) techTags.push("wordpress");
  if (/wix/.test(content)) techTags.push("wix");
  if (/squarespace/.test(content)) techTags.push("squarespace");
  if (/react|next\.js|__next/.test(content)) techTags.push("react");
  if (/webflow/.test(content)) techTags.push("webflow");
  if (/hubspot/.test(content)) techTags.push("hubspot");

  if (/e[- ]?commerce|checkout|cart|product/.test(content)) serviceTags.push("ecommerce");
  if (/branding|brand strategy/.test(content)) serviceTags.push("branding");
  if (/marketing|seo|ads|campaign|social media/.test(content)) serviceTags.push("marketing");
  if (/development|developer|software|engineering|app development/.test(content)) serviceTags.push("development");
  if (/white[- ]?label|partner|overflow|reseller/.test(content)) serviceTags.push("partnering");
  if (/builder|construction|joinery|cabinet|plumber|electrician|roofing|glazing|concrete|carpentry/.test(content)) serviceTags.push("trade");
  if (/dentist|lawyer|accountant|clinic|cleaning|mechanic|consulting/.test(content)) serviceTags.push("professional_service");

  let leadClass: LeadClass = "general";
  if (/\bgovernment\b|\bcouncil\b|\bschool\b|\buniversity\b|\bcharity\b|\bnonprofit\b|\bnot-for-profit\b|\bfoundation\b/.test(content)) leadClass = "not_fit";
  else if (/\bsoftware studio\b|\bproduct studio\b|\bweb development\b|\bapp development\b|\bdevelopers\b|\bsoftware agency\b/.test(content)) leadClass = "dev_shop";
  else if (/\bagency\b|\bstudio\b|\bcreative\b|\bbranding\b|\bmarketing agency\b|\bseo agency\b|\bweb design\b|\bdesign studio\b|\bwhite label\b/.test(content)) leadClass = serviceTags.includes("marketing") ? "marketing_agency" : "agency";
  else if (/e[- ]?commerce|checkout|cart|product/.test(content)) leadClass = "ecommerce";
  else if (/\bbuilder\b|\bconstruction\b|\bjoinery\b|\bcabinet\b|\bplumber\b|\belectrician\b|\broofing\b|\bglazing\b|\bconcrete\b|\bcarpentry\b|\blandscap|\bcivil contractor\b|\bearthworks\b|\bfabrication\b/.test(content)) leadClass = "contractor";
  else if (/\bdentist\b|\blawyer\b|\baccountant\b|\bphysio\b|\bclinic\b|\bconsulting\b|\bfinancial planning\b/.test(content)) leadClass = "professional_service";
  else if (/\bmanufacturing\b|\bindustrial\b|\bfabrication\b|\bengineering services\b/.test(content)) leadClass = "industrial";
  else if (/cleaning|mechanic|removals|pest control|service business/.test(content)) leadClass = "local_service";

  let qualityTier: QualityTier = "average";
  if (!html.trim() || /coming soon|under construction|domain parked|placeholder/i.test(content)) qualityTier = "missing";
  else if (/wix|squarespace|weebly|template|site by wix/i.test(content)) qualityTier = "weak";
  else if (title && description && (techTags.includes("react") || techTags.includes("shopify") || techTags.includes("webflow"))) qualityTier = "strong";

  let opportunityType: OpportunityType = "positioning_improvement";
  let draftStrategy: DraftStrategy = "light_teardown_offer";
  let toneMode: ToneMode = "consultative";

  if (leadClass === "agency" || leadClass === "dev_shop" || leadClass === "marketing_agency") {
    opportunityType = serviceTags.includes("partnering") ? "white_label_partnership" : "overflow_delivery_support";
    draftStrategy = opportunityType === "white_label_partnership" ? "white_label_partnership" : "overflow_delivery_support";
    toneMode = "peer";
  } else if (leadClass === "contractor" || leadClass === "local_service") {
    opportunityType = qualityTier === "weak" || qualityTier === "missing" ? "site_rebuild" : "lead_flow_uplift";
    draftStrategy = "contractor_lead_uplift";
    toneMode = "direct";
  } else if (leadClass === "professional_service") {
    opportunityType = qualityTier === "weak" || qualityTier === "missing" ? "site_rebuild" : "lead_flow_uplift";
    draftStrategy = "professional_service_uplift";
    toneMode = "consultative";
  } else if (leadClass === "ecommerce") {
    opportunityType = "conversion_optimisation";
    draftStrategy = "ecommerce_conversion_offer";
    toneMode = "sharp";
  } else if (leadClass === "not_fit") {
    opportunityType = "do_not_pitch";
    draftStrategy = "do_not_send";
  } else if (qualityTier === "weak" || qualityTier === "missing") {
    opportunityType = "site_rebuild";
    draftStrategy = "site_rebuild_offer";
  }

  return { leadClass, opportunityType, qualityTier, draftStrategy, toneMode, serviceTags, techTags };
}

function deriveScores(input: { leadClass: LeadClass; qualityTier: QualityTier; opportunityType: OpportunityType; hasContactForm: boolean; contactEmail?: string; html: string; }) {
  let fit = 0.35;
  let contact = 0.2;
  let risk = 0.08;
  if (input.contactEmail) contact = 0.95;
  else if (input.hasContactForm) contact = 0.55;
  if (["agency", "dev_shop", "marketing_agency"].includes(input.leadClass)) fit = 0.9;
  else if (["contractor", "local_service", "professional_service", "industrial"].includes(input.leadClass)) fit = 0.82;
  else if (input.leadClass === "ecommerce") fit = 0.87;
  else if (input.leadClass === "not_fit") fit = 0.1;
  if (input.qualityTier === "missing") fit += 0.1;
  if (input.qualityTier === "weak") fit += 0.12;
  if (input.qualityTier === "strong" && !["agency", "dev_shop", "marketing_agency"].includes(input.leadClass)) fit -= 0.2;
  if (input.opportunityType === "do_not_pitch") risk = 0.8;
  fit = Math.max(0, Math.min(1, fit));
  contact = Math.max(0, Math.min(1, contact));
  risk = Math.max(0, Math.min(1, risk));
  const total = Math.max(0, Math.min(1, fit * 0.55 + contact * 0.35 - risk * 0.2));
  return {
    fit: Number(fit.toFixed(2)),
    contact: Number(contact.toFixed(2)),
    risk: Number(risk.toFixed(2)),
    total: Number(total.toFixed(2)),
  };
}

function buildProblemSummary(leadClass: LeadClass, qualityTier: QualityTier) {
  if (leadClass === "agency" || leadClass === "dev_shop" || leadClass === "marketing_agency") return "This looks more like a partnership or overflow opportunity than a redesign target.";
  if (leadClass === "ecommerce") return "The likely value here is conversion improvement, not surface-level redesign work.";
  if (leadClass === "contractor" || leadClass === "local_service" || leadClass === "professional_service") {
    return qualityTier === "weak" || qualityTier === "missing"
      ? "The site likely undersells trust and enquiry flow."
      : "The site may be leaving enquiry quality and conversion clarity on the table.";
  }
  return qualityTier === "weak" || qualityTier === "missing"
    ? "The digital presence appears weaker than it should be."
    : "There may be positioning or performance issues worth tightening.";
}

function buildLeverageSummary(leadClass: LeadClass, opportunityType: OpportunityType) {
  if (opportunityType === "white_label_partnership") return "EVAVO should position as quiet implementation capacity behind the scenes.";
  if (opportunityType === "overflow_delivery_support") return "EVAVO should position as overflow support that helps delivery teams move faster.";
  if (leadClass === "ecommerce") return "EVAVO should focus on conversion, clarity, and practical revenue lift.";
  if (leadClass === "contractor" || leadClass === "local_service" || leadClass === "professional_service") return "EVAVO should focus on trust, enquiries, and cleaner conversion paths.";
  return "EVAVO should use a short, grounded teardown angle.";
}

function buildRecommendedAngle(opportunityType: OpportunityType) {
  if (opportunityType === "white_label_partnership") return "Peer-to-peer note about white-label or overflow support.";
  if (opportunityType === "overflow_delivery_support") return "Short note about extra delivery capacity without adding headcount.";
  if (opportunityType === "conversion_optimisation") return "Short conversion-focused teardown offer.";
  if (opportunityType === "lead_flow_uplift") return "Practical lead-flow improvement note.";
  if (opportunityType === "site_rebuild") return "Low-friction rebuild or refresh angle.";
  return "Light teardown offer.";
}

function buildOutreachAngles(leadClass: LeadClass, opportunityType: OpportunityType): string[] {
  if (opportunityType === "white_label_partnership") return ["support overflow delivery", "offer white-label implementation capacity", "help quietly behind the scenes"];
  if (opportunityType === "overflow_delivery_support") return ["help with production overflow", "support delivery under capacity pressure", "add implementation support without headcount"];
  if (leadClass === "contractor" || leadClass === "local_service" || leadClass === "professional_service") return ["make the site clearer for inbound enquiries", "improve trust and lead capture", "tighten contact pathways"];
  if (leadClass === "ecommerce") return ["improve conversion flow", "tighten product page clarity", "lift trust and checkout performance"];
  if (opportunityType === "site_rebuild") return ["refresh positioning and structure", "improve mobile clarity", "rebuild around conversion and trust"];
  return ["tighten positioning and site performance"];
}

function buildAvoidSaying(opportunityType: OpportunityType): string[] {
  if (opportunityType === "white_label_partnership" || opportunityType === "overflow_delivery_support") {
    return ["we can redo your website", "your site is bad", "you need a redesign", "we can replace your team"];
  }
  return ["generic growth claims", "obvious AI phrasing", "empty flattery"];
}

function buildLeadSignals(scan: ScanResult): LeadSignals {
  return {
    summary: scan.brief,
    brief: scan.brief,
    siteQualitySummary: scan.siteQualitySummary,
    contactSummary: scan.contactSummary,
    serviceTags: scan.serviceTags,
    techTags: scan.techTags,
    outreachAngles: scan.outreachAngles,
    groundedFacts: scan.groundedFacts,
    avoidSaying: scan.avoidSaying,
    title: scan.title,
    description: scan.description,
    companyName: scan.companyName,
    leadClass: scan.leadClass,
    qualityTier: scan.qualityTier,
    opportunityType: scan.opportunityType,
    decisionSummary: scan.decisionSummary,
    draftStrategy: scan.draftStrategy,
    toneMode: scan.toneMode,
    problemSummary: scan.problemSummary,
    leverageSummary: scan.leverageSummary,
    recommendedAngle: scan.recommendedAngle,
  } as LeadSignals;
}

function envBrandLine(env: Env): string {
  return env.BRAND_NAME || "EVAVO Studio";
}

function cleanCompanyName(lead: LeadRow): string {
  const signals = parseLeadSignals(lead) as any;
  return lead.company_name || signals.companyName || lead.website_url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function lines(parts: Array<string | false | null | undefined>): string {
  return parts.filter((part): part is string => Boolean(part)).join("\n");
}

function buildDraftCopy(env: Env, lead: LeadRow) {
  const signals = parseLeadSignals(lead) as any;
  const company = cleanCompanyName(lead);
  const domain = lead.website_url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const grounded = Array.isArray(signals.groundedFacts) ? signals.groundedFacts.slice(0, 2) : [];
  const angle = signals.recommendedAngle || "Short teardown offer";
  const problem = signals.problemSummary || "There may be a practical website opportunity here.";
  const leverage = signals.leverageSummary || "EVAVO should focus on practical improvement, not fluff.";
  const tone = String(signals.toneMode || "consultative");
  const strategy = String(signals.draftStrategy || "light_teardown_offer");

  if (strategy === "white_label_partnership" || strategy === "overflow_delivery_support") {
    return {
      subject: `Quiet support for ${company} if overflow ever hits`,
      bodyText: lines([
        `Hi ${company},`,
        "",
        `I had a quick look through ${domain} and this felt more like a partner-fit conversation than a pitch about redoing your site.`,
        grounded.length ? `A couple of grounded things I picked up: ${grounded.join("; ")}.` : "",
        "",
        `${envBrandLine(env)} usually helps behind the scenes when agencies or dev teams need extra implementation capacity without adding permanent headcount.`,
        `The angle here would be simple: ${angle.toLowerCase()}.`,
        "",
        "If that is ever useful, I am happy to send a short note on where we tend to plug in.",
        "",
        "Best,",
        envBrandLine(env),
      ]),
      followupText: lines([
        `Hi ${company},`,
        "",
        "Just following up in case overflow or quiet implementation support is relevant at the moment.",
        "",
        "Best,",
        envBrandLine(env),
      ]),
      whyJson: JSON.stringify({ company, tone, angle, problem, leverage, groundedFacts: grounded, strategy }),
    };
  }

  if (strategy === "contractor_lead_uplift" || strategy === "professional_service_uplift") {
    return {
      subject: `A practical website idea for ${company}`,
      bodyText: lines([
        `Hi ${company},`,
        "",
        `I had a look through ${domain} and there looks to be a practical opportunity to tighten how the site turns visits into enquiries.`,
        grounded.length ? `One grounded thing that stood out was: ${grounded[0]}.` : "",
        "",
        problem,
        leverage,
        "",
        "If useful, I can send through a short note with 2 or 3 specific improvements rather than a generic redesign pitch.",
        "",
        "Best,",
        envBrandLine(env),
      ]),
      followupText: lines([
        `Hi ${company},`,
        "",
        "Just following up in case a short, practical teardown would be useful.",
        "",
        "Best,",
        envBrandLine(env),
      ]),
      whyJson: JSON.stringify({ company, tone, angle, problem, leverage, groundedFacts: grounded, strategy }),
    };
  }

  if (strategy === "ecommerce_conversion_offer") {
    return {
      subject: `A conversion idea for ${company}`,
      bodyText: lines([
        `Hi ${company},`,
        "",
        `I had a look through ${domain} and this feels more like a conversion and clarity opportunity than a redesign-for-the-sake-of-it situation.`,
        grounded.length ? `A grounded signal here was: ${grounded[0]}.` : "",
        "",
        problem,
        leverage,
        "",
        "If useful, I can send a short teardown focused on what is most likely to lift trust or action.",
        "",
        "Best,",
        envBrandLine(env),
      ]),
      followupText: lines([
        `Hi ${company},`,
        "",
        "Just following up in case a conversion-focused teardown would be useful.",
        "",
        "Best,",
        envBrandLine(env),
      ]),
      whyJson: JSON.stringify({ company, tone, angle, problem, leverage, groundedFacts: grounded, strategy }),
    };
  }

  return {
    subject: `A practical idea for ${company}`,
    bodyText: lines([
      `Hi ${company},`,
      "",
      `I had a look through ${domain} and there may be a worthwhile improvement opportunity there.`,
      grounded.length ? `A couple of grounded things I noticed: ${grounded.join("; ")}.` : "",
      "",
      problem,
      leverage,
      "",
      "If useful, I can send a short note with specific suggestions.",
      "",
      "Best,",
      envBrandLine(env),
    ]),
    followupText: lines([
      `Hi ${company},`,
      "",
      "Just following up in case a short, specific teardown would be useful.",
      "",
      "Best,",
      envBrandLine(env),
    ]),
    whyJson: JSON.stringify({ company, tone, angle, problem, leverage, groundedFacts: grounded, strategy }),
  };
}

async function executeWithRetry<T>(task: () => Promise<T>, maxRetries = 3, baseDelayMs = 300): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await task();
    } catch (error: any) {
      attempt += 1;
      const message = String(error?.message || error || "");
      const retryable = /timeout|network|429|rate|temporar/i.test(message);
      if (!retryable || attempt > maxRetries) throw error;
      const delay = baseDelayMs * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function getCap(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function draftCountForLead(env: Env, leadId: string): Promise<number> {
  const row = await env.DB.prepare(`SELECT COUNT(*) as count FROM drafts WHERE lead_id = ?`).bind(leadId).first<{ count: number }>();
  return Number(row?.count || 0);
}

async function markExcludedLead(env: Env, lead: LeadRow, reason: string): Promise<void> {
  await updateLead(env, lead.id, {
    status: "do_not_contact",
    signals_json: JSON.stringify({
      ...(parseLeadSignals(lead) || {}),
      filteredOut: true,
      filterReason: reason,
      decisionSummary: `Lead excluded by filter: ${reason}.`,
    }),
  });
  await logEvent(env, "scan_skip", `Filtered lead ${lead.website_url}: ${reason}`, lead.id);
}

async function cleanMarketplaceTargetNoise(env: Env, leads: LeadRow[]): Promise<number> {
  let cleaned = 0;
  for (const lead of leads) {
    if (isSourceLead(lead)) continue;
    const domain = getDomain(lead.website_url || "");
    if (!isMarketplaceDomain(domain)) continue;
    await markExcludedLead(env, lead, "marketplace_internal_target");
    cleaned += 1;
  }
  return cleaned;
}

function shouldRetrySourceLead(lead: LeadRow): boolean {
  if (!isSourceLead(lead)) return false;
  const status = String(lead.status || "");
  if (status === "new") return false;
  if (["drafted", "sent"].includes(status)) return false;

  const signals = getSourceSignals(lead);
  const nowMs = Date.now();
  const lastAttemptMs =
    getIsoMs(signals?.lastSourceAttemptAt) ||
    getIsoMs(signals?.requeuedAt) ||
    getIsoMs(lead.updated_at_iso);

  const emptyAttemptCount = Number(signals?.sourceAttemptCount || 0);
  const successCount = Number(signals?.sourceSuccessCount || 0);
  const extracted = Number(signals?.extractedCandidates || 0);
  const producedCandidatesBefore = extracted > 0 || successCount > 0;

  const cooldownHours = producedCandidatesBefore ? SOURCE_REFRESH_HOURS : SOURCE_RETRY_HOURS;
  const isStale = !lastAttemptMs || nowMs - lastAttemptMs >= cooldownHours * 60 * 60 * 1000;

  if (producedCandidatesBefore) return isStale;
  if (emptyAttemptCount >= SOURCE_MAX_EMPTY_ATTEMPTS) return false;

  return isStale && (status === "failed" || status === "do_not_contact");
}

async function requeueDeadSources(env: Env, leads: LeadRow[], maxToRequeue = 8): Promise<number> {
  let count = 0;
  for (const lead of leads) {
    if (count >= maxToRequeue) break;
    if (!shouldRetrySourceLead(lead)) continue;
    const signals = getSourceSignals(lead);
    await updateLead(env, lead.id, {
      status: "new",
      signals_json: JSON.stringify({
        ...signals,
        sourceExpanded: false,
        requeuedForRetry: true,
        requeuedAt: nowISO(),
        sourceRetryReason: "stale_source_page",
      }),
    });
    await logEvent(env, "source_requeued", `Requeued source page for another expansion pass: ${lead.website_url}`, lead.id);
    count += 1;
  }
  return count;
}

async function expandSourceLead(env: Env, lead: LeadRow, summary: ScanRunSummary): Promise<{ inserted: number; newLeadIds: string[] }> {
  const previousSignals = getSourceSignals(lead);
  const priorAttempts = Number(previousSignals?.sourceAttemptCount || 0);
  const priorSuccesses = Number(previousSignals?.sourceSuccessCount || 0);

  const html = await fetchHtml(lead.website_url);
  if (!html.trim()) {
    await updateLead(env, lead.id, {
      status: "failed",
      signals_json: JSON.stringify({
        ...previousSignals,
        sourceExpanded: false,
        sourceFetchFailed: true,
        sourceAttemptCount: priorAttempts + 1,
        sourceSuccessCount: priorSuccesses,
        lastSourceAttemptAt: nowISO(),
        decisionSummary: `Source page unavailable for ${lead.website_url}.`,
      }),
    });
    await logEvent(env, "expand_fail", `Source page empty or unavailable: ${lead.website_url}`, lead.id);
    summary.candidateDiagnostics.sourcePagesRetried += 1;
    return { inserted: 0, newLeadIds: [] };
  }

  const existingLeads = await listLeads(env, { limit: 800 });
  const existingDomains = new Set(existingLeads.map((item) => getDomain(item.website_url)));
  const extracted = extractCandidateProfileUrls(lead.website_url, html);
  const profileUrls = extracted.urls;
  const sourceCountryHint = (lead.country === "NZ" ? "NZ" : "AU") as "AU" | "NZ";

  if (extracted.fallbackUsed) summary.candidateDiagnostics.fallbackUsed += 1;

  let inserted = 0;
  const newLeadIds: string[] = [];
  let inferredAccepted = 0;

  for (const profileUrl of profileUrls) {
    summary.candidateDiagnostics.profilesVisited += 1;
    const profileHtml = await fetchHtml(profileUrl);
    if (!profileHtml.trim()) continue;

    const externalWebsite = extractExternalWebsiteFromProfile(profileUrl, profileHtml);
    if (!externalWebsite) {
      summary.candidateDiagnostics.noExternalWebsite += 1;
      continue;
    }

    const domain = getDomain(externalWebsite);
    if (isBadDomain(domain)) {
      summary.candidateDiagnostics.badDomainSkipped += 1;
      continue;
    }
    if (isMarketplaceDomain(domain) || isSocialDomain(domain) || isHardNoiseUrl(externalWebsite)) {
      summary.candidateDiagnostics.marketplaceSkipped += 1;
      continue;
    }
    if (existingDomains.has(domain)) {
      summary.candidateDiagnostics.duplicatesSkipped += 1;
      continue;
    }

    const countryGuess = inferCountryGuess(externalWebsite, `${domain} ${profileHtml}`);
    if (countryGuess === "OTHER" && !/\.(com|net|org|io|co|app|studio|agency|digital)$/i.test(domain)) {
      summary.candidateDiagnostics.outOfRegionSkipped += 1;
      continue;
    }
    if (countryGuess === "OTHER") inferredAccepted += 1;

    try {
      const insertedLead = await insertLead(env, {
        websiteUrl: normalizeWebsite(externalWebsite),
        discoverySource: `expanded_from:${lead.id}`,
        category: lead.category || "general",
        country: countryGuess === "NZ" ? "NZ" : sourceCountryHint,
        region: lead.region || null,
        signalsJson: JSON.stringify({
          sourceDomain: getDomain(lead.website_url),
          sourceProfileUrl: profileUrl,
          inferredFromMarketplaceRegion: countryGuess === "OTHER",
        }),
      });
      inserted += 1;
      newLeadIds.push(insertedLead.id);
      existingDomains.add(domain);
    } catch {
      summary.candidateDiagnostics.duplicatesSkipped += 1;
    }
  }

  summary.candidateDiagnostics.inserted += inserted;
  summary.candidateDiagnostics.inferredRegionAccepted += inferredAccepted;

  const nextSignals = {
    ...previousSignals,
    sourceExpanded: inserted > 0,
    extractedCandidates: inserted,
    profilesVisited: profileUrls.length,
    fallbackUsed: extracted.fallbackUsed,
    lastSourceAttemptAt: nowISO(),
    sourceAttemptCount: inserted > 0 ? 0 : priorAttempts + 1,
    sourceSuccessCount: inserted > 0 ? priorSuccesses + 1 : priorSuccesses,
    sourceHarvestedAt: inserted > 0 ? nowISO() : previousSignals?.sourceHarvestedAt,
    decisionSummary:
      inserted > 0
        ? `Directory source page expanded into ${inserted} candidate URLs.`
        : `Directory source page produced no accepted candidates after reviewing ${profileUrls.length} profiles.`,
  };

  await updateLead(env, lead.id, {
    status: inserted > 0 ? "do_not_contact" : "failed",
    signals_json: JSON.stringify(nextSignals),
  });

  await logEvent(
    env,
    "expand_ok",
    `Expanded ${lead.website_url} | profiles ${profileUrls.length} | inserted ${inserted} | fallback ${extracted.fallbackUsed ? "yes" : "no"}`,
    lead.id
  );

  return { inserted, newLeadIds };
}

function buildScanResult(lead: LeadRow, html: string): ScanResult {
  const url = new URL(normalizeWebsite(lead.website_url));
  const title = extractTitle(html);
  const description = extractDescription(html);
  const classified = classifyLead(url.hostname, html, title, description);
  const emails = extractEmails(html);
  const contactEmail = emails[0];
  const contactHrefMatch = html.match(/href=["']([^"']*contact[^"']*)["']/i);
  const contactPageUrl = contactHrefMatch ? new URL(contactHrefMatch[1], lead.website_url).toString() : null;
  const hasContactForm = /<form[\s\S]*?(contact|enquiry|inquiry|message)/i.test(html) || Boolean(contactPageUrl);

  const scores = deriveScores({
    leadClass: classified.leadClass,
    qualityTier: classified.qualityTier,
    opportunityType: classified.opportunityType,
    hasContactForm,
    contactEmail,
    html,
  });

  return {
    companyName: guessCompanyName(title, url.hostname),
    leadClass: classified.leadClass,
    opportunityType: classified.opportunityType,
    qualityTier: classified.qualityTier,
    draftStrategy: classified.draftStrategy,
    toneMode: classified.toneMode,
    fitScore: scores.fit,
    contactabilityScore: scores.contact,
    riskScore: scores.risk,
    scoreTotal: scores.total,
    brief:
      classified.leadClass === "agency" || classified.leadClass === "dev_shop" || classified.leadClass === "marketing_agency"
        ? "Agency-side lead that likely suits partnership or overflow support."
        : classified.leadClass === "ecommerce"
        ? "Commerce lead that likely suits a conversion-focused offer."
        : classified.leadClass === "contractor" || classified.leadClass === "local_service"
        ? "Service-business lead where practical website uplift may improve enquiry flow."
        : classified.leadClass === "professional_service"
        ? "Professional-service lead where clearer trust and contact flow may matter."
        : "General lead with some improvement potential.",
    contactEmail,
    contactPageUrl,
    hasContactForm,
    contactSummary: contactEmail ? `Found direct email ${contactEmail}` : hasContactForm ? "No direct email found, but a contact route exists" : "No direct contact route found",
    siteQualitySummary:
      classified.qualityTier === "missing"
        ? "Digital presence appears missing or placeholder-level."
        : classified.qualityTier === "weak"
        ? "Site loaded, but likely presents a weaker or more templated experience."
        : classified.qualityTier === "strong"
        ? "Site loaded and appears comparatively stronger."
        : "Site loaded successfully.",
    techTags: classified.techTags,
    serviceTags: classified.serviceTags,
    outreachAngles: buildOutreachAngles(classified.leadClass, classified.opportunityType),
    avoidSaying: buildAvoidSaying(classified.opportunityType),
    groundedFacts: [
      ...(title ? [`Title: ${title}`] : []),
      ...(description ? [`Description: ${description}`] : []),
      ...(contactEmail ? [`Email found: ${contactEmail}`] : []),
      ...(contactPageUrl ? [`Contact page: ${contactPageUrl}`] : []),
    ],
    title,
    description,
    decisionSummary: buildRecommendedAngle(classified.opportunityType),
    problemSummary: buildProblemSummary(classified.leadClass, classified.qualityTier),
    leverageSummary: buildLeverageSummary(classified.leadClass, classified.opportunityType),
    recommendedAngle: buildRecommendedAngle(classified.opportunityType),
    country: url.hostname.endsWith(".nz") ? "NZ" : "AU",
    region: null,
  };
}

export async function scanWebsiteNow(env: Env, websiteInput: string): Promise<LeadRow> {
  const website = normalizeWebsite(websiteInput);
  const lead = await insertLead(env, { websiteUrl: website, discoverySource: "manual", signalsJson: "{}" });
  await runScan(env, 1);
  return (await getLeadById(env, lead.id)) as LeadRow;
}

async function runScan(env: Env, maxItems: number): Promise<ScanRunSummary> {
  const allRecent = await listLeads(env, { limit: 400 });
  const summary = emptySummary();

  const cleanedMarketplaceTargets = await cleanMarketplaceTargetNoise(
    env,
    allRecent.filter((lead) => ["new", "failed"].includes(String(lead.status || "")))
  );
  if (cleanedMarketplaceTargets > 0) summary.candidateDiagnostics.marketplaceSkipped += cleanedMarketplaceTargets;

  let refreshedLeads = await listLeads(env, { limit: 400 });
  let eligible = refreshedLeads.filter((lead) => {
    const domain = getDomain(lead.website_url || "");
    if (isBadDomain(domain)) {
      summary.skippedReasons.bad_domain_existing = (summary.skippedReasons.bad_domain_existing || 0) + 1;
      return false;
    }
    if (lead.status === "new") return true;
    if (shouldRetrySourceLead(lead)) return true;
    const key = lead.status ? `status_${lead.status}` : "other";
    summary.skippedReasons[key] = (summary.skippedReasons[key] || 0) + 1;
    return false;
  });

  if (eligible.length === 0) {
    const requeued = await requeueDeadSources(env, refreshedLeads, 8);
    summary.candidateDiagnostics.requeuedSources = requeued;
    refreshedLeads = await listLeads(env, { limit: 400 });
    eligible = refreshedLeads.filter((lead) => lead.status === "new" || shouldRetrySourceLead(lead));
  }

  const queue: LeadRow[] = [...eligible]
    .sort((a, b) => {
      const aSource = isSourceLead(a) ? 1 : 0;
      const bSource = isSourceLead(b) ? 1 : 0;
      if (aSource !== bSource) return aSource - bSource;
      return (b.score_total || 0) - (a.score_total || 0);
    })
    .slice(0, maxItems * 4);

  const processed = new Set<string>();

  while (queue.length > 0 && summary.scanned < maxItems) {
    const lead = queue.shift()!;
    if (processed.has(lead.id)) continue;
    processed.add(lead.id);

    try {
      const domain = getDomain(lead.website_url);

      if (isBadDomain(domain)) {
        await markExcludedLead(env, lead, "bad_domain");
        summary.candidateDiagnostics.badDomainSkipped += 1;
        continue;
      }

      if (isHardNoiseUrl(lead.website_url) && !isSourceLead(lead)) {
        await markExcludedLead(env, lead, "noise_url");
        summary.candidateDiagnostics.noiseSkipped += 1;
        summary.candidateDiagnostics.assetRejected += 1;
        continue;
      }

      if (isMarketplaceDomain(domain) && !isSourceLead(lead)) {
        await markExcludedLead(env, lead, "marketplace_internal_target");
        summary.candidateDiagnostics.marketplaceSkipped += 1;
        continue;
      }

      const html = await fetchHtml(lead.website_url);
      if (!html.trim()) {
        await updateLead(env, lead.id, { status: "failed" });
        await logEvent(env, "scan_fail", `No HTML returned for ${lead.website_url}`, lead.id);
        summary.failed += 1;
        continue;
      }

      if (looksLikeSourcePage(lead.website_url, html)) {
        const expansion = await expandSourceLead(env, lead, summary);
        summary.expanded += expansion.inserted;
        if (expansion.newLeadIds.length > 0) {
          const fresh = await listLeads(env, { status: "new", limit: maxItems * 8 });
          const insertedTargets = fresh.filter((item) => expansion.newLeadIds.includes(item.id) && !isSourceLead(item));
          queue.unshift(...insertedTargets);
        }
        continue;
      }

      const title = extractTitle(html);
      const description = extractDescription(html);
      if (!looksLikeRealBusinessPage(lead.website_url, html, title, description)) {
        await markExcludedLead(env, lead, "weak_or_non_business_page");
        summary.candidateDiagnostics.weakPageRejected += 1;
        continue;
      }

      const scan = buildScanResult(lead, html);
      await updateLead(env, lead.id, {
        company_name: scan.companyName || null,
        category: scan.leadClass as any,
        country: scan.country || null,
        region: scan.region || null,
        contact_email: scan.contactEmail || null,
        contact_page_url: scan.contactPageUrl || null,
        has_contact_form: scan.hasContactForm ? 1 : 0,
        signals_json: JSON.stringify(buildLeadSignals(scan)),
        score_fit: scan.fitScore,
        score_contact: scan.contactabilityScore,
        score_risk: scan.riskScore,
        score_total: scan.scoreTotal,
        status: "scanned",
      });
      await bump(env, "leads_new_today", 1);
      await bump(env, "crawl_scanned_today", 1);
      await logEvent(env, "scan_ok", `Scanned ${lead.website_url} as ${scan.leadClass}`, lead.id);
      summary.scanned += 1;
    } catch (error) {
      await updateLead(env, lead.id, { status: "failed" });
      await logEvent(env, "scan_fail", `Error scanning ${lead.website_url}: ${String(error)}`, lead.id);
      summary.failed += 1;
    }
  }

  summary.skipped = Math.max(0, refreshedLeads.length - processed.size);
  return summary;
}

async function runDraft(env: Env, maxItems: number): Promise<number> {
  const minimumScore = Number((await getSetting(env, "min_score_for_draft")) || 0.45);
  const leads = await listLeads(env, { status: "scanned", limit: maxItems * 5 });
  let drafted = 0;

  for (const lead of leads) {
    const signals = parseLeadSignals(lead) as any;
    const leadClass = String(signals.leadClass || lead.category || "general").toLowerCase();
    const qualityTier = String(signals.qualityTier || "average").toLowerCase();
    const opportunityType = String(signals.opportunityType || "");
    const strategy = String(signals.draftStrategy || "");
    const existingDraftCount = await draftCountForLead(env, lead.id);

    if (drafted >= maxItems) break;
    if ((lead.score_total || 0) < minimumScore) continue;
    if (strategy === "do_not_send" || opportunityType === "do_not_pitch") continue;
    if (qualityTier === "strong" && !["agency", "dev_shop", "marketing_agency", "ecommerce"].includes(leadClass)) continue;
    if (existingDraftCount >= 1) continue;

    try {
      const draft = buildDraftCopy(env, lead);
      await insertDraft(env, {
        leadId: lead.id,
        mode: "heuristic",
        subject: draft.subject,
        bodyText: draft.bodyText,
        followupText: draft.followupText,
        whyJson: draft.whyJson,
      });
      await updateLead(env, lead.id, { status: "drafted" });
      await bump(env, "drafts_created_today", 1);
      await bump(env, "ai_calls", 1);
      await logEvent(env, "draft_created", `Draft created for ${lead.website_url}`, lead.id);
      drafted += 1;
    } catch (error) {
      await logEvent(env, "draft_fail", `Error drafting for ${lead.website_url}: ${String(error)}`, lead.id);
    }
  }

  return drafted;
}

async function runSend(env: Env, maxItems: number): Promise<{ sent: number; failed: number }> {
  const sendingEnabled = ((await getSetting(env, "sending_enabled")) || "0") === "1";
  if (!sendingEnabled) {
    await logEvent(env, "send_skip", "Sending disabled, skipping send stage.");
    return { sent: 0, failed: 0 };
  }

  const minimumScore = Number((await getSetting(env, "min_score_for_send")) || 0.65);
  const drafts = await listDrafts(env, { status: "approved", limit: maxItems });
  let sent = 0;
  let failed = 0;

  for (const draft of drafts) {
    const lead = await getLeadById(env, draft.lead_id);
    if (!lead) {
      failed += 1;
      await updateDraft(env, draft.id, { status: "failed" });
      await logEvent(env, "send_fail", "Lead missing for approved draft", draft.lead_id);
      continue;
    }

    if ((lead.score_total || 0) < minimumScore) {
      await logEvent(env, "send_skip", "Lead below send threshold", lead.id);
      continue;
    }

    const toEmail = lead.contact_email?.trim().toLowerCase() || null;
    if (!toEmail || (await isSuppressed(env, toEmail))) {
      await logEvent(env, "send_skip", "Missing or suppressed email", lead.id);
      continue;
    }

    try {
      const result = await executeWithRetry(() =>
        sendEmail(env, { to: toEmail, subject: draft.subject, bodyText: draft.body_text })
      );
      if (result.ok) {
        await updateDraft(env, draft.id, { status: "sent" });
        await updateLead(env, lead.id, { status: "sent" });
        await bump(env, "sends_sent_today", 1);
        await logEvent(env, "send_ok", `Email sent to ${toEmail}`, lead.id);
        sent += 1;
      } else {
        await updateDraft(env, draft.id, { status: "failed" });
        await updateLead(env, lead.id, { status: "failed" });
        await logEvent(env, "send_fail", result.error || "Unknown send error", lead.id);
        failed += 1;
      }
    } catch (error) {
      await updateDraft(env, draft.id, { status: "failed" });
      await updateLead(env, lead.id, { status: "failed" });
      await logEvent(env, "send_fail", String(error), lead.id);
      failed += 1;
    }
  }

  return { sent, failed };
}

async function persistLastEngineRun(
  env: Env,
  payload: {
    runId: string;
    started_at_iso: string;
    scanned: number;
    expanded: number;
    skipped: number;
    skippedReasons: Record<string, number>;
    candidateDiagnostics: Record<string, unknown>;
    failed: number;
    drafted: number;
    sent: number;
    sendFailed: number;
    runMode: "tick" | "manual_scan" | "manual_draft" | "manual_send";
  }
): Promise<void> {
  await env.DB.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`)
    .bind("last_engine_run", JSON.stringify(payload))
    .run();
}

export async function dailyTick(env: Env): Promise<void> {
  const engineEnabled = ((await getSetting(env, "engine_enabled")) || "1") !== "0";
  if (!engineEnabled) return;

  const token = await tryAcquireLock(env, "engine-cycle", 60 * 10);
  if (!token) return;

  const crawlCap = getCap((await getSetting(env, "crawl_cap_per_day")) || env.CAP_CRAWL_PER_DAY, 60);
  const draftCap = getCap((await getSetting(env, "draft_cap_per_day")) || env.CAP_DRAFTS_PER_DAY, 25);
  const sendCap = getCap((await getSetting(env, "send_cap_per_day")) || env.CAP_SEND_PER_DAY, 12);

  const startedAt = nowISO();
  const runId = uuid();
  let scanSummary = emptySummary();
  let drafted = 0;
  let sendResult = { sent: 0, failed: 0 };

  try {
    await logEvent(env, "tick_ok", "Daily tick step started");
    scanSummary = await runScan(env, Math.min(10, crawlCap));
    const draftingEnabled = ((await getSetting(env, "drafting_enabled")) || "1") !== "0";
    if (draftingEnabled) drafted = await runDraft(env, Math.min(10, draftCap));
    sendResult = await runSend(env, Math.min(10, sendCap));
    await logEvent(
      env,
      "tick_ok",
      `Daily tick step finished | scanned ${scanSummary.scanned} | expanded ${scanSummary.expanded} | failed ${scanSummary.failed} | drafted ${drafted} | sent ${sendResult.sent}`
    );
  } catch (error) {
    await logEvent(env, "tick_fail", String(error));
  } finally {
    await persistLastEngineRun(env, {
      runId,
      started_at_iso: startedAt,
      scanned: scanSummary.scanned,
      expanded: scanSummary.expanded,
      skipped: scanSummary.skipped,
      skippedReasons: scanSummary.skippedReasons,
      candidateDiagnostics: scanSummary.candidateDiagnostics,
      failed: scanSummary.failed,
      drafted,
      sent: sendResult.sent,
      sendFailed: sendResult.failed,
      runMode: "tick",
    });
    await releaseLock(env, "engine-cycle", token);
  }
}

export async function runScanOnce(env: Env): Promise<ScanRunSummary> {
  const token = await tryAcquireLock(env, "scan-only", 60 * 5);
  if (!token) return emptySummary();

  const runId = uuid();
  const startedAt = nowISO();

  try {
    const summary = await runScan(env, 10);
    await persistLastEngineRun(env, {
      runId,
      started_at_iso: startedAt,
      scanned: summary.scanned,
      expanded: summary.expanded,
      skipped: summary.skipped,
      skippedReasons: summary.skippedReasons,
      candidateDiagnostics: summary.candidateDiagnostics,
      failed: summary.failed,
      drafted: 0,
      sent: 0,
      sendFailed: 0,
      runMode: "manual_scan",
    });
    await logEvent(env, "scan_ok", `Manual scan completed | scanned ${summary.scanned} | expanded ${summary.expanded} | failed ${summary.failed}`);
    return summary;
  } finally {
    await releaseLock(env, "scan-only", token);
  }
}

export async function runDraftOnce(env: Env): Promise<{ drafted: number }> {
  const token = await tryAcquireLock(env, "draft-only", 60 * 5);
  if (!token) return { drafted: 0 };

  const runId = uuid();
  const startedAt = nowISO();

  try {
    const drafted = await runDraft(env, 10);
    await persistLastEngineRun(env, {
      runId,
      started_at_iso: startedAt,
      scanned: 0,
      expanded: 0,
      skipped: 0,
      skippedReasons: {},
      candidateDiagnostics: emptySummary().candidateDiagnostics,
      failed: 0,
      drafted,
      sent: 0,
      sendFailed: 0,
      runMode: "manual_draft",
    });
    await logEvent(env, "draft_ok", `Manual draft completed | drafted ${drafted}`);
    return { drafted };
  } finally {
    await releaseLock(env, "draft-only", token);
  }
}

export async function runSendApproved(env: Env): Promise<{ sent: number; failed: number }> {
  const token = await tryAcquireLock(env, "send-only", 60 * 5);
  if (!token) return { sent: 0, failed: 0 };

  const runId = uuid();
  const startedAt = nowISO();

  try {
    const result = await runSend(env, 10);
    await persistLastEngineRun(env, {
      runId,
      started_at_iso: startedAt,
      scanned: 0,
      expanded: 0,
      skipped: 0,
      skippedReasons: {},
      candidateDiagnostics: emptySummary().candidateDiagnostics,
      failed: 0,
      drafted: 0,
      sent: result.sent,
      sendFailed: result.failed,
      runMode: "manual_send",
    });
    await logEvent(env, "send_ok", `Manual send completed | sent ${result.sent} | failed ${result.failed}`);
    return result;
  } finally {
    await releaseLock(env, "send-only", token);
  }
}
