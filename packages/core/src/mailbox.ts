/** Store-and-forward mailbox contracts: relays see only encrypted blobs. */
import { VeilError } from './errors';
import { DEFAULT_MAILBOX_TTL_DAYS, MAX_ENVELOPE_BYTES } from './version';

/** Default mailbox TTL in milliseconds. */
export const DEFAULT_MAILBOX_TTL_MS = DEFAULT_MAILBOX_TTL_DAYS * 24 * 60 * 60 * 1000;
/** Maximum accepted TTL, to limit relay storage abuse. */
export const MAX_MAILBOX_TTL_MS = DEFAULT_MAILBOX_TTL_MS;

/** Opaque item submitted to a mailbox. Recipient is a blinded mailbox token. */
export interface MailboxItem {
  readonly itemId: string;
  readonly recipientToken: Uint8Array;
  readonly encryptedEnvelope: Uint8Array;
  readonly createdAtMs: number;
  readonly expiresAtMs: number;
  readonly powNonce: Uint8Array;
}

/** Query for mailbox items; caller proves control of recipient token. */
export interface MailboxQuery {
  readonly recipientToken: Uint8Array;
  readonly sinceMs?: number;
  readonly limit: number;
  readonly authProof: Uint8Array;
}

/** Result returned to a recipient after a successful mailbox fetch. */
export interface MailboxBatch {
  readonly items: readonly MailboxItem[];
  readonly nextCursor?: string;
}

/** Mailbox protocol surface, implemented by relay client and node. */
export interface MailboxService {
  store(item: MailboxItem): Promise<void>;
  retrieve(query: MailboxQuery): Promise<MailboxBatch>;
  acknowledge(recipientToken: Uint8Array, itemIds: readonly string[], authProof: Uint8Array): Promise<void>;
}

/** Validate untrusted mailbox storage input (no signature trust implied). */
export function validateMailboxItem(item: MailboxItem, nowMs: number): void {
  if (!item.itemId || item.itemId.length > 128) throw new VeilError('INVALID_MAILBOX', 'invalid item id');
  if (item.recipientToken.length < 16 || item.recipientToken.length > 64) {
    throw new VeilError('INVALID_MAILBOX', 'recipient token must be 16..64 bytes');
  }
  if (item.encryptedEnvelope.length === 0 || item.encryptedEnvelope.length > MAX_ENVELOPE_BYTES) {
    throw new VeilError('INVALID_MAILBOX', 'encrypted envelope size is invalid');
  }
  if (item.createdAtMs > nowMs + 5 * 60_000 || item.expiresAtMs <= nowMs) {
    throw new VeilError('INVALID_MAILBOX', 'mailbox item is expired or future-dated');
  }
  const ttl = item.expiresAtMs - item.createdAtMs;
  if (ttl <= 0 || ttl > MAX_MAILBOX_TTL_MS) {
    throw new VeilError('INVALID_MAILBOX', 'mailbox TTL exceeds the configured maximum');
  }
  if (item.powNonce.length < 8 || item.powNonce.length > 64) {
    throw new VeilError('INVALID_MAILBOX', 'proof-of-work nonce must be 8..64 bytes');
  }
}
