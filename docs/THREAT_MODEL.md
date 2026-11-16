# THREAT_MODEL.md

Scope: the Veil protocol and its reference clients (web, desktop) plus
volunteer relay/mailbox nodes. Assets: message confidentiality, message
integrity, identity-key ownership, contact graph privacy, metadata
minimalisation, availability.

## Adversaries

| #   | Adversary                                       | Capabilities                                                         | Mitigations                                                                                                                                                                             | Residual risk                                                                              |
| --- | ----------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | **Passive network observer** (ISP, Wi-Fi sniff) | Sees traffic, sizes, timing, endpoints                               | TLS/noise transport, GossipSub, fixed padding buckets, opaque conversation ids, no display names on the wire                                                                            | Traffic analysis on timing/volume remains                                                  |
| 2   | **Malicious relay / mailbox node**              | Stores drops, correlates tokens, drops/reorders, DoS                 | Relays only ever hold sealed `MailboxItem`s; recipient tokens are unlinkable HMACs; TTL-capped storage; client-side acks; multiple configurable mailbox nodes                           | Availability attacks (dropping mail) are detectable but not preventable                    |
| 3   | **Malicious peer** (in or near a conversation)  | Sends malformed/spam envelopes, replays, impersonation attempts      | Mandatory Ed25519 signatures verified against `sender` did:key; nonce-reuse rejection; HLC clamping; PoW/rate limits for strangers; contact requests require acceptance                 | Keyed peer inside a group can read that group (by design); PCS via MLS limits blast radius |
| 4   | **Compromised device**                          | Full access to that device's keys and plaintext DB while compromised | Passphrase + Argon2id at-rest encryption; disappearing messages shrink the window; MLS forward secrecy + PCS heals group keying after the device re-verifies; device revocation commits | A live attacker reads current traffic until revocation                                     |
| 5   | **Sybil / eclipse attacker** (P2P layer)        | Floods DHT with peers, surrounds a victim, spams topics              | Bootstrap peer list configurable; PoW for first-contact; GossipSub scoring; contact requests are opt-in; group joins require an admin commit                                            | A resourceful global attacker can still degrade discovery                                  |
| 6   | **Malicious group member**                      | Adds their own devices, leaks transcript                             | MLS admin commits; roster changes are signed; leaving = removal commit; export of transcript is explicit UI action                                                                      | Cannot prevent a human re-sharing content                                                  |

## Cross-cutting rules

1. **No plaintext or key material in logs.** Log codes and sizes only; a CI
   grep check guards obvious cases (`console.log(plaintext)` patterns).
2. **Validate before parse; parse before trust.** Every inbound frame is
   size-limited (`MAX_ENVELOPE_BYTES`), proto-validated, version-checked,
   then signature-verified, then (only then) decrypted.
3. **Constant-time** comparison for tokens, auth proofs and MAC checks.
4. **Replay/dedup** by content-addressed message id + HLC; duplicate
   envelopes are dropped idempotently.
5. **Crypto agility** is bounded: exactly one suite per protocol version,
   negotiated via `version`; no optional cipher choices.
6. **Dependency supply chain**: lockfile pinned, `pnpm audit` in CI, only
   allow-listed build scripts, crypto libraries must be audited (D-04).
7. **Web client CSP**: `default-src 'self'`; no inline scripts; wasm only
   from the bundled crypto assets; no remote code.
