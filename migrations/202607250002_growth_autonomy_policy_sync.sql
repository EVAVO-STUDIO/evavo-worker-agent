create table if not exists growth_autonomy_policy_sync_requests (
  key_id text not null,
  nonce text not null,
  request_id text not null,
  organisation_id text not null,
  workspace_id text not null,
  policy_version integer not null,
  policy_sha256 text not null,
  body_sha256 text not null,
  idempotency_key text not null,
  changed integer not null,
  received_at text not null,
  primary key (key_id, nonce),
  unique (key_id, request_id),
  check (key_id glob '[a-z0-9]*'),
  check (length(nonce) = 43),
  check (length(request_id) between 16 and 160),
  check (policy_version >= 1),
  check (length(policy_sha256) = 64),
  check (length(body_sha256) = 64),
  check (length(idempotency_key) between 16 and 160),
  check (changed in (0, 1)),
  check (received_at glob '*Z')
);

create index if not exists growth_autonomy_policy_sync_tenant_version_idx
  on growth_autonomy_policy_sync_requests (
    organisation_id,
    workspace_id,
    policy_version desc,
    received_at desc
  );

create index if not exists growth_autonomy_policy_sync_idempotency_idx
  on growth_autonomy_policy_sync_requests (
    organisation_id,
    workspace_id,
    idempotency_key
  );

drop trigger if exists prevent_growth_autonomy_policy_cache_version_regression;
create trigger prevent_growth_autonomy_policy_cache_version_regression
before update on growth_autonomy_policy_cache
for each row
when
  new.source_version < old.source_version
  or (
    new.source_version = old.source_version
    and (
      new.policy_sha256 <> old.policy_sha256
      or new.profile <> old.profile
      or new.timezone <> old.timezone
      or new.source_updated_at <> old.source_updated_at
    )
  )
begin
  select raise(abort, 'GROWTH_AUTONOMY_POLICY_SYNC_VERSION_CONFLICT');
end;
