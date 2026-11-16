/**
 * Message model: the padded, signed, versioned envelope plus the payload union
 * carried inside it, and the hybrid logical clock used to order messages.
 *
 * The envelope is the *only* thing that touches the wire. Everything inside
 * `payload` is ciphertext once Phase 3 lands; `@veil/core` treats it as opaque
 * bytes and owns only structure, padding and size limits.
 */

import { compareStrings, concatBytes, u32be, u64be, utf8Encode } from './bytes';
import { VeilError } from './errors';
import type { PeerId } from './identity';
import { BUCKET_SIZES, type BucketSize, NONCE_BYTES } from './version';

/** Content-addressed message id: SHA-256 of the canonical envelope bytes. */
export type MessageId = string;

/** Opaque conversation id (pairwise id for DMs, group id for groups). */
export type ConversationId = string;

/** Bytes appended by the padding scheme to record the original length. */
const PADDING_FOOTER_BYTES = 2;

/** Largest bucket (32768); tuple is non-empty so the index is always valid. */
const LARGEST_BUCKET = BUCKET_SIZES[BUCKET_SIZES.length - 1] as BucketSize;

/** Largest payload that fits any bucket. */
export const MAX_PAYLOAD_BYTES = LARGEST_BUCKET - PADDING_FOOTER_BYTES;

/**
 * Hybrid logical clock: a Lamport counter for causality plus a wall-clock
 * reading for human ordering. `nodeId` breaks ties deterministically.
 */
export interface HybridClock {
  readonly lamport: bigint;
  readonly wallMs: number;
  readonly nodeId: string;
}

/** Create a fresh clock for a node. */
export function createClock(nodeId: string, wallMs = 0): HybridClock {
  if (wallMs < 0 || !Number.isFinite(wallMs)) {
    throw new VeilError('INVALID_CLOCK', 'wallMs must be a finite non-negative number');
  }
  if (nodeId.length === 0 || nodeId.length > 64) {
    throw new VeilError('INVALID_CLOCK', 'nodeId must be 1..64 characters');
  }
  return { lamport: 0n, wallMs: Math.floor(wallMs), nodeId };
}

/** Advance the clock for a locally generated event. */
export function tick(clock: HybridClock, nowMs: number = Date.now()): HybridClock {
  return {
    lamport: clock.lamport + 1n,
    wallMs: Math.max(clock.wallMs, Math.floor(nowMs)),
    nodeId: clock.nodeId,
  };
}

/**
 * Advance the clock for a received event, preserving causality:
 * `lamport = max(local, remote) + 1`. This also caps the influence of a peer
 * with a maliciously forward-dated wall clock.
 */
export function observe(clock: HybridClock, remote: HybridClock, nowMs: number = Date.now()): HybridClock {
  const lamport = clock.lamport > remote.lamport ? clock.lamport + 1n : remote.lamport + 1n;
  return {
    lamport,
    wallMs: Math.max(clock.wallMs, remote.wallMs, Math.floor(nowMs)),
    nodeId: clock.nodeId,
  };
}

/** Total order: Lamport first, then wall clock, then nodeId. */
export function compareClocks(a: HybridClock, b: HybridClock): number {
  if (a.lamport !== b.lamport) return a.lamport < b.lamport ? -1 : 1;
  if (a.wallMs !== b.wallMs) return a.wallMs < b.wallMs ? -1 : 1;
  return compareStrings(a.nodeId, b.nodeId);
}

/** Structural equality — used to deduplicate identical remote events. */
export function clocksEqual(a: HybridClock, b: HybridClock): boolean {
  return a.lamport === b.lamport && a.wallMs === b.wallMs && a.nodeId === b.nodeId;
}

/** Payload discriminants inside the encrypted envelope. */
export type MessageKind =
  'text' | 'edit' | 'delete' | 'reaction' | 'receipt' | 'typing' | 'attachment' | 'contact-request';

/** Plain text message, optionally a reply. */
export interface TextPayload {
  readonly kind: 'text';
  readonly text: string;
  readonly replyTo?: MessageId;
  readonly mentions?: readonly string[];
}

/** Edit of a previously sent message. */
export interface EditPayload {
  readonly kind: 'edit';
  readonly target: MessageId;
  readonly text: string;
}

/** Tombstone: the message is deleted and its content discarded locally. */
export interface DeletePayload {
  readonly kind: 'delete';
  readonly target: MessageId;
}

/** Reaction add/remove on an existing message. */
export interface ReactionPayload {
  readonly kind: 'reaction';
  readonly target: MessageId;
  readonly emoji: string;
  readonly op: 'add' | 'remove';
}

/** Delivery / read receipt batch. */
export interface ReceiptPayload {
  readonly kind: 'receipt';
  readonly ack: readonly MessageId[];
  readonly state: 'delivered' | 'read';
}

/** Ephemeral typing indicator — never stored, never receipted. */
export interface TypingPayload {
  readonly kind: 'typing';
  readonly state: 'start' | 'stop';
  /** Disappearing-messages timer applied by the sender, in ms. */
  readonly expiresInMs?: number;
}

/** Attachment descriptor: content hash + key travel inside the ciphertext. */
export interface AttachmentPayload {
  readonly kind: 'attachment';
  readonly contentCid: string;
  readonly key: Uint8Array;
  readonly sizeBytes: number;
  readonly chunkCount: number;
  readonly mimeType?: string;
  readonly fileName?: string;
}

/** First contact from an unknown peer; subject to PoW / rate limiting. */
export interface ContactRequestPayload {
  readonly kind: 'contact-request';
  readonly message?: string;
}

/** Discriminated union of everything that can travel in a payload. */
export type MessagePayload =
  | TextPayload
  | EditPayload
  | DeletePayload
  | ReactionPayload
  | ReceiptPayload
  | TypingPayload
  | AttachmentPayload
  | ContactRequestPayload;

/**
 * The wire unit. `payload` is already padded to exactly `bucket` bytes and
 * encrypted (once Phase 3 lands); `signature` is Ed25519 over
 * {@link encodeEnvelopeSignatureBase} using the sender's identity key.
 */
export interface VersionedEnvelope {
  readonly version: number;
  /** Sender `did:key` — needed to locate the signing key and route replies. */
  readonly sender: string;
  /** Opaque conversation id. Never a display name or contact list. */
  readonly conversation: ConversationId;
  readonly bucket: BucketSize;
  /** Ciphertext, padded to exactly `bucket` bytes. */
  readonly payload: Uint8Array;
  readonly nonce: Uint8Array;
  readonly signature: Uint8Array;
  readonly clock: HybridClock;
  readonly sentAtMs: number;
}

/** Smallest bucket that can hold `length` bytes (including the pad footer). */
export function chooseBucket(length: number): BucketSize {
  for (const bucket of BUCKET_SIZES) {
    if (length + PADDING_FOOTER_BYTES <= bucket) return bucket;
  }
  throw new VeilError(
    'ENVELOPE_TOO_LARGE',
    `payload of ${length} bytes exceeds the largest bucket (max ${MAX_PAYLOAD_BYTES})`,
  );
}

/**
 * Pad `payload` to exactly `bucket` bytes with a length footer:
 * `payload ‖ 0x00… ‖ uint16be(totalPadding)`.
 *
 * The zero fill makes an un-pad mismatch detectable instead of silently
 * truncating; deterministic output means identical inputs produce identical
 * envelopes (and therefore identical message ids).
 */
export function padToBucket(payload: Uint8Array, bucket?: BucketSize): Uint8Array {
  const target = bucket ?? chooseBucket(payload.length);
  const padTotal = target - payload.length;
  if (padTotal < PADDING_FOOTER_BYTES) {
    throw new VeilError(
      'INVALID_PADDING',
      `payload of ${payload.length} bytes does not fit bucket ${target}`,
    );
  }
  const out = new Uint8Array(target); // zero-filled
  out.set(payload, 0);
  out[target - 2] = (padTotal >> 8) & 0xff;
  out[target - 1] = padTotal & 0xff;
  return out;
}

/** Reverse {@link padToBucket}, validating the footer and the zero fill. */
export function unpadFromBucket(padded: Uint8Array, bucket: BucketSize): Uint8Array {
  if (padded.length !== bucket) {
    throw new VeilError(
      'INVALID_PADDING',
      `padded payload must be exactly ${bucket} bytes, got ${padded.length}`,
    );
  }
  const padTotal = ((padded[bucket - 2] as number) << 8) | (padded[bucket - 1] as number);
  if (padTotal < PADDING_FOOTER_BYTES || padTotal > bucket) {
    throw new VeilError('INVALID_PADDING', `invalid padding footer: ${padTotal}`);
  }
  const contentLength = bucket - padTotal;
  for (let i = contentLength; i < bucket - PADDING_FOOTER_BYTES; i++) {
    if (padded[i] !== 0) {
      throw new VeilError('INVALID_PADDING', 'padding bytes must be zero');
    }
  }
  return padded.slice(0, contentLength);
}

/**
 * Canonical bytes that the sender signs. Includes every field that must not be
 * mutated in flight, plus the version, so a version-downgrade attempt breaks
 * the signature. Deliberately independent of protobuf field ordering.
 */
export function encodeEnvelopeSignatureBase(envelope: VersionedEnvelope): Uint8Array {
  return concatBytes(
    u32be(envelope.version),
    utf8Encode(envelope.sender),
    utf8Encode(envelope.conversation),
    u32be(envelope.bucket),
    u32be(envelope.payload.length),
    envelope.payload,
    envelope.nonce,
    u64be(envelope.clock.lamport),
    u64be(BigInt(Math.floor(envelope.clock.wallMs))),
    utf8Encode(envelope.clock.nodeId),
    u64be(BigInt(Math.floor(envelope.sentAtMs))),
  );
}

/** Structural validation shared by the encoder and the decoder. */
export function validateEnvelope(envelope: VersionedEnvelope): void {
  if (envelope.payload.length !== envelope.bucket) {
    throw new VeilError(
      'MALFORMED_ENVELOPE',
      `payload must be padded to bucket size (${envelope.bucket}), got ${envelope.payload.length}`,
    );
  }
  if (envelope.nonce.length !== NONCE_BYTES) {
    throw new VeilError(
      'MALFORMED_ENVELOPE',
      `nonce must be ${NONCE_BYTES} bytes, got ${envelope.nonce.length}`,
    );
  }
  if (envelope.conversation.length === 0 || envelope.conversation.length > 128) {
    throw new VeilError('MALFORMED_ENVELOPE', 'conversation id must be 1..128 characters');
  }
  if (envelope.clock.nodeId.length === 0 || envelope.clock.nodeId.length > 64) {
    throw new VeilError('MALFORMED_ENVELOPE', 'clock nodeId must be 1..64 characters');
  }
}

/** Where an incoming message came from — used by the transport seam. */
export interface IncomingEnvelopeMeta {
  readonly from: PeerId;
  readonly topic: string;
  readonly receivedAtMs: number;
}
