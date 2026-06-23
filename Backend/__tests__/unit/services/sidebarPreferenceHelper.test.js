const {
  CONFIGURABLE_SIDEBAR_KEYS,
  LOCKED_SIDEBAR_KEYS,
  getHiddenSidebarKeys,
  getTenantDefaultHiddenSidebarKeys,
  sanitizeHiddenSidebarKeys,
  getSidebarPreferences,
} = require('../../../services/sidebarPreferenceHelper');

describe('sidebarPreferenceHelper', () => {
  describe('sanitizeHiddenSidebarKeys', () => {
    it('returns empty array for non-array input', () => {
      expect(sanitizeHiddenSidebarKeys(null)).toEqual([]);
      expect(sanitizeHiddenSidebarKeys('bad')).toEqual([]);
    });

    it('keeps only configurable keys and drops locked keys', () => {
      expect(
        sanitizeHiddenSidebarKeys([
          '/leads',
          '/dashboard',
          '/marketing',
          '/settings',
          'invalid',
          '/leads',
        ])
      ).toEqual(['/leads', '/marketing']);
    });
  });

  describe('getHiddenSidebarKeys', () => {
    it('reads hiddenSidebarKeys from metadata', () => {
      expect(
        getHiddenSidebarKeys({
          hiddenSidebarKeys: ['/tasks', '/dashboard'],
        })
      ).toEqual(['/tasks']);
    });

    it('returns empty array when metadata is missing', () => {
      expect(getHiddenSidebarKeys(null)).toEqual([]);
    });
  });

  describe('getSidebarPreferences', () => {
    it('builds API payload from membership metadata', () => {
      expect(
        getSidebarPreferences({
          metadata: { hiddenSidebarKeys: ['/vendors'] },
        })
      ).toEqual({ hiddenSidebarKeys: ['/vendors'], source: 'user' });
    });

    it('falls back to tenant defaults when user has not customized', () => {
      expect(
        getSidebarPreferences(
          { metadata: {} },
          { defaultHiddenSidebarKeys: ['/leads', '/marketing'] }
        )
      ).toEqual({ hiddenSidebarKeys: ['/leads', '/marketing'], source: 'tenant_default' });
    });
  });

  describe('getTenantDefaultHiddenSidebarKeys', () => {
    it('reads tenant default hidden sidebar keys', () => {
      expect(
        getTenantDefaultHiddenSidebarKeys({
          defaultHiddenSidebarKeys: ['/tasks', '/dashboard'],
        })
      ).toEqual(['/tasks']);
    });
  });

  it('exports locked and configurable key lists', () => {
    expect(LOCKED_SIDEBAR_KEYS).toContain('/dashboard');
    expect(CONFIGURABLE_SIDEBAR_KEYS).toContain('/leads');
    expect(CONFIGURABLE_SIDEBAR_KEYS).not.toContain('/dashboard');
  });
});
