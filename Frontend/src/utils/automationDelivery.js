import { maskRecipientAddress } from './maskContact';

const MESSAGING_TYPES = new Set(['send_sms', 'send_email_platform', 'send_whatsapp']);
const CHANNEL_ORDER = ['sms', 'email', 'whatsapp'];

/**
 * Normalize action type / channel string to sms|email|whatsapp.
 * @param {object|string} actionOrChannel
 * @returns {'sms'|'email'|'whatsapp'|null}
 */
export function normalizeDeliveryChannel(actionOrChannel) {
  const raw =
    typeof actionOrChannel === 'string'
      ? actionOrChannel
      : actionOrChannel?.channel || actionOrChannel?.type || actionOrChannel?.actionType || '';
  const value = String(raw || '').toLowerCase();
  if (value === 'sms' || value === 'send_sms') return 'sms';
  if (value === 'email' || value === 'send_email_platform') return 'email';
  if (value === 'whatsapp' || value === 'send_whatsapp') return 'whatsapp';
  return null;
}

/**
 * @param {object} result
 * @returns {string}
 */
function recipientKeyFromResult(result) {
  return (
    result?.recipientUserId ||
    result?.customerId ||
    result?.recipientAddress ||
    result?.recipientName ||
    result?.email ||
    'unknown'
  );
}

/**
 * Build a single channel cell from a result (or empty).
 * @param {object|null} result
 * @param {Record<string, string>} [waStatusByMessageId]
 * @returns {object|null}
 */
function cellFromResult(result, waStatusByMessageId = {}) {
  if (!result) return null;
  const channel = normalizeDeliveryChannel(result);
  const address = result.recipientAddress || result.email || null;
  const messageId = result.messageId || null;
  const waStatus = messageId && waStatusByMessageId[messageId] ? waStatusByMessageId[messageId] : null;
  return {
    channel,
    success: result.success !== false && !result.error && !result.skipped,
    skipped: Boolean(result.skipped),
    reason: result.reason || null,
    error: result.error || null,
    sentAt: result.sentAt || null,
    address,
    maskedAddress: maskRecipientAddress(address, channel),
    messageId,
    whatsappStatus: channel === 'whatsapp' ? waStatus : null,
  };
}

/**
 * Build delivery matrix rows for a run expand panel.
 * Falls back to triggerContext when results lack recipient fields (legacy runs).
 * @param {object} run
 * @param {{ waStatusByMessageId?: Record<string, string> }} [options]
 * @returns {Array<{ key: string, recipientName: string, cells: Record<'sms'|'email'|'whatsapp', object|null> }>}
 */
export function buildDeliveryMatrix(run, options = {}) {
  const waStatusByMessageId = options.waStatusByMessageId || {};
  const triggerContext = run?.triggerContext || {};
  const results = Array.isArray(run?.resultSummary?.results) ? run.resultSummary.results : [];
  const messagingResults = results.filter((result) => MESSAGING_TYPES.has(result?.type));

  if (!messagingResults.length) {
    return [];
  }

  const hasRecipientMeta = messagingResults.some(
    (result) =>
      result?.recipientName ||
      result?.recipientAddress ||
      result?.recipientUserId ||
      result?.customerId ||
      result?.email
  );

  if (!hasRecipientMeta) {
    const fallbackName =
      triggerContext.assigneeName ||
      triggerContext.recipientName ||
      triggerContext.customerName ||
      triggerContext.companyName ||
      'Recipient';
    const cells = { sms: null, email: null, whatsapp: null };
    for (const result of messagingResults) {
      const channel = normalizeDeliveryChannel(result);
      if (!channel) continue;
      const address =
        channel === 'email'
          ? triggerContext.email || null
          : triggerContext.phone || null;
      cells[channel] = {
        channel,
        success: result.success !== false && !result.error && !result.skipped,
        skipped: Boolean(result.skipped),
        reason: result.reason || null,
        error: result.error || null,
        sentAt: result.sentAt || run.finishedAt || run.createdAt || null,
        address,
        maskedAddress: maskRecipientAddress(address, channel),
        messageId: result.messageId || null,
        whatsappStatus:
          channel === 'whatsapp' && result.messageId
            ? waStatusByMessageId[result.messageId] || null
            : null,
      };
    }
    return [
      {
        key: 'legacy-fallback',
        recipientName: fallbackName,
        cells,
      },
    ];
  }

  const byRecipient = new Map();
  for (const result of messagingResults) {
    const key = recipientKeyFromResult(result);
    if (!byRecipient.has(key)) {
      byRecipient.set(key, {
        key,
        recipientName:
          result.recipientName ||
          triggerContext.assigneeName ||
          triggerContext.customerName ||
          'Recipient',
        cells: { sms: null, email: null, whatsapp: null },
      });
    }
    const row = byRecipient.get(key);
    const channel = normalizeDeliveryChannel(result);
    if (!channel) continue;
    row.cells[channel] = cellFromResult(result, waStatusByMessageId);
  }

  return Array.from(byRecipient.values());
}

/**
 * Prefer the richest WhatsApp status for a messageId (read > delivered > sent).
 * @param {Array<object>} events
 * @returns {Record<string, string>}
 */
export function buildWhatsAppStatusByMessageId(events = []) {
  const rank = { read: 3, delivered: 2, sent: 1, failed: 0 };
  const map = {};
  for (const event of events) {
    const messageId = event?.messageId;
    if (!messageId) continue;
    const status = String(event?.status || event?.eventType || '').toLowerCase();
    if (!status) continue;
    const prev = map[messageId];
    if (!prev || (rank[status] || 0) >= (rank[prev] || 0)) {
      map[messageId] = status;
    }
  }
  return map;
}

export { CHANNEL_ORDER };
