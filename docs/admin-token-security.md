# Administrator token security

`ADMIN_TOKEN` is the single server-side credential accepted by protected EVAVO Growth Research Worker routes.

## Required shape

- minimum UTF-8 length: **32 bytes**;
- maximum UTF-8 length: **256 bytes**;
- no leading or trailing whitespace;
- no embedded whitespace;
- sent only as `Authorization: Bearer <token>`.

The Worker validates both the configured secret and the presented credential before hashing. A weak configured value therefore fails closed even when the caller presents the same weak value.

The bounded maximum prevents oversized authorization values from consuming unnecessary hashing and request-processing work. Valid values are compared through fixed-length SHA-256 digests without a direct string equality branch.

## Generation and storage

Generate a high-entropy secret with a cryptographically secure password manager or operating-system random source. Store it only through:

```text
wrangler secret put ADMIN_TOKEN
```

Do not put the value in `wrangler.toml`, source code, screenshots, logs, query strings, browser storage or documentation.

## Rotation

Rotate the token immediately if it is disclosed, copied into a repository, sent through an insecure channel or exposed in logs. Update authorised server-side callers in a controlled window and verify old-token rejection after rotation.

No browser client should possess this credential. Protected browser-facing workflows must terminate at a separate authenticated server boundary rather than forwarding `ADMIN_TOKEN` to the browser.
