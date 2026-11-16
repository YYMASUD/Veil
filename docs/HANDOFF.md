# HANDOFF.md — project state & resume guide

> **Purpose:** everything needed to continue Veil development on another
> machine or with a fresh session. Read this top-to-bottom before writing code.
> Last updated: 2026-11-16 (during Phase 1).

## 1. What this is

**Veil** — a decentralized, end-to-end encrypted chat app. No central server
stores messages or identities; users own an Ed25519 keypair (`did:key:z6Mk…`).
Stack: TypeScript strict monorepo (pnpm 12 + Turborepo), React 19 + Vite 8 +
Tailwind 4 + Zustand, libp2p 3.5.1 networking, noble/scure crypto stack,
encrypted local storage. Authoritative docs: `docs/PROTOCOL.md`,
`docs/THREAT_MODEL.md`, `docs/ARCHITECTURE.md`, `docs/DECISIONS.md`,
`docs/AGENTS.md`.

## 2. Phase status (8 phases planned after Phase 0)

| Phase | Scope                                                                 | Status                      |
| ----- | --------------------------------------------------------------------- | --------------------------- |
| 0     | scaffold, `@veil/core` contracts, docs, CI, relay skeleton, web shell | ✅ committed (`main`)       |
| 1     | identity crypto (A), encrypted storage (C), real UI shell (D)         | 🔄 **in progress — see §4** |
| 2     | libp2p transport (B), mailbox wire protocol (E), e2e harness (F)      | queued                      |
| 3     | X3DH + Double Ratchet, verification UI, crypto vectors                | queued                      |
| 4     | mailbox client/service, offline sync                                  | queued                      |
| 5     | MLS groups, CRDT group metadata, group UI                             | queued                      |
| 6     | attachments, receipts, disappearing messages, notifications           | queued                      |
| 7     | Tauri desktop, mobile, multi-device linking                           | queued                      |
| 8     | fuzzing, 50-peer simulation, perf, security review                    | queued                      |

## 3. Setup on a new machine

Prerequisites: **Node ≥ 22**, **git**, optionally Docker (relay image; the dev
box used here has no engine — CI validates it). pnpm comes via corepack.

```bash
corepack enable pnpm          # once; pnpm 12.21.0 is pinned in package.json
pnpm install                  # if build scripts are blocked, add:
                              #   --allow-build=esbuild --allow-build=@tailwindcss/oxide
pnpm lint && pnpm typecheck && pnpm test   # full verify (turbo, parallel)
pnpm --filter @veil/web dev   # web app at http://localhost:5173
pnpm --filter @veil/relay-node start       # relay node (health :8080/health)
```

Expected state at this snapshot: lint clean, typecheck 7/7 packages, tests
7/7 (37 core + 16 crypto + 3 web + 8 relay + 4 seam smoke tests).

Rules that are easy to trip on:

- `@veil/core` is the only shared-types package; additive changes only, and a
  breaking change = `PROTOCOL_VERSION` bump + `docs/PROTOCOL.md` update.
- noble/scure subpath imports need the **`.js` suffix**
  (`@noble/curves/ed25519.js`, `@scure/bip39/wordlists/english.js` exports
  `wordlist`, not `english`).
- Never log plaintext messages, keys or mnemonics. Error strings carry codes
  and sizes only.
- Commit style: conventional commits (`feat(core): …`, `docs: …`).

## 4. Phase 1 exact resume point

**Done (committed on `main`, commit `feat(packages)…` was Phase 0; the Phase 1
work below is the state you cloned):**

- `packages/core/src/crypto.ts` — `Argon2Params` added to the
  `IdentityCrypto.encryptIdentity` seam (additive, non-breaking).
- `packages/core/src/storage.ts` — `StoredMessage.deletedAtMs` added for
  tombstones (additive, non-breaking).
- `packages/core/src/identity.ts` — `IdentityKeypair.entropy?: Uint8Array`
  (BIP39 root entropy travels with the keypair; never persisted unencrypted).
- `packages/crypto/src/identity.ts` — **complete, tested** (340 lines):
  `keypairFromEntropy`, `generateIdentity`, `fromMnemonic`, `toMnemonic`,
  `encryptIdentity`/`decryptIdentity` (Argon2id → ChaCha20-Poly1305, versioned
  JSON blob, fails closed), `signWithEd25519`/`verifyEd25519`, and the
  `identityCrypto` facade implementing the core seam. Derivation:
  `SHA-256("veil/identity-ed25519-v1" ‖ entropy)` → Ed25519 seed;
  `SHA-256("veil/identity-x25519-v1" ‖ entropy)` → X25519 secret (D-16).
- `packages/crypto/src/index.ts` re-exports everything;
  `packages/crypto/test/identity.test.ts` — **16 tests green** incl. RFC 8032
  §7.1 TEST 1 signature vector and AEAD fail-closed cases.

**Next steps, in order (nothing started yet):**

1. **`@veil/crypto` decision log (D-16)** — add the key-derivation entry to
   `docs/DECISIONS.md` (noble/scure chosen over libsignal for Phase 1;
   X3DH/Double Ratchet still land in Phase 3 behind the seam).
2. **`@veil/storage` (agent C)** — implement `MessageStore` + `IdentityStore`
   from `@veil/core/src/storage.ts`. Phase 1 scope: an in-memory or
   IndexedDB/OPFS-backed store is fine; the contract is: HLC ordering via
   `compareClocks`, dedup by message id (`append` returns `false` on
   duplicates), `tombstone()` sets `deletedAtMs`, `upsertReaction` is
   idempotent. `IdentityStore.save/load` wraps
   `encryptIdentity`/`decryptIdentity` from `@veil/crypto`. Target ≥ 80%
   coverage (Turbo enforces nothing yet; the threshold lives in
   `packages/core/vitest.config.ts` as the pattern).
3. **`apps/web` (agent D)** — replace `DEMO_CHATS` with a real session flow:
   onboarding (generate identity → show 12 words → confirm → set passphrase →
   `IdentityStore.save`), unlock screen (decrypt → in-memory session),
   sidebar shows the real `identity.did` (`shortDid()` from core). Keep the
   Zustand store API; swap the internals.
4. **Merge & verify** — `pnpm lint && pnpm typecheck && pnpm test`, then
   commit as `feat(storage): …` and `feat(web): identity onboarding …`, and
   update `docs/AGENTS.md` statuses.

**Do NOT start in Phase 1:** wire protocol, X3DH/Double Ratchet, MLS, relay
mailbox protocol — those are Phases 2–5 and have their own seams.

## 5. Verification commands (run after every change)

```bash
pnpm format                                  # prettier (also: pnpm format:check)
pnpm lint                                    # eslint 10 flat config
pnpm typecheck                               # turbo, all 7 packages, strict TS
pnpm test                                    # turbo, all 7 packages, parallel
pnpm --filter @veil/crypto test              # single package
pnpm --filter @veil/relay-node start         # boot relay; curl :8080/health → ok
```

## 6. Environment notes & gotchas

- **Windows host.** LF enforced by `.gitattributes`; PowerShell 7 is the
  shell. Use `cmd.exe /c npx …` when spawning node CLIs from PowerShell.
- **pnpm 12 blocks lifecycle scripts** by default; `onlyBuiltDependencies`
  lives in `pnpm-workspace.yaml`, and the fallback is
  `pnpm install --allow-build=esbuild --allow-build=@tailwindcss/oxide`.
- **Docker engine is NOT installed** on the original dev box (CLI only). The
  relay image build runs in CI (`.github/workflows/ci.yml` → `relay-container`).
  The relay boots locally via `tsx` (see D-12); `node dist/` will fail with
  `ERR_MODULE_NOT_FOUND` — that is expected, don't chase it.
- **ESM imports:** workspace-internal imports are extensionless
  (`./identity`, `@veil/core`), but **external package subpaths generally
  need `.js`** (noble/scure exports maps are exact-match).
- **Git identity** is repo-local (`Veil Dev <dev@veil.local>`); set your own
  after cloning if you want commits attributed to you.
- **Do not commit** real passphrases, mnemonics or `.env` files; `.gitignore`
  already excludes `*.seed`, `*.key`, `.env*`.

## 7. Key file map

| Path                                 | Contents                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| `packages/core/src/`                 | version, errors, bytes, base58, hash, identity, messages, codec, topics, mailbox, transport, storage, crypto seams |
| `packages/core/proto/envelope.proto` | normative wire schema (protobufjs conformance test pins it)                                                        |
| `packages/crypto/src/identity.ts`    | Phase 1 identity crypto (complete, tested)                                                                         |
| `apps/web/src/`                      | React shell: `store.ts`, `demoData.ts`, `components/`, `useTheme.ts`, `i18n.ts`                                    |
| `apps/relay-node/src/`               | `server.ts` (libp2p), `mailbox.ts` (in-memory store), `config.ts`                                                  |
| `.github/workflows/ci.yml`           | quality / unit-matrix / relay-docker jobs                                                                          |
