/**
 * Mask a phone number for safe display (e.g. +233***567).
 * @param {string | null | undefined} phone
 * @returns {string}
 */
export function maskPhone(phone) {
  if (!phone || typeof phone !== 'string') return '';
  const trimmed = phone.trim();
  if (!trimmed) return '';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 4) return '***';
  const last3 = digits.slice(-3);
  const hasPlus = trimmed.startsWith('+');
  if (digits.length <= 6) {
    return `${hasPlus ? '+' : ''}***${last3}`;
  }
  const prefixLen = Math.min(3, digits.length - 3);
  const prefix = digits.slice(0, prefixLen);
  return `${hasPlus ? '+' : ''}${prefix}***${last3}`;
}

/**
 * Mask an email for delivery detail UI (e.g. a***@example.com).
 * @param {string | null | undefined} email
 * @returns {string}
 */
export function maskEmailAddress(email) {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at < 1) return '***';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return '***';
  const showLocal = local.length <= 1 ? '*' : `${local.slice(0, 1)}***`;
  return `${showLocal}@${domain}`;
}

/**
 * Mask a recipient address (phone or email) for display.
 * @param {string | null | undefined} address
 * @param {'sms'|'email'|'whatsapp'|string|null} [channel]
 * @returns {string}
 */
export function maskRecipientAddress(address, channel = null) {
  if (!address || typeof address !== 'string') return '';
  const trimmed = address.trim();
  if (!trimmed) return '';
  if (channel === 'email' || trimmed.includes('@')) {
    return maskEmailAddress(trimmed);
  }
  return maskPhone(trimmed);
}
