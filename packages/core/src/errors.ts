/**
 * Typed error hierarchy for Veil. Every error carries a stable machine-readable
 * `code` so callers (and tests) can branch without string-matching messages.
 * Messages must never contain plaintext message content or key material.
 */

/** Stable, public error codes. Add new codes at the end to keep numeric order. */
export type ErrorCode =
  | 'UNSUPPORTED_VERSION'
  | 'MALFORMED_ENVELOPE'
  | 'ENVELOPE_TOO_LARGE'
  | 'INVALID_PADDING'
  | 'INVALID_IDENTITY'
  | 'INVALID_TOPIC'
  | 'INVALID_CLOCK'
  | 'INVALID_MAILBOX'
  | 'DECODE_FAILED'
  | 'NOT_IMPLEMENTED';

/** Error thrown across Veil packages for all expected failure modes. */
export class VeilError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    // Maintain prototype chain when targeting ES classes down-level.
    Object.setPrototypeOf(this, VeilError.prototype);
    this.name = 'VeilError';
    this.code = code;
  }
}

/** Convenience guard: throws {@link VeilError} when `condition` is false. */
export function assertOrThrow(condition: boolean, code: ErrorCode, message: string): asserts condition {
  if (!condition) throw new VeilError(code, message);
}
