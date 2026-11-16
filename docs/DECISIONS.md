# DECISIONS.md

Architectural decisions for Veil. One entry per decision; newest at the end.
If something is ambiguous and we had to choose, it is recorded here.

---

## D-01 — App name is "Veil" (2026-11-16)

The task spec left `[AppName]` open. **Assumption:** the product is called
**Veil**. Package scope is `@veil/*`, wire namespace is `veil/v1/`. The user
confirmed this choice during Phase 0 planning.

## D-02 — pnpm (via corepack) + Turborepo (2026-11-16)

Spec default. `packageManager: pnpm@12.21.0` — the version corepack activated
on the dev machine (the 10.x line was superseded; no functional difference for
workspaces). Turborepo runs `build`/`test`/`lint`/`typecheck` in parallel.

## D-03 — TypeScript 5.9, not TypeScript 7 (2026-11-16)

`typescript@latest` resolved to 7.0.2 (the native-compiler line). The
ecosystem (eslint typescript-eslint, Vite, vitest) still targets 5.x, so we
pin `^5.9.3`. Re-evaluate when typescript-eslint ships 7-compatible releases.

## D-04 — Crypto: wrappers only, audited primitives (2026-11-16)

Never roll our own primitives. 1:1 = X3DH + Double Ratchet per the Signal
specification; groups = MLS (RFC 9420). Candidate libraries (registry-checked
in Phase 0): `@signalapp/libsignal-client` (native, audited), `ts-mls`
(Typescript MLS implementation; OpenMLS itself ships no npm package —
verified). Both are hidden behind the `DirectMessageCrypto` / `GroupCrypto`
seams in `@veil/core` so the implementation can be swapped without touching
call sites. **Risk:** native bindings complicate browser builds; if WASM is
required we may implement the Signal spec against libsodium primitives and
carry test vectors from the reference implementations. Test vectors against
reference implementations are a hard requirement before Phase 3 exits.

## D-05 — React 19 + Vite 8 + Tailwind 4 (2026-11-16)

Spec default, registry-verified versions: react 19.3, vite 8.3,
tailwindcss 4.3 (CSS-first config via `@tailwindcss/vite`), zustand 5.

## D-06 — Hand-rolled proto3 codec + protobufjs conformance test (2026-11-16)

`@veil/core` must stay dependency-free for browser/worker/Node use. The
envelope schema is tiny and frozen, so `src/codec.ts` implements proto3
encoding directly, and `test/conformance.test.ts` asserts byte-for-byte
equality against `protobufjs` parsing `proto/envelope.proto`. The `.proto`
file remains normative; if the codec and protobufjs ever disagree, that's a
release-blocking bug. Alternative considered: `@bufbuild/protobuf` (2.17) —
deferred; revisit if the schema grows beyond the envelope.

## D-07 — CRDT engine: Yjs, Automerge deferred (2026-11-16)

`automerge@2` is alpha-only on npm (2.0.0-alpha.3, registry-verified).
Group metadata/reactions therefore use **Yjs 13.6** behind the `CrdtDoc` seam.
Revisit Automerge 2 stable at Phase 5.

## D-08 — Identity = Ed25519 `did:key`, single keypair per identity (2026-11-16)

Identity is one Ed25519 keypair; user-facing id is `did:key:z6Mk…`. A second
X25519 static key handles Noise/mailbox sealing. Device id defaults to the
identity key; linked devices get their own signing key (revocable). Mnemonic
(BIP39) export/import is part of `IdentityCrypto` (Phase 1). Encoding is
dependency-free in `@veil/core` (base58 + varint multicodec prefix 0xed01),
validated against the W3C did:key registry format.

## D-09 — Envelope padding: fixed buckets + 2-byte length footer (2026-11-16)

Buckets 512 / 2048 / 8192 / 32768 bytes. Payload is zero-padded to the bucket
with a trailing uint16 footer recording the padding length so un-padding is
exact and mismatch-detectable. An observer learns only the bucket class.

## D-10 — Windows dev host (2026-11-16)

The primary dev machine is Windows. Consequences: LF enforced via
`.gitattributes`; no shell-script-only build steps; pnpm `onlyBuiltDependencies`
allow-list controls native builds. CI runs on Ubuntu and is the source of
truth for the Linux build.

## D-16 — Identity crypto stack: noble/scure, deterministic key derivation (2026-11-16)

Phase 1 identity operations use **@noble/curves** (Ed25519, X25519),
**@noble/hashes** (SHA-256, Argon2id), **@noble/ciphers**
(ChaCha20-Poly1305) and **@scure/bip39** — audited, pure-JS, browser-safe
libraries (D-04 prohibits hand-rolled primitives). Key derivation from the
BIP39 entropy is domain-separated and deterministic:

```
signSeed  = SHA-256("veil/identity-ed25519-v1" ‖ entropy)  → Ed25519 (sign)
noiseSeed = SHA-256("veil/identity-x25519-v1"  ‖ entropy)  → X25519 (Noise/mailbox)
```

so a 12/24-word mnemonic restores the whole identity. `libsignal-client`
(audited, but a native binding) remains the candidate for the Phase 3
X3DH/Double Ratchet session layer; the `IdentityCrypto`/`DirectMessageCrypto`
seams keep that swappable. At-rest format: Argon2id(passphrase, t=3, 64 MiB)
→ ChaCha20-Poly1305 over a versioned JSON blob containing the entropy; a
mismatched `did` inside a decrypted blob is rejected (fail-closed).

## D-11 — pnpm 12 build-script approvals (2026-11-16)

pnpm 12 no longer reads the `pnpm` field in `package.json`, and blocks
lifecycle scripts by default. `onlyBuiltDependencies` lives in
`pnpm-workspace.yaml`; where the allow-list is not honoured we install with
explicit `--allow-build=esbuild --allow-build=@tailwindcss/oxide`. CI should
use `pnpm install --frozen-lockfile` after the allow-list is committed.

## D-12 — Relay runtime uses `tsx`, not `node dist` (2026-11-16)

`tsc` does not rewrite import specifiers, so extensionless workspace imports
(`./config`, `@veil/core` → `src/index.ts`) fail under plain Node ESM. Rather
than litter every file with `.js` suffixes, the relay node runs through `tsx`
(a TS-aware ESM loader already used for `dev`). `tsc -p` still runs as a
typecheck/emit gate; Docker runs `npx tsx src/server.ts`. Revisit if we later
adopt a bundler for the service.

## D-13 — Docker engine unavailable on the dev host (2026-11-16)

Only the Docker CLI is installed locally (no Desktop/engine), so the relay
image build is validated in CI (`relay-container` job) rather than on the
Windows dev machine. Locally we validate the node by booting `tsx` and probing
`/health` (verified: 200 ok).

## D-14 — Lint/format stack (2026-11-16)

ESLint 10 flat config (`eslint.config.js`) + typescript-eslint 8 recommended,
Prettier 3 (printWidth 110, single quotes). Type-aware lint rules are off for
speed; enable per-package if a package needs them. `pnpm lint` runs once at
the repo root.

## D-15 — i18n without i18next in Phase 0 (2026-11-16)

All UI strings live in `apps/web/src/i18n.ts` behind `t(key, values)`. This
keeps the Phase 0 bundle dependency-light and CSP-clean while remaining
i18n-ready; the module is a drop-in seam for i18next when strings are
extracted per component in Phase 6.
