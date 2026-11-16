# @veil/core

Shared contract layer for Veil: identity, message envelope types, pubsub topic
naming, and the transport / storage / crypto seams that every other package
implements. Nothing in this package performs I/O — it defines **types,
pure functions and constants** only, so it can be imported by browsers,
workers, Node services and test harnesses without pulling heavy dependencies.

## Modules

| File               | Purpose                                                                         |
| ------------------ | ------------------------------------------------------------------------------- |
| `src/version.ts`   | `PROTOCOL_VERSION`, `MIN_SUPPORTED_VERSION`, bucket sizes                       |
| `src/identity.ts`  | Identity, DID (`did:key`), fingerprint derivation, device linking types         |
| `src/messages.ts`  | `VersionedEnvelope`, message payloads, HLC clock, tombstones, receipts          |
| `src/topics.ts`    | Deterministic topic naming (`veil/v1/...`) and safety-number helpers            |
| `src/transport.ts` | `MessageTransport` seam — implemented by `@veil/network`, mocked in UI/tests    |
| `src/storage.ts`   | `MessageStore` / `IdentityStore` seams — implemented by `@veil/storage`         |
| `src/crypto.ts`    | Crypto engine seams (`DmCrypto`, `GroupCrypto`) — implemented by `@veil/crypto` |
| `src/mailbox.ts`   | Mailbox store/forward envelope types (encrypted blobs, TTL, PoW)                |
| `src/errors.ts`    | Typed error hierarchy with stable codes                                         |
| `proto/`           | Protobuf sources for the wire format (codegen lands in Phase 2)                 |

## Rules

- This package is the **only** place shared types may be declared. Other
  packages import from `@veil/core`; they never re-export mutated copies.
- Breaking a type here is a protocol change — bump `PROTOCOL_VERSION` and
  update `docs/PROTOCOL.md` in the same commit.
