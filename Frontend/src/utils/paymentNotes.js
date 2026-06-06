const SYSTEM_PAYMENT_NOTE_PATTERNS = [
  /^Payment for invoice\s+/i,
  /^Invoice\s+.+\s+manually marked as paid$/i,
  /^Payment for sale\s+/i,
  /^Paystack payment for invoice\s+/i,
  /^Payment via public link for invoice\s+/i,
  /^Payment recorded for invoice\s+/i,
  /^Local seeded payment$/i,
];

/**
 * @param {unknown} value
 * @returns {string}
 */
export const normalizePaymentNote = (value) => {
  if (value == null) return '';
  return String(value).trim();
};

/**
 * @param {unknown} value
 * @returns {boolean}
 */
export const isSystemGeneratedPaymentNote = (value) => {
  const note = normalizePaymentNote(value);
  if (!note) return false;
  return SYSTEM_PAYMENT_NOTE_PATTERNS.some((pattern) => pattern.test(note));
};

/**
 * Resolve a user-entered payment note from a payment record (notes / comment / comments).
 * Hides auto-generated system messages.
 * @param {Record<string, unknown>|null|undefined} payment
 * @returns {string}
 */
export const getDisplayPaymentNote = (payment) => {
  if (!payment || typeof payment !== 'object') return '';
  const candidates = [payment.notes, payment.comment, payment.comments];
  for (const candidate of candidates) {
    const normalized = normalizePaymentNote(candidate);
    if (normalized && !isSystemGeneratedPaymentNote(normalized)) {
      return normalized;
    }
  }
  return '';
};

/**
 * Pick the first non-empty note value from form/API payload fields.
 * @param {Record<string, unknown>} payload
 * @returns {string|undefined}
 */
export const resolvePaymentNotePayload = (payload = {}) => {
  const resolved = [payload.notes, payload.comment, payload.comments]
    .map((value) => normalizePaymentNote(value))
    .find(Boolean);
  return resolved || undefined;
};
