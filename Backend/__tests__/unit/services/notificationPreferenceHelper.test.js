const {
  mergeNotificationPreferences,
  applyNotificationPreferencePatch,
  isNotificationChannelEnabled,
  LOCKED_NOTIFICATION_CHANNELS,
} = require('../../../services/notificationPreferenceHelper');

describe('notificationPreferenceHelper', () => {
  describe('mergeNotificationPreferences', () => {
    it('returns defaults when stored prefs are missing', () => {
      const merged = mergeNotificationPreferences(null);

      expect(merged.categories.job).toEqual({ in_app: true, email: false, push: true });
      expect(merged.categories.user.email).toBe(true);
    });

    it('preserves stored email:true for non-user categories', () => {
      const merged = mergeNotificationPreferences({
        categories: {
          job: { in_app: true, email: true, push: true },
          invoice: { in_app: false, email: true, push: false },
        },
      });

      expect(merged.categories.job.email).toBe(true);
      expect(merged.categories.invoice.email).toBe(true);
      expect(merged.categories.invoice.in_app).toBe(false);
    });

    it('forces user.email to true even when stored false', () => {
      const merged = mergeNotificationPreferences({
        categories: {
          user: { in_app: false, email: false, push: false },
        },
      });

      expect(merged.categories.user.email).toBe(true);
    });
  });

  describe('applyNotificationPreferencePatch', () => {
    it('persists email:true from client patch', () => {
      const saved = applyNotificationPreferencePatch(null, {
        job: { in_app: true, email: true },
        invoice: { in_app: true, email: true },
      });

      expect(saved.categories.job.email).toBe(true);
      expect(saved.categories.invoice.email).toBe(true);
    });

    it('preserves pushDevices and other top-level keys', () => {
      const saved = applyNotificationPreferencePatch(
        {
          pushDevices: [{ token: 'ExpoPushToken[abc]', tenantId: 'tenant-1' }],
          categories: {
            job: { in_app: true, email: false, push: true },
          },
        },
        {
          job: { in_app: true, email: true },
        }
      );

      expect(saved.pushDevices).toEqual([{ token: 'ExpoPushToken[abc]', tenantId: 'tenant-1' }]);
      expect(saved.categories.job.email).toBe(true);
    });

    it('locks user.email to true after patch', () => {
      const saved = applyNotificationPreferencePatch(null, {
        user: { in_app: false, email: false },
      });

      expect(saved.categories.user.email).toBe(true);
    });
  });

  describe('isNotificationChannelEnabled', () => {
    it('respects locked always_on email for user category', () => {
      const prefs = mergeNotificationPreferences({
        categories: { user: { in_app: false, email: false, push: false } },
      });

      expect(
        isNotificationChannelEnabled(prefs, 'user', 'email')
      ).toBe(true);
      expect(LOCKED_NOTIFICATION_CHANNELS.user.email).toBe('always_on');
    });

    it('returns false for email when category email is off', () => {
      const prefs = mergeNotificationPreferences({
        categories: { job: { in_app: true, email: false, push: true } },
      });

      expect(isNotificationChannelEnabled(prefs, 'job', 'email')).toBe(false);
      expect(isNotificationChannelEnabled(prefs, 'job', 'in_app')).toBe(true);
    });
  });
});
