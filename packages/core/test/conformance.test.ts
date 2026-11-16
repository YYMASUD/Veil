import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import protobuf from 'protobufjs';
import { describe, expect, it } from 'vitest';

import { encodeEnvelope } from '../src/codec';
import { padToBucket } from '../src/messages';
import { fromHex } from '../src/bytes';

const protoPath = resolve(import.meta.dirname, '../proto/envelope.proto');
const schema = protobuf.parse(readFileSync(protoPath, 'utf8')).root;
const ProtoEnvelope = schema.lookupType('veil.v1.Envelope');

/**
 * Conformance test: the dependency-free encoder must produce byte-for-byte
 * protobuf output consistent with the normative .proto via protobufjs.
 */
describe('protobuf conformance', () => {
  it('matches protobufjs on the normative envelope schema', () => {
    const envelope = {
      version: 1,
      sender: 'did:key:z6MkhaXgBZDvotDkL5257faiztiGiC2QtKLGpbnnEGta2doK',
      conversation: 'conformance-check',
      bucket: 512 as const,
      payload: padToBucket(fromHex('deadbeef'), 512),
      nonce: new Uint8Array(24).fill(1),
      signature: new Uint8Array(64).fill(2),
      clock: { lamport: 3n, wallMs: 1_700_000_000_000, nodeId: 'vector-node' },
      sentAtMs: 1_700_000_000_000,
    };

    const ours = encodeEnvelope(envelope);
    const proto = {
      version: envelope.version,
      sender: envelope.sender,
      conversation: envelope.conversation,
      bucket: envelope.bucket,
      payload: Buffer.from(envelope.payload),
      nonce: Buffer.from(envelope.nonce),
      clock: {
        lamport: Number(envelope.clock.lamport),
        wallMs: envelope.clock.wallMs,
        nodeId: envelope.clock.nodeId,
      },
      sentAtMs: envelope.sentAtMs,
      signature: Buffer.from(envelope.signature),
    };
    const err = ProtoEnvelope.verify(proto);
    expect(err).toBeNull();
    const reference = ProtoEnvelope.encode(ProtoEnvelope.create(proto)).finish();
    expect(Buffer.from(ours).equals(Buffer.from(reference))).toBe(true);
  });
});
