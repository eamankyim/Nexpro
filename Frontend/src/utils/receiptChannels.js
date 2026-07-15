const DEFAULT_RECEIPT_CHANNELS = ['sms', 'print'];
const DEFAULT_CHANNELS_AVAILABLE = { sms: false, whatsapp: false, email: false };
const DEFAULT_AUTOMATION_COVERAGE = { sms: false, email: false, whatsapp: false };

/**
 * Receipt channels the cashier can manually choose after a sale.
 * Print is always kept; SMS/email/WhatsApp are hidden when an automation already covers that channel.
 * @param {Object} [posConfig]
 * @returns {string[]}
 */
export function getEffectiveReceiptChannels(posConfig) {
  const coverage = posConfig?.automationReceiptCoverage || DEFAULT_AUTOMATION_COVERAGE;
  const rawChannels = posConfig?.receipt?.channels || DEFAULT_RECEIPT_CHANNELS;
  const available = posConfig?.receiptChannelsAvailable || DEFAULT_CHANNELS_AVAILABLE;

  return rawChannels.filter((channel) => {
    if (channel === 'print') return true;
    if (available[channel] !== true) return false;
    return !coverage[channel];
  });
}

/**
 * Integrated send channels (excluding print) available for manual or POS auto-send.
 * @param {Object} [posConfig]
 * @returns {string[]}
 */
export function getIntegratedSendChannels(posConfig) {
  return getEffectiveReceiptChannels(posConfig).filter((channel) => channel !== 'print');
}

/**
 * Whether the post-sale receipt dialog should be skipped entirely.
 * Auto modes still open the modal when it must run print/send side effects.
 * @param {Object} [posConfig]
 * @returns {boolean}
 */
export function shouldSkipReceiptModal(posConfig) {
  const receiptMode = posConfig?.receipt?.mode || 'ask';
  const effectiveChannels = getEffectiveReceiptChannels(posConfig);
  const integratedSend = getIntegratedSendChannels(posConfig);

  if (receiptMode === 'auto_send' && integratedSend.length === 0) {
    return true;
  }
  if (receiptMode === 'ask' && effectiveChannels.length === 0) {
    return true;
  }

  return false;
}
