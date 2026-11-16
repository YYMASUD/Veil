/**
 * Minimal, dependency-free protobuf (proto3) codec for Veil's wire types.
 *
 * Why hand-rolled: `@veil/core` must run in browsers, workers, Node services
 * and the simulation harness with zero dependencies, and the envelope schema
 * is tiny and frozen. `packages/core/test/conformance.test.ts` asserts
 * byte-for-byte equality against `protobufjs` parsing `proto/envelope.proto`,
 * so the .proto file remains normative and this codec cannot silently drift.
 *
 * Field numbers below MUST match proto/envelope.proto. Do not renumber.
 */

import { bytesEqual, utf8Decode, utf8Encode } from './bytes';
import { VeilError } from './errors';
import { decodeDidKey } from './identity';
import type { HybridClock, VersionedEnvelope } from './messages';
import { validateEnvelope } from './messages';
import {
  BUCKET_SIZES,
  type BucketSize,
  ED25519_SIGNATURE_BYTES,
  isSupportedVersion,
  MAX_ENVELOPE_BYTES,
  NONCE_BYTES,
} from './version';

const enum WireType {
  Varint = 0,
  SixtyFourBit = 1,
  LengthDelimited = 2,
  ThirtyTwoBit = 5,
}

const FIELD = {
  version: 1,
  sender: 2,
  conversation: 3,
  bucket: 4,
  payload: 5,
  nonce: 6,
  clock: 7,
  sentAtMs: 8,
  signature: 9,
} as const;

const CLOCK_FIELD = { lamport: 1, wallMs: 2, nodeId: 3 } as const;

/** Largest field number we accept; a guard against adversarial tag values. */
const MAX_FIELD_NUMBER = 2048;

class ProtoWriter {
  private readonly out: number[] = [];

  varint(value: number | bigint): void {
    let v = typeof value === 'bigint' ? value : BigInt(Math.trunc(value));
    if (v < 0n) throw new VeilError('DECODE_FAILED', 'varint must be non-negative');
    while (v > 0x7fn) {
      this.out.push(Number((v & 0x7fn) | 0x80n));
      v >>= 7n;
    }
    this.out.push(Number(v));
  }

  tag(field: number, wireType: WireType): void {
    this.varint((field << 3) | wireType);
  }

  bytes(field: number, value: Uint8Array): void {
    this.tag(field, WireType.LengthDelimited);
    this.varint(value.length);
    for (const b of value) this.out.push(b);
  }

  string(field: number, value: string): void {
    this.bytes(field, utf8Encode(value));
  }

  uint32(field: number, value: number): void {
    this.tag(field, WireType.Varint);
    this.varint(value);
  }

  uint64(field: number, value: number | bigint): void {
    this.tag(field, WireType.Varint);
    this.varint(value);
  }

  message(field: number, encode: (w: ProtoWriter) => void): void {
    const nested = new ProtoWriter();
    encode(nested);
    this.bytes(field, nested.toBytes());
  }

  toBytes(): Uint8Array {
    return Uint8Array.from(this.out);
  }
}

class ProtoReader {
  private index = 0;

  constructor(private readonly bytes: Uint8Array) {}

  get done(): boolean {
    return this.index >= this.bytes.length;
  }

  varint(): bigint {
    let result = 0n;
    let shift = 0n;
    let bytesRead = 0;
    for (;;) {
      if (this.index >= this.bytes.length) {
        throw new VeilError('MALFORMED_ENVELOPE', 'truncated varint');
      }
      const byte = this.bytes[this.index++] as number;
      result |= BigInt(byte & 0x7f) << shift;
      bytesRead += 1;
      if ((byte & 0x80) === 0) break;
      shift += 7n;
      if (bytesRead > 10) {
        throw new VeilError('MALFORMED_ENVELOPE', 'varint exceeds 10 bytes');
      }
    }
    return result;
  }

  tag(): { field: number; wireType: number } {
    const raw = this.varint();
    const field = Number(raw >> 3n);
    const wireType = Number(raw & 0x7n);
    if (field < 1 || field > MAX_FIELD_NUMBER) {
      throw new VeilError('MALFORMED_ENVELOPE', `field number ${field} out of range`);
    }
    return { field, wireType };
  }

  lengthDelimited(): Uint8Array {
    const length = Number(this.varint());
    if (length < 0 || this.index + length > this.bytes.length) {
      throw new VeilError('MALFORMED_ENVELOPE', 'length-delimited field overruns buffer');
    }
    const slice = this.bytes.subarray(this.index, this.index + length);
    this.index += length;
    return slice;
  }

  string(): string {
    return utf8Decode(this.lengthDelimited());
  }

  uint32(): number {
    const value = this.varint();
    if (value > 0xffff_ffffn) {
      throw new VeilError('MALFORMED_ENVELOPE', 'uint32 field out of range');
    }
    return Number(value);
  }

  uint64(): bigint {
    return this.varint();
  }

  skip(wireType: number): void {
    switch (wireType) {
      case WireType.Varint:
        this.varint();
        return;
      case WireType.SixtyFourBit:
        this.advance(8);
        return;
      case WireType.LengthDelimited:
        this.lengthDelimited();
        return;
      case WireType.ThirtyTwoBit:
        this.advance(4);
        return;
      default:
        throw new VeilError('MALFORMED_ENVELOPE', `unsupported wire type ${wireType}`);
    }
  }

  private advance(count: number): void {
    if (this.index + count > this.bytes.length) {
      throw new VeilError('MALFORMED_ENVELOPE', 'skip overruns buffer');
    }
    this.index += count;
  }
}

function encodeClock(writer: ProtoWriter, clock: HybridClock): void {
  writer.tag(CLOCK_FIELD.lamport, WireType.Varint);
  writer.varint(clock.lamport);
  writer.tag(CLOCK_FIELD.wallMs, WireType.Varint);
  writer.varint(BigInt(Math.floor(clock.wallMs)));
  writer.string(CLOCK_FIELD.nodeId, clock.nodeId);
}

/**
 * Serialise an envelope to protobuf bytes. Validates structure first so a
 * malformed envelope can never reach the network.
 */
export function encodeEnvelope(envelope: VersionedEnvelope): Uint8Array {
  if (!isSupportedVersion(envelope.version)) {
    throw new VeilError('UNSUPPORTED_VERSION', `cannot encode protocol version ${envelope.version}`);
  }
  validateEnvelope(envelope);
  if (envelope.signature.length !== ED25519_SIGNATURE_BYTES) {
    throw new VeilError(
      'MALFORMED_ENVELOPE',
      `signature must be ${ED25519_SIGNATURE_BYTES} bytes, got ${envelope.signature.length}`,
    );
  }
  // Defence in depth: never encode an envelope with an unusable sender id.
  try {
    decodeDidKey(envelope.sender);
  } catch (cause) {
    throw new VeilError('MALFORMED_ENVELOPE', 'sender did:key is invalid', cause);
  }

  const writer = new ProtoWriter();
  writer.uint32(FIELD.version, envelope.version);
  writer.string(FIELD.sender, envelope.sender);
  writer.string(FIELD.conversation, envelope.conversation);
  writer.uint32(FIELD.bucket, envelope.bucket);
  writer.bytes(FIELD.payload, envelope.payload);
  writer.bytes(FIELD.nonce, envelope.nonce);
  writer.message(FIELD.clock, (w) => encodeClock(w, envelope.clock));
  writer.uint64(FIELD.sentAtMs, BigInt(Math.floor(envelope.sentAtMs)));
  writer.bytes(FIELD.signature, envelope.signature);
  return writer.toBytes();
}

/**
 * Deserialise and validate an envelope. Unknown fields are skipped so newer
 * peers can add fields without breaking older decoders (see PROTOCOL.md).
 *
 * This performs **structural** validation only. Signature verification and
 * payload decryption belong to `@veil/crypto` and must happen before any
 * payload is trusted.
 */
export function decodeEnvelope(bytes: Uint8Array): VersionedEnvelope {
  if (bytes.length === 0) {
    throw new VeilError('MALFORMED_ENVELOPE', 'empty envelope');
  }
  if (bytes.length > MAX_ENVELOPE_BYTES) {
    throw new VeilError(
      'ENVELOPE_TOO_LARGE',
      `envelope of ${bytes.length} bytes exceeds ${MAX_ENVELOPE_BYTES}`,
    );
  }

  const reader = new ProtoReader(bytes);
  let version: number | undefined;
  let sender: string | undefined;
  let conversation: string | undefined;
  let bucket: number | undefined;
  let payload: Uint8Array | undefined;
  let nonce: Uint8Array | undefined;
  let clock: HybridClock | undefined;
  let sentAtMs: bigint | undefined;
  let signature: Uint8Array | undefined;

  while (!reader.done) {
    const { field, wireType } = reader.tag();
    switch (field) {
      case FIELD.version:
        version = reader.uint32();
        break;
      case FIELD.sender:
        sender = reader.string();
        break;
      case FIELD.conversation:
        conversation = reader.string();
        break;
      case FIELD.bucket:
        bucket = reader.uint32();
        break;
      case FIELD.payload:
        payload = reader.lengthDelimited();
        break;
      case FIELD.nonce:
        nonce = reader.lengthDelimited();
        break;
      case FIELD.clock: {
        const nested = new ProtoReader(reader.lengthDelimited());
        let lamport = 0n;
        let wallMs = 0;
        let nodeId = '';
        while (!nested.done) {
          const inner = nested.tag();
          switch (inner.field) {
            case CLOCK_FIELD.lamport:
              lamport = nested.uint64();
              break;
            case CLOCK_FIELD.wallMs:
              wallMs = Number(nested.uint64());
              break;
            case CLOCK_FIELD.nodeId:
              nodeId = nested.string();
              break;
            default:
              nested.skip(inner.wireType);
          }
        }
        clock = { lamport, wallMs, nodeId };
        break;
      }
      case FIELD.sentAtMs:
        sentAtMs = reader.uint64();
        break;
      case FIELD.signature:
        signature = reader.lengthDelimited();
        break;
      default:
        reader.skip(wireType);
    }
  }

  if (sender === undefined) throw new VeilError('MALFORMED_ENVELOPE', 'missing sender');
  if (conversation === undefined) {
    throw new VeilError('MALFORMED_ENVELOPE', 'missing conversation');
  }
  if (payload === undefined) throw new VeilError('MALFORMED_ENVELOPE', 'missing payload');
  if (nonce === undefined) throw new VeilError('MALFORMED_ENVELOPE', 'missing nonce');
  if (clock === undefined) throw new VeilError('MALFORMED_ENVELOPE', 'missing clock');
  if (signature === undefined) {
    throw new VeilError('MALFORMED_ENVELOPE', 'missing signature');
  }
  if (bucket === undefined) throw new VeilError('MALFORMED_ENVELOPE', 'missing bucket');

  const finalVersion = version ?? 1;
  if (!isSupportedVersion(finalVersion)) {
    throw new VeilError(
      'UNSUPPORTED_VERSION',
      `peer sent protocol version ${finalVersion}; this build supports 1..1`,
    );
  }
  if (!(BUCKET_SIZES as readonly number[]).includes(bucket)) {
    throw new VeilError('MALFORMED_ENVELOPE', `bucket ${bucket} is not one of the fixed buckets`);
  }
  if (payload.length !== bucket) {
    throw new VeilError(
      'MALFORMED_ENVELOPE',
      `payload length ${payload.length} does not match bucket ${bucket}`,
    );
  }
  if (nonce.length !== NONCE_BYTES) {
    throw new VeilError('MALFORMED_ENVELOPE', `nonce must be ${NONCE_BYTES} bytes, got ${nonce.length}`);
  }
  if (signature.length !== ED25519_SIGNATURE_BYTES) {
    throw new VeilError(
      'MALFORMED_ENVELOPE',
      `signature must be ${ED25519_SIGNATURE_BYTES} bytes, got ${signature.length}`,
    );
  }
  if (!sender.startsWith('did:key:')) {
    throw new VeilError('MALFORMED_ENVELOPE', 'sender must be a did:key identifier');
  }
  // Throws INVALID_IDENTITY for a malformed key; surface as MALFORMED_ENVELOPE.
  try {
    decodeDidKey(sender);
  } catch (cause) {
    throw new VeilError('MALFORMED_ENVELOPE', 'sender did:key is invalid', cause);
  }

  // payload / nonce / signature are views into the input buffer — copy them so
  // callers can safely retain decoded envelopes after the buffer is reused.
  const envelope: VersionedEnvelope = {
    version: finalVersion,
    sender,
    conversation,
    bucket: bucket as BucketSize,
    payload: Uint8Array.from(payload),
    nonce: Uint8Array.from(nonce),
    signature: Uint8Array.from(signature),
    clock,
    sentAtMs: Number(sentAtMs ?? 0n),
  };
  validateEnvelope(envelope);
  return envelope;
}

/** True when two envelopes were produced from identical bytes. */
export function envelopesEqual(a: VersionedEnvelope, b: VersionedEnvelope): boolean {
  const ea = encodeEnvelope(a);
  const eb = encodeEnvelope(b);
  return bytesEqual(ea, eb);
}
