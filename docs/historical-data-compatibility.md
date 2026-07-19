# Historical data compatibility boundary

The EVAVO Growth Research Worker retains historical lead, draft, event and suppression records in D1 while active outbound execution remains removed.

## Authoritative distinction

Historical data values are not runtime capabilities.

The database may contain lead or draft statuses such as:

- `drafted`
- `approved`
- `sent`
- `failed`
- `rejected`

These values may be required to read existing rows, produce aggregate history, explain prior review decisions and preserve migration compatibility. Their presence does not mean the current Worker can generate drafts or send email.

## Active capability posture

The active Worker has no:

- legacy execution engine module
- email sender module
- MailChannels configuration
- draft runtime cap
- send runtime cap
- mutable AI, drafting or sending settings
- scheduled outbound execution
- manual outbound execution route

All public status output is aggregate and review-first. Protected review routes may update internal review state only.

## Schema and migration rule

`schema.sql` is a legacy bootstrap reference only. It must not be applied to the live or an already-migrated D1 database.

The production schema is the result of the ordered migration history under `migrations/`. Use:

```powershell
npm run db:migrations:check
npm run db:migrations:print
```

Apply individual migrations deliberately with the guarded helper described in `migrations/README.md`.

Do not:

- rebuild the live database from `schema.sql`
- rewrite historical statuses merely to match current capability
- delete suppression records
- infer active sending from historical `sent` rows
- infer active drafting from historical draft records

## Future cleanup rule

Historical statuses may only be retired after all of the following are proven:

1. the live D1 row counts and distinct status values have been inspected;
2. active Worker and private-hub consumers no longer depend on those values;
3. a reversible migration and reporting plan exists;
4. suppression and audit retention obligations are preserved;
5. the change passes the historical-data compatibility contract.
