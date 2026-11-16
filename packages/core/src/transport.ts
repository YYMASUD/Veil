/** P2P transport seam. Concrete implementation lives in `@veil/network`. */
import type { PeerId } from './identity';
import type { IncomingEnvelopeMeta, VersionedEnvelope } from './messages';

/** Stop listening to a topic. Safe to call more than once. */
export type Unsubscribe = () => void | Promise<void>;

/** Network-independent message transport used by UI and storage layers. */
export interface MessageTransport {
  /** Establish transports and discovery; resolves when ready to publish. */
  start(): Promise<void>;
  /** Stop discovery, listeners and connections. */
  stop(): Promise<void>;
  /** Publish a signed, padded envelope to a protocol topic. */
  publish(topic: string, envelope: VersionedEnvelope): Promise<void>;
  /** Subscribe to a topic and receive validated envelope metadata. */
  subscribe(
    topic: string,
    onMessage: (envelope: VersionedEnvelope, meta: IncomingEnvelopeMeta) => void | Promise<void>,
  ): Promise<Unsubscribe>;
  /** Current local libp2p peer id, once started. */
  localPeerId(): PeerId | undefined;
  /** Whether the transport is started. */
  isStarted(): boolean;
}

/** Configuration independent of a specific libp2p version. */
export interface NetworkConfig {
  readonly listenAddresses: readonly string[];
  readonly bootstrapPeers: readonly string[];
  readonly enableMdns: boolean;
  readonly enableDht: boolean;
  readonly enableRelay: boolean;
  readonly maxMessageBytes: number;
}
