# @veil/network

libp2p-based peer-to-peer transport for Veil. Implements the
`MessageTransport` and `MailboxService` seams from `@veil/core`.

- **Transports** — WebRTC (browser-to-browser), WebSockets, WebTransport,
  TCP and QUIC (desktop / relay nodes).
- **Discovery** — Kademlia DHT, mDNS on local networks, configurable
  bootstrap peers.
- **NAT traversal** — Circuit Relay v2 plus DCUtR hole punching.
- **Pubsub** — GossipSub on the `veil/v1/...` topics from `@veil/core`.
- **Offline delivery** — store-and-forward mailbox nodes holding only
  encrypted blobs with a TTL (default 14 days).

Status: seam only (Phase 0). Implementation lands in Phases 2 and 4.
