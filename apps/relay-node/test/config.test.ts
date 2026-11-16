import { describe, expect, it } from 'vitest';

import { loadConfig } from '../src/config';

describe('relay config', () => {
  it('loads defaults', () => {
    const config = loadConfig({});
    expect(config.host).toBe('0.0.0.0');
    expect(config.tcpPort).toBe(4001);
    expect(config.wsPort).toBe(4002);
    expect(config.healthPort).toBe(8080);
    expect(config.logLevel).toBe('info');
    expect(config.announceAddrs).toEqual([]);
  });

  it('parses explicit values', () => {
    const config = loadConfig({
      VEIL_HOST: '127.0.0.1',
      VEIL_TCP_PORT: '9999',
      VEIL_LOG_LEVEL: 'DEBUG',
      VEIL_ANNOUNCE_ADDRS: '/ip4/1.2.3.4/tcp/4001, /dns/relay.example/tcp/443/wss',
    });
    expect(config.host).toBe('127.0.0.1');
    expect(config.tcpPort).toBe(9999);
    expect(config.logLevel).toBe('debug');
    expect(config.announceAddrs).toHaveLength(2);
  });

  it('rejects out-of-range ports and invalid log levels', () => {
    expect(() => loadConfig({ VEIL_TCP_PORT: '70000' })).toThrow(/PORT/i);
    expect(() => loadConfig({ VEIL_LOG_LEVEL: 'trace' })).toThrow(/LOG_LEVEL/i);
  });
});
