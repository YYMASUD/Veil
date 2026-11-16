/** @veil/crypto — identity crypto (Phase 1); X3DH/Double Ratchet + MLS land in Phases 3–5. */
export {
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
  X25519_SECRET_LENGTH,
} from './identity';
export { CRYPTO_PACKAGE_VERSION } from './packageMeta';
