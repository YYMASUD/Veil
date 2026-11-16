# @veil/crypto

End-to-end encryption for Veil. Wraps audited primitives behind the seams
declared in `@veil/core` (`IdentityCrypto`, `DirectMessageCrypto`,
`GroupCrypto`, `EnvelopeCrypto`). We do **not** invent crypto primitives.

- **1:1 chats** — X3DH key agreement + Double Ratchet (forward secrecy and
  post-compromise security), following the Signal specification.
- **Groups** — MLS (RFC 9420) for up to 256 members.
- **At rest** — Argon2id key derivation from a passphrase; encrypted identity
  blobs; BIP39 12/24-word mnemonic export/import.
- **Signing** — Ed25519 envelope signatures; constant-time verification paths.

Status: seams only (Phase 0). Implementation lands in Phases 1 and 3–5 with
test vectors checked against reference implementations.
