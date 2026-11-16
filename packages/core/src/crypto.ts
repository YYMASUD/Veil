/** Cryptographic service seams. Implementations live in `@veil/crypto`. */
import type { Identity, IdentityKeypair, MnemonicSource } from './identity';
import type { MessagePayload, VersionedEnvelope } from './messages';

/** Encrypted key export — plaintext secret bytes are never persisted. */
export interface EncryptedIdentityExport {
  readonly version: 1;
  readonly kdf: 'argon2id';
  readonly salt: Uint8Array;
  readonly nonce: Uint8Array;
  readonly opsLimit: number;
  readonly memLimit: number;
  readonly ciphertext: Uint8Array;
}

/** Ed25519/X25519 identity, mnemonic, and at-rest encryption operations. */
export interface IdentityCrypto {
  generateIdentity(displayName?: string): Promise<IdentityKeypair>;
  fromMnemonic(mnemonic: string, language?: string): Promise<IdentityKeypair>;
  toMnemonic(keypair: IdentityKeypair, words?: 12 | 24): Promise<MnemonicSource>;
  encryptIdentity(keypair: IdentityKeypair, passphrase: string): Promise<EncryptedIdentityExport>;
  decryptIdentity(data: EncryptedIdentityExport, passphrase: string): Promise<IdentityKeypair>;
  sign(message: Uint8Array, secretKey: Uint8Array): Promise<Uint8Array>;
  verify(message: Uint8Array, signature: Uint8Array, publicKey: Uint8Array): Promise<boolean>;
}

/** Double Ratchet / X3DH session operations for 1:1 conversations. */
export interface DirectMessageCrypto {
  createPreKeyBundle(identity: IdentityKeypair): Promise<Uint8Array>;
  establishSession(local: IdentityKeypair, remote: Identity, bundle: Uint8Array): Promise<string>;
  encrypt(sessionId: string, plaintext: Uint8Array): Promise<Uint8Array>;
  decrypt(sessionId: string, ciphertext: Uint8Array): Promise<Uint8Array>;
  deleteSession(sessionId: string): Promise<void>;
}

/** MLS group epoch operations (RFC 9420). */
export interface GroupCrypto {
  createGroup(groupId: string, creator: IdentityKeypair): Promise<Uint8Array>;
  addMember(groupId: string, member: Identity, inviter: IdentityKeypair): Promise<Uint8Array>;
  processCommit(groupId: string, commit: Uint8Array): Promise<void>;
  encrypt(groupId: string, payload: MessagePayload): Promise<Uint8Array>;
  decrypt(groupId: string, ciphertext: Uint8Array): Promise<MessagePayload>;
  exportState(groupId: string): Promise<Uint8Array>;
  importState(groupId: string, state: Uint8Array): Promise<void>;
  deleteGroup(groupId: string): Promise<void>;
}

/** Generic high-level envelope signer/verifier used by the networking layer. */
export interface EnvelopeCrypto {
  signEnvelope(envelope: VersionedEnvelope, identity: IdentityKeypair): Promise<VersionedEnvelope>;
  verifyEnvelope(envelope: VersionedEnvelope, identity: Identity): Promise<boolean>;
}
