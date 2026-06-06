const {
  normalizePaymentNote,
  resolvePaymentNotesFromBody,
  isSystemGeneratedPaymentNote,
  getPaymentNoteFromRecord,
} = require('../../../utils/paymentNoteUtils');

describe('paymentNoteUtils', () => {
  describe('resolvePaymentNotesFromBody', () => {
    it('prefers notes over comment aliases', () => {
      expect(resolvePaymentNotesFromBody({
        notes: 'Primary note',
        comment: 'Secondary comment',
      })).toBe('Primary note');
    });

    it('accepts comment and comments aliases', () => {
      expect(resolvePaymentNotesFromBody({ comment: 'Paid at desk' })).toBe('Paid at desk');
      expect(resolvePaymentNotesFromBody({ comments: 'Bank transfer ref 123' })).toBe('Bank transfer ref 123');
    });

    it('returns empty string when no note fields are provided', () => {
      expect(resolvePaymentNotesFromBody({ amount: 50 })).toBe('');
    });
  });

  describe('isSystemGeneratedPaymentNote', () => {
    it('detects auto-generated invoice payment notes', () => {
      expect(isSystemGeneratedPaymentNote('Payment for invoice INV-001')).toBe(true);
      expect(isSystemGeneratedPaymentNote('Invoice INV-001 manually marked as paid')).toBe(true);
    });

    it('does not flag user-entered notes', () => {
      expect(isSystemGeneratedPaymentNote('Customer paid by MoMo ref 9988')).toBe(false);
    });
  });

  describe('getPaymentNoteFromRecord', () => {
    it('returns user note from notes or aliases and hides system notes', () => {
      expect(getPaymentNoteFromRecord({ notes: 'Received cash at counter' })).toBe('Received cash at counter');
      expect(getPaymentNoteFromRecord({ comment: 'Part payment from client' })).toBe('Part payment from client');
      expect(getPaymentNoteFromRecord({ notes: 'Payment for invoice INV-001' })).toBe('');
    });
  });

  describe('normalizePaymentNote', () => {
    it('trims and caps note length', () => {
      expect(normalizePaymentNote('  hello  ')).toBe('hello');
      expect(normalizePaymentNote(null)).toBe('');
    });
  });
});
