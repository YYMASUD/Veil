/** Deterministic pubsub topic naming. Topics never contain display names. */
import { compareStrings, utf8Encode } from './bytes';
import { VeilError } from './errors';
import { WIRE_NAMESPACE } from './version';

/** Opaque conversation/group identifier. */
export type TopicId = string;

/** Sort peers first, so both participants derive the same DM topic. */
export function pairId(a: string, b: string): string {
  if (a === b) throw new VeilError('INVALID_TOPIC', 'a DM needs two distinct peers');
  const [first, second] = compareStrings(a, b) < 0 ? [a, b] : [b, a];
  return `${encodeURIComponent(first)}.${encodeURIComponent(second)}`;
}

/** All pubsub topic builders, rooted at `veil/v1/`. */
export const TOPIC = Object.freeze({
  dm: (a: string, b: string): string => `${WIRE_NAMESPACE}/dm/${pairId(a, b)}`,
  group: (groupId: TopicId): string => `${WIRE_NAMESPACE}/group/${safeId(groupId)}`,
  presence: `${WIRE_NAMESPACE}/presence`,
  typing: (conversationId: TopicId): string => `${WIRE_NAMESPACE}/typing/${safeId(conversationId)}`,
  mailbox: (recipientId: TopicId): string => `${WIRE_NAMESPACE}/mailbox/${safeId(recipientId)}`,
});

/** Validates that a topic is in this protocol's namespace. */
export function isVeilTopic(topic: string): boolean {
  return topic.startsWith(`${WIRE_NAMESPACE}/`) && utf8Encode(topic).length <= 512;
}

/** Validate and return a topic, throwing on malformed or foreign namespace. */
export function validateTopic(topic: string): string {
  if (!isVeilTopic(topic)) {
    throw new VeilError('INVALID_TOPIC', 'topic must use the veil/v1/ namespace (max 512 bytes)');
  }
  return topic;
}

function safeId(id: string): string {
  if (!id || id.length > 256) throw new VeilError('INVALID_TOPIC', 'topic id must be 1..256 characters');
  return encodeURIComponent(id);
}
