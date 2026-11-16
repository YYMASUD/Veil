/**
 * Identity operations for Veil (Phase 1): Ed25519 + X25519 key generation,
 * BIP39 mnemonic export/import, Argon2id at-rest encryption and Ed25519
 * signatures. All primitives come from audited noble/scure libraries — no
 * hand-rolled crypto (DECISIONS.md D-04).
 *
 * Key derivation (documented in PROTOCOL.md §1 and DECISIONS.md D-16):
 *   BIP39 entropy (16 B → 12 words, 32 B → 24 words)
 *     signSeed   = SHA-256("veil/identity-ed25519-v1" ‖ entropy)
 *     noiseSeed  = SHA-256("veil/identity-x25519-v1"  ‖ entropy)
 * A mnemonic therefore restores both the signing key and the X25519 static
 * key; the entropy is retained on the keypair so exports round-trip exactly.
 */

import { chacha20poly1305 } from '@noble/ciphers/chacha.js';
import { ed25519, x25519 } from '@noble/curves/ed25519.js';
import { argon2idAsync } from '@noble/hashes/argon2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { randomBytes } from '@noble/hashes/utils.js';
import { wordlist as english } from '@scure/bip39/wordlists/english.js';
import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39';

import { concatBytes, createIdentity, fromHex, toHex, utf8Decode, utf8Encode, VeilError } from '@veil/core';
import type {
  Argon2Params,
  EncryptedIdentityExport,
  IdentityCrypto,
  IdentityKeypair,
  MnemonicSource,
  NoiseKeypair,
  SignKeypair,
} from '@veil/core';

/** Domain separator for the Ed25519 seed derived from BIP39 entropy. */
const SEED_DOMAIN = utf8Encode('veil/identity-ed25519-v1');
/** Domain separator for the X25519 static key derived from BIP39 entropy. */
const NOISE_DOMAIN = utf8Encode('veil/identity-x25519-v1');

/** Production Argon2id cost: t=3 iterations, 64 MiB memory, 1 lane. */
export const DEFAULT_ARGON2_PARAMS: Argon2Params = { opsLimit: 3, memLimit: 65_536 };

const SALT_BYTES = 16;
const AEAD_NONCE_BYTES = 12;
const ARGON2_KEY_BYTES = 32;
const ED25519_SEED_BYTES = 32;
const ED25519_PUBLIC_BYTES = 32;
const X25519_SECRET_BYTES = 32;

/** Entropy sizes that map to BIP39 word counts. */
const ENTROPY_BYTES_12_WORDS = 16;
const ENTROPY_BYTES_24_WORDS = 32;

/** Reject empty/weak passphrases before they reach the KDF. */
function assertPassphrase(passphrase: string): void {
  if (passphrase.length < 8) {
    throw new VeilError('INVALID_IDENTITY', 'passphrase must be at least 8 characters');
  }
}

/** Entropy is root secret material and must exist to export a mnemonic. */
function requireEntropy(keypair: IdentityKeypair): Uint8Array {
  if (keypair.entropy === undefined) {
    throw new VeilError(
      'INVALID_IDENTITY',
      'keypair has no mnemonic entropy (it was not generated or imported from one)',
    );
  }
  return keypair.entropy;
}

/** Derive both keypairs and the shareable identity from BIP39 entropy. */
export function keypairFromEntropy(entropy: Uint8Array, displayName?: string): IdentityKeypair {
  if (entropy.length !== ENTROPY_BYTES_12_WORDS && entropy.length !== ENTROPY_BYTES_24_WORDS) {
    throw new VeilError('INVALID_IDENTITY', 'entropy must be 16 or 32 bytes');
  }

  const signSeed = sha256(concatBytes(SEED_DOMAIN, entropy));
  const signPublic = ed25519.getPublicKey(signSeed);
  const sign: SignKeypair = {
    publicKey: Uint8Array.from(signPublic),
    secretKey: concatBytes(signSeed, signPublic), // seed ‖ public (64 B)
  };

  const noiseSecret = sha256(concatBytes(NOISE_DOMAIN, entropy));
  const noise: NoiseKeypair = {
    publicKey: Uint8Array.from(x25519.getPublicKey(noiseSecret)),
    secretKey: Uint8Array.from(noiseSecret),
  };

  const identity = createIdentity({
    sign,
    noise,
    ...(displayName === undefined ? {} : { displayName }),
  });

  return { identity, sign, noise, entropy: Uint8Array.from(entropy) };
}

/** Restore a keypair from a BIP39 mnemonic (English, 12 or 24 words). */
export async function fromMnemonic(mnemonic: string, language = 'en'): Promise<IdentityKeypair> {
  if (language !== 'en') {
    throw new VeilError('NOT_IMPLEMENTED', `mnemonic language "${language}" is not supported yet`);
  }
  const normalized = mnemonic.trim().toLowerCase().replace(/\s+/g, ' ');
  if (normalized.length === 0) {
    throw new VeilError('INVALID_IDENTITY', 'mnemonic is empty');
  }
  if (!validateMnemonic(normalized, english)) {
    throw new VeilError('INVALID_IDENTITY', 'mnemonic is invalid (unknown word or bad checksum)');
  }
  return keypairFromEntropy(mnemonicToEntropy(normalized, english));
}

/** Export a keypair as a BIP39 mnemonic of the matching length. */
export function toMnemonic(keypair: IdentityKeypair, words: 12 | 24 = 24): MnemonicSource {
  const entropy = requireEntropy(keypair);
  const expected = words === 12 ? ENTROPY_BYTES_12_WORDS : ENTROPY_BYTES_24_WORDS;
  if (entropy.length !== expected) {
    const actual = entropy.length === 16 ? 12 : 24;
    throw new VeilError(
      'INVALID_IDENTITY',
      `cannot export ${words} words from ${entropy.length}-byte entropy; use ${actual} words`,
    );
  }
  const phrase = entropyToMnemonic(entropy, english);
  return { words: phrase.split(' '), language: 'en' };
}

/** Generate a fresh identity (12-word / 128-bit default). */
export async function generateIdentity(displayName?: string): Promise<IdentityKeypair> {
  return keypairFromEntropy(randomBytes(ENTROPY_BYTES_12_WORDS), displayName);
}

/** Argon2id derivation with validated cost parameters. */
async function deriveKey(passphrase: string, salt: Uint8Array, params: Argon2Params): Promise<Uint8Array> {
  assertPassphrase(passphrase);
  if (!Number.isInteger(params.opsLimit) || params.opsLimit < 1) {
    throw new VeilError('INVALID_IDENTITY', 'argon2 opsLimit must be an integer >= 1');
  }
  if (!Number.isInteger(params.memLimit) || params.memLimit < 8) {
    throw new VeilError('INVALID_IDENTITY', 'argon2 memLimit must be an integer >= 8 KiB');
  }
  const key = await argon2idAsync(passphrase, salt, {
    t: params.opsLimit,
    m: params.memLimit,
    p: 1,
    dkLen: ARGON2_KEY_BYTES,
  });
  return Uint8Array.from(key);
}

/**
 * Encrypt a keypair for at-rest storage: Argon2id(passphrase) → ChaCha20-Poly1305.
 * The plaintext JSON carries the mnemonic entropy, so an encrypted backup can
 * always be restored with `decryptIdentity` (and re-exported as a mnemonic).
 */
export async function encryptIdentity(
  keypair: IdentityKeypair,
  passphrase: string,
  params: Argon2Params = DEFAULT_ARGON2_PARAMS,
): Promise<EncryptedIdentityExport> {
  assertPassphrase(passphrase);
  const salt = randomBytes(SALT_BYTES);
  const nonce = randomBytes(AEAD_NONCE_BYTES);
  const key = await deriveKey(passphrase, salt, params);
  const plaintext = utf8Encode(
    JSON.stringify({
      v: 1,
      entropy: toHex(requireEntropy(keypair)),
      did: keypair.identity.did,
      deviceId: keypair.identity.deviceId,
      ...(keypair.identity.displayName === undefined ? {} : { displayName: keypair.identity.displayName }),
    }),
  );
  const ciphertext = chacha20poly1305(key, nonce).encrypt(plaintext);
  return {
    version: 1,
    kdf: 'argon2id',
    salt: Uint8Array.from(salt),
    nonce: Uint8Array.from(nonce),
    opsLimit: params.opsLimit,
    memLimit: params.memLimit,
    ciphertext: Uint8Array.from(ciphertext),
  };
}

interface IdentityBlob {
  readonly entropy: string;
  readonly did: string;
  readonly deviceId: string;
  readonly displayName?: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new VeilError('DECODE_FAILED', 'identity blob must be a JSON object');
  }
  return value as Record<string, unknown>;
}

function requiredString(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== 'string' || value.length === 0) {
    throw new VeilError('DECODE_FAILED', `identity blob field "${field}" is missing or invalid`);
  }
  return value;
}

function parseIdentityBlob(plaintext: Uint8Array): IdentityBlob {
  let parsed: unknown;
  try {
    parsed = JSON.parse(utf8Decode(plaintext));
  } catch (cause) {
    throw new VeilError('DECODE_FAILED', 'identity blob is not valid JSON', cause);
  }
  const record = asRecord(parsed);
  const version = record['v'];
  if (version !== 1) {
    throw new VeilError('UNSUPPORTED_VERSION', `unsupported identity blob version ${String(version)}`);
  }
  const displayName = record['displayName'];
  if (displayName !== undefined && displayName !== null && typeof displayName !== 'string') {
    throw new VeilError('DECODE_FAILED', 'identity blob displayName must be a string');
  }
  return {
    entropy: requiredString(record, 'entropy'),
    did: requiredString(record, 'did'),
    deviceId: requiredString(record, 'deviceId'),
    ...(typeof displayName === 'string' ? { displayName } : {}),
  };
}

/**
 * Decrypt an identity blob. Fails closed: a wrong passphrase or tampering
 * raises `DECODE_FAILED` (AEAD authentication), and a blob whose `did` does
 * not match the derived key is rejected.
 */
export async function decryptIdentity(
  data: EncryptedIdentityExport,
  passphrase: string,
): Promise<IdentityKeypair> {
  if (data.version !== 1) {
    throw new VeilError('UNSUPPORTED_VERSION', `unsupported identity blob version ${data.version}`);
  }
  if (data.kdf !== 'argon2id') {
    throw new VeilError('INVALID_IDENTITY', `unsupported kdf "${data.kdf}"`);
  }
  if (data.salt.length < 8 || data.nonce.length !== AEAD_NONCE_BYTES) {
    throw new VeilError('INVALID_IDENTITY', 'identity blob salt/nonce are malformed');
  }
  const key = await deriveKey(passphrase, data.salt, {
    opsLimit: data.opsLimit,
    memLimit: data.memLimit,
  });

  let plaintext: Uint8Array;
  try {
    plaintext = chacha20poly1305(key, data.nonce).decrypt(data.ciphertext);
  } catch (cause) {
    throw new VeilError(
      'DECODE_FAILED',
      'identity decryption failed (wrong passphrase or corrupt blob)',
      cause,
    );
  }

  const blob = parseIdentityBlob(plaintext);
  let entropy: Uint8Array;
  try {
    entropy = fromHex(blob.entropy);
  } catch (cause) {
    throw new VeilError('DECODE_FAILED', 'identity blob entropy is not valid hex', cause);
  }
  const keypair = keypairFromEntropy(entropy, blob.displayName);
  if (keypair.identity.did !== blob.did) {
    throw new VeilError('INVALID_IDENTITY', 'identity blob did does not match the derived key');
  }
  if (keypair.identity.deviceId !== blob.deviceId) {
    throw new VeilError('INVALID_IDENTITY', 'identity blob deviceId does not match the derived key');
  }
  return keypair;
}

/** Ed25519 signature over `message`. Accepts 32-byte seeds or 64-byte (seed‖pub). */
export function signWithEd25519(message: Uint8Array, secretKey: Uint8Array): Uint8Array {
  const seed = secretKey.length === 64 ? secretKey.subarray(0, ED25519_SEED_BYTES) : secretKey;
  if (seed.length !== ED25519_SEED_BYTES) {
    throw new VeilError('INVALID_IDENTITY', 'ed25519 secret key must be 32 or 64 bytes');
  }
  return Uint8Array.from(ed25519.sign(message, seed));
}

/** Verification; malformed inputs return `false` rather than throwing. */
export function verifyEd25519(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): boolean {
  if (publicKey.length !== ED25519_PUBLIC_BYTES || signature.length !== 64) return false;
  try {
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

/** Default {@link IdentityCrypto} implementation backed by noble/scure. */
export const identityCrypto: IdentityCrypto = {
  generateIdentity,
  fromMnemonic,
  toMnemonic: (keypair, words) => Promise.resolve(toMnemonic(keypair, words)),
  encryptIdentity,
  decryptIdentity,
  sign: (message, secretKey) => Promise.resolve(signWithEd25519(message, secretKey)),
  verify: (message, signature, publicKey) => Promise.resolve(verifyEd25519(message, signature, publicKey)),
};

/** X25519 static secret length; used by handshake code (Phase 3). */
export const X25519_SECRET_LENGTH = X25519_SECRET_BYTES;
