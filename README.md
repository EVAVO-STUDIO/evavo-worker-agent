# EVAVO Outbound Agent (Cloudflare Worker)

This is a conservative outbound assistant:
- Adds leads from **public websites** (manual URL add for v1)
- Analyzes site + contact page
- Drafts a short outreach email with Cloudflare AI
- Queues drafts for **human approval**
- Sends via MailChannels (optional) with an unsubscribe link (sending can be disabled)
- Hard caps per day for crawl/draft/send

## Quick start

1) Install deps
```bash
npm i
```

2) Create the D1 database and apply schema

```bash
wrangler d1 create evavo_outbound_agent
# copy the database_id into wrangler.toml (under [[d1_databases]])
npm run db:init:remote
```

> Tip: `npm run db:init:local` applies the schema to Wrangler’s local dev database only.
> Use `db:init:remote` to initialize the real cloud D1 database you just created.

3) Set secrets
```bash
wrangler secret put ADMIN_TOKEN
wrangler secret put MAILCHANNELS_API_KEY   # optional (required to send)
wrangler secret put FROM_EMAIL             # optional
wrangler secret put REPLY_TO_EMAIL         # optional
wrangler secret put PUBLIC_BASE_URL        # optional (https://evavo.com.au)
```

4) Dev / Deploy
```bash
npm run dev
npm run deploy
```

## Endpoints

Public:
- `GET /public/status`
- `GET /public/events?limit=18`
- `GET /public/unsubscribe?email=...`

Admin (Bearer token):
- `GET /admin/overview`
- `GET /admin/leads?status=new&limit=50`
- `POST /admin/leads` `{ websiteUrl }`
- `GET /admin/drafts?status=queued&limit=50`
- `POST /admin/drafts/:id/approve`
- `POST /admin/drafts/:id/reject`
- `POST /admin/drafts/:id/send` (requires MailChannels)
- `POST /admin/run` `{ kind: "draft" | "send" | "scan" }`
- `POST /admin/engine` `{ enabled: boolean }` (v1 placeholder)
## Common gotchas

### D1 schema executed locally (not remote)
If you see output mentioning `.wrangler/state/...` and `local database`, you initialized the local dev DB.
Run this to initialize the real remote DB:

```bash
npm run db:init:remote
```

### Updating secrets
To replace a secret value:

```bash
wrangler secret put ADMIN_TOKEN
```

To delete an optional secret:

```bash
wrangler secret delete MAILCHANNELS_API_KEY
```
