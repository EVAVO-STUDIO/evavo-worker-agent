# Worker tracked-source secret posture

## Purpose

The Growth Research Worker must remain safe even when its source code can be read outside the runtime environment. Runtime authentication is necessary, but it is not a substitute for preventing credentials, private keys and credential-bearing provider URLs from entering Git history.

The authoritative tracked-source contract is:

```text
npm run worker:source-secret-safety:check
```

It is required by the complete local gate and the read-only Worker contract workflow. The checker reports only the affected file path and rule name. It never prints a matched secret value.

## Local environment files

Use the checked-in template:

```text
.dev.vars.example
```

Copy it locally to `.dev.vars` and replace the placeholders only in the ignored local file. Never commit `.dev.vars`, `.env`, environment-specific variants or copied provider configuration.

The repository ignore policy covers:

```text
.env
.env.*
.dev.vars
.dev.vars.*
.wrangler/
npm-audit.json
```

Only `.env.example` and `.dev.vars.example` may be tracked as environment templates, and their values must remain obvious non-secret placeholders.

## What the checker rejects

The source guard inspects tracked text files and rejects:

- tracked real environment files;
- private-key material;
- common live provider-token shapes;
- credential-bearing database, cache and HTTP URLs;
- non-placeholder assignments to sensitive environment variables;
- npm authentication tokens;
- missing ignore rules or unsafe local-variable templates.

Large files and binary files are skipped deliberately. The contract is a focused source-control boundary, not a substitute for GitHub secret scanning, provider-side revocation or a complete incident-response review.

## Administrator credential

`ADMIN_TOKEN` remains the only active Worker administrator credential. It is server-side only and must be stored as a Cloudflare Worker secret in deployed environments.

The local template does not contain a usable credential. Generate an independent random token with at least 32 bytes of entropy and place it only in the ignored local `.dev.vars` file or the Cloudflare secret store.

## Repository visibility

Repository visibility is an administrative GitHub setting and cannot be enforced by source code or the Worker runtime. The tracked-source contract therefore assumes that source may be readable and requires the repository to remain free of deployable credentials regardless of its visibility.

The repository is currently reported by GitHub as public. If EVAVO's governance intent is for this backend source to remain private, an administrator must change the repository visibility in GitHub settings and review the consequences for forks, Actions, pages, rulesets and external integrations. That setting change is separate from this source hardening and was not performed by the connector.

Changing a repository from public to private does not remove any credential that was already committed. Any discovered credential must still be rotated or revoked, and Git history must be assessed separately.

## Incident response

When a real credential is found in source or history:

1. revoke or rotate it at the provider;
2. update the intended runtime secret store;
3. verify the old value no longer works;
4. inspect logs for unexpected use;
5. decide whether a reviewed history rewrite is required;
6. rerun the complete Worker gate before deployment.

Do not solve an exposure by merely adding the file to `.gitignore`. Ignore rules prevent future accidental tracking; they do not remove existing Git history.
