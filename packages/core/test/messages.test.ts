import { describe, expect, it } from 'vitest';

import { fromHex, toHex } from '../src/bytes';
import {
  chooseBucket,
  clocksEqual,
  compareClocks,
  createClock,
  observe,
  padToBucket,
  tick,
  unpadFromBucket,
  validateEnvelope,
  type VersionedEnvelope,
} from '../src/messages';
import { BUCKET_SIZES, MAX_PAYLOAD_BYTES, NONCE_BYTES } from '../src/version';

describe('hybrid logical clock', () => {
  it('ticks monotonically', () => {
    let clock = createClock('node-a', 1000);
    clock = tick(clock, 1500);
    clock = tick(clock, 1200); // wall never regresses
    expect(clock.lamport).toBe(2n);
    expect(clock.wallMs).toBe(1500);
  });

  it('observe() preserves causality', () => {
    const a = tick(tick(createClock('a', 0), 1), 2);
    const b = tick(tick(tick(createClock('b', 0), 1), 2), 3);
    const merged = observe(a, b, 4);
    expect(merged.lamport).toBe(4n); // max(2,3)+1
    expect(merged.nodeId).toBe('a');
  });

  it('orders clocks totally', () => {
    const a = { lamport: 1n, wallMs: 100, nodeId: 'a' };
    const b = { lamport: 1n, wallMs: 101, nodeId: 'a' };
    const c = { lamport: 1n, wallMs: 101, nodeId: 'b' };
    expect(compareClocks(a, b)).toBe(-1);
    expect(compareClocks(b, c)).toBe(-1);
    expect(compareClocks(a, a)).toBe(0);
    expect(clocksEqual(a, { lamport: 1n, wallMs: 100, nodeId: 'a' })).toBe(true);
  });

  it('rejects invalid node ids', () => {
    expect(() => createClock('')).toThrow();
    expect(() => createClock('x'.repeat(65))).toThrow();
  });
});

describe('bucket padding', () => {
  it('picks the smallest fitting bucket', () => {
    expect(chooseBucket(1)).toBe(512);
    expect(chooseBucket(510)).toBe(512);
    expect(chooseBucket(511)).toBe(2048); // 511 + 2 footer > 512
    expect(chooseBucket(2000)).toBe(2048);
    expect(chooseBucket(8000)).toBe(8192);
  });

  it('rejects oversized payloads', () => {
    expect(() => chooseBucket(MAX_PAYLOAD_BYTES + 1)).toThrow(/bucket/);
  });

  it('pads to exact bucket size and un-pads exactly', () => {
    for (const size of [1, 100, 510]) {
      const padded = padToBucket(new Uint8Array(size).fill(7));
      expect(BUCKET_SIZES).toContain(padded.length);
      const out = unpadFromBucket(padded, padded.length as 512);
      expect(out.length).toBe(size);
    }
  });

  it('detects corrupted padding or footer', () => {
    const padded = padToBucket(fromHex('aabbcc'), 512);
    const tampered = Uint8Array.from(padded);
    tampered[10] = 0xff; // corrupt inside the zero region
    expect(() => unpadFromBucket(tampered, 512)).toThrow(/zero/);
    const badFooter = Uint8Array.from(padded);
    badFooter[510] = 2; // footer now claims 765 bytes of padding > bucket
    expect(() => unpadFromBucket(badFooter, 512)).toThrow(/footer/);
  });

  it('rejects wrong bucket size on unpad', () => {
    const padded = padToBucket(fromHex('aa'), 512);
    expect(() => unpadFromBucket(padded, 2048)).toThrow(/exactly/);
  });

  it('pads deterministically (identical input → identical bytes)', () => {
    const a = padToBucket(fromHex('deadbeef'), 512);
    const b = padToBucket(fromHex('deadbeef'), 512);
    expect(toHex(a)).toBe(toHex(b));
  });
});

function buildEnvelope(overrides: Partial<VersionedEnvelope> = {}): VersionedEnvelope {
  const did = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';
  const payload = padToBucket(fromHex('0102030405'), 512);
  return {
    version: 1,
    sender: did,
    conversation: 'abc.def',
    bucket: 512,
    payload,
    nonce: new Uint8Array(NONCE_BYTES).fill(3),
    signature: new Uint8Array(64).fill(9),
    clock: { lamport: 5n, wallMs: 1720000000000, nodeId: 'test-node' },
    sentAtMs: 1720000000000,
    ...overrides,
  };
}

describe('envelope validation', () => {
  it('accepts a well-formed envelope', () => {
    expect(() => validateEnvelope(buildEnvelope())).not.toThrow();
  });

  it('rejects size/nonce/length violations', () => {
    expect(() => validateEnvelope(buildEnvelope({ payload: new Uint8Array(100) }))).toThrow(/bucket/);
    expect(() => validateEnvelope(buildEnvelope({ nonce: new Uint8Array(NONCE_BYTES - 1) }))).toThrow(
      /nonce/,
    );
    expect(() => validateEnvelope(buildEnvelope({ conversation: '' }))).toThrow(/conversation/);
    expect(() => validateEnvelope(buildEnvelope({ conversation: 'x'.repeat(129) }))).toThrow(/conversation/);
    expect(() => validateEnvelope(buildEnvelope({ clock: { lamport: 1n, wallMs: 1, nodeId: '' } }))).toThrow(
      /nodeId/,
    );
  });
});
