const { User } = require('../models');

/** Categories aligned with notification `type` and activityLogger config.type */
const NOTIFICATION_PREFERENCE_CATEGORIES = [
  'job',
  'lead',
  'invoice',
  'payment',
  'order',
  'quote',
  'alert',
  'expense',
  'user'
];

const DEFAULT_CATEGORY_PREFS = { in_app: true, email: false };

/**
 * @returns {{ categories: Record<string, { in_app: boolean, email: boolean }> }}
 */
function buildDefaultPreferences() {
  const categories = {};
  for (const key of NOTIFICATION_PREFERENCE_CATEGORIES) {
    categories[key] = { ...DEFAULT_CATEGORY_PREFS };
  }
  return { categories };
}

/**
 * Merge stored JSON with defaults (unknown keys ignored).
 * @param {object|null|undefined} stored
 */
function mergeNotificationPreferences(stored) {
  const defaults = buildDefaultPreferences();
  if (!stored || typeof stored !== 'object') return defaults;
  const out = { categories: { ...defaults.categories } };
  const incoming =
    stored.categories && typeof stored.categories === 'object' ? stored.categories : {};
  for (const key of NOTIFICATION_PREFERENCE_CATEGORIES) {
    const row = incoming[key];
    if (row && typeof row === 'object') {
      out.categories[key] = {
        in_app: row.in_app !== false,
        email: row.email === true
      };
    }
  }
  return out;
}

/**
 * @param {string} type - notification.type or activity config.type
 * @returns {string|null} - null means do not apply preference gating
 */
function normalizeNotificationCategory(type) {
  if (!type || typeof type !== 'string') return null;
  return NOTIFICATION_PREFERENCE_CATEGORIES.includes(type) ? type : null;
}

/**
 * @param {{ categories: Record<string, { in_app: boolean, email: boolean }> }} mergedPrefs
 * @param {string} category - raw type from notification payload
 * @param {'in_app'|'email'} channel
 */
function isNotificationChannelEnabled(mergedPrefs, category, channel) {
  const cat = normalizeNotificationCategory(category);
  if (!cat) return true;
  const prefs = mergedPrefs || buildDefaultPreferences();
  const c = prefs.categories[cat];
  if (!c) return channel === 'in_app';
  if (channel === 'in_app') return c.in_app !== false;
  if (channel === 'email') return c.email === true;
  return true;
}

/**
 * @param {string[]} userIds
 * @returns {Promise<Map<string, ReturnType<typeof mergeNotificationPreferences>>>}
 */
async function getPreferencesForUsers(userIds) {
  const unique = [...new Set((userIds || []).filter(Boolean))];
  const map = new Map();
  if (unique.length === 0) return map;
  const users = await User.findAll({
    where: { id: unique },
    attributes: ['id', 'notificationPreferences']
  });
  const found = new Map(
    users.map((u) => [u.id, mergeNotificationPreferences(u.notificationPreferences)])
  );
  for (const id of unique) {
    map.set(id, found.get(id) || mergeNotificationPreferences(null));
  }
  return map;
}

module.exports = {
  NOTIFICATION_PREFERENCE_CATEGORIES,
  buildDefaultPreferences,
  mergeNotificationPreferences,
  normalizeNotificationCategory,
  isNotificationChannelEnabled,
  getPreferencesForUsers
};
