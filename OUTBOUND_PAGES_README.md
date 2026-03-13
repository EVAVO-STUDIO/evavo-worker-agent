# EVAVO Outbound Lab + Admin (Patch v5 — hardened)

This patch adds:
- Public status page: `/outbound-lab`
- Admin console: `/admin/outbound-agent` (HTTP Basic Auth)
- Server-side proxy API routes that keep your Worker admin token secret.

## Pages
- Public: `/outbound-lab`
- Admin: `/admin/outbound-agent` (HTTP Basic Auth)

## Next.js API routes (proxy)
Public (cacheable):
- `/api/outbound/public/status`
- `/api/outbound/public/events?limit=20`

Admin (no-store + Basic Auth required):
- `/api/outbound/admin/overview`
- `/api/outbound/admin/leads` (GET, POST)
- `/api/outbound/admin/drafts` (GET)
- `/api/outbound/admin/drafts/[id]/approve` (POST)
- `/api/outbound/admin/drafts/[id]/reject` (POST)
- `/api/outbound/admin/run` (POST)

## Required environment variables (set in Vercel)
Required:
- OUTBOUND_AGENT_BASE_URL
  Example: https://evavo-outbound-agent.evavo-studio.workers.dev
- OUTBOUND_AGENT_ADMIN_TOKEN
  Must match the Worker ADMIN_TOKEN secret.

Required (admin Basic Auth):
- OUTBOUND_ADMIN_USERNAME
- OUTBOUND_ADMIN_PASSWORD

## Security notes
- Admin page SSR enforces Basic Auth (401 w/ WWW-Authenticate).
- Admin proxy API routes ALSO enforce Basic Auth (prevents token abuse).
- Admin responses include: Cache-Control: no-store, X-Frame-Options: DENY, X-Robots-Tag: noindex.

## Worker endpoints expected
Public:
- GET /public/status
- GET /public/events?limit=N

Admin (Bearer token):
- GET /admin/overview
- GET /admin/leads?limit=N&status=...
- POST /admin/leads { websiteUrl }
- GET /admin/drafts?limit=N&status=queued
- POST /admin/drafts/:id/approve
- POST /admin/drafts/:id/reject
- POST /admin/run { kind: "draft" | ... }
