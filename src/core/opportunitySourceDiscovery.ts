import type { Env } from "../db";

type SourceCandidate = {
  url: string;
  label: string;
  sourceType: string;
  country: string;
  region?: string | null;
  category: string;
  score: number;
  reasons: string[];
  duplicate: boolean;
  existingSourceId?: string | null;
};

type ExistingSource = {
  id: string;
  url: string;
  label?: string | null;
  source_type?: string | null;
  country?: string | null;
  region?: string | null;
  category?: string | null;
  status?: string | null;
  priority?: number | null;
};

const BASE_CANDIDATES: Array<Omit<SourceCandidate, "score" | "reasons" | "duplicate" | "existingSourceId">> = [
  {
    url: "https://www.tenders.gov.au/",
    label: "Australian Government AusTender",
    sourceType: "government_tenders",
    country: "AU",
    region: "national",
    category: "tenders",
  },
  {
    url: "https://www.grants.gov.au/",
    label: "Australian Government GrantConnect",
    sourceType: "government_grants",
    country: "AU",
    region: "national",
    category: "grants",
  },
  {
    url: "https://www.buy.nsw.gov.au/supplier-centre/opportunities",
    label: "NSW Government procurement opportunities",
    sourceType: "government_tenders",
    country: "AU",
    region: "NSW",
    category: "tenders",
  },
  {
    url: "https://www.tenders.vic.gov.au/",
    label: "Buying for Victoria tenders",
    sourceType: "government_tenders",
    country: "AU",
    region: "VIC",
    category: "tenders",
  },
  {
    url: "https://qtenders.epw.qld.gov.au/",
    label: "Queensland Government QTenders",
    sourceType: "government_tenders",
    country: "AU",
    region: "QLD",
    category: "tenders",
  },
  {
    url: "https://www.tenders.sa.gov.au/",
    label: "South Australian Government tenders",
    sourceType: "government_tenders",
    country: "AU",
    region: "SA",
    category: "tenders",
  },
  {
    url: "https://www.tenders.wa.gov.au/",
    label: "Western Australian Government tenders",
    sourceType: "government_tenders",
    country: "AU",
    region: "WA",
    category: "tenders",
  },
  {
    url: "https://www.tenders.tas.gov.au/",
    label: "Tasmanian Government tenders",
    sourceType: "government_tenders",
    country: "AU",
    region: "TAS",
    category: "tenders",
  },
  {
    url: "https://tenders.nt.gov.au/",
    label: "Northern Territory Government tenders",
    sourceType: "government_tenders",
    country: "AU",
    region: "NT",
    category: "tenders",
  },
  {
    url: "https://www.tenders.act.gov.au/",
    label: "ACT Government tenders",
    sourceType: "government_tenders",
    country: "AU",
    region: "ACT",
    category: "tenders",
  },
  {
    url: "https://www.gets.govt.nz/",
    label: "New Zealand GETS tenders",
    sourceType: "government_tenders",
    country: "NZ",
    region: "national",
    category: "tenders",
  },
  {
    url: "https://www.digital.govt.nz/standards-and-guidance/digital-service-design-standard/",
    label: "NZ digital government standards and supplier signal",
    sourceType: "government_digital_signal",
    country: "NZ",
    region: "national",
    category: "digital_services",
  },
  {
    url: "https://www.business.gov.au/grants-and-programs",
    label: "Australian business grants and programs",
    sourceType: "business_grants",
    country: "AU",
    region: "national",
    category: "grants",
  },
  {
    url: "https://www.nsw.gov.au/grants-and-funding",
    label: "NSW grants and funding",
    sourceType: "government_grants",
    country: "AU",
    region: "NSW",
    category: "grants",
  },
  {
    url: "https://www.vic.gov.au/grants",
    label: "Victorian Government grants",
    sourceType: "government_grants",
    country: "AU",
    region: "VIC",
    category: "grants",
  },
  {
    url: "https://www.qld.gov.au/community/community-organisations-volunteering/funding-grants-resources",
    label: "Queensland grants and funding",
    sourceType: "government_grants",
    country: "AU",
    region: "QLD",
    category: "grants",
  },
  {
    url: "https://business.govt.nz/",
    label: "New Zealand business support and funding signals",
    sourceType: "business_grants",
    country: "NZ",
    region: "national",
    category: "grants",
  },
  {
    url: "https://www.screenrights.org/cultural-fund/",
    label: "Screenrights Cultural Fund",
    sourceType: "creative_grants",
    country: "AU",
    region: "national",
    category: "creative_funding",
  },
  {
    url: "https://creative.gov.au/investment-and-development/",
    label: "Creative Australia investment and development",
    sourceType: "creative_grants",
    country: "AU",
    region: "national",
    category: "creative_funding",
  },
  {
    url: "https://www.startupdaily.net/tag/grants/",
    label: "Startup Daily grants signal feed",
    sourceType: "market_signal",
    country: "AU",
    region: "national",
    category: "startup_funding",
  },
];

function normalizeUrl(raw: string) {
  try {
    const url = new URL(raw.trim());
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return raw.trim().replace(/\/+$/, "");
  }
}

function domainOf(raw: string) {
  try {
    return new URL(raw).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return raw.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0].toLowerCase();
  }
}

function scoreCandidate(candidate: Omit<SourceCandidate, "score" | "reasons" | "duplicate" | "existingSourceId">, existingByDomain: Map<string, ExistingSource>) {
  const reasons: string[] = [];
  let score = 30;
  const lower = `${candidate.url} ${candidate.label} ${candidate.sourceType} ${candidate.category}`.toLowerCase();
  const domain = domainOf(candidate.url);

  if (/tender|procurement|supplier|buy/.test(lower)) {
    score += 24;
    reasons.push("source_candidate:tender_or_procurement");
  }
  if (/grant|funding|program|investment/.test(lower)) {
    score += 22;
    reasons.push("source_candidate:grant_or_funding");
  }
  if (/digital|technology|service|creative|startup/.test(lower)) {
    score += 12;
    reasons.push("source_candidate:evavo_relevant_category");
  }
  if (/\.gov\.au|\.govt\.nz|gov\.au|govt\.nz/.test(domain)) {
    score += 18;
    reasons.push("source_candidate:government_authority");
  }
  if (candidate.region && candidate.region !== "national") {
    score += 4;
    reasons.push("source_candidate:regional_coverage");
  }
  if (/facebook|instagram|linkedin|twitter|x\.com|youtube|tiktok/.test(lower)) {
    score -= 50;
    reasons.push("source_candidate:social_noise_penalty");
  }
  if (/\.pdf$|\.zip$|\.jpg$|\.png$/.test(lower)) {
    score -= 80;
    reasons.push("source_candidate:file_noise_penalty");
  }

  const existing = existingByDomain.get(domain);
  const duplicate = Boolean(existing);
  if (duplicate) {
    score -= 35;
    reasons.push("source_candidate:existing_domain_duplicate");
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, reasons, duplicate, existingSourceId: existing?.id || null };
}

async function tableExists(env: Env, tableName: string): Promise<boolean> {
  const row = await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ? LIMIT 1").bind(tableName).first<any>();
  return Boolean(row?.name);
}

async function existingOpportunitySources(env: Env): Promise<ExistingSource[]> {
  if (!(await tableExists(env, "opportunity_sources"))) return [];
  const rows = await env.DB.prepare(
    `SELECT id, url, label, source_type, country, region, category, status, priority
     FROM opportunity_sources
     LIMIT 5000`
  ).all<ExistingSource>();
  return rows.results || [];
}

function candidateMatchesFilters(candidate: SourceCandidate, filters: { country?: string; category?: string; includeDuplicates?: boolean }) {
  if (filters.country && candidate.country.toUpperCase() !== filters.country.toUpperCase()) return false;
  if (filters.category && candidate.category !== filters.category) return false;
  if (!filters.includeDuplicates && candidate.duplicate) return false;
  return true;
}

export async function previewOpportunitySourceCandidates(env: Env, options: { country?: string; category?: string; limit?: number; includeDuplicates?: boolean } = {}) {
  const existing = await existingOpportunitySources(env);
  const existingByDomain = new Map(existing.map((source) => [domainOf(normalizeUrl(source.url)), source]));
  const limit = Math.max(1, Math.min(100, Math.round(Number(options.limit || 50))));

  const candidates: SourceCandidate[] = BASE_CANDIDATES.map((base) => {
    const normalizedBase = { ...base, url: normalizeUrl(base.url) };
    const scored = scoreCandidate(normalizedBase, existingByDomain);
    return { ...normalizedBase, ...scored };
  })
    .filter((candidate) => candidateMatchesFilters(candidate, { country: options.country, category: options.category, includeDuplicates: options.includeDuplicates }))
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url))
    .slice(0, limit);

  return {
    ok: true,
    mode: "opportunity_source_candidate_preview",
    candidateCount: candidates.length,
    existingSourceCount: existing.length,
    candidates,
    filters: {
      country: options.country || null,
      category: options.category || null,
      includeDuplicates: Boolean(options.includeDuplicates),
      limit,
    },
    safety: {
      previewOnly: true,
      writesTables: [],
      callsAI: false,
      sendsEmail: false,
      postsExternally: false,
      appliesExternally: false,
      callsNetwork: false,
    },
  };
}
