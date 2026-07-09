const {
  resolveSmsDisplayName,
  formatCustomerSmsMessage,
} = require('../../../utils/smsMessageUtils');

describe('smsMessageUtils', () => {
  it('prefixes customer SMS with shop name', () => {
    const message = formatCustomerSmsMessage('Invoice INV-1 paid. Thank you.', 'Main Street Shop');
    expect(message).toBe('Main Street Shop: Invoice INV-1 paid. Thank you.');
  });

  it('truncates to 160 characters', () => {
    const longBody = 'A'.repeat(200);
    const message = formatCustomerSmsMessage(longBody, 'Shop');
    expect(message.length).toBe(160);
  });

  it('falls back display name when organization name is empty', () => {
    expect(resolveSmsDisplayName({ name: '' })).toBe('African Business Suite');
    expect(resolveSmsDisplayName({ name: 'Branch One' })).toBe('Branch One');
  });
});
