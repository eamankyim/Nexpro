/** Keys must stay in sync with Backend/services/notificationPreferenceHelper.js */
export const NOTIFICATION_PREFERENCE_CATEGORY_ORDER = [
  'job',
  'lead',
  'invoice',
  'payment',
  'order',
  'quote',
  'alert',
  'expense',
  'user',
] as const;

export const NOTIFICATION_PREFERENCE_CATEGORY_LABELS: Record<string, string> = {
  job: 'Jobs',
  lead: 'Leads',
  invoice: 'Invoices',
  payment: 'Payments',
  order: 'Orders (kitchen / POS)',
  quote: 'Quotes',
  alert: 'Alerts & low stock',
  expense: 'Expenses',
  user: 'Team & invitations',
};

/** Channels that cannot be toggled off (sync with Backend/services/notificationPreferenceHelper.js). */
export const NOTIFICATION_PREFERENCE_LOCKED_CHANNELS: Record<
  string,
  Partial<Record<'in_app' | 'email', 'not_applicable' | 'always_on'>>
> = {
  user: { in_app: 'not_applicable', email: 'always_on' },
};

export type NotificationCategoryPrefs = { in_app?: boolean; email?: boolean };

export type NotificationPrefsDraft = {
  categories: Record<string, NotificationCategoryPrefs>;
};

/** Default prefs when API has none stored yet (matches backend mergeNotificationPreferences). */
export function buildDefaultNotificationPreferences(): NotificationPrefsDraft {
  const categories: Record<string, NotificationCategoryPrefs> = {};
  for (const key of NOTIFICATION_PREFERENCE_CATEGORY_ORDER) {
    categories[key] = { in_app: true, email: false };
  }
  return { categories };
}

/** Merge API payload with defaults so every category row exists. */
export function normalizeNotificationPreferences(
  stored?: { categories?: Record<string, NotificationCategoryPrefs> } | null
): NotificationPrefsDraft {
  const defaults = buildDefaultNotificationPreferences();
  if (!stored?.categories || typeof stored.categories !== 'object') {
    return defaults;
  }
  const categories = { ...defaults.categories };
  for (const key of NOTIFICATION_PREFERENCE_CATEGORY_ORDER) {
    const row = stored.categories[key];
    if (row && typeof row === 'object') {
      categories[key] = {
        in_app: row.in_app !== false,
        email: row.email === true,
      };
    }
  }
  if (categories.user) {
    categories.user.email = true;
  }
  return { categories };
}
