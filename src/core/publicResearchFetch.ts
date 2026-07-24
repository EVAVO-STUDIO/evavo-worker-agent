export const PUBLIC_RESEARCH_FETCH_CONTRACT = "public_research_fetch_v1";
export const DEFAULT_PUBLIC_RESEARCH_MAX_BYTES = 1_048_576;
export const DEFAULT_PUBLIC_RESEARCH_MAX_REDIRECTS = 4;
export const DEFAULT_PUBLIC_RESEARCH_TIMEOUT_MS = 12_000;

export type PublicResearchUrlDecision = {
  ok: boolean;
  url: string | null;
  error: string | null;
};

export type PublicResearchFetchOptions = {
  maxBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
  accept?: string;
  acceptLanguage?: string;
};

export type PublicResearchFetchResult = {
  ok: boolean;
  contract: typeof PUBLIC_RESEARCH_FETCH_CONTRACT;
  requestedUrl: string | null;
  finalUrl: string | null;
  redirectCount: number;
  status: number;
  contentType: string;
  body: string;
  bytes: number;
  bodySha256: string | null;
  elapsedMs: number;
  fetchedAtISO: string;
  error: string | null;
};

const BLOCKED_HOST_SUFFIXES = [
  ".localhost",
  ".local",
  ".internal",
  ".lan",
  ".home",
  ".test",
  ".invalid",
  ".example",
  ".onion",
];

const BLOCKED_EXACT_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function normalizedHostname(url: URL): string {
  return url.hostname.replace(/^\[/, "").replace(/\]$/, "").replace(/\.$/, "").toLowerCase();
}

function parseIpv4(hostname: string): number[] | null {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname)) return null;
  const octets = hostname.split(".").map(Number);
  if (octets.some((value) => !Number.isInteger(value) || value < 0 || value > 255)) return null;
  return octets;
}

function isBlockedIpv4(octets: number[]): boolean {
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 0 && octets[2] === 2) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && octets[2] === 100) return true;
  if (a === 203 && b === 0 && octets[2] === 113) return true;
  if (a >= 224) return true;
  return false;
}

function isBlockedIpv6(hostname: string): boolean {
  const value = hostname.toLowerCase();
  if (!value.includes(":")) return false;
  if (value === "::" || value === "::1") return true;
  if (value.startsWith("fc") || value.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(value)) return true;
  if (value.startsWith("ff")) return true;
  if (value.startsWith("2001:db8:")) return true;
  if (value.startsWith("::ffff:")) return true;
  return false;
}

function isBlockedHostname(hostname: string): boolean {
  if (!hostname || BLOCKED_EXACT_HOSTS.has(hostname)) return true;
  if (BLOCKED_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return true;
  const ipv4 = parseIpv4(hostname);
  if (ipv4) return isBlockedIpv4(ipv4);
  if (isBlockedIpv6(hostname)) return true;
  if (!hostname.includes(".")) return true;
  return false;
}

export function validatePublicResearchUrl(raw: unknown, baseUrl?: string): PublicResearchUrlDecision {
  const input = String(raw || "").trim();
  if (!input) return { ok: false, url: null, error: "url_required" };

  try {
    const url = baseUrl ? new URL(input, baseUrl) : new URL(input);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return { ok: false, url: null, error: "unsupported_url_protocol" };
    }
    if (url.username || url.password) {
      return { ok: false, url: null, error: "url_credentials_not_allowed" };
    }

    const hostname = normalizedHostname(url);
    if (isBlockedHostname(hostname)) {
      return { ok: false, url: null, error: "non_public_research_host" };
    }

    const port = url.port;
    if (port && !((url.protocol === "https:" && port === "443") || (url.protocol === "http:" && port === "80"))) {
      return { ok: false, url: null, error: "non_standard_port_not_allowed" };
    }

    url.hash = "";
    return { ok: true, url: url.toString(), error: null };
  } catch {
    return { ok: false, url: null, error: "invalid_research_url" };
  }
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

async function readBodyBounded(response: Response, maxBytes: number): Promise<{ ok: boolean; bytes: Uint8Array; error: string | null }> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response.body?.cancel().catch(() => undefined);
    return { ok: false, bytes: new Uint8Array(), error: "response_too_large" };
  }

  if (!response.body) return { ok: true, bytes: new Uint8Array(), error: null };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      if (!next.value) continue;
      total += next.value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("response_too_large").catch(() => undefined);
        return { ok: false, bytes: new Uint8Array(), error: "response_too_large" };
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes: combined, error: null };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function failedResult(
  requestedUrl: string | null,
  finalUrl: string | null,
  redirectCount: number,
  startedAt: number,
  error: string,
  status = 0,
  contentType = "",
): PublicResearchFetchResult {
  return {
    ok: false,
    contract: PUBLIC_RESEARCH_FETCH_CONTRACT,
    requestedUrl,
    finalUrl,
    redirectCount,
    status,
    contentType,
    body: "",
    bytes: 0,
    bodySha256: null,
    elapsedMs: Date.now() - startedAt,
    fetchedAtISO: new Date().toISOString(),
    error,
  };
}

export async function fetchPublicResearchHtml(rawUrl: unknown, options: PublicResearchFetchOptions = {}): Promise<PublicResearchFetchResult> {
  const startedAt = Date.now();
  const initial = validatePublicResearchUrl(rawUrl);
  if (!initial.ok || !initial.url) return failedResult(null, null, 0, startedAt, initial.error || "invalid_research_url");

  const maxBytes = boundedInteger(options.maxBytes, DEFAULT_PUBLIC_RESEARCH_MAX_BYTES, 16_384, 5_242_880);
  const maxRedirects = boundedInteger(options.maxRedirects, DEFAULT_PUBLIC_RESEARCH_MAX_REDIRECTS, 0, 8);
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_PUBLIC_RESEARCH_TIMEOUT_MS, 1_000, 30_000);
  const requestedUrl = initial.url;
  let currentUrl = initial.url;
  let redirectCount = 0;
  const visited = new Set<string>();

  while (true) {
    if (visited.has(currentUrl)) return failedResult(requestedUrl, currentUrl, redirectCount, startedAt, "redirect_loop");
    visited.add(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("research_fetch_timeout"), timeoutMs);
    let response: Response;

    try {
      response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: options.accept || "text/html,application/xhtml+xml;q=0.9",
          "accept-language": options.acceptLanguage || "en-AU,en;q=0.9",
          "user-agent": "EVAVO-Growth-Research-Worker/1.0 (+https://evavo.com.au)",
        },
      });
    } catch (error) {
      clearTimeout(timeout);
      const reason = error instanceof Error && error.name === "AbortError" ? "research_fetch_timeout" : "research_fetch_failed";
      return failedResult(requestedUrl, currentUrl, redirectCount, startedAt, reason);
    }
    clearTimeout(timeout);

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get("location");
      await response.body?.cancel().catch(() => undefined);
      if (!location) return failedResult(requestedUrl, currentUrl, redirectCount, startedAt, "redirect_location_missing", response.status);
      if (redirectCount >= maxRedirects) return failedResult(requestedUrl, currentUrl, redirectCount, startedAt, "too_many_redirects", response.status);
      const next = validatePublicResearchUrl(location, currentUrl);
      if (!next.ok || !next.url) {
        return failedResult(requestedUrl, currentUrl, redirectCount, startedAt, next.error || "unsafe_redirect_target", response.status);
      }
      currentUrl = next.url;
      redirectCount += 1;
      continue;
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !/text\/html|application\/xhtml\+xml/.test(contentType)) {
      await response.body?.cancel().catch(() => undefined);
      return failedResult(requestedUrl, currentUrl, redirectCount, startedAt, "non_html_response", response.status, contentType);
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      return failedResult(requestedUrl, currentUrl, redirectCount, startedAt, `http_${response.status}`, response.status, contentType);
    }

    const bounded = await readBodyBounded(response, maxBytes);
    if (!bounded.ok) return failedResult(requestedUrl, currentUrl, redirectCount, startedAt, bounded.error || "response_read_failed", response.status, contentType);

    const body = new TextDecoder("utf-8", { fatal: false }).decode(bounded.bytes);
    return {
      ok: Boolean(body.trim()),
      contract: PUBLIC_RESEARCH_FETCH_CONTRACT,
      requestedUrl,
      finalUrl: currentUrl,
      redirectCount,
      status: response.status,
      contentType,
      body,
      bytes: bounded.bytes.byteLength,
      bodySha256: await sha256Hex(bounded.bytes),
      elapsedMs: Date.now() - startedAt,
      fetchedAtISO: new Date().toISOString(),
      error: body.trim() ? null : "empty_response",
    };
  }
}
