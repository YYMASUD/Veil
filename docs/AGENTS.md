# AGENTS.md

Sub-agent roles, folder ownership and status. The orchestrator creates the
shared contracts first (`@veil/core`); agents only code inside their own
folders and only against `@veil/core` interfaces. Branches: `agent/<task>`.

| Agent        | Role                            | Owns                           | Interfaces consumed                                                      | Status                                              |
| ------------ | ------------------------------- | ------------------------------ | ------------------------------------------------------------------------ | --------------------------------------------------- |
| Orchestrator | scaffold, contracts, merges, CI | root configs, `/packages/core` | —                                                                        | Phase 0 ✅ (37 core tests, lint/typecheck green)    |
| A            | Crypto                          | `/packages/crypto`             | `IdentityCrypto`, `DirectMessageCrypto`, `GroupCrypto`, `EnvelopeCrypto` | seam + smoke test ready (P1)                        |
| B            | Network                         | `/packages/network`            | `MessageTransport`, `NetworkConfig`, `MailboxService`                    | seam + smoke test ready (P2)                        |
| C            | Storage                         | `/packages/storage`            | `MessageStore`, `IdentityStore`, `CrdtDoc`                               | seam + smoke test ready (P1)                        |
| D            | UI / Web                        | `/packages/ui`, `/apps/web`    | `MessageTransport` (mocked), `MessageStore` (mocked)                     | shell built & tested (store tests, Vite build)      |
| E            | Relay node                      | `/apps/relay-node`             | `MailboxService` (server side)                                           | boots, 8 tests, health 200 ok (wire protocol P2/P4) |
| F            | Docs & QA                       | `/docs`, `/e2e`, CI            | everything (read-only)                                                   | docs + CI + lint/format config ✅                   |

## Rules

1. `@veil/core` is the only shared-types package. A change needed there goes
   back to the orchestrator.
2. Each agent keeps their package's README accurate and their tests green.
3. Breaking a `@veil/core` type = protocol change = bump
   `PROTOCOL_VERSION` + update `docs/PROTOCOL.md` in the same commit.
4. No plaintext message content or key material in logs. Ever.

## Phase status

- **Phase 0** — scaffold + `@veil/core` contracts + docs skeleton + CI: ✅
- **Phase 1** — identity (A), encrypted storage (C), UI shell (D): queued
- **Phase 2** — libp2p (B), relay skeleton (E), chat UI on mocks (D), e2e harness (F): queued
- **Phase 3** — X3DH + Double Ratchet (A), verification UI (D), vectors (F): queued
- **Phase 4** — mailbox service (E), mailbox client (B), offline sync (C): queued
- **Phase 5** — MLS groups (A), CRDT metadata (C), group UI (D): queued
- **Phase 6** — attachments, receipts, disappearing messages, notifications: queued
- **Phase 7** — desktop (Tauri), mobile, multi-device linking: queued
- **Phase 8** — fuzzing, 50-peer simulation, perf, security review: queued
