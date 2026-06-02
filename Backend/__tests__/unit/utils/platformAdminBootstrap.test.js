const { isBootstrapPlatformSuperAdmin } = require('../../../utils/platformAdminBootstrap');

describe('platformAdminBootstrap', () => {
  it('recognizes bootstrap superadmin emails', () => {
    expect(isBootstrapPlatformSuperAdmin({ email: 'info@absghana.com' })).toBe(true);
    expect(isBootstrapPlatformSuperAdmin({ email: 'SuperAdmin@Nexpro.com' })).toBe(true);
  });

  it('rejects other platform admin emails', () => {
    expect(isBootstrapPlatformSuperAdmin({ email: 'ops@example.com' })).toBe(false);
    expect(isBootstrapPlatformSuperAdmin(null)).toBe(false);
  });
});
