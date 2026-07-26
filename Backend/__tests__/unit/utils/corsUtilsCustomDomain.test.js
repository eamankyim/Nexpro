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
  isOriginAllowedAsync,
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

  it('awaits cold-cache load before rejecting an unknown custom origin', async () => {
    jest.resetModules();
    jest.doMock('../../../models', () => ({
      OnlineStoreSettings: { findAll: jest.fn() },
    }));
    // eslint-disable-next-line global-require
    const { OnlineStoreSettings: FreshSettings } = require('../../../models');
    FreshSettings.findAll.mockResolvedValueOnce([
      { customDomain: 'www.gapconnects.com' },
    ]);
    // eslint-disable-next-line global-require
    const cors = require('../../../utils/corsUtils');

    // Sync check on empty cache would false-negative; async must succeed after DB load.
    expect(cors.isOriginAllowed('https://www.gapconnects.com')).toBe(false);
    await expect(cors.isOriginAllowedAsync('https://www.gapconnects.com')).resolves.toBe(true);
    expect(FreshSettings.findAll).toHaveBeenCalled();
  });
});
