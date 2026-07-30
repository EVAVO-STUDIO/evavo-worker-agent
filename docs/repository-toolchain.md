# Worker repository toolchain

`EVAVO-STUDIO/evavo-worker-agent` uses one exact local and hosted validation toolchain:

```text
Node.js 24.18.0
npm 11.16.0
package-lock.json lockfileVersion 3
```

The Node.js release is pinned in `.nvmrc`, `package.json`, `evavo.reliability.json`, and all three active exact-SHA workflows. The committed npm lockfile remains authoritative and is installed with `npm ci`.

## Dependency-free validation

Run before dependency installation:

```powershell
node scripts/check-repository-toolchain.mjs
node scripts/test-repository-toolchain.mjs
```

The checker verifies:

- exact Node.js and npm identities;
- package and lockfile root identity;
- the repository-owned governance mirror;
- direct-main lease and force-push restrictions;
- exact runtime selection in every active workflow; and
- the presence of the existing workflow-policy gate.

The adversarial fixture copies bounded evidence into an owned temporary directory and proves that Node.js, npm, lockfile, profile, and workflow drift fail closed.

## Validation order

```text
exact toolchain
→ adversarial drift fixtures
→ npm ci
→ complete Worker local safety and contract gate
→ exact-SHA workflow receipt
```

The confidentiality lane remains read-only and does not install application dependencies. It still validates the exact repository toolchain before checking live private visibility.

## Authority boundary

The repository remains the EVAVO Growth Research Worker. Historical Cloudflare Worker and D1 identifiers are compatibility-only.

A green validation result does not authorize:

- outbound execution;
- email or social publishing;
- browser automation;
- Cloudflare deployment;
- D1 mutation;
- external spend;
- repository visibility change; or
- customer communication.

Those effects require their separate reviewed authority and evidence.
