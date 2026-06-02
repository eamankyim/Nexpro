jest.mock('../../../utils/phoneUtils', () => ({
  formatToE164: jest.fn((phone) => {
    const digits = String(phone).replace(/\D/g, '');
    if (digits.startsWith('233')) return `+${digits}`;
    if (digits.startsWith('0')) return `+233${digits.slice(1)}`;
    return phone;
  }),
}));

const {
  buildCustomerContactScopeWhere,
  assertCustomerContactUnique,
} = require('../../../utils/customerUniquenessUtils');

jest.mock('../../../models', () => ({
  Customer: {
    findOne: jest.fn(),
  },
}));

const { Customer } = require('../../../models');

describe('customerUniquenessUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('buildCustomerContactScopeWhere', () => {
    it('scopes by studioLocationId for studio tenants', () => {
      const req = {
        studioLocationScoped: true,
        studioLocationFilterId: 'studio-a',
        shopScoped: false,
      };
      expect(buildCustomerContactScopeWhere(req, 'tenant-1')).toEqual({
        tenantId: 'tenant-1',
        studioLocationId: 'studio-a',
      });
    });

    it('scopes by shopId for shop tenants', () => {
      const req = {
        studioLocationScoped: false,
        shopScoped: true,
        shopFilterId: 'shop-a',
      };
      expect(buildCustomerContactScopeWhere(req, 'tenant-1')).toEqual({
        tenantId: 'tenant-1',
        shopId: 'shop-a',
      });
    });

    it('uses tenant-wide null scope when not shop/studio scoped', () => {
      const req = { studioLocationScoped: false, shopScoped: false };
      expect(buildCustomerContactScopeWhere(req, 'tenant-1')).toEqual({
        tenantId: 'tenant-1',
        studioLocationId: null,
        shopId: null,
      });
    });
  });

  describe('assertCustomerContactUnique', () => {
    it('allows same phone in a different studio', async () => {
      Customer.findOne.mockResolvedValue(null);

      const req = {
        tenantId: 'tenant-1',
        studioLocationScoped: true,
        studioLocationFilterId: 'studio-b',
      };

      await expect(
        assertCustomerContactUnique(req, { phone: '0244123456' })
      ).resolves.toBeUndefined();

      expect(Customer.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            studioLocationId: 'studio-b',
          }),
        })
      );
    });

    it('rejects duplicate phone within the same studio', async () => {
      Customer.findOne.mockResolvedValue({ id: 'existing-id' });

      const req = {
        tenantId: 'tenant-1',
        studioLocationScoped: true,
        studioLocationFilterId: 'studio-a',
      };

      await expect(
        assertCustomerContactUnique(req, { phone: '0244123456' })
      ).rejects.toMatchObject({
        message: 'Phone number already exists',
        statusCode: 400,
      });
    });

    it('rejects duplicate email within the same shop', async () => {
      Customer.findOne.mockResolvedValue({ id: 'existing-id' });

      const req = {
        tenantId: 'tenant-1',
        shopScoped: true,
        shopFilterId: 'shop-a',
      };

      await expect(
        assertCustomerContactUnique(req, {
          email: 'Jane@Example.com',
        })
      ).rejects.toMatchObject({
        message: 'Email already exists',
        statusCode: 400,
      });

      expect(Customer.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 'tenant-1',
            shopId: 'shop-a',
            email: 'jane@example.com',
          }),
        })
      );
    });
  });
});
