import { describe, expect, it } from 'vitest';

import { base58btcDecode, base58btcEncode } from '../src/base58';
import {
  createIdentity,
  decodeDidKey,
  decodeNoiseKey,
  encodeDidKey,
  encodeNoiseKey,
  isDidKey,
  shortDid,
} from '../src/identity';
import { fromHex, toHex } from '../src/bytes';
import { testNoiseKeypair, testSignKeypair } from './helpers';

/** RFC 8032 §7.2 TEST 1 Ed25519 public key (published reference vector). */
const RFC8032_PK = fromHex('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');

describe('base58', () => {
  it('round-trips structured buffers', () => {
    for (let len = 1; len <= 64; len++) {
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) bytes[i] = (i * 37 + len * 11) % 256;
      expect(base58btcDecode(base58btcEncode(bytes))).toEqual(bytes);
    }
  });

  it('encodes leading zeros as 1s (bitcoin convention)', () => {
    const bytes = new Uint8Array([0, 0, 1, 0]);
    expect(base58btcDecode(base58btcEncode(bytes))).toEqual(bytes);
    expect(base58btcEncode(bytes).startsWith('11')).toBe(true);
  });

  it('rejects invalid characters', () => {
    expect(() => base58btcDecode('0OIl')).toThrow();
  });
});

describe('did:key identity encoding', () => {
  it('encodes the RFC 8032 reference key into a z6Mk… did:key', () => {
    const did = encodeDidKey(RFC8032_PK);
    expect(did.startsWith('did:key:z6Mk')).toBe(true);
    // Round-trip through the decoder returns the exact 32-byte key.
    expect(toHex(decodeDidKey(did))).toBe(toHex(RFC8032_PK));
  });

  it('round-trips a second independent key', () => {
    const did = encodeDidKey(testSignKeypair().publicKey);
    expect(decodeDidKey(did)).toEqual(testSignKeypair().publicKey);
  });

  it('rejects malformed dids', () => {
    expect(isDidKey('did:key:z1')).toBe(false);
    expect(isDidKey('not-a-did')).toBe(false);
    expect(isDidKey(`did:key:${encodeDidKey(RFC8032_PK).slice('did:key:'.length)}`)).toBe(true);
  });

  it('rejects a wrong multicodec prefix when decoding a noise key as did', () => {
    const noise = encodeNoiseKey(testNoiseKeypair().publicKey);
    // x25519 prefix (0xec01) is not ed25519 (0xed01): decodeDidKey must throw.
    expect(() => decodeDidKey(`did:key:${noise}`)).toThrow(/multicodec|bytes/);
    expect(toHex(decodeNoiseKey(noise))).toBe(toHex(testNoiseKeypair().publicKey));
  });
});

describe('identity views', () => {
  it('builds a public identity from keypairs', () => {
    const identity = createIdentity({
      sign: testSignKeypair(),
      noise: testNoiseKeypair(),
      displayName: 'Tester',
    });
    expect(identity.did).toBe(encodeDidKey(testSignKeypair().publicKey));
    expect(identity.deviceId).toBe(identity.did);
    expect(identity.displayName).toBe('Tester');
  });

  it('supports an independent device key', () => {
    const deviceKey = fromHex('3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c');
    const identity = createIdentity({
      sign: testSignKeypair(),
      noise: testNoiseKeypair(),
      deviceSignKey: deviceKey,
    });
    expect(identity.deviceId).toBe(encodeDidKey(deviceKey));
    expect(identity.deviceId).not.toBe(identity.did);
  });

  it('renders short DIDs', () => {
    const identity = createIdentity({ sign: testSignKeypair(), noise: testNoiseKeypair() });
    const short = shortDid(identity.did);
    expect(short.startsWith('z6Mk')).toBe(true);
    expect(short).toContain('…');
    expect(short.length).toBeLessThanOrEqual(12);
  });

  it('rejects keys of the wrong length', () => {
    expect(() => encodeDidKey(new Uint8Array(31))).toThrow(/32 bytes/);
    expect(() => encodeNoiseKey(new Uint8Array(33))).toThrow(/32 bytes/);
  });
});
