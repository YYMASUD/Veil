import { describe, expect, it } from 'vitest';

import { CRYPTO_PACKAGE_VERSION } from '../src/index';

describe('@veil/crypto', () => {
  it('exposes its entrypoint (implementation lands in Phase 1)', () => {
    expect(CRYPTO_PACKAGE_VERSION).toBe('0.1.0');
  });
});
