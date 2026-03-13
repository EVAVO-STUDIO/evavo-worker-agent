// src/util.ts

export function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

export function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((v) => (v || "").trim())
        .filter(Boolean)
    )
  );
}

export function normalizeUrl(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    url.hash = "";
    url.search = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function normalizeSeedUrl(input: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return "";
  }
}

export function normalizeLeadCandidateUrl(input: string): string {
  const url = normalizeUrl(input);
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return "";
  }
}

export function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

const ENTITY_MAP: Record<string, string> = {
  amp: "&",
  nbsp: " ",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  ndash: "–",
  mdash: "—",
  copy: "©",
  reg: "®",
};

export function decodeHtmlEntities(value: string): string {
  return (value || "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (_, name) => ENTITY_MAP[name.toLowerCase()] ?? `&${name};`);
}

export function stripHtmlToText(html: string): string {
  return decodeHtmlEntities(
    (html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
}

export function extractEmails(text: string): string[] {
  const out = new Set<string>();
  const normalized = decodeHtmlEntities(text)
    .replace(/\s*\[at\]\s*/gi, "@")
    .replace(/\s*\(at\)\s*/gi, "@")
    .replace(/\s*\[dot\]\s*/gi, ".")
    .replace(/\s*\(dot\)\s*/gi, ".");

  const re = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized))) {
    const email = match[0].toLowerCase();
    if (!email.includes("example.com") && !email.includes("yourdomain")) out.add(email);
  }
  return [...out];
}

export function scoreEmailForOutreach(email: string): number {
  const e = (email || "").toLowerCase();
  if (!e.includes("@")) return 0;
  let score = 0;
  const local = e.split("@")[0] || "";
  const domain = e.split("@")[1] || "";
  if (/^(hello|info|contact|admin|sales|enquiries|enquiry|office)$/.test(local)) score += 30;
  if (/^(support|accounts|billing|careers|jobs|privacy|noreply|no-reply|donotreply|do-not-reply)$/.test(local)) score -= 25;
  if (/[a-z]+\.[a-z]+/.test(local) || /^[a-z]{2,}$/.test(local)) score += 12;
  if (/(gmail|yahoo|hotmail|outlook|bigpond)\./.test(domain)) score -= 6;
  if (/(example|test)/.test(e)) score -= 50;
  return score;
}

export function rankEmailsForOutreach(emails: string[]): string[] {
  return uniqueStrings(emails)
    .sort((a, b) => scoreEmailForOutreach(b) - scoreEmailForOutreach(a) || a.localeCompare(b));
}

export function extractLinks(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  const patterns = [/href\s*=\s*"([^"]+)"/gi, /href\s*=\s*'([^']+)'/gi];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(html))) {
      const href = (match[1] || "").trim();
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:") || href.startsWith("javascript:")) continue;
      try {
        const url = new URL(href, baseUrl);
        url.hash = "";
        out.add(url.toString());
      } catch {
        // ignore
      }
    }
  }
  return [...out];
}

export function extractMailtoEmails(html: string): string[] {
  const out = new Set<string>();
  const re = /mailto:([^"'?#\s>]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html || ""))) {
    const email = decodeURIComponent(match[1]).trim().toLowerCase();
    if (email && email.includes("@")) out.add(email);
  }
  return [...out];
}

export function isKnownDirectoryDomain(domain: string): boolean {
  const d = (domain || "").toLowerCase();
  return [
    "yellowpages.com.au",
    "truelocal.com.au",
    "whitepages.com.au",
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "x.com",
    "twitter.com",
    "youtube.com",
    "tiktok.com",
    "google.com",
    "maps.google.com",
    "googleusercontent.com",
    "cloudfront.net",
    "wixsite.com",
    "squarespace.com",
    "godaddysites.com",
  ].some((host) => d === host || d.endsWith(`.${host}`));
}

export function isLikelyNonBusinessPath(pathname: string): boolean {
  const p = (pathname || "").toLowerCase();
  return [
    "/privacy",
    "/privacy-policy",
    "/terms",
    "/terms-and-conditions",
    "/login",
    "/signin",
    "/sign-in",
    "/signup",
    "/sign-up",
    "/register",
    "/account",
    "/my-account",
    "/checkout",
    "/cart",
    "/search",
    "/feed",
    "/wp-admin",
    "/wp-login.php",
  ].some((bad) => p === bad || p.startsWith(`${bad}/`));
}

export function looksLikeWeakTitle(title: string): boolean {
  const t = (title || "").trim().toLowerCase();
  return !t || ["home", "award", "html redirect", "boosting performance", "welcome", "untitled"].includes(t);
}

export function cleanTitle(value: string): string {
  return decodeHtmlEntities((value || "").replace(/\s+/g, " ").replace(/[|•·]+/g, " ").trim());
}

export function guessTitleFromHtml(html: string): string | null {
  const match = /<title>([^<]{1,250})<\/title>/i.exec(html || "");
  if (!match) return null;
  const cleaned = cleanTitle(match[1]);
  if (!cleaned) return null;
  const parts = cleaned
    .split(/[\-|–—:]+/)
    .map((part) => cleanTitle(part))
    .filter(Boolean);
  return parts[0] || cleaned;
}

export function pickContactPage(links: string[], sameDomain: string): string | null {
  const scored = links
    .map((raw) => {
      try {
        const url = new URL(raw);
        const domain = url.hostname.replace(/^www\./i, "").toLowerCase();
        if (domain !== sameDomain.toLowerCase()) return null;
        const path = url.pathname.toLowerCase();
        let score = 0;
        if (path.includes("contact")) score += 120;
        if (path.includes("enquire") || path.includes("enquiry") || path.includes("inquiry")) score += 90;
        if (path.includes("about")) score += 40;
        if (path.includes("get-in-touch")) score += 80;
        if (isLikelyNonBusinessPath(path)) score -= 200;
        return { url: url.toString(), score };
      } catch {
        return null;
      }
    })
    .filter((item): item is { url: string; score: number } => !!item)
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.url || null;
}

export function looksLikeContactForm(html: string): boolean {
  const h = (html || "").toLowerCase();
  if (!h.includes("<form")) return false;
  const hasEmail = h.includes('type="email"') || h.includes("name=\"email\"") || h.includes("email");
  const hasMessage = h.includes("textarea") || h.includes("message") || h.includes("enquiry") || h.includes("inquiry");
  return hasEmail && hasMessage;
}

export function inferGeoHint(text: string, domain: string): string | null {
  const hay = (text || "").toLowerCase();
  const mapping = [
    ["melbourne", "Melbourne"],
    ["sydney", "Sydney"],
    ["brisbane", "Brisbane"],
    ["perth", "Perth"],
    ["adelaide", "Adelaide"],
    ["hobart", "Hobart"],
    ["canberra", "Canberra"],
    ["gold coast", "Gold Coast"],
    ["sunshine coast", "Sunshine Coast"],
    ["newcastle", "Newcastle"],
    ["tamworth", "Tamworth"],
    ["mildura", "Mildura"],
    ["toowoomba", "Toowoomba"],
  ] as const;
  for (const [needle, label] of mapping) if (hay.includes(needle)) return label;
  if (domain.endsWith(".com.au") || domain.endsWith(".au")) return "Australia";
  if (domain.endsWith(".co.nz") || domain.endsWith(".nz")) return "New Zealand";
  return null;
}

export function summarizeContact(allEmails: string[], hasForm: boolean, contactPageUrl: string | null): string {
  if (allEmails.length) return `Best direct email: ${allEmails[0]}${allEmails.length > 1 ? ` (+${allEmails.length - 1} more found)` : ""}.`;
  if (hasForm && contactPageUrl) return `Contact form found on ${contactPageUrl}.`;
  if (hasForm) return "Contact form found.";
  if (contactPageUrl) return `Contact page found at ${contactPageUrl}, but no direct email detected.`;
  return "No direct contact route found.";
}
