import { describe, expect, it } from 'vitest';

import { STORAGE_PACKAGE_VERSION } from '../src/index';

describe('@veil/storage', () => {
  it('exposes its entrypoint (implementation lands in Phase 1)', () => {
    expect(STORAGE_PACKAGE_VERSION).toBe('0.1.0');
  });
});
