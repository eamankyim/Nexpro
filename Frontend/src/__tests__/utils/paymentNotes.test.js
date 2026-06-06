import { describe, it, expect } from 'vitest';
import { getDisplayPaymentNote, resolvePaymentNotePayload } from '../../utils/paymentNotes';

describe('paymentNotes utils', () => {
  it('resolves note payload from notes or comment aliases', () => {
    expect(resolvePaymentNotePayload({ notes: 'Desk payment' })).toBe('Desk payment');
    expect(resolvePaymentNotePayload({ comment: 'Desk payment' })).toBe('Desk payment');
    expect(resolvePaymentNotePayload({ comments: 'Desk payment' })).toBe('Desk payment');
    expect(resolvePaymentNotePayload({ amount: 10 })).toBeUndefined();
  });

  it('hides system-generated payment notes in the drawer', () => {
    expect(getDisplayPaymentNote({ notes: 'Payment for invoice INV-001' })).toBe('');
    expect(getDisplayPaymentNote({ notes: 'Paid with cheque #44' })).toBe('Paid with cheque #44');
    expect(getDisplayPaymentNote({ comment: 'Paid with cheque #44' })).toBe('Paid with cheque #44');
  });
});
