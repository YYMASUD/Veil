/**
 * In-memory mailbox store — the Phase 0 server-side seam for store-and-forward.
 *
 * The node is untrusted by design: it only ever handles sealed `MailboxItem`
 * blobs indexed by an opaque recipient token. It validates every item with
 * `@veil/core`'s `validateMailboxItem`, dedups by item id, enforces per-token
 * and global caps, and garbage-collects expired items. The durable/clustered
 * implementation replaces this class in Phase 4 behind the same interface.
 */

import { toHex } from '@veil/core';
import { validateMailboxItem, type MailboxItem } from '@veil/core';

export interface MailboxStoreOptions {
  readonly maxItemsPerToken: number;
  readonly maxTotalItems: number;
  /** Injectable clock for tests. */
  readonly now?: () => number;
}

interface TokenBucket {
  readonly byId: Map<string, MailboxItem>;
}

export class MailboxStore {
  private readonly buckets = new Map<string, TokenBucket>();
  private totalItems = 0;
  private readonly now: () => number;

  constructor(private readonly options: MailboxStoreOptions) {
    if (options.maxItemsPerToken < 1 || options.maxTotalItems < options.maxItemsPerToken) {
      throw new Error('mailbox caps are inconsistent (per-token must be ≥ 1, total ≥ per-token)');
    }
    this.now = options.now ?? Date.now;
  }

  /**
   * Store an item after full validation. Duplicate item ids for the same
   * token are accepted idempotently (retries must not double-store).
   * @returns 'stored' | 'duplicate' | 'rejected'
   */
  store(item: MailboxItem): 'stored' | 'duplicate' | 'rejected' {
    try {
      validateMailboxItem(item, this.now());
    } catch {
      return 'rejected';
    }
    if (this.totalItems >= this.options.maxTotalItems) {
      this.sweep();
      if (this.totalItems >= this.options.maxTotalItems) return 'rejected';
    }
    const key = toHex(item.recipientToken);
    let bucket = this.buckets.get(key);
    if (bucket === undefined) {
      if (this.buckets.size >= this.options.maxTotalItems) {
        this.sweep();
        if (this.buckets.size >= this.options.maxTotalItems) return 'rejected';
      }
      bucket = { byId: new Map() };
      this.buckets.set(key, bucket);
    }
    if (bucket.byId.has(item.itemId)) return 'duplicate';
    if (bucket.byId.size >= this.options.maxItemsPerToken) return 'rejected';
    bucket.byId.set(item.itemId, item);
    this.totalItems += 1;
    return 'stored';
  }

  /** All unexpired items for a token, oldest first. */
  retrieve(recipientToken: Uint8Array): readonly MailboxItem[] {
    const bucket = this.buckets.get(toHex(recipientToken));
    if (bucket === undefined) return [];
    const now = this.now();
    return [...bucket.byId.values()]
      .filter((item) => item.expiresAtMs > now)
      .sort((a, b) => a.createdAtMs - b.createdAtMs);
  }

  /** Remove acknowledged items. Unknown ids are ignored (idempotent). */
  acknowledge(recipientToken: Uint8Array, itemIds: readonly string[]): number {
    const bucket = this.buckets.get(toHex(recipientToken));
    if (bucket === undefined) return 0;
    let removed = 0;
    for (const id of itemIds) {
      if (bucket.byId.delete(id)) removed += 1;
    }
    this.totalItems -= removed;
    if (bucket.byId.size === 0) this.buckets.delete(toHex(recipientToken));
    return removed;
  }

  /** Delete every expired item across all tokens. @returns items removed. */
  sweep(nowMs: number = this.now()): number {
    let removed = 0;
    for (const [key, bucket] of this.buckets) {
      for (const [id, item] of bucket.byId) {
        if (item.expiresAtMs <= nowMs) {
          bucket.byId.delete(id);
          removed += 1;
        }
      }
      if (bucket.byId.size === 0) this.buckets.delete(key);
    }
    this.totalItems -= removed;
    return removed;
  }

  /** Current live item count (after expiry filtering). */
  size(): number {
    const now = this.now();
    let count = 0;
    for (const bucket of this.buckets.values()) {
      for (const item of bucket.byId.values()) {
        if (item.expiresAtMs > now) count += 1;
      }
    }
    return count;
  }

  /** Number of distinct recipient tokens currently tracked. */
  tokenCount(): number {
    return this.buckets.size;
  }
}
