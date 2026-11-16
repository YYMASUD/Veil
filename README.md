# Veil

Decentralized, end-to-end encrypted chat. Users own their identity (a keypair)
and their data; there is no central server that stores messages or user
identities. The app keeps working if any single node — including our own
bootstrap or relay nodes — goes offline.

- **Identity** — locally generated Ed25519 keypair, user-facing id is a
  `did:key:…` fingerprint, exportable as a BIP39 mnemonic.
- **Encryption** — X3DH + Double Ratchet for 1:1 chats, MLS (RFC 9420) for
  groups. Forward secrecy and post-compromise security are requirements.
- **Networking** — libp2p (WebRTC, WebSockets, WebTransport, QUIC/TCP),
  Kademlia + mDNS discovery, GossipSub topics, Circuit Relay v2 + DCUtR.
- **Offline** — store-and-forward mailbox nodes holding only encrypted blobs
  with a TTL (14 days by default).
- **Local-first** — encrypted SQLite, CRDT sync, hybrid logical clocks.

## Repository layout

```
apps/
  web          React web client (Vite + Tailwind + Zustand)
  relay-node   Bootstrap + circuit relay + mailbox node (Node.js, Docker)
  desktop      Tauri wrapper        (Phase 7)
  mobile       React Native client   (Phase 7)
packages/
  core         Shared types, identity, envelope codec, topic naming, seams
  crypto       E2EE wrappers (X3DH, Double Ratchet, MLS, Argon2id, BIP39)
  network      libp2p transport, discovery, pubsub, mailbox client
  storage      Encrypted local DB, CRDT sync, message ordering
  ui           Shared React components (themes, a11y, i18n-ready)
docs/
  ARCHITECTURE.md   Component map, layering, message lifecycle
  PROTOCOL.md       Wire format, topics, handshakes, mailbox protocol
  THREAT_MODEL.md   Adversaries, mitigations, residual risks
  DECISIONS.md      Every non-obvious choice, with rationale
  AGENTS.md         Sub-agent ownership and phase status
```

## Development

```bash
corepack enable pnpm   # once
pnpm install
pnpm build             # turbo: parallel across workspaces
pnpm test              # vitest projects in parallel
pnpm lint && pnpm typecheck
```

Requires Node ≥ 22. See `docs/` for the protocol and security model before
changing anything under `packages/core` — it is the shared contract layer.

## Status

Phase 0 (scaffold + contracts + docs). Implementation phases are tracked in
`docs/AGENTS.md`; the protocol version lives in
`packages/core/src/version.ts`.
