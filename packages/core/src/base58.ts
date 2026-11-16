/**
 * Minimal, dependency-free Base58BTC (Bitcoin alphabet) codec.
 * Used to serialise multicodec-prefixed keys into `did:key` identifiers.
 * Leading zero bytes encode as leading '1' characters (Bitcoin convention).
 */

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const BASE = BigInt(ALPHABET.length);

/** Encode bytes to Base58BTC. */
export function base58btcEncode(bytes: Uint8Array): string {
  // Count leading zeros — each becomes a '1'.
  let zeros = 0;
  while (zeros < bytes.length && bytes[zeros] === 0) zeros++;

  let value = 0n;
  for (const b of bytes) value = (value << 8n) | BigInt(b);

  let out = '';
  while (value > 0n) {
    const rem = value % BASE;
    value /= BASE;
    out = ALPHABET[Number(rem)] + out;
  }
  return '1'.repeat(zeros) + out;
}

/** Decode Base58BTC back to bytes. Throws on characters outside the alphabet. */
export function base58btcDecode(text: string): Uint8Array {
  let zeros = 0;
  while (zeros < text.length && text[zeros] === '1') zeros++;

  let value = 0n;
  for (const ch of text) {
    const idx = ALPHABET.indexOf(ch);
    if (idx === -1) throw new Error(`invalid base58 character: ${JSON.stringify(ch)}`);
    value = value * BASE + BigInt(idx);
  }

  const bytes: number[] = [];
  while (value > 0n) {
    bytes.unshift(Number(value & 0xffn));
    value >>= 8n;
  }
  const out = new Uint8Array(zeros + bytes.length);
  out.set(new Uint8Array(zeros), 0);
  out.set(bytes, zeros);
  return out;
}
