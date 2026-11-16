import { describe, expect, it } from 'vitest';

import { MailboxStore } from '../src/mailbox';

const DAY = 86_400_000;
const NOW = 1_700_000_000_000;

function makeItem(id: string, token: number, now = NOW) {
  return {
    itemId: id,
    recipientToken: new Uint8Array(32).fill(token),
    encryptedEnvelope: new Uint8Array(512).fill(2),
    createdAtMs: now - 100,
    expiresAtMs: now + 13 * DAY,
    powNonce: new Uint8Array(8).fill(3),
  };
}

describe('MailboxStore', () => {
  it('stores and retrieves per recipient, in created-time order', () => {
    const store = new MailboxStore({ maxItemsPerToken: 5, maxTotalItems: 20, now: () => NOW });
    expect(store.store(makeItem('later', 1))).toBe('stored');
    expect(store.store({ ...makeItem('earlier', 1), createdAtMs: NOW - 200 })).toBe('stored');
    expect(store.retrieve(new Uint8Array(32).fill(1)).map((i) => i.itemId)).toEqual(['earlier', 'later']);
    expect(store.retrieve(new Uint8Array(32).fill(2))).toEqual([]);
  });

  it('deduplicates item ids idempotently', () => {
    const store = new MailboxStore({ maxItemsPerToken: 5, maxTotalItems: 20, now: () => NOW });
    expect(store.store(makeItem('same', 1))).toBe('stored');
    expect(store.store(makeItem('same', 1))).toBe('duplicate');
    expect(store.size()).toBe(1);
  });

  it('enforces per-token and global capacity', () => {
    const store = new MailboxStore({ maxItemsPerToken: 1, maxTotalItems: 2, now: () => NOW });
    expect(store.store(makeItem('a', 1))).toBe('stored');
    expect(store.store(makeItem('b', 1))).toBe('rejected');
    expect(store.store(makeItem('c', 2))).toBe('stored');
    expect(store.store(makeItem('d', 3))).toBe('rejected');
  });

  it('acknowledges idempotently', () => {
    const store = new MailboxStore({ maxItemsPerToken: 5, maxTotalItems: 20, now: () => NOW });
    store.store(makeItem('a', 1));
    store.store(makeItem('b', 1));
    expect(store.acknowledge(new Uint8Array(32).fill(1), ['a', 'missing'])).toBe(1);
    expect(store.acknowledge(new Uint8Array(32).fill(1), ['a'])).toBe(0);
    expect(store.size()).toBe(1);
  });

  it('sweeps expired items and returns live size', () => {
    let now = NOW;
    const store = new MailboxStore({ maxItemsPerToken: 5, maxTotalItems: 20, now: () => now });
    store.store(makeItem('a', 1));
    now += 14 * DAY;
    expect(store.retrieve(new Uint8Array(32).fill(1))).toEqual([]);
    expect(store.sweep()).toBe(1);
    expect(store.size()).toBe(0);
  });
});
