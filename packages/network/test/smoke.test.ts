import { describe, expect, it } from 'vitest';

import { NETWORK_PACKAGE_VERSION } from '../src/index';

describe('@veil/network', () => {
  it('exposes its entrypoint (implementation lands in Phase 2)', () => {
    expect(NETWORK_PACKAGE_VERSION).toBe('0.1.0');
  });
});
