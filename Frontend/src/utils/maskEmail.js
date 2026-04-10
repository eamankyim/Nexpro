/**
 * Mask an email address for safe display (e.g. j•••@example.com).
 * @param {string | null | undefined} email - Raw email
 * @returns {string} Masked form, or empty string if missing/invalid
 */
export function maskEmail(email) {
  if (!email || typeof email !== 'string') return '';
  const trimmed = email.trim();
  const at = trimmed.indexOf('@');
  if (at < 1) return '•••';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (!domain) return '•••';
  const showLocal = local.length <= 1 ? '•' : `${local.slice(0, 1)}•••`;
  return `${showLocal}@${domain}`;
}
