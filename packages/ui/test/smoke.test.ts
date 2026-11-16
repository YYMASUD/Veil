import { describe, expect, it } from 'vitest';

import { UI_PACKAGE_VERSION } from '../src/index';

describe('@veil/ui', () => {
  it('exposes its entrypoint (components land from Phase 1)', () => {
    expect(UI_PACKAGE_VERSION).toBe('0.1.0');
  });
});
