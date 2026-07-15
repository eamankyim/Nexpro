import { describe, it, expect } from 'vitest';
import {
  getEffectiveReceiptChannels,
  getIntegratedSendChannels,
  shouldSkipReceiptModal,
} from '../../utils/receiptChannels';

describe('receiptChannels', () => {
  const baseConfig = {
    receipt: { mode: 'ask', channels: ['sms', 'print', 'email'] },
    receiptChannelsAvailable: { sms: true, whatsapp: false, email: true },
    automationReceiptCoverage: { sms: false, email: false, whatsapp: false },
  };

  it('keeps print and uncovered channels when SMS is automation-covered', () => {
    const config = {
      ...baseConfig,
      automationReceiptCoverage: { sms: true, email: false, whatsapp: false },
    };

    expect(getEffectiveReceiptChannels(config)).toEqual(['print', 'email']);
  });

  it('hides SMS and email when both are automation-covered', () => {
    const config = {
      ...baseConfig,
      automationReceiptCoverage: { sms: true, email: true, whatsapp: false },
    };

    expect(getIntegratedSendChannels(config)).toEqual([]);
    expect(getEffectiveReceiptChannels(config)).toEqual(['print']);
  });

  it('skips ask-mode modal when every channel including print is unavailable', () => {
    const config = {
      receipt: { mode: 'ask', channels: ['sms'] },
      receiptChannelsAvailable: { sms: true, whatsapp: false, email: false },
      automationReceiptCoverage: { sms: true, email: false, whatsapp: false },
    };

    expect(shouldSkipReceiptModal(config)).toBe(true);
  });

  it('skips auto_send modal when integrated channels are automation-covered', () => {
    const config = {
      receipt: { mode: 'auto_send', channels: ['sms', 'print'] },
      receiptChannelsAvailable: { sms: true, whatsapp: false, email: false },
      automationReceiptCoverage: { sms: true, email: false, whatsapp: false },
    };

    expect(shouldSkipReceiptModal(config)).toBe(true);
  });
});
