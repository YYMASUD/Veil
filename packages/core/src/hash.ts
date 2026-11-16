/**
 * Hashing helpers built on the WebCrypto `SubtleCrypto` API, which is
 * available in browsers, workers and Node ≥ 18 (`globalThis.crypto`).
 * No third-party dependency and no synchronous API — Veil hashing is async.
 */

/** SHA-256 over one or more byte inputs, concatenated in order. */
export async function sha256(...inputs: Uint8Array[]): Promise<Uint8Array> {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.subtle) {
    throw new Error('WebCrypto (globalThis.crypto.subtle) is unavailable');
  }
  let total = 0;
  for (const input of inputs) total += input.length;
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const input of inputs) {
    buf.set(input, offset);
    offset += input.length;
  }
  const digest = await cryptoObj.subtle.digest('SHA-256', buf);
  return new Uint8Array(digest);
}

/** SHA-256 hex string over the given inputs. */
export async function sha256Hex(...inputs: Uint8Array[]): Promise<string> {
  const bytes = await sha256(...inputs);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

/** Deterministic 16-digit decimal safety number derived from sorted inputs. */
export async function decimalDigits(inputs: Uint8Array[], groups = 4, groupSize = 4): Promise<string> {
  const digest = await sha256(...inputs);
  const digits: string[] = [];
  for (let i = 0; i < groups * groupSize; i++) {
    // Slight modulo bias is acceptable for human-verified safety numbers.
    const byte = digest[i] as number;
    digits.push(String(byte % 10));
  }
  const out: string[] = [];
  for (let g = 0; g < groups; g++) {
    out.push(digits.slice(g * groupSize, (g + 1) * groupSize).join(''));
  }
  return out.join(' ');
}
