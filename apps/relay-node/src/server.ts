/**
 * Veil relay + mailbox node (Phase 0 skeleton).
 *
 * Responsibilities:
 *  - libp2p host with TCP + WebSocket transports, noise encryption, yamux
 *  - Circuit Relay v2 server (hop) so NAT'd peers can rendezvous
 *  - DCUtR hole-punch coordination, identify, ping services
 *  - Mailbox seam: an in-memory sealed-blob store behind @veil/core types
 *    (wired to the network protocol in Phase 4)
 *  - Tiny HTTP health endpoint for Docker/orchestrator probes
 *
 * The node never sees plaintext messages or identities — see THREAT_MODEL.md.
 */

import { createServer } from 'node:http';

import { createLibp2p, type Libp2p } from 'libp2p';
import { tcp } from '@libp2p/tcp';
import { webSockets } from '@libp2p/websockets';
import { noise } from '@chainsafe/libp2p-noise';
import { yamux } from '@chainsafe/libp2p-yamux';
import { circuitRelayServer } from '@libp2p/circuit-relay-v2';
import { identify } from '@libp2p/identify';
import { ping } from '@libp2p/ping';
import { dcutr } from '@libp2p/dcutr';

import { loadConfig, type RelayConfig } from './config';
import { MailboxStore } from './mailbox';

/** One structured JSON line per event; never message content or key material. */
function log(level: RelayConfig['logLevel'], message: string): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, msg: message }));
}

function startHealthServer(port: number): ReturnType<typeof createServer> {
  const server = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'text/plain' });
      res.end('ok');
      return;
    }
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not found');
  });
  server.listen(port, () => log('info', `health endpoint listening on :${port}`));
  return server;
}

async function main(): Promise<void> {
  const config = loadConfig();

  const node: Libp2p = await createLibp2p({
    addresses: {
      listen: [`/ip4/${config.host}/tcp/${config.tcpPort}`, `/ip4/${config.host}/tcp/${config.wsPort}/ws`],
      ...(config.announceAddrs.length > 0 ? { announce: [...config.announceAddrs] } : {}),
    },
    transports: [tcp(), webSockets()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      identify: identify(),
      ping: ping(),
      dcutr: dcutr(),
      relay: circuitRelayServer({
        reservations: {
          maxReservations: 1_024,
          reservationClearInterval: 60_000,
        },
      }),
    },
  });

  const mailbox = new MailboxStore({
    maxItemsPerToken: config.maxItemsPerToken,
    maxTotalItems: config.maxTotalItems,
  });
  void mailbox; // wired to the mailbox wire protocol in Phase 4

  const health = startHealthServer(config.healthPort);

  for (const addr of node.getMultiaddrs()) {
    log('info', `listening on ${addr.toString()}`);
  }
  log('info', `peer id ${node.peerId.toString()} — relay v2 (hop) + mailbox seam ready`);
  log('info', `mailbox caps: ${config.maxItemsPerToken}/token, ${config.maxTotalItems} total`);

  let stopping = false;
  async function shutdown(signal: string): Promise<void> {
    if (stopping) return;
    stopping = true;
    log('info', `received ${signal}, shutting down`);
    health.close();
    await node.stop();
    process.exit(0);
  }
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((error: unknown) => {
  console.error(JSON.stringify({ level: 'error', msg: 'fatal', error: String(error) }));
  process.exit(1);
});
