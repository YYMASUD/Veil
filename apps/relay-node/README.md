# @veil/relay-node

Volunteer libp2p relay + mailbox node. The node provides Circuit Relay v2
reservations, DCUtR hole-punch coordination, and a health endpoint. Phase 0
mailbox storage is an **in-memory interface stub**; the network mailbox
protocol arrives in Phase 4. This node stores no user identities and cannot
decrypt any messages.

## Run locally

```powershell
pnpm install
pnpm --filter @veil/relay-node start
```

The process logs its PeerId and listen multiaddrs (never message contents or
keys). Probe `http://localhost:8080/health` → `ok`.

Verified on Windows: listeners on `/ip4/*/tcp/4001` (TCP) and
`/tcp/4002/ws` (WebSockets), relay v2 hop enabled, health endpoint `200 ok`.

## Run in Docker

```powershell
docker build -f apps/relay-node/Dockerfile -t veil-relay .
docker run --rm -p 4001:4001/tcp -p 4002:4002/tcp -p 8080:8080 veil-relay
```

The runtime image runs as non-root (`veil`), contains only built JS + runtime
dependencies, and has an HTTP healthcheck. Production deployments should put
it behind a TLS-terminating proxy for WebSockets and forward TCP/QUIC ports as
needed.

## Configuration

| Variable                   | Default   | Purpose                              |
| -------------------------- | --------- | ------------------------------------ |
| `VEIL_HOST`                | `0.0.0.0` | Bind address                         |
| `VEIL_TCP_PORT`            | `4001`    | libp2p TCP listener                  |
| `VEIL_WS_PORT`             | `4002`    | libp2p WebSocket listener            |
| `VEIL_HEALTH_PORT`         | `8080`    | HTTP `/health` port                  |
| `VEIL_LOG_LEVEL`           | `info`    | `debug                               | info | warn | error` |
| `VEIL_MAX_ITEMS_PER_TOKEN` | `500`     | Mailbox cap per recipient token      |
| `VEIL_MAX_TOTAL_ITEMS`     | `20000`   | Global mailbox cap                   |
| `VEIL_ANNOUNCE_ADDRS`      | (empty)   | Comma-separated announced multiaddrs |
