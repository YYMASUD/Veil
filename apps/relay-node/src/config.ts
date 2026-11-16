/**
 * Relay/mailbox node configuration from environment variables, with safe
 * defaults and hard caps. Never logs configuration secrets (there are none).
 */

export interface RelayConfig {
  /** TCP listen host (default 0.0.0.0). */
  readonly host: string;
  /** TCP listen port for libp2p (default 4001). */
  readonly tcpPort: number;
  /** WebSocket listen port for libp2p (default 4002). */
  readonly wsPort: number;
  /** Plain HTTP health endpoint port (default 8080). */
  readonly healthPort: number;
  /** Log verbosity: debug | info | warn | error. */
  readonly logLevel: 'debug' | 'info' | 'warn' | 'error';
  /** Mailbox capacity per recipient token. */
  readonly maxItemsPerToken: number;
  /** Global mailbox capacity (all tokens). */
  readonly maxTotalItems: number;
  /** Announce these extra multiaddrs (comma-separated, optional). */
  readonly announceAddrs: readonly string[];
}

function parsePort(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined || value === '') return fallback;
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`${label} must be an integer between 1 and 65535, got "${value}"`);
  }
  return port;
}

function parsePositiveInt(value: string | undefined, fallback: number, label: string): number {
  if (value === undefined || value === '') return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 10_000_000) {
    throw new Error(`${label} must be a positive integer, got "${value}"`);
  }
  return parsed;
}

function parseLogLevel(value: string | undefined): RelayConfig['logLevel'] {
  if (value === undefined || value === '') return 'info';
  const normalized = value.toLowerCase();
  if (normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
    return normalized;
  }
  throw new Error(`VEIL_LOG_LEVEL must be debug|info|warn|error, got "${value}"`);
}

/** Load configuration from `env` (defaults to process.env). Throws on bad values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): RelayConfig {
  return {
    host: env.VEIL_HOST ?? '0.0.0.0',
    tcpPort: parsePort(env.VEIL_TCP_PORT, 4001, 'VEIL_TCP_PORT'),
    wsPort: parsePort(env.VEIL_WS_PORT, 4002, 'VEIL_WS_PORT'),
    healthPort: parsePort(env.VEIL_HEALTH_PORT, 8080, 'VEIL_HEALTH_PORT'),
    logLevel: parseLogLevel(env.VEIL_LOG_LEVEL),
    maxItemsPerToken: parsePositiveInt(env.VEIL_MAX_ITEMS_PER_TOKEN, 500, 'VEIL_MAX_ITEMS_PER_TOKEN'),
    maxTotalItems: parsePositiveInt(env.VEIL_MAX_TOTAL_ITEMS, 20_000, 'VEIL_MAX_TOTAL_ITEMS'),
    announceAddrs: (env.VEIL_ANNOUNCE_ADDRS ?? '')
      .split(',')
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0),
  };
}
