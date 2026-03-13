import {
  cleanTitle,
  extractEmails,
  extractLinks,
  extractMailtoEmails,
  getDomain,
  guessTitleFromHtml,
  inferGeoHint,
  looksLikeContactForm,
  looksLikeWeakTitle,
  pickContactPage,
  rankEmailsForOutreach,
  stripHtmlToText,
  summarizeContact,
  uniqueStrings,
} from "./util";
import type { LeadBrief, LeadClass, ScoreBreakdown } from "./db";

export type SiteAnalysis = {
  companyNameGuess: string | null;
  bestEmail: string | null;
  allEmails: string[];
  contactPageUrl: string | null;
  hasContactForm: boolean;
  businessType: string | null;
  serviceTags: string[];
  techTags: string[];
  geoHint: string | null;
  siteFlags: string[];
  groundedFacts: string[];
  outreachAngles: string[];
  avoidSaying: string[];
  confidence: "low" | "medium" | "high";
  leadClass: LeadClass;
  score: ScoreBreakdown;
  brief: LeadBrief;
  signals: Array<{ key: string; value: string }>;
};

function detectBusinessType(text: string): string | null {
  const t = text.toLowerCase();
  if (t.includes("builder") || t.includes("construction") || t.includes("renovation") || t.includes("homes")) return "builder_trades";
  if (t.includes("digital marketing") || t.includes("seo") || t.includes("web design") || t.includes("branding agency") || t.includes("creative agency") || t.includes("marketing agency")) return "digital_agency";
  if (t.includes("software") || t.includes("app development") || t.includes("web development")) return "software_dev";
  if (t.includes("photographer") || t.includes("studio")) return "creative_service";
  if (t.includes("hosting") || t.includes("website host")) return "hosting_provider";
  return null;
}

function collectTags(text: string) {
  const t = text.toLowerCase();
  const serviceTags = uniqueStrings([
    t.includes("web design") || t.includes("website design") ? "web" : "",
    t.includes("web development") || t.includes("app development") ? "development" : "",
    t.includes("seo") ? "seo" : "",
    t.includes("ecommerce") ? "ecommerce" : "",
    t.includes("shopify") ? "ecommerce" : "",
    t.includes("google ads") || t.includes("paid media") || t.includes("ppc") ? "paid media" : "",
    t.includes("social media") ? "social" : "",
    t.includes("branding") ? "branding" : "",
    t.includes("graphic design") ? "design" : "",
    t.includes("construction") || t.includes("builder") ? "construction" : "",
    t.includes("hosting") ? "hosting" : "",
    t.includes("marketing") ? "marketing" : "",
  ]);

  const techTags = uniqueStrings([
    t.includes("wordpress") ? "wordpress" : "",
    t.includes("shopify") ? "shopify" : "",
    t.includes("woocommerce") ? "woocommerce" : "",
    t.includes("wix") ? "wix" : "",
    t.includes("squarespace") ? "squarespace" : "",
    t.includes("webflow") ? "webflow" : "",
  ]);

  return { serviceTags, techTags };
}

function classifyLead(serviceTags: string[], businessType: string | null, siteFlags: string[], directEmail: boolean): LeadClass {
  if (siteFlags.includes("redirect_or_placeholder") || siteFlags.includes("junk_title")) return "low_signal";
  if (businessType === "hosting_provider") return "do_not_contact";
  if (businessType === "digital_agency") return directEmail ? "possible_partner" : "agency_peer";
  if (businessType === "builder_trades") return "ideal_client";
  if (serviceTags.includes("construction")) return "ideal_client";
  if (serviceTags.includes("web") || serviceTags.includes("seo") || serviceTags.includes("branding") || serviceTags.includes("marketing")) return directEmail ? "possible_partner" : "agency_peer";
  return directEmail ? "low_signal" : "do_not_contact";
}

function buildAngles(leadClass: LeadClass, serviceTags: string[], siteFlags: string[]) {
  const angles: string[] = [];
  const avoid: string[] = [];

  if (leadClass === "ideal_client") {
    angles.push("Tighten enquiry flow and mobile conversion path.");
    angles.push("Lift credibility with clearer project, gallery, or testimonial presentation.");
    if (siteFlags.includes("weak_contact")) angles.push("Add a cleaner direct contact path to reduce enquiry friction.");
  }

  if (leadClass === "possible_partner" || leadClass === "agency_peer") {
    angles.push("Offer overflow development or implementation support.");
    angles.push("Position EVAVO as a practical technical partner, not a generic agency pitch.");
    if (serviceTags.includes("branding") || serviceTags.includes("seo") || serviceTags.includes("marketing")) {
      angles.push("Offer delivery support on rebuilds, technical cleanup, or conversion fixes.");
    }
  }

  if (siteFlags.includes("dated_site")) angles.push("Mention the site feels dated and could be tightened without making fake performance claims.");
  if (siteFlags.includes("thin_copy")) angles.push("Focus on sharpening clarity and trust signals rather than promising vague growth.");
  if (siteFlags.includes("has_testimonials")) angles.push("Use their existing proof points as something that could be surfaced more clearly on-site.");
  if (siteFlags.includes("has_portfolio")) angles.push("Suggest making project work easier to scan and convert from.");

  if (siteFlags.includes("redirect_or_placeholder")) avoid.push("Do not pretend the website is polished or fully built.");
  if (siteFlags.includes("no_direct_email")) avoid.push("Do not claim you found the right person directly.");
  avoid.push("Do not use generic hype or fake praise.");

  return { angles: uniqueStrings(angles).slice(0, 4), avoid: uniqueStrings(avoid).slice(0, 4) };
}

export async function analyzeSite(homeUrl: string, homeHtml: string, contactHtml?: string, aboutHtml?: string): Promise<SiteAnalysis> {
  const domain = getDomain(homeUrl);
  const titleGuess = cleanTitle(guessTitleFromHtml(homeHtml) || "");
  const homeText = stripHtmlToText(homeHtml);
  const contactText = contactHtml ? stripHtmlToText(contactHtml) : "";
  const aboutText = aboutHtml ? stripHtmlToText(aboutHtml) : "";
  const combinedText = `${homeText} ${contactText} ${aboutText}`.trim();
  const lowerCombined = combinedText.toLowerCase();

  const links = extractLinks(homeHtml, homeUrl);
  const contactPageUrl = pickContactPage(links, domain);
  const hasContactForm = looksLikeContactForm(contactHtml || homeHtml);
  const allEmails = rankEmailsForOutreach([
    ...extractMailtoEmails(homeHtml),
    ...extractMailtoEmails(contactHtml || ""),
    ...extractEmails(homeText),
    ...extractEmails(contactText),
    ...extractEmails(aboutText),
  ]);
  const bestEmail = allEmails[0] || null;

  const companyNameGuess = titleGuess || domain.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
  const businessType = detectBusinessType(combinedText);
  const { serviceTags, techTags } = collectTags(combinedText);
  const geoHint = inferGeoHint(combinedText, domain);

  const siteFlags = uniqueStrings([
    looksLikeWeakTitle(titleGuess) ? "junk_title" : "",
    /redirect|forward/i.test(titleGuess) ? "redirect_or_placeholder" : "",
    !bestEmail && !hasContactForm ? "weak_contact" : "",
    !bestEmail ? "no_direct_email" : "",
    serviceTags.length === 0 ? "low_service_signal" : "",
    homeText.length < 350 ? "thin_copy" : "",
    /est\.?\s*\d{4}|award winning|trusted|family builder|custom homes/i.test(combinedText) ? "credibility_signal" : "",
    /copyright\s+20(1\d|2[0-4])/i.test(homeText) ? "dated_site" : "",
    /testimonial|review|what our clients say|google review/i.test(lowerCombined) ? "has_testimonials" : "",
    /project|portfolio|case stud/i.test(lowerCombined) ? "has_portfolio" : "",
    /quote|book now|get a quote|request a quote/i.test(lowerCombined) ? "has_quote_cta" : "",
    /pricing|packages/i.test(lowerCombined) ? "has_pricing_signal" : "",
  ]);

  const leadClass = classifyLead(serviceTags, businessType, siteFlags, !!bestEmail);
  const { angles, avoid } = buildAngles(leadClass, serviceTags, siteFlags);

  const groundedFacts = uniqueStrings([
    titleGuess ? `Title suggests: ${titleGuess}.` : "",
    geoHint ? `Location signal: ${geoHint}.` : "",
    serviceTags.length ? `Services visible: ${serviceTags.join(", ")}.` : "",
    techTags.length ? `Tech clues: ${techTags.join(", ")}.` : "",
    bestEmail ? `Best direct email found: ${bestEmail}.` : "",
    hasContactForm ? "Contact form detected." : "",
    contactPageUrl ? `Contact page found: ${contactPageUrl}.` : "",
    siteFlags.includes("has_testimonials") ? "Testimonials or reviews appear to be present." : "",
    siteFlags.includes("has_portfolio") ? "Project or portfolio content appears to be present." : "",
    siteFlags.includes("has_quote_cta") ? "Quote or enquiry CTA is visible on-site." : "",
  ]);

  const fit = (() => {
    let score = 0;
    if (leadClass === "ideal_client") score += 42;
    if (leadClass === "possible_partner") score += 30;
    if (leadClass === "agency_peer") score += 18;
    if (serviceTags.includes("construction")) score += 18;
    if (serviceTags.includes("web") || serviceTags.includes("seo") || serviceTags.includes("branding") || serviceTags.includes("marketing")) score += 10;
    if (siteFlags.includes("low_service_signal")) score -= 12;
    return Math.max(0, Math.min(100, score));
  })();

  const contactability = (() => {
    let score = 0;
    if (bestEmail) score += 45;
    if (allEmails.length > 1) score += 8;
    if (hasContactForm) score += 15;
    if (contactPageUrl) score += 10;
    if (siteFlags.includes("weak_contact")) score -= 20;
    return Math.max(0, Math.min(100, score));
  })();

  const opportunity = (() => {
    let score = 0;
    if (siteFlags.includes("dated_site")) score += 15;
    if (siteFlags.includes("thin_copy")) score += 8;
    if (siteFlags.includes("has_portfolio") || siteFlags.includes("has_testimonials")) score += 5;
    if (leadClass === "ideal_client") score += 10;
    if (leadClass === "possible_partner") score += 12;
    return Math.max(0, Math.min(100, score));
  })();

  const risk = (() => {
    let score = 0;
    if (leadClass === "do_not_contact") score += 50;
    if (leadClass === "agency_peer") score += 10;
    if (siteFlags.includes("redirect_or_placeholder")) score += 25;
    if (siteFlags.includes("junk_title")) score += 15;
    return Math.max(0, Math.min(100, score));
  })();

  const total = Math.max(0, Math.min(100, fit + contactability + opportunity - risk));
  const score: ScoreBreakdown = { fit, contactability, opportunity, risk, total };
  const confidence: "low" | "medium" | "high" = total >= 70 ? "high" : total >= 40 ? "medium" : "low";

  const brief: LeadBrief = {
    companyName: companyNameGuess || null,
    businessType,
    geoHint,
    summary: [
      businessType ? `Looks like ${businessType.replace(/_/g, " ")}.` : "Business type is unclear.",
      serviceTags.length ? `Visible services: ${serviceTags.join(", ")}.` : "Service mix is not clear from the site.",
      siteFlags.includes("dated_site") ? "The site appears dated or overdue for cleanup." : "",
      siteFlags.includes("thin_copy") ? "The site content feels thin or sparse." : "",
      siteFlags.includes("has_portfolio") ? "There appears to be project or portfolio content that could be surfaced better." : "",
    ].filter(Boolean).join(" "),
    siteQualitySummary: siteFlags.includes("redirect_or_placeholder")
      ? "Site looks redirect-like or placeholder-heavy."
      : siteFlags.includes("dated_site")
      ? "Site appears live but dated."
      : siteFlags.includes("thin_copy")
      ? "Site is live but content looks thin."
      : "Site appears live and readable.",
    siteFlags,
    serviceTags,
    techTags,
    outreachAngles: angles,
    groundedFacts,
    avoidSaying: avoid,
    contactSummary: summarizeContact(allEmails, hasContactForm, contactPageUrl),
    confidence,
  };

  const signals = uniqueStrings([
    ...serviceTags.map((v) => `service:${v}`),
    ...techTags.map((v) => `tech:${v}`),
    businessType ? `business:${businessType}` : "",
    geoHint ? `geo:${geoHint}` : "",
    ...siteFlags.map((v) => `flag:${v}`),
  ]).map((value) => {
    const [key, rest] = value.split(":");
    return { key, value: rest || value };
  });

  return {
    companyNameGuess: companyNameGuess || null,
    bestEmail,
    allEmails,
    contactPageUrl,
    hasContactForm,
    businessType,
    serviceTags,
    techTags,
    geoHint,
    siteFlags,
    groundedFacts,
    outreachAngles: angles,
    avoidSaying: avoid,
    confidence,
    leadClass,
    score,
    brief,
    signals,
  };
}
