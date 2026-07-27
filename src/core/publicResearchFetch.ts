import { copyBytesToArrayBuffer } from "./cryptoBufferSource";

export const PUBLIC_RESEARCH_FETCH_CONTRACT = "public_research_fetch_v2";
export const DEFAULT_PUBLIC_RESEARCH_MAX_BYTES = 1_048_576;
export const DEFAULT_PUBLIC_RESEARCH_MAX_REDIRECTS = 4;
export const DEFAULT_PUBLIC_RESEARCH_TIMEOUT_MS = 12_000;

export type PublicResearchUrlDecision = {
  ok: boolean;
  url: string | null;
  error: string | null;
};

export type PublicResearchTransport = (input: string, init: RequestInit) => Promise<Response>;

export type PublicResearchRedirectHop = {
  from: string;
  status: number;
  to: string;
};

export type PublicResearchFetchOptions = {
  maxBytes?: number;
  maxRedirects?: number;
  timeoutMs?: number;
  accept?: string;
  acceptLanguage?: string;
  contentKind?: "html" | "text";
  transport?: PublicResearchTransport;
};

export type PublicResearchFetchResult = {
  ok: boolean;
  contract: typeof PUBLIC_RESEARCH_FETCH_CONTRACT;
  requestedUrl: string | null;
  finalUrl: string | null;
  redirectCount: number;
  redirectChain: PublicResearchRedirectHop[];
  status: number;
  contentType: string;
  contentLength: number | null;
  etag: string | null;
  lastModified: string | null;
  contentLanguage: string | null;
  body: string;
  bytes: number;
  bodySha256: string | null;
  elapsedMs: number;
  fetchedAtISO: string;
  timeoutScope: "full_operation";
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

const SENSITIVE_QUERY_KEYS = new Set([
  "access_token",
  "api_key",
  "apikey",
  "auth",
  "authorization",
  "client_secret",
  "jwt",
  "password",
  "passwd",
  "secret",
  "session",
  "sessionid",
  "signature",
  "sig",
  "token",
  "x-amz-credential",
  "x-amz-security-token",
  "x-amz-signature",
  "x-goog-credential",
  "x-goog-signature",
]);

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const HTML_CONTENT_TYPE_PATTERN = /text\/html|application\/xhtml\+xml/i;
const PUBLIC_TEXT_CONTENT_TYPE_PATTERN = /text\/|application\/(?:xml|xhtml\+xml|rss\+xml|atom\+xml|json)/i;

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

function hasSensitiveQueryParameter(url: URL): boolean {
  for (const key of url.searchParams.keys()) {
    const normalized = key.trim().toLowerCase();
    if (SENSITIVE_QUERY_KEYS.has(normalized)) return true;
    if (/(?:^|[_-])(?:access[_-]?token|api[_-]?key|client[_-]?secret|password|signature|session[_-]?token)$/.test(normalized)) return true;
  }
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

    if (hasSensitiveQueryParameter(url)) {
      return { ok: false, url: null, error: "sensitive_query_parameter_not_allowed" };
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

function parseContentLength(value: string | null): number | null {
  if (!value || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function boundedHeader(response: Response, name: string, maxLength: number): string | null {
  const value = response.headers.get(name)?.trim();
  return value ? value.slice(0, maxLength) : null;
}

async function readBodyBounded(response: Response, maxBytes: number): Promise<{ ok: boolean; bytes: Uint8Array; error: string | null }> {
  const declaredLength = parseContentLength(response.headers.get("content-length"));
  if (declaredLength !== null && declaredLength > maxBytes) {
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
    try {
      reader.releaseLock();
    } catch {
      // A timed-out or cancelled stream may already have released its lock.
    }
  }

  const combined = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, bytes: combined, error: null };
}

function isProbablyBinary(bytes: Uint8Array): boolean {
  const sample = bytes.subarray(0, Math.min(bytes.byteLength, 512));
  if (!sample.byteLength) return false;
  let suspiciousControls = 0;
  for (const value of sample) {
    if (value === 0) return true;
    if ((value < 0x09 || (value > 0x0d && value < 0x20)) && value !== 0x1b) suspiciousControls += 1;
  }
  return suspiciousControls / sample.byteLength > 0.05;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", copyBytesToArrayBuffer(bytes));
  return Array.from(new Uint8Array(digest)).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function failedResult(
  requestedUrl: string | null,
  finalUrl: string | null,
  redirectChain: PublicResearchRedirectHop[],
  startedAt: number,
  error: string,
  status = 0,
  contentType = "",
  response?: Response,
): PublicResearchFetchResult {
  return {
    ok: false,
    contract: PUBLIC_RESEARCH_FETCH_CONTRACT,
    requestedUrl,
    finalUrl,
    redirectCount: redirectChain.length,
    redirectChain,
    status,
    contentType,
    contentLength: response ? parseContentLength(response.headers.get("content-length")) : null,
    etag: response ? boundedHeader(response, "etag", 512) : null,
    lastModified: response ? boundedHeader(response, "last-modified", 128) : null,
    contentLanguage: response ? boundedHeader(response, "content-language", 128) : null,
    body: "",
    bytes: 0,
    bodySha256: null,
    elapsedMs: Date.now() - startedAt,
    fetchedAtISO: new Date().toISOString(),
    timeoutScope: "full_operation",
    error,
  };
}

function contentTypeAllowed(contentType: string, contentKind: "html" | "text"): boolean {
  if (!contentType) return true;
  return contentKind === "html"
    ? HTML_CONTENT_TYPE_PATTERN.test(contentType)
    : PUBLIC_TEXT_CONTENT_TYPE_PATTERN.test(contentType);
}

async function fetchPublicResearchContent(rawUrl: unknown, options: PublicResearchFetchOptions): Promise<PublicResearchFetchResult> {
  const startedAt = Date.now();
  const initial = validatePublicResearchUrl(rawUrl);
  if (!initial.ok || !initial.url) return failedResult(null, null, [], startedAt, initial.error || "invalid_research_url");

  const maxBytes = boundedInteger(options.maxBytes, DEFAULT_PUBLIC_RESEARCH_MAX_BYTES, 16_384, 5_242_880);
  const maxRedirects = boundedInteger(options.maxRedirects, DEFAULT_PUBLIC_RESEARCH_MAX_REDIRECTS, 0, 8);
  const timeoutMs = boundedInteger(options.timeoutMs, DEFAULT_PUBLIC_RESEARCH_TIMEOUT_MS, 1_000, 30_000);
  const deadlineAt = startedAt + timeoutMs;
  const contentKind = options.contentKind || "html";
  const transport = options.transport || fetch;
  const requestedUrl = initial.url;
  let currentUrl = initial.url;
  const redirectChain: PublicResearchRedirectHop[] = [];
  const visited = new Set<string>();

  while (true) {
    if (visited.has(currentUrl)) return failedResult(requestedUrl, currentUrl, redirectChain, startedAt, "redirect_loop");
    visited.add(currentUrl);

    const remainingMs = deadlineAt - Date.now();
    if (remainingMs <= 0) return failedResult(requestedUrl, currentUrl, redirectChain, startedAt, "research_fetch_timeout");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort("research_fetch_timeout"), remainingMs);
    let phase: "headers" | "body" = "headers";

    try {
      const response = await transport(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          accept: options.accept || (contentKind === "html" ? "text/html,application/xhtml+xml;q=0.9" : "text/plain,application/xml,text/xml,application/json;q=0.9"),
          "accept-language": options.acceptLanguage || "en-AU,en;q=0.9",
          "user-agent": "EVAVO-Growth-Research-Worker/2.0 (+https://evavo.com.au)",
        },
      });

      if (REDIRECT_STATUSES.has(response.status)) {
        const location = response.headers.get("location");
        await response.body?.cancel().catch(() => undefined);
        if (!location) return failedResult(requestedUrl, currentUrl, redirectChain, startedAt, "redirect_location_missing", response.status, "", response);
        if (redirectChain.length >= maxRedirects) return failedResult(requestedUrl, currentUrl, redirectChain, startedAt, "too_many_redirects", response.status, "", response);
        const next = validatePublicResearchUrl(location, currentUrl);
        if (!next.ok || !next.url) {
          return failedResult(requestedUrl, currentUrl, redirectChain, startedAt, next.error || "unsafe_redirect_target", response.status, "", response);
        }
        redirectChain.push({ from: currentUrl, status: response.status, to: next.url });
        currentUrl = next.url;
        continue;
      }

      const contentType = String(response.headers.get("content-type") || "").toLowerCase();
      if (!contentTypeAllowed(contentType, contentKind)) {
        await response.body?.cancel().catch(() => undefined);
        return failedResult(requestedUrl, currentUrl, redirectChain, startedAt, "unsupported_content_type", response.status, contentType, response);
      }
      if (!response.ok) {
        await response.body?.cancel().catch(() => undefined);
        return failedResult(requestedUrl, currentUrl, redirectChain, startedAt, `http_${response.status}`, response.status, contentType, response);
      }

      phase = "body";
      const bounded = await readBodyBounded(response, maxBytes);
      if (!bounded.ok) return failedResult(requestedUrl, currentUrl, redirectChain, startedAt, bounded.error || "response_read_failed", response.status, contentType, response);
      if (isProbablyBinary(bounded.bytes)) return failedResult(requestedUrl, currentUrl, redirectChain, startedAt, "binary_response_rejected", response.status, contentType, response);

      const body = new TextDecoder("utf-8", { fatal: false }).decode(bounded.bytes);
      return {
        ok: Boolean(body.trim()),
        contract: PUBLIC_RESEARCH_FETCH_CONTRACT,
        requestedUrl,
        finalUrl: currentUrl,
        redirectCount: redirectChain.length,
        redirectChain,
        status: response.status,
        contentType,
        contentLength: parseContentLength(response.headers.get("content-length")),
        etag: boundedHeader(response, "etag", 512),
        lastModified: boundedHeader(response, "last-modified", 128),
        contentLanguage: boundedHeader(response, "content-language", 128),
        body,
        bytes: bounded.bytes.byteLength,
        bodySha256: await sha256Hex(bounded.bytes),
        elapsedMs: Date.now() - startedAt,
        fetchedAtISO: new Date().toISOString(),
        timeoutScope: "full_operation",
        error: body.trim() ? null : "empty_response",
      };
    } catch {
      const reason = controller.signal.aborted
        ? "research_fetch_timeout"
        : phase === "body"
          ? "response_read_failed"
          : "research_fetch_failed";
      return failedResult(requestedUrl, currentUrl, redirectChain, startedAt, reason);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export async function fetchPublicResearchHtml(rawUrl: unknown, options: PublicResearchFetchOptions = {}): Promise<PublicResearchFetchResult> {
  return fetchPublicResearchContent(rawUrl, { ...options, contentKind: "html" });
}

export async function fetchPublicResearchText(rawUrl: unknown, options: PublicResearchFetchOptions = {}): Promise<PublicResearchFetchResult> {
  return fetchPublicResearchContent(rawUrl, { ...options, contentKind: "text" });
}
