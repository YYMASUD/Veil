/**
 * Byte helpers used across Veil. Pure functions only — no crypto here.
 * Hex is lowercase; UTF-8 is used for all string ⇄ byte conversion.
 */

const HEX_DIGITS = '0123456789abcdef';

/** Encode bytes as lowercase hex. */
export function toHex(bytes: Uint8Array): string {
  let out = '';
  for (const b of bytes) {
    out += HEX_DIGITS[b >> 4];
    out += HEX_DIGITS[b & 0x0f];
  }
  return out;
}

/** Decode lowercase or uppercase hex. Throws on odd length / non-hex chars. */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error('hex string must have even length');
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const hi = Number.parseInt(hex[i * 2] as string, 16);
    const lo = Number.parseInt(hex[i * 2 + 1] as string, 16);
    if (Number.isNaN(hi) || Number.isNaN(lo)) {
      throw new Error(`invalid hex byte at ${i * 2}`);
    }
    out[i] = (hi << 4) | lo;
  }
  return out;
}

/** Concatenate byte arrays into one new array. */
export function concatBytes(...parts: Uint8Array[]): Uint8Array {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/** Constant-time-ish byte comparison for **non-secret** values only. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] as number) ^ (b[i] as number);
  return diff === 0;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: false });

/** UTF-8 encode. */
export function utf8Encode(text: string): Uint8Array {
  return encoder.encode(text);
}

/** UTF-8 decode (lossy for invalid sequences). */
export function utf8Decode(bytes: Uint8Array): string {
  return decoder.decode(bytes);
}

/** Lexicographic comparison of two strings (for canonical ordering). */
export function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Big-endian 32-bit unsigned int to bytes. */
export function u32be(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, false);
  return out;
}

/** Big-endian 64-bit unsigned int to bytes. */
export function u64be(value: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, value, false);
  return out;
}
