const {
  marketingPlainMessageEmail,
  marketingPlainMessageDisclaimer,
} = require('../../../services/emailTemplates');

describe('marketingPlainMessageEmail audience footer', () => {
  it('uses customer disclaimer by default', () => {
    const html = marketingPlainMessageEmail('Hello', { name: 'iCreations Digital Group' });
    expect(html).toContain(
      'You are receiving this because you are a customer of iCreations Digital Group.'
    );
    expect(html).not.toContain('team member');
  });

  it('uses team-member disclaimer for internal/staff audience', () => {
    const html = marketingPlainMessageEmail(
      'Job JOB-TEST-0001 (Sample print job) was created for Eric Amankyim.',
      { name: 'iCreations Digital Group', audience: 'internal' }
    );
    expect(html).toContain(
      'You are receiving this because you are a team member of iCreations Digital Group.'
    );
    expect(html).not.toContain('you are a customer of');
  });

  it('treats staff audience the same as internal', () => {
    expect(marketingPlainMessageDisclaimer('Acme', 'staff')).toBe(
      'You are receiving this because you are a team member of Acme.'
    );
    expect(marketingPlainMessageDisclaimer('Acme', 'customer')).toBe(
      'You are receiving this because you are a customer of Acme.'
    );
  });
});
