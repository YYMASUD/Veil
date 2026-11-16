/**
 * Identity model. A Veil identity is a locally generated Ed25519 keypair.
 * There is no email, phone number or central registry: the user-facing
 * identifier is `did:key:z…` (multicodec-prefixed, Base58BTC, multibase `z`).
 *
 * Key material *types* live here; generation, signing and mnemonic handling
 * live in `@veil/crypto` (Phase 1) so this package stays dependency-free.
 */

import { base58btcDecode, base58btcEncode } from './base58';
import { bytesEqual, concatBytes } from './bytes';
import { VeilError } from './errors';
import { ED25519_PUBLIC_KEY_BYTES } from './version';

/** Multicodec code point for `ed25519-pub` (varint `0xed 0x01`). */
export const MULTICODEC_ED25519_PUB = 0xed;
/** Multicodec code point for `x25519-pub` (varint `0xec 0x01`). */
export const MULTICODEC_X25519_PUB = 0xec;

/** varint-encoded multicodec prefixes for Ed25519 / X25519 public keys. */
export const ED25519_MULTICODEC_PREFIX = new Uint8Array([0xed, 0x01]);
export const X25519_MULTICODEC_PREFIX = new Uint8Array([0xec, 0x01]);

/** libp2p PeerId (string form) — derived by `@veil/network` from the sign key. */
export type PeerId = string;

/** Device identifier: the `did:key` of the device's own signing key. */
export type DeviceId = string;

/** Ed25519 keypair: 32-byte public, 64-byte secret (seed ‖ public). */
export interface SignKeypair {
  readonly publicKey: Uint8Array;
  readonly secretKey: Uint8Array;
}

/** X25519 static keypair used for the Noise handshake and mailbox sealing. */
export interface NoiseKeypair {
  readonly publicKey: Uint8Array;
  readonly secretKey: Uint8Array;
}

/** Public, shareable identity. Contains no secret material. */
export interface Identity {
  /** `did:key:z…` of the Ed25519 identity signing key. */
  readonly did: string;
  /** `did:key` of the signing key of *this device*. */
  readonly deviceId: DeviceId;
  /** 32-byte Ed25519 public key. */
  readonly publicSignKey: Uint8Array;
  /** 32-byte X25519 static public key used for the Noise handshake. */
  readonly publicNoiseKey: Uint8Array;
  /** Optional human-readable name. Never transmitted to relays. */
  readonly displayName?: string;
}

/** Full identity material, including secrets. Must be encrypted at rest. */
export interface IdentityKeypair {
  readonly identity: Identity;
  readonly sign: SignKeypair;
  readonly noise: NoiseKeypair;
  /**
   * BIP39 entropy this identity was derived from (16 bytes → 12 words,
   * 32 bytes → 24 words). Present when the identity was generated or
   * imported from a mnemonic; required for `toMnemonic()` export.
   * This is root secret material — never persist it unencrypted.
   */
  readonly entropy?: Uint8Array;
}

/** BIP39 mnemonic used to export/import an identity. */
export interface MnemonicSource {
  /** BIP39 word list entries, e.g. `["abandon", "ability", …]`. */
  readonly words: readonly string[];
  /** BCP-47-ish language tag, e.g. `"en"`. */
  readonly language: string;
}

/** Encode `multibase('z', base58btc(prefix ‖ key))`. */
export function encodeMultibaseKey(key: Uint8Array, prefix: Uint8Array): string {
  return `z${base58btcEncode(concatBytes(prefix, key))}`;
}

/** Decode and validate a `z…` multibase key with the expected multicodec prefix. */
export function decodeMultibaseKey(value: string, prefix: Uint8Array, label: string): Uint8Array {
  if (!value.startsWith('z')) {
    throw new VeilError('INVALID_IDENTITY', `${label} must use multibase base58btc (z-prefixed)`);
  }
  let raw: Uint8Array;
  try {
    raw = base58btcDecode(value.slice(1));
  } catch (cause) {
    throw new VeilError('INVALID_IDENTITY', `${label} is not valid base58btc`, cause);
  }
  if (raw.length < prefix.length || !bytesEqual(raw.subarray(0, prefix.length), prefix)) {
    throw new VeilError('INVALID_IDENTITY', `${label} has an unexpected multicodec prefix`);
  }
  const key = raw.subarray(prefix.length);
  if (key.length !== ED25519_PUBLIC_KEY_BYTES) {
    throw new VeilError(
      'INVALID_IDENTITY',
      `${label} must be ${ED25519_PUBLIC_KEY_BYTES} bytes, got ${key.length}`,
    );
  }
  return Uint8Array.from(key);
}

/** `did:key:z…` for an Ed25519 public key. */
export function encodeDidKey(publicSignKey: Uint8Array): string {
  validateKeyLength(publicSignKey, 'publicSignKey');
  return `did:key:${encodeMultibaseKey(publicSignKey, ED25519_MULTICODEC_PREFIX)}`;
}

/** Extract the 32-byte Ed25519 public key from a `did:key`. Throws when invalid. */
export function decodeDidKey(did: string): Uint8Array {
  if (!did.startsWith('did:key:')) {
    throw new VeilError('INVALID_IDENTITY', 'did:key identifier must start with "did:key:"');
  }
  return decodeMultibaseKey(did.slice('did:key:'.length), ED25519_MULTICODEC_PREFIX, 'did:key');
}

/** Non-throwing variant of {@link decodeDidKey}. */
export function isDidKey(value: string): boolean {
  try {
    decodeDidKey(value);
    return true;
  } catch {
    return false;
  }
}

/** `z…` multibase encoding of an X25519 static public key. */
export function encodeNoiseKey(publicNoiseKey: Uint8Array): string {
  validateKeyLength(publicNoiseKey, 'publicNoiseKey');
  return encodeMultibaseKey(publicNoiseKey, X25519_MULTICODEC_PREFIX);
}

/** Decode a `z…` X25519 static public key. */
export function decodeNoiseKey(value: string): Uint8Array {
  return decodeMultibaseKey(value, X25519_MULTICODEC_PREFIX, 'noise key');
}

/** Assert an Ed25519 public key has the expected length. */
export function validateKeyLength(key: Uint8Array, label: string): void {
  if (key.length !== ED25519_PUBLIC_KEY_BYTES) {
    throw new VeilError(
      'INVALID_IDENTITY',
      `${label} must be ${ED25519_PUBLIC_KEY_BYTES} bytes, got ${key.length}`,
    );
  }
}

/**
 * Derive the shareable {@link Identity} view from keypairs. The `deviceId`
 * defaults to the identity key (single-device case); pass `deviceSignKey`
 * for a linked device that can be revoked independently.
 */
export function createIdentity(params: {
  sign: SignKeypair;
  noise: NoiseKeypair;
  displayName?: string;
  deviceSignKey?: Uint8Array;
}): Identity {
  const { sign, noise, displayName, deviceSignKey } = params;
  validateKeyLength(sign.publicKey, 'sign.publicKey');
  validateKeyLength(noise.publicKey, 'noise.publicKey');
  const did = encodeDidKey(sign.publicKey);
  const deviceId = encodeDidKey(deviceSignKey ?? sign.publicKey);
  return {
    did,
    deviceId,
    publicSignKey: Uint8Array.from(sign.publicKey),
    publicNoiseKey: Uint8Array.from(noise.publicKey),
    ...(displayName === undefined ? {} : { displayName }),
  };
}

/** Short, human-scannable form of an identity, e.g. `z6Mk…2Wv1`. */
export function shortDid(did: string): string {
  const tail = did.slice('did:key:'.length);
  if (tail.length <= 12) return tail;
  return `${tail.slice(0, 6)}…${tail.slice(-4)}`;
}

/** Stable lookup key for the address book / storage indexes. */
export function identityKey(identity: Identity): string {
  return identity.did;
}
