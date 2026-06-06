const MAX_PAYMENT_NOTE_LENGTH = 1000;

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
 * Trim and cap a single payment note value.
 * @param {unknown} value
 * @returns {string}
 */
const normalizePaymentNote = (value) => {
  if (value == null) return '';
  return String(value).trim().slice(0, MAX_PAYMENT_NOTE_LENGTH);
};

/**
 * Accept notes, comment, or comments from request bodies and return the first non-empty value.
 * @param {Record<string, unknown>} body
 * @returns {string}
 */
const resolvePaymentNotesFromBody = (body = {}) => {
  const candidates = [body.notes, body.comment, body.comments];
  for (const candidate of candidates) {
    const normalized = normalizePaymentNote(candidate);
    if (normalized) return normalized;
  }
  return '';
};

/**
 * Whether a stored payment note is an auto-generated system message (not user-entered).
 * @param {unknown} value
 * @returns {boolean}
 */
const isSystemGeneratedPaymentNote = (value) => {
  const note = normalizePaymentNote(value);
  if (!note) return false;
  return SYSTEM_PAYMENT_NOTE_PATTERNS.some((pattern) => pattern.test(note));
};

/**
 * User-facing note from a payment record, checking common aliases.
 * @param {Record<string, unknown>|null|undefined} payment
 * @returns {string}
 */
const getPaymentNoteFromRecord = (payment) => {
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

module.exports = {
  MAX_PAYMENT_NOTE_LENGTH,
  normalizePaymentNote,
  resolvePaymentNotesFromBody,
  isSystemGeneratedPaymentNote,
  getPaymentNoteFromRecord,
};
