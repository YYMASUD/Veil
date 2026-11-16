import { describe, expect, it } from 'vitest';

import { fromHex, toHex, utf8Encode } from '@veil/core';
import type { Argon2Params } from '@veil/core';
import { randomBytes } from '@noble/hashes/utils.js';

import {
  DEFAULT_ARGON2_PARAMS,
  decryptIdentity,
  encryptIdentity,
  fromMnemonic,
  generateIdentity,
  identityCrypto,
  keypairFromEntropy,
  signWithEd25519,
  toMnemonic,
  verifyEd25519,
} from '../src/identity';

/** Fast Argon2 params for tests only (production defaults: t=3, 64 MiB). */
const FAST: Argon2Params = { opsLimit: 1, memLimit: 1024 };

// RFC 8032 §7.1 TEST 1 — published reference vector, not self-derived.
const RFC8032_MSG = new Uint8Array(0);
const RFC8032_SK = fromHex('9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60');
const RFC8032_PK = fromHex('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a');
const RFC8032_SIG = fromHex(
  'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155' +
    '5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b',
);

describe('ed25519 signing (RFC 8032 reference vectors)', () => {
  it('produces the exact TEST 1 signature', () => {
    expect(toHex(signWithEd25519(RFC8032_MSG, RFC8032_SK))).toBe(toHex(RFC8032_SIG));
  });

  it('verifies TEST 1 and rejects tampering', () => {
    expect(verifyEd25519(RFC8032_MSG, RFC8032_SIG, RFC8032_PK)).toBe(true);
    const tampered = Uint8Array.from(RFC8032_SIG);
    tampered[0] ^= 0x01;
    expect(verifyEd25519(RFC8032_MSG, tampered, RFC8032_PK)).toBe(false);
    expect(verifyEd25519(utf8Encode('other message'), RFC8032_SIG, RFC8032_PK)).toBe(false);
  });

  it('accepts 64-byte (seed ‖ public) secret keys', () => {
    const long = new Uint8Array(64);
    long.set(RFC8032_SK, 0);
    long.set(RFC8032_PK, 32);
    expect(toHex(signWithEd25519(RFC8032_MSG, long))).toBe(toHex(RFC8032_SIG));
  });

  it('rejects malformed keys/signatures without throwing', () => {
    expect(verifyEd25519(RFC8032_MSG, RFC8032_SIG, new Uint8Array(31))).toBe(false);
    expect(() => signWithEd25519(RFC8032_MSG, new Uint8Array(16))).toThrow(/32 or 64 bytes/);
  });
});

describe('identity lifecycle', () => {
  it('generates a valid identity with 12-word entropy', async () => {
    const keypair = await generateIdentity('Tester');
    expect(keypair.identity.did.startsWith('did:key:z6Mk')).toBe(true);
    expect(keypair.entropy).toHaveLength(16);
    expect(keypair.sign.secretKey).toHaveLength(64);
    expect(keypair.noise.secretKey).toHaveLength(32);
    expect(keypair.identity.displayName).toBe('Tester');
  });

  it('round-trips a 12-word mnemonic exactly', async () => {
    const keypair = await generateIdentity();
    const backup = toMnemonic(keypair, 12);
    expect(backup.words).toHaveLength(12);
    const restored = await fromMnemonic(backup.words.join(' '));
    expect(restored.identity.did).toBe(keypair.identity.did);
    expect(toHex(restored.noise.publicKey)).toBe(toHex(keypair.noise.publicKey));
  });

  it('round-trips a 24-word mnemonic exactly', async () => {
    const keypair = keypairFromEntropy(randomBytes(32));
    const backup = toMnemonic(keypair, 24);
    expect(backup.words).toHaveLength(24);
    const restored = await fromMnemonic(backup.words.join(' '));
    expect(restored.identity.did).toBe(keypair.identity.did);
  });

  it('refuses exports that do not match the entropy length', async () => {
    const keypair = await generateIdentity(); // 16-byte entropy
    expect(() => toMnemonic(keypair, 24)).toThrow(/24 words/);
    const noEntropy = { ...keypair, entropy: undefined };
    expect(() => toMnemonic(noEntropy)).toThrow(/no mnemonic entropy/);
  });

  it('rejects invalid mnemonics', async () => {
    await expect(fromMnemonic('not a real mnemonic phrase at all here')).rejects.toThrow(/invalid/);
  });
});

describe('identity at-rest encryption', () => {
  it('round-trips encrypt → decrypt with matching identity', async () => {
    const keypair = await generateIdentity('Vault');
    const blob = await encryptIdentity(keypair, 'correct horse battery', FAST);
    expect(blob.kdf).toBe('argon2id');
    expect(blob.version).toBe(1);
    const restored = await decryptIdentity(blob, 'correct horse battery');
    expect(restored.identity.did).toBe(keypair.identity.did);
    expect(restored.identity.displayName).toBe('Vault');
    expect(toHex(restored.entropy ?? new Uint8Array())).toBe(toHex(keypair.entropy ?? new Uint8Array()));
  });

  it('fails closed on a wrong passphrase', async () => {
    const keypair = await generateIdentity();
    const blob = await encryptIdentity(keypair, 'correct horse battery', FAST);
    await expect(decryptIdentity(blob, 'incorrect passphrase')).rejects.toThrow(/decryption failed/);
  });

  it('fails closed on tampered ciphertext', async () => {
    const keypair = await generateIdentity();
    const blob = await encryptIdentity(keypair, 'correct horse battery', FAST);
    const tampered = { ...blob, ciphertext: Uint8Array.from(blob.ciphertext) };
    const last = tampered.ciphertext.length - 1;
    tampered.ciphertext[last] = (tampered.ciphertext[last] ?? 0) ^ 0x01;
    await expect(decryptIdentity(tampered, 'correct horse battery')).rejects.toThrow();
  });

  it('rejects weak passphrases and unsupported blob versions', async () => {
    const keypair = await generateIdentity();
    await expect(encryptIdentity(keypair, 'short')).rejects.toThrow(/8 characters/);
    const blob = await encryptIdentity(keypair, 'correct horse battery', FAST);
    await expect(decryptIdentity({ ...blob, version: 99 }, 'correct horse battery')).rejects.toThrow(
      /version/,
    );
  });

  it('exposes production KDF defaults (t=3, 64 MiB)', () => {
    expect(DEFAULT_ARGON2_PARAMS).toEqual({ opsLimit: 3, memLimit: 65_536 });
  });
});

describe('identityCrypto facade', () => {
  it('signs and verifies through the seam', async () => {
    const keypair = await generateIdentity();
    const message = utf8Encode('veil test message');
    const signature = await identityCrypto.sign(message, keypair.sign.secretKey);
    await expect(identityCrypto.verify(message, signature, keypair.sign.publicKey)).resolves.toBe(true);
    await expect(
      identityCrypto.verify(utf8Encode('changed'), signature, keypair.sign.publicKey),
    ).resolves.toBe(false);
  });
});
