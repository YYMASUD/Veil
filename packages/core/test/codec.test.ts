import { describe, expect, it } from 'vitest';

import { fromHex, toHex } from '../src/bytes';
import { decodeEnvelope, encodeEnvelope, envelopesEqual } from '../src/codec';
import { padToBucket } from '../src/messages';
import { NONCE_BYTES } from '../src/version';

const SENDER = 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK';

function sample() {
  return {
    version: 1,
    sender: SENDER,
    conversation: 'conv-1',
    bucket: 512 as const,
    payload: padToBucket(fromHex('0102030405'), 512),
    nonce: new Uint8Array(NONCE_BYTES).fill(7),
    signature: new Uint8Array(64).fill(1),
    clock: { lamport: 42n, wallMs: 1_700_000_000_000, nodeId: 'test' },
    sentAtMs: 1_700_000_000_000,
  };
}

describe('envelope codec', () => {
  it('round-trips a valid envelope byte-for-byte', () => {
    const env = sample();
    const bytes = encodeEnvelope(env);
    const decoded = decodeEnvelope(bytes);
    expect(decoded.sender).toBe(env.sender);
    expect(decoded.conversation).toBe(env.conversation);
    expect(decoded.bucket).toBe(env.bucket);
    expect(toHex(decoded.payload)).toBe(toHex(env.payload));
    expect(decoded.clock.lamport).toBe(42n);
    expect(decoded.clock.nodeId).toBe('test');
    expect(decoded.sentAtMs).toBe(1_700_000_000_000);
    expect(envelopesEqual(env, decoded)).toBe(true);
  });

  it('produces deterministic encoding', () => {
    const a = encodeEnvelope(sample());
    const b = encodeEnvelope(sample());
    expect(toHex(a)).toBe(toHex(b));
  });

  it('copies buffers so later input mutation cannot change decoded values', () => {
    const env = sample();
    const bytes = encodeEnvelope(env);
    const copy = Uint8Array.from(bytes);
    const decoded = decodeEnvelope(copy);
    copy[20] = 0xff;
    expect(decoded.payload.length).toBe(512);
  });

  it('rejects structurally invalid envelopes', () => {
    expect(() => decodeEnvelope(new Uint8Array(0))).toThrow(/empty/);
    expect(() => decodeEnvelope(new Uint8Array(97_000))).toThrow(/exceeds/);
  });

  it('rejects envelopes that are missing required fields', () => {
    // sender present but empty (length 0), nothing else → next required field missing.
    expect(() => decodeEnvelope(fromHex('1200'))).toThrow(/missing/);
    // payload tag with length 0, nothing else → missing sender first.
    expect(() => decodeEnvelope(fromHex('2a00'))).toThrow(/missing/);
  });

  it('skips unknown fields (forward compatibility)', () => {
    const env = sample();
    const bytes = encodeEnvelope(env);
    // Append synthetic unknown field 100 (wire type 2, length 3, bytes 1,2,3).
    const unknown = [0xa2, 0x06, 0x03, 0x01, 0x02, 0x03];
    const extended = new Uint8Array(bytes.length + unknown.length);
    extended.set(bytes, 0);
    extended.set(unknown, bytes.length);
    const decoded = decodeEnvelope(extended);
    expect(decoded.sender).toBe(env.sender);
    expect(toHex(decoded.payload)).toBe(toHex(env.payload));
  });

  it('rejects a bad sender did:key', () => {
    const env = { ...sample(), sender: 'did:key:zInvalid!!' };
    expect(() => encodeEnvelope(env as never)).toThrow();
  });
});
