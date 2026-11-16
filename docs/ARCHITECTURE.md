# ARCHITECTURE.md — Veil

Veil is a local-first, end-to-end encrypted messenger with **no central
server that stores messages or identities**. Every client owns an Ed25519
identity keypair; the network is libp2p (GossipSub + DHT + relays); offline
delivery goes through untrusted mailbox nodes that hold only sealed blobs.

## Component overview

```mermaid
flowchart LR
    subgraph Client[Client (web / desktop / mobile)]
        UI["@veil/ui + apps/web<br/>React 19 · Zustand · Tailwind 4"]
        CRYPTO["@veil/crypto<br/>X3DH + Double Ratchet · MLS · Argon2id"]
        STORAGE["@veil/storage<br/>encrypted SQLite · Yjs CRDT"]
        CORE["@veil/core<br/>identity · envelope · codec · topics"]
        NET["@veil/network<br/>libp2p · GossipSub · DHT"]
    end

    subgraph Volunteers[Untrusted volunteer nodes]
        RELAY["apps/relay-node<br/>circuit relay v2 + mailbox service"]
    end

    UI --> CRYPTO
    UI --> STORAGE
    CRYPTO --> CORE
    STORAGE --> CORE
    NET --> CORE
    NET --> STORAGE
    NET <-.->|WebSocket / QUIC / WebRTC| RELAY
    NET <-.->|GossipSub mesh| NET2[Other Veil peers]
```

## Layering rules

- `@veil/core` is dependency-free and holds every shared type; all other
  packages (and every sub-agent) code against it, never sideways.
- `@veil/crypto` and `@veil/storage` implement `@veil/core` seams only.
- `@veil/network` implements `MessageTransport` / `MailboxService`.
- UI packages never touch crypto or the network directly — they consume
  injected seam implementations, which makes mocked UI tests trivial.

## Message lifecycle

1. **Compose** — UI produces a `MessagePayload` (typed union in `@veil/core`).
2. **Protect** — `@veil/crypto` encrypts (Double Ratchet / MLS), `@veil/core`
   pads to a fixed bucket and signs the envelope (Ed25519 over the canonical
   signature base).
3. **Transmit** — `@veil/network` publishes the protobuf envelope to the
   conversation's GossipSub topic, or seals it to a mailbox for offline
   peers.
4. **Receive** — the same path in reverse: size/structure/version checks →
   signature verify → decrypt → HLC merge → dedup by message id → persist in
   `@veil/storage` → UI state update.
5. **Sync** — on reconnect, mailbox fetch + CRDT state-vector exchange heals
   anything missed (partition tolerance test in Phase 2's e2e suite).

## Storage

Encrypted SQLite (wa-sqlite/OPFS on web, native elsewhere). The database key
is derived from the user passphrase (Argon2id) and never persisted. Shared
mutable state (group metadata, reactions) lives in Yjs CRDT documents whose
updates piggyback on conversation traffic.

## Failure model

- Any single node (bootstrap, relay, mailbox) can vanish; clients fall back
  to DHT discovery, other relays, or direct WebRTC when available.
- Messages sent during a partition are stored (own outbox) and retrieved
  (mailbox TTL 14 days) when connectivity returns.
- The UI is usable offline: reads are local, writes queue locally.

## Testing strategy

- Unit: ≥ 80% coverage for `@veil/core`, `@veil/crypto`, `@veil/storage`
  (vitest, threads in parallel).
- Conformance: hand-rolled codec vs protobufjs on golden envelopes.
- e2e (Phase 2+): two browser contexts exchanging messages through a real
  relay node (Playwright).
- Partition: messages sent during a network partition arrive after healing.
- Simulation (Phase 8): 50-peer libp2p mesh in a single process.

## Status

Phase 0 complete: scaffold, `@veil/core` contracts (identity/DID, envelope
codec with protobufjs conformance test, padding buckets, HLC, topics,
mailbox, transport/storage/crypto seams), docs set, CI, ESLint/Prettier, web
shell (builds + store tests), relay node (boots, health endpoint verified).
Later phases add each implementation behind the seams listed in AGENTS.md.
