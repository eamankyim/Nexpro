/**
 * Unit tests for custom-domain CORS allowlist helpers.
 */

jest.mock('../../../models', () => ({
  OnlineStoreSettings: { findAll: jest.fn() },
}));

const { Op } = require('sequelize');
const { OnlineStoreSettings } = require('../../../models');
const {
  hostVariants,
  originsForHost,
  refreshVerifiedDomainOrigins,
  isOriginAllowed,
} = require('../../../utils/corsUtils');

describe('corsUtils — custom domain origins', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('builds apex/www host variants', () => {
    expect(hostVariants('www.gapconnects.com')).toEqual([
      'www.gapconnects.com',
      'gapconnects.com',
    ]);
    expect(hostVariants('gapconnects.com.')).toEqual([
      'gapconnects.com',
      'www.gapconnects.com',
    ]);
  });

  it('builds http/https origins for both apex and www', () => {
    expect(originsForHost('www.gapconnects.com')).toEqual(
      expect.arrayContaining([
        'https://www.gapconnects.com',
        'http://www.gapconnects.com',
        'https://gapconnects.com',
        'http://gapconnects.com',
      ]),
    );
  });

  it('loads pending and verified domains into the CORS allowlist', async () => {
    OnlineStoreSettings.findAll.mockResolvedValueOnce([
      { customDomain: 'www.gapconnects.com' },
    ]);

    await refreshVerifiedDomainOrigins();

    expect(OnlineStoreSettings.findAll).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          customDomainStatus: { [Op.in]: ['verified', 'pending'] },
        }),
      }),
    );
    expect(isOriginAllowed('https://www.gapconnects.com')).toBe(true);
    expect(isOriginAllowed('https://gapconnects.com')).toBe(true);
  });
});
