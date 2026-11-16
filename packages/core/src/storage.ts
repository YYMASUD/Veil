/** Local-first persistence contracts. Implemented by `@veil/storage`. */
import type { Identity, IdentityKeypair } from './identity';
import type { HybridClock, MessageId, VersionedEnvelope } from './messages';

/** Message metadata stored beside the encrypted wire envelope. */
export interface StoredMessage {
  readonly id: MessageId;
  readonly conversationId: string;
  readonly envelope: VersionedEnvelope;
  readonly clock: HybridClock;
  readonly receivedAtMs: number;
  readonly expiresAtMs?: number;
  readonly status: 'pending' | 'sent' | 'delivered' | 'read';
}

/** Reaction state is an idempotent CRDT operation, not an in-place edit. */
export interface Reaction {
  readonly messageId: MessageId;
  readonly authorDid: string;
  readonly emoji: string;
  readonly op: 'add' | 'remove';
  readonly clock: HybridClock;
}

/** Range selector in the total order defined by HybridClock. */
export interface MessageRange {
  readonly conversationId: string;
  readonly after?: HybridClock;
  readonly before?: HybridClock;
  readonly limit: number;
}

/** Encrypted database lifecycle and message operations. */
export interface MessageStore {
  open(key: Uint8Array): Promise<void>;
  close(): Promise<void>;
  append(message: StoredMessage): Promise<boolean>;
  getRange(range: MessageRange): Promise<readonly StoredMessage[]>;
  getById(id: MessageId): Promise<StoredMessage | undefined>;
  upsertReaction(reaction: Reaction): Promise<void>;
  getReactions(messageId: MessageId): Promise<readonly Reaction[]>;
  tombstone(id: MessageId, clock: HybridClock): Promise<void>;
}

/** Secure local identity persistence (passphrase/OS-keychain implementation). */
export interface IdentityStore {
  save(keypair: IdentityKeypair, passphrase: string): Promise<void>;
  load(passphrase: string): Promise<IdentityKeypair | undefined>;
  getPublicIdentity(): Promise<Identity | undefined>;
  delete(): Promise<void>;
}

/** CRDT document interface for shared group metadata and reactions. */
export interface CrdtDoc {
  readonly actorId: string;
  applyUpdate(update: Uint8Array, origin?: string): void;
  encodeState(): Uint8Array;
  encodeStateVector(): Uint8Array;
  onUpdate(listener: (update: Uint8Array, origin?: string) => void): () => void;
  destroy(): void;
}
