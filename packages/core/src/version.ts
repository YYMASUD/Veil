/**
 * Protocol versioning and tunable wire limits for Veil.
 *
 * `PROTOCOL_VERSION` is the version this build emits. `MIN_SUPPORTED_VERSION`
 * is the oldest version we will still *decode*. Senders negotiate by emitting
 * `min(version, their_version)` during handshake; anything below
 * `MIN_SUPPORTED_VERSION` is rejected at decode time (see `@veil/core/codec`).
 */

/** The wire-format version this build emits. */
export const PROTOCOL_VERSION = 1;

/** The oldest envelope version this build accepts. */
export const MIN_SUPPORTED_VERSION = 1;

/** Human-facing product name (also used in UI branding). */
export const APP_NAME = 'Veil';

/** Namespace prefix for every pubsub topic we publish. */
export const WIRE_NAMESPACE = 'veil/v1';

/**
 * Fixed message-padded buckets. Payloads are padded up to one of these sizes
 * so that an observer learns only the bucket, never the plaintext length.
 * Buckets are sorted ascending; `chooseBucket` depends on that.
 */
export const BUCKET_SIZES = [512, 2048, 8192, 32768] as const;

/** One of {@link BUCKET_SIZES}. */
export type BucketSize = (typeof BUCKET_SIZES)[number];

/** Max wire size of a single envelope (bucket + framing + signature). */
export const MAX_ENVELOPE_BYTES = 96_000;

/** Max group membership enforced by validation (see messages/limits). */
export const MAX_GROUP_MEMBERS = 256;

/** Max attachment size (bytes) — content is chunked above this client-side. */
export const MAX_ATTACHMENT_BYTES = 100 * 1024 * 1024;

/** Default TTL for mailbox store-and-forward blobs. */
export const DEFAULT_MAILBOX_TTL_DAYS = 14;

/** Nonce length (bytes) for envelope AEAD / signature domain separation. */
export const NONCE_BYTES = 24;

/** Ed25519 signature length (bytes). */
export const ED25519_SIGNATURE_BYTES = 64;

/** Ed25519 public key length (bytes). */
export const ED25519_PUBLIC_KEY_BYTES = 32;

/** @returns true when `version` is in the decodable range for this build. */
export function isSupportedVersion(version: number): boolean {
  return Number.isInteger(version) && version >= MIN_SUPPORTED_VERSION && version <= PROTOCOL_VERSION;
}

/**
 * Choose the wire version to emit when talking to a peer that advertises
 * `theirVersion`. We degrade gracefully to the highest mutually supported
 * version, or `MIN_SUPPORTED_VERSION` if the peer is newer than us.
 */
export function negotiateVersion(theirVersion: number): number {
  if (theirVersion < MIN_SUPPORTED_VERSION) return MIN_SUPPORTED_VERSION;
  return Math.min(theirVersion, PROTOCOL_VERSION);
}
