/**
 * Shared deterministic key material for tests. 32 bytes each, fixed values so
 * vectors and snapshots are stable across runs. Never use outside tests.
 */

import { fromHex } from '../src/bytes';

export const TEST_SIGN_SECRET_HEX = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
export const TEST_SIGN_PUBLIC_HEX = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';
export const TEST_NOISE_SECRET_HEX = 'b7f4a9bea8e1d4c2c9e0f3a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f';

export function testSignKeypair() {
  return {
    publicKey: fromHex(TEST_SIGN_PUBLIC_HEX),
    secretKey: fromHex(TEST_SIGN_SECRET_HEX),
  };
}

export function testNoiseKeypair() {
  return {
    publicKey: fromHex(TEST_NOISE_SECRET_HEX),
    secretKey: fromHex(TEST_NOISE_SECRET_HEX),
  };
}
