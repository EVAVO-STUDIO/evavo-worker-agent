import assert from "node:assert/strict";
import test from "node:test";

import {
  fetchPublicResearchHtml,
  validatePublicResearchUrl,
  type PublicResearchTransport,
} from "../src/core/publicResearchFetch.ts";

function expectedSha256(value: string): Promise<string> {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)).then((digest) =>
    Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join(""),
  );
}

test("public URL validation rejects non-public and credential-bearing targets", () => {
  const rejected = [
    ["http://localhost/path", "non_public_research_host"],
    ["http://2130706433/path", "non_public_research_host"],
    ["http://[::1]/path", "non_public_research_host"],
    ["https://metadata.google.internal/path", "non_public_research_host"],
    ["https://user:password@example.com/path", "url_credentials_not_allowed"],
    ["https://example.com:8443/path", "non_standard_port_not_allowed"],
    ["file:///etc/passwd", "unsupported_url_protocol"],
    ["https://example.com/path?access_token=secret", "sensitive_query_parameter_not_allowed"],
    ["https://example.com/path?client-secret=secret", "sensitive_query_parameter_not_allowed"],
  ] as const;

  for (const [url, error] of rejected) {
    const result = validatePublicResearchUrl(url);
    assert.equal(result.ok, false, url);
    assert.equal(result.error, error, url);
    assert.equal(result.url, null, url);
  }
});

test("public URL validation normalizes a safe URL without its fragment", () => {
  const result = validatePublicResearchUrl(" https://Example.COM:443/a?topic=grants#details ");
  assert.equal(result.ok, true);
  assert.equal(result.error, null);
  assert.equal(result.url, "https://example.com/a?topic=grants");
});

test("manual redirects are validated and recorded before the next request", async () => {
  const calls: Array<{ url: string; redirect: RequestRedirect | undefined }> = [];
  const transport: PublicResearchTransport = async (url, init) => {
    calls.push({ url, redirect: init.redirect });
    if (url === "https://research.example.com/start") {
      return new Response(null, {
        status: 302,
        headers: { location: "/final" },
      });
    }
    return new Response("<html><body>grant opportunity</body></html>", {
      status: 200,
      headers: {
        "content-type": "text/html; charset=utf-8",
        etag: '"version-7"',
        "last-modified": "Wed, 22 Jul 2026 01:02:03 GMT",
        "content-language": "en-AU",
      },
    });
  };

  const result = await fetchPublicResearchHtml("https://research.example.com/start", { transport });
  assert.equal(result.ok, true);
  assert.equal(result.contract, "public_research_fetch_v2");
  assert.equal(result.finalUrl, "https://research.example.com/final");
  assert.equal(result.redirectCount, 1);
  assert.deepEqual(result.redirectChain, [{
    from: "https://research.example.com/start",
    status: 302,
    to: "https://research.example.com/final",
  }]);
  assert.equal(result.etag, '"version-7"');
  assert.equal(result.lastModified, "Wed, 22 Jul 2026 01:02:03 GMT");
  assert.equal(result.contentLanguage, "en-AU");
  assert.equal(result.bodySha256, await expectedSha256("<html><body>grant opportunity</body></html>"));
  assert.equal(result.timeoutScope, "full_operation");
  assert.deepEqual(calls, [
    { url: "https://research.example.com/start", redirect: "manual" },
    { url: "https://research.example.com/final", redirect: "manual" },
  ]);
});

test("an unsafe redirect is rejected before a second transport call", async () => {
  let calls = 0;
  const transport: PublicResearchTransport = async () => {
    calls += 1;
    return new Response(null, {
      status: 302,
      headers: { location: "http://127.0.0.1/private" },
    });
  };

  const result = await fetchPublicResearchHtml("https://research.example.com/start", { transport });
  assert.equal(result.ok, false);
  assert.equal(result.error, "non_public_research_host");
  assert.equal(result.redirectCount, 0);
  assert.equal(calls, 1);
});

test("bounded reads reject oversized and binary responses", async (t) => {
  await t.test("oversized response", async () => {
    const bytes = new Uint8Array(16_385).fill(65);
    const result = await fetchPublicResearchHtml("https://research.example.com/large", {
      maxBytes: 16_384,
      transport: async () => new Response(bytes, { headers: { "content-type": "text/html" } }),
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "response_too_large");
    assert.equal(result.body, "");
  });

  await t.test("binary body without a trustworthy type", async () => {
    const result = await fetchPublicResearchHtml("https://research.example.com/binary", {
      transport: async () => new Response(new Uint8Array([0, 1, 2, 3, 4])),
    });
    assert.equal(result.ok, false);
    assert.equal(result.error, "binary_response_rejected");
    assert.equal(result.bodySha256, null);
  });
});

test("HTML research rejects a non-HTML declared media type", async () => {
  const result = await fetchPublicResearchHtml("https://research.example.com/data", {
    transport: async () => new Response('{"ok":true}', { headers: { "content-type": "application/json" } }),
  });
  assert.equal(result.ok, false);
  assert.equal(result.error, "unsupported_content_type");
});
