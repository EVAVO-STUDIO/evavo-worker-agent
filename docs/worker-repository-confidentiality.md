# Worker repository confidentiality

## Required posture

`EVAVO-STUDIO/evavo-worker-agent` is the private backend for EVAVO growth research, internal business intelligence, review metadata and strategy memory.

The required GitHub repository posture is:

```text
private: true
visibility: private
archived: false
```

At the connector verification performed on July 27, 2026, GitHub reported the repository as public. That is a release and governance blocker. Source hardening and tracked-secret scanning reduce exposure risk, but they are not substitutes for repository confidentiality.

## Live verification

The focused live check is:

```powershell
node scripts/check-worker-repository-visibility.mjs --live
```

The read-only workflow runs the same check with GitHub's built-in repository token. It reads repository metadata only and performs no repository mutation.

The check requires:

- `GITHUB_REPOSITORY` to equal `EVAVO-STUDIO/evavo-worker-agent`;
- a bounded read-only `GITHUB_TOKEN` or `GH_TOKEN`;
- an HTTP 200 JSON response from GitHub's repository metadata endpoint;
- `full_name` to match the expected repository;
- `private` to be `true`;
- `visibility` to be `private`;
- `archived` to be `false`.

The response body is byte-bounded. The token and response body are never logged.

## Static verification

The local deterministic command is:

```powershell
npm run worker:repository-visibility:check
```

Static mode verifies the policy document and focused workflow without making a network request or requiring a credential. The complete local gate includes this command, but only the live GitHub workflow can prove current repository visibility.

## Remediation

Change repository visibility through an approved GitHub administrative path. After changing it:

1. run or re-run the focused repository-confidentiality workflow;
2. verify the live result reports `private: true` and `visibility: private`;
3. review collaborators, teams, deploy keys, GitHub Apps and Actions permissions;
4. confirm the Cloudflare deployment integration still has the minimum required repository access;
5. keep tracked-source secret and credential-rotation controls in force.

Changing GitHub visibility does not rename or redeploy the Cloudflare Worker, does not change the D1 database, and does not authorize any external execution capability.

## Secret-history boundary

Making the repository private does not revoke a credential that was previously committed or exposed. Any real credential found in source or history must still be rotated or revoked at its provider. A history rewrite should be treated as a separate reviewed incident-response decision.

## Workflow boundary

The focused workflow:

- uses read-only `contents` permission;
- persists no checkout credential;
- installs no dependencies;
- requests no Worker secret;
- performs no deployment;
- makes one bounded read of the current repository metadata;
- remains red while the repository is public.

A green source-secret check must never be interpreted as proof that repository visibility is private.
