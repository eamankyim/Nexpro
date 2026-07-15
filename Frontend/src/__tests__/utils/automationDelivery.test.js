import { maskEmailAddress, maskPhone, maskRecipientAddress } from '../../utils/maskContact';
import {
  buildDeliveryMatrix,
  buildWhatsAppStatusByMessageId,
  normalizeDeliveryChannel,
} from '../../utils/automationDelivery';

describe('maskContact', () => {
  it('masks phones as +233***567', () => {
    expect(maskPhone('+233201234567')).toBe('+233***567');
  });

  it('masks emails as a***@example.com', () => {
    expect(maskEmailAddress('ama@example.com')).toBe('a***@example.com');
  });

  it('routes maskRecipientAddress by channel or @', () => {
    expect(maskRecipientAddress('+233201234567', 'sms')).toBe('+233***567');
    expect(maskRecipientAddress('ama@example.com', 'email')).toBe('a***@example.com');
    expect(maskRecipientAddress('ama@example.com')).toBe('a***@example.com');
  });
});

describe('automationDelivery', () => {
  it('normalizes channel keys', () => {
    expect(normalizeDeliveryChannel('send_sms')).toBe('sms');
    expect(normalizeDeliveryChannel({ type: 'send_email_platform' })).toBe('email');
    expect(normalizeDeliveryChannel({ channel: 'whatsapp' })).toBe('whatsapp');
  });

  it('builds a recipient x channel matrix from enriched results', () => {
    const rows = buildDeliveryMatrix({
      resultSummary: {
        results: [
          {
            type: 'send_sms',
            channel: 'sms',
            success: true,
            recipientName: 'Ama Mensah',
            recipientAddress: '+233201234567',
            customerId: 'cust-1',
            sentAt: '2026-07-12T10:00:00.000Z',
          },
          {
            type: 'send_email_platform',
            channel: 'email',
            success: false,
            error: 'smtp_error',
            recipientName: 'Ama Mensah',
            recipientAddress: 'ama@example.com',
            customerId: 'cust-1',
            sentAt: '2026-07-12T10:00:01.000Z',
          },
        ],
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].recipientName).toBe('Ama Mensah');
    expect(rows[0].cells.sms).toMatchObject({
      success: true,
      maskedAddress: '+233***567',
    });
    expect(rows[0].cells.email).toMatchObject({
      success: false,
      maskedAddress: 'a***@example.com',
      error: 'smtp_error',
    });
    expect(rows[0].cells.whatsapp).toBeNull();
  });

  it('falls back to triggerContext for legacy runs without recipient fields', () => {
    const rows = buildDeliveryMatrix({
      triggerContext: {
        customerName: 'Legacy Customer',
        email: 'legacy@example.com',
        phone: '+233209999999',
      },
      resultSummary: {
        results: [
          { type: 'send_whatsapp', success: true, messageId: 'wa-1' },
          { type: 'send_email_platform', success: true },
        ],
      },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].recipientName).toBe('Legacy Customer');
    expect(rows[0].cells.whatsapp.maskedAddress).toBe('+233***999');
    expect(rows[0].cells.email.maskedAddress).toBe('l***@example.com');
  });

  it('marks skipped email cells without treating them as successful sends', () => {
    const rows = buildDeliveryMatrix({
      resultSummary: {
        results: [
          {
            type: 'send_email_platform',
            channel: 'email',
            success: true,
            skipped: true,
            reason: 'No recipient email',
            recipientName: 'Walk-in',
            recipientAddress: null,
            customerId: 'cust-1',
          },
        ],
      },
    });

    expect(rows[0].cells.email).toMatchObject({
      success: false,
      skipped: true,
      reason: 'No recipient email',
    });
  });
});
