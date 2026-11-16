import { describe, expect, it } from 'vitest';

import { TOPIC, isVeilTopic, pairId, validateTopic } from '../src/topics';
import { validateMailboxItem, type MailboxItem } from '../src/mailbox';

describe('topics', () => {
  it('is symmetric in peer order', () => {
    const a = 'did:key:zA';
    const b = 'did:key:zB';
    expect(pairId(a, b)).toBe(pairId(b, a));
    expect(TOPIC.dm(a, b)).toBe(TOPIC.dm(b, a));
  });

  it('namespaces all topics under veil/v1', () => {
    expect(TOPIC.dm('did:key:zA', 'did:key:zB')).toMatch(/^veil\/v1\/dm\//);
    expect(TOPIC.group('g1')).toBe('veil/v1/group/g1');
    expect(TOPIC.typing('g1')).toBe('veil/v1/typing/g1');
    expect(TOPIC.presence).toBe('veil/v1/presence');
  });

  it('rejects distinct-peer violations', () => {
    expect(() => pairId('same', 'same')).toThrow(/distinct/);
  });

  it('validates topic namespace', () => {
    expect(isVeilTopic('veil/v1/dm/x')).toBe(true);
    expect(isVeilTopic('other/v1/dm/x')).toBe(false);
    expect(() => validateTopic('bogus')).toThrow(/namespace/);
  });
});

describe('mailbox item validation', () => {
  const now = 1_700_000_000_000;
  const DAY = 24 * 60 * 60 * 1000;

  function item(overrides: Partial<MailboxItem> = {}): MailboxItem {
    return {
      itemId: 'item-1',
      recipientToken: new Uint8Array(32).fill(1),
      encryptedEnvelope: new Uint8Array(600),
      createdAtMs: now - 1000,
      expiresAtMs: now + 13 * DAY,
      powNonce: new Uint8Array(8).fill(2),
      ...overrides,
    };
  }

  it('accepts a valid item', () => {
    expect(() => validateMailboxItem(item(), now)).not.toThrow();
  });

  it('rejects bad tokens, sizes, TTLs and PoW lengths', () => {
    expect(() => validateMailboxItem(item({ recipientToken: new Uint8Array(8) }), now)).toThrow(/token/);
    expect(() => validateMailboxItem(item({ encryptedEnvelope: new Uint8Array(0) }), now)).toThrow(
      /envelope/,
    );
    expect(() => validateMailboxItem(item({ createdAtMs: now - 1000, expiresAtMs: now - 500 }), now)).toThrow(
      /expired/,
    );
    expect(() =>
      validateMailboxItem(item({ createdAtMs: now - 1000, expiresAtMs: now + 400 * DAY }), now),
    ).toThrow(/TTL/);
    expect(() => validateMailboxItem(item({ powNonce: new Uint8Array(4) }), now)).toThrow(/proof-of-work/);
    expect(() => validateMailboxItem(item({ itemId: '' }), now)).toThrow(/item id/);
  });
});
