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
  setSetting,
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

export interface ScanResult {
  companyName?: string;
  classification: string;
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
  country?: string | null;
  region?: string | null;
}

function normalizeWebsite(raw: string): string {
  const trimmed = String(raw || "").trim();
  if (!trimmed) throw new Error("Missing website URL");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}

function extractEmails(input: string): string[] {
  const matches = input.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  const cleaned = new Set<string>();
  for (const value of matches) {
    const email = value.toLowerCase();
    if (!/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(email)) cleaned.add(email);
  }
  return Array.from(cleaned);
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
    if (!res.ok) return "";
    return await res.text();
  } catch {
    return "";
  }
}

function extractDescription(html: string): string {
  return html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1]?.trim() || "";
}

function extractTitle(html: string): string {
  return html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1]?.trim() || "";
}

function guessCompanyName(title: string, domain: string): string {
  if (title) {
    const cleaned = title.split(/[\-|•|:|·]/)[0].replace(/\s+/g, " ").trim();
    if (cleaned) return cleaned;
  }
  return domain.replace(/^www\./i, "");
}

function classifyLead(domain: string, html: string): { classification: string; serviceTags: string[]; techTags: string[] } {
  const content = html.toLowerCase();
  const domainLower = domain.toLowerCase();
  const techTags: string[] = [];
  const serviceTags: string[] = [];

  if (/shopify/.test(content)) techTags.push("shopify");
  if (/wordpress|wp-content/.test(content)) techTags.push("wordpress");
  if (/wix/.test(content)) techTags.push("wix");
  if (/squarespace/.test(content)) techTags.push("squarespace");
  if (/react|next\.js|__next/.test(content)) techTags.push("react");
  if (/webflow/.test(content)) techTags.push("webflow");

  if (/e[- ]?commerce|checkout|cart|product/.test(content)) serviceTags.push("ecommerce");
  if (/design|branding|studio|creative/.test(content)) serviceTags.push("design");
  if (/development|software|engineer|developer/.test(content)) serviceTags.push("development");
  if (/marketing|seo|ads|campaign/.test(content)) serviceTags.push("marketing");
  if (/agency|white[- ]?label|partner/.test(content)) serviceTags.push("agency");

  let classification = "general";
  if (/(^|\.)gov(\.|$)| government /.test(` ${domainLower} ${content} `)) classification = "government";
  else if (/(^|\.)edu(\.|$)| university | school /.test(` ${domainLower} ${content} `)) classification = "education";
  else if (/nonprofit|not-for-profit|charity|ngo/.test(content)) classification = "nonprofit";
  else if (/saas|software as a service|book demo|start free|sign in/.test(content)) classification = "saas";
  else if (serviceTags.includes("ecommerce")) classification = "ecommerce";
  else if (serviceTags.includes("agency")) classification = "agency";
  else if (/builder|plumber|electrician|contractor|cabinet|joinery|roofing|construction/.test(content)) classification = "contractor";

  return { classification, serviceTags, techTags };
}

async function heuristicScan(websiteUrl: string): Promise<ScanResult> {
  const normalized = normalizeWebsite(websiteUrl);
  const url = new URL(normalized);
  const html = await fetchHtml(normalized);
  const title = extractTitle(html);
  const description = extractDescription(html);
  const { classification, serviceTags, techTags } = classifyLead(url.hostname, html);

  const emails = extractEmails(html);
  const contactEmail = emails[0];
  const contactHrefMatch = html.match(/href=["']([^"']*contact[^"']*)["']/i);
  const contactPageUrl = contactHrefMatch ? new URL(contactHrefMatch[1], normalized).toString() : null;
  const hasContactForm = /<form[\s\S]*?(contact|enquiry|inquiry|message)/i.test(html) || Boolean(contactPageUrl);

  let fit = 0.45;
  if (["ecommerce", "saas", "agency", "contractor"].includes(classification)) fit = 0.82;
  if (["government", "education", "nonprofit"].includes(classification)) fit = 0.18;
  if (/wix|squarespace|weebly|template/i.test(html)) fit += 0.08;
  if (!html.trim()) fit -= 0.12;

  let contact = 0.2;
  if (contactEmail) contact = 0.95;
  else if (hasContactForm) contact = 0.55;

  let risk = 0.05;
  if (/\.(xyz|click|top|info)$/i.test(url.hostname)) risk = 0.45;
  if (/(casino|bet|porn|adult|download crack)/i.test(html)) risk = 0.9;

  fit = Math.max(0, Math.min(1, fit));
  contact = Math.max(0, Math.min(1, contact));
  risk = Math.max(0, Math.min(1, risk));

  const scoreTotal = fit * 0.5 + contact * 0.35 - risk * 0.2;
  const outreachAngles: string[] = [];
  if (classification === "agency") outreachAngles.push("support overflow delivery", "offer white-label capacity");
  if (classification === "contractor") outreachAngles.push("make the site clearer for inbound enquiries", "improve trust and lead capture");
  if (serviceTags.includes("ecommerce")) outreachAngles.push("improve conversion flow");
  if (techTags.some((tag) => ["wordpress", "wix", "squarespace"].includes(tag))) outreachAngles.push("rebuild into a stronger custom stack");
  if (!outreachAngles.length) outreachAngles.push("tighten positioning and site performance");

  const groundedFacts: string[] = [];
  if (title) groundedFacts.push(`Title: ${title}`);
  if (description) groundedFacts.push(`Description: ${description}`);
  if (contactEmail) groundedFacts.push(`Email found: ${contactEmail}`);
  if (contactPageUrl) groundedFacts.push(`Contact page: ${contactPageUrl}`);

  let brief = `General business with ${serviceTags.join(", ") || "unspecified offerings"}`;
  if (classification === "agency") brief = "Agency lead that may suit white-label or overflow support outreach";
  else if (classification === "contractor") brief = "Contractor-style business where practical lead-generation improvements may be valuable";
  else if (classification === "ecommerce") brief = "Commerce-focused business with likely conversion optimisation opportunities";
  else if (classification === "saas") brief = "SaaS-style business where positioning and product marketing clarity matter";

  return {
    companyName: guessCompanyName(title, url.hostname),
    classification,
    fitScore: Number(fit.toFixed(2)),
    contactabilityScore: Number(contact.toFixed(2)),
    riskScore: Number(risk.toFixed(2)),
    scoreTotal: Number(scoreTotal.toFixed(2)),
    brief,
    contactEmail,
    contactPageUrl,
    hasContactForm,
    contactSummary: contactEmail ? `Found direct email ${contactEmail}` : hasContactForm ? "No direct email found, but a contact route exists" : "No direct contact route found",
    siteQualitySummary: html ? "Site loaded successfully" : "Could not fetch site",
    techTags,
    serviceTags,
    outreachAngles,
    avoidSaying: classification === "agency" ? ["we can replace your team", "you need a redesign"] : classification === "nonprofit" ? ["profit"] : [],
    groundedFacts,
    title,
    description,
    country: null,
    region: null,
  };
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
  };
}

function envBrandLine(env: Env): string {
  return env.BRAND_NAME || "EVAVO Studio";
}

function cleanCompanyName(lead: LeadRow): string {
  const signals = parseLeadSignals(lead);
  return lead.company_name || signals.companyName || lead.website_url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
}

function buildAgencyDraft(env: Env, lead: LeadRow) {
  const signals = parseLeadSignals(lead);
  const company = cleanCompanyName(lead);
  const domain = lead.website_url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const facts = (signals.groundedFacts || []).slice(0, 2).join("; ");

  return {
    subject: `Possible overflow support for ${company}`,
    bodyText: [
      `Hi ${company},`,
      "",
      `I had a look through ${domain} and thought there may be a fit for overflow or white-label support.`,
      facts ? `A couple of grounded things I picked up: ${facts}.` : "",
      "",
      `At ${envBrandLine(env)}, we help teams that need dependable extra capacity across strategy, design, and implementation without adding permanent headcount.`,
      "This would only make sense if you occasionally need extra hands behind the scenes, but if that is relevant, I would be happy to send a short note on how we usually slot in.",
      "",
      "Best,",
      envBrandLine(env),
    ].filter(Boolean).join("\n"),
    followupText: [
      `Hi ${company},`,
      "",
      "Just following up in case overflow or white-label support is relevant at the moment.",
      "Happy to send a short note outlining the kind of work we can quietly support behind the scenes.",
      "",
      "Best,",
      envBrandLine(env),
    ].join("\n"),
    whyJson: JSON.stringify({
      mode: "agency_partnership",
      company,
      category: lead.category,
      score_total: lead.score_total,
      groundedFacts: signals.groundedFacts || [],
      outreachAngles: signals.outreachAngles || [],
    }),
  };
}

function buildContractorDraft(env: Env, lead: LeadRow) {
  const signals = parseLeadSignals(lead);
  const company = cleanCompanyName(lead);
  const domain = lead.website_url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const fact = (signals.groundedFacts || [])[0];

  return {
    subject: `A practical website idea for ${company}`,
    bodyText: [
      `Hi ${company},`,
      "",
      `I had a look through ${domain} and there may be a straightforward opportunity to make the site work harder for new enquiries.`,
      fact ? `One grounded thing that stood out was: ${fact}.` : "",
      "",
      `At ${envBrandLine(env)}, we help service businesses tighten their site structure, lead flow, and trust signals so the website feels more like a useful sales tool than just a placeholder.`,
      "If useful, I can send through a short note with two or three practical suggestions based on what is already there.",
      "",
      "Best,",
      envBrandLine(env),
    ].filter(Boolean).join("\n"),
    followupText: [
      `Hi ${company},`,
      "",
      "Just following up in case a short set of practical website suggestions would be useful.",
      "Happy to keep it brief and specific to what is already on the site.",
      "",
      "Best,",
      envBrandLine(env),
    ].join("\n"),
    whyJson: JSON.stringify({
      mode: "contractor_outreach",
      company,
      category: lead.category,
      score_total: lead.score_total,
      groundedFacts: signals.groundedFacts || [],
      outreachAngles: signals.outreachAngles || [],
    }),
  };
}

function buildGeneralDraft(env: Env, lead: LeadRow) {
  const signals = parseLeadSignals(lead);
  const company = cleanCompanyName(lead);
  const domain = lead.website_url.replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  const serviceTags = signals.serviceTags || [];
  const groundedFacts = signals.groundedFacts || [];
  const outreachAngles = signals.outreachAngles || ["improve digital presence"];

  return {
    subject: serviceTags.includes("ecommerce") ? `Idea to improve ${company}'s conversion flow` : `A practical idea for ${company}`,
    bodyText: [
      `Hi ${company},`,
      "",
      `I had a look through ${domain} and there are a few practical opportunities that stood out.`,
      groundedFacts.length ? `A couple of grounded things I picked up: ${groundedFacts.slice(0, 3).join("; ")}.` : "",
      "",
      `At ${envBrandLine(env)}, we help businesses tighten the quality of their web presence through strategy, design, and build work.`,
      `From what I saw, there may be an opportunity to ${outreachAngles.join(" and ")}.`,
      serviceTags.length ? `It also looks like your focus is around ${serviceTags.join(", ")}.` : "",
      "",
      "Happy to send through a few practical ideas if that would be useful.",
      "",
      "Best,",
      envBrandLine(env),
    ].filter(Boolean).join("\n"),
    followupText: [
      `Hi ${company},`,
      "",
      "Just following up on my earlier note in case it slipped past you.",
      "Happy to send a short teardown with a few practical suggestions if that would help.",
      "",
      "Best,",
      envBrandLine(env),
    ].join("\n"),
    whyJson: JSON.stringify({
      mode: "general_outreach",
      company,
      category: lead.category,
      score_total: lead.score_total,
      serviceTags,
      outreachAngles,
      groundedFacts: groundedFacts.slice(0, 5),
    }),
  };
}

function buildDraftCopy(env: Env, lead: LeadRow) {
  const category = String(lead.category || "").toLowerCase();
  if (category === "agency") return buildAgencyDraft(env, lead);
  if (category === "contractor") return buildContractorDraft(env, lead);
  return buildGeneralDraft(env, lead);
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

export async function scanWebsiteNow(env: Env, websiteInput: string): Promise<LeadRow> {
  const website = normalizeWebsite(websiteInput);
  const lead = await insertLead(env, website, "manual");
  const scan = await heuristicScan(website);
  await updateLead(env, lead.id, {
    company_name: scan.companyName || null,
    category: scan.classification,
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
  await logEvent(env, "scan_ok", `Scanned ${website}`, lead.id);
  return (await getLeadById(env, lead.id)) as LeadRow;
}

async function runScan(env: Env, maxItems: number): Promise<number> {
  const leads = await listLeads(env, { status: "new", limit: maxItems });
  let scanned = 0;
  for (const lead of leads) {
    try {
      const scan = await heuristicScan(lead.website_url);
      await updateLead(env, lead.id, {
        company_name: scan.companyName || null,
        category: scan.classification,
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
      await logEvent(env, "scan_ok", `Scanned ${lead.website_url}`, lead.id);
      scanned += 1;
    } catch (error) {
      await updateLead(env, lead.id, { status: "failed" });
      await logEvent(env, "scan_fail", `Error scanning ${lead.website_url}: ${String(error)}`, lead.id);
    }
  }
  return scanned;
}

async function runDraft(env: Env, maxItems: number): Promise<number> {
  const minimumScore = Number((await getSetting(env, "min_score_for_draft")) || 0.45);
  const leads = await listLeads(env, { status: "scanned", limit: maxItems });
  let drafted = 0;

  for (const lead of leads) {
    if (lead.score_total < minimumScore) continue;
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
        sendEmail(env, {
          to: toEmail,
          subject: draft.subject,
          bodyText: draft.body_text,
        })
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
  let scanned = 0;
  let drafted = 0;
  let sendResult = { sent: 0, failed: 0 };

  try {
    await logEvent(env, "tick_ok", "Daily tick step started");
    scanned = await runScan(env, Math.min(10, crawlCap));
    const draftingEnabled = ((await getSetting(env, "drafting_enabled")) || "1") !== "0";
    if (draftingEnabled) drafted = await runDraft(env, Math.min(10, draftCap));
    sendResult = await runSend(env, Math.min(10, sendCap));
    await logEvent(env, "tick_ok", "Daily tick step finished");
  } catch (error) {
    await logEvent(env, "tick_fail", String(error));
  } finally {
    await setSetting(
      env,
      "last_engine_run",
      JSON.stringify({
        runId,
        started_at_iso: startedAt,
        scanned,
        drafted,
        sent: sendResult.sent,
        failed: sendResult.failed,
      })
    );
    await releaseLock(env, "engine-cycle", token);
  }
}

export async function runScanOnce(env: Env): Promise<{ scanned: number }> {
  const token = await tryAcquireLock(env, "scan-only", 60 * 5);
  if (!token) return { scanned: 0 };
  try {
    const scanned = await runScan(env, 10);
    await logEvent(env, "scan_ok", "Manual scan completed");
    return { scanned };
  } finally {
    await releaseLock(env, "scan-only", token);
  }
}

export async function runDraftOnce(env: Env): Promise<{ drafted: number }> {
  const token = await tryAcquireLock(env, "draft-only", 60 * 5);
  if (!token) return { drafted: 0 };
  try {
    const drafted = await runDraft(env, 10);
    await logEvent(env, "draft_ok", "Manual draft completed");
    return { drafted };
  } finally {
    await releaseLock(env, "draft-only", token);
  }
}

export async function runSendApproved(env: Env): Promise<{ sent: number; failed: number }> {
  const token = await tryAcquireLock(env, "send-only", 60 * 5);
  if (!token) return { sent: 0, failed: 0 };
  try {
    const result = await runSend(env, 10);
    await logEvent(env, "send_ok", "Manual send completed");
    return result;
  } finally {
    await releaseLock(env, "send-only", token);
  }
}
