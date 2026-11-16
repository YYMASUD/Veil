# @veil/storage

Local-first, encrypted persistence for Veil. Implements the `MessageStore`,
`IdentityStore` and `CrdtDoc` seams from `@veil/core`.

- **Engine** — SQLite (wa-sqlite over OPFS in the browser, native elsewhere),
  encrypted at rest with an SQLCipher-compatible key schedule.
- **Ordering** — hybrid logical clocks from `@veil/core`; duplicates removed by
  content-addressed message id (SHA-256 of the canonical envelope).
- **Shared state** — CRDT documents (Yjs) for group metadata, reactions and
  edits; updates piggyback on normal message flow.
- **Attachments** — client-side encryption and chunking; only the content hash
  and the decryption key ever travel, inside an already-encrypted message.

Status: seam only (Phase 0). Implementation lands in Phases 1, 4 and 5.
