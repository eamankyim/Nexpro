jest.mock('../../../config/database', () => ({
  sequelize: {
    transaction: jest.fn(),
    where: jest.fn((left, right) => ({ left, right })),
    json: jest.fn((path) => path),
    literal: jest.fn((sql) => sql),
  },
}));

jest.mock('../../../config/config', () => ({
  jwt: {
    secret: 'test-secret',
    expire: '1h',
  },
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'storefront.jwt'),
}));

jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('hashed-otp'),
  compare: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../../services/emailService', () => ({
  sendPlatformMessage: jest.fn().mockResolvedValue({ success: true, messageId: 'msg-1' }),
}));

jest.mock('../../../services/emailTemplates', () => ({
  emailOtpCode: jest.fn(() => ({ subject: 'OTP', html: '<p>OTP</p>', text: 'OTP' })),
}));

jest.mock('../../../models', () => ({
  Customer: {},
  OnlineProductListing: {},
  OnlineStoreSettings: {
    findAll: jest.fn(),
  },
  Product: {},
  ProductVariant: {},
  Sale: {
    findAndCountAll: jest.fn(),
    findOne: jest.fn(),
  },
  SaleActivity: {},
  SaleItem: {},
  StorefrontCustomer: {
    create: jest.fn(),
    findOne: jest.fn(),
  },
  Tenant: {},
  Shop: {},
}));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const emailService = require('../../../services/emailService');
const { sequelize } = require('../../../config/database');
const { OnlineStoreSettings, Sale, StorefrontCustomer } = require('../../../models');
const storefrontCustomerController = require('../../../controllers/storefrontCustomerController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const makeCustomer = (overrides = {}) => {
  const customer = {
    id: 'customer-1',
    name: 'Ama Shopper',
    email: 'ama@example.com',
    phone: '0240000000',
    isActive: false,
    emailVerifiedAt: null,
    metadata: {},
    comparePassword: jest.fn().mockResolvedValue(true),
    update: jest.fn(async (payload) => {
      Object.assign(customer, payload);
      return customer;
    }),
    ...overrides,
  };
  return customer;
};

describe('storefrontCustomerController shopper auth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    emailService.sendPlatformMessage.mockResolvedValue({ success: true, messageId: 'msg-1' });
    bcrypt.compare.mockResolvedValue(true);
    OnlineStoreSettings.findAll.mockResolvedValue([]);
    Sale.findAndCountAll.mockReset();
    Sale.findOne.mockReset();
  });

  it('reactivates a legacy inactive unverified shopper on register and issues a session token', async () => {
    const existing = makeCustomer({
      isActive: false,
      emailVerifiedAt: null,
      metadata: { source: 'storefront_signup' },
    });
    StorefrontCustomer.findOne.mockResolvedValue(existing);
    const req = {
      body: {
        name: 'Ama Shopper',
        email: 'ama@example.com',
        phone: '0240000000',
        password: 'strongpass',
      },
    };
    const res = mockRes();

    await storefrontCustomerController.registerStorefrontCustomer(req, res, jest.fn());

    expect(StorefrontCustomer.create).not.toHaveBeenCalled();
    expect(existing.update).toHaveBeenCalledWith(expect.objectContaining({
      name: 'Ama Shopper',
      phone: '0240000000',
      password: 'strongpass',
      isActive: true,
      emailVerifiedAt: null,
      metadata: expect.objectContaining({
        reactivatedFromLegacyPendingAt: expect.any(String),
      }),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        token: 'storefront.jwt',
        verificationRequired: true,
      }),
    }));
  });

  it('blocks register for admin-disabled inactive shoppers', async () => {
    const existing = makeCustomer({
      isActive: false,
      emailVerifiedAt: new Date(),
      metadata: { disabledByAdmin: true },
    });
    StorefrontCustomer.findOne.mockResolvedValue(existing);
    const req = {
      body: {
        name: 'Ama Shopper',
        email: 'ama@example.com',
        phone: '0240000000',
        password: 'strongpass',
      },
    };
    const res = mockRes();

    await storefrontCustomerController.registerStorefrontCustomer(req, res, jest.fn());

    expect(existing.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      errorCode: 'STOREFRONT_ACCOUNT_INACTIVE',
    }));
  });

  it('requires phone number when registering a storefront shopper', async () => {
    const req = {
      body: {
        name: 'Ama Shopper',
        email: 'ama@example.com',
        phone: '   ',
        password: 'strongpass',
      },
    };
    const res = mockRes();

    await storefrontCustomerController.registerStorefrontCustomer(req, res, jest.fn());

    expect(StorefrontCustomer.findOne).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Phone number is required.',
    }));
  });

  it('registers an active unverified shopper, sends an OTP, and issues a session token', async () => {
    const customer = makeCustomer({ isActive: true });
    StorefrontCustomer.findOne.mockResolvedValue(null);
    StorefrontCustomer.create.mockResolvedValue(customer);
    const req = {
      body: {
        name: 'Ama Shopper',
        email: 'AMA@example.com',
        phone: ' 0240000000 ',
        password: 'strongpass',
      },
    };
    const res = mockRes();

    await storefrontCustomerController.registerStorefrontCustomer(req, res, jest.fn());

    expect(StorefrontCustomer.create).toHaveBeenCalledWith(expect.objectContaining({
      email: 'ama@example.com',
      isActive: true,
      emailVerifiedAt: null,
    }));
    expect(customer.update).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        emailVerification: expect.objectContaining({
          otpHash: 'hashed-otp',
          attempts: 0,
        }),
      }),
    }));
    expect(emailService.sendPlatformMessage).toHaveBeenCalledWith(
      'ama@example.com',
      'OTP',
      '<p>OTP</p>',
      'OTP',
      [],
      expect.objectContaining({ categories: ['transactional', 'storefront-signup'] })
    );
    expect(jwt.sign).toHaveBeenCalledWith(
      { id: 'customer-1', type: 'storefront_customer' },
      'test-secret',
      { expiresIn: '1h' }
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        token: 'storefront.jwt',
        verificationRequired: true,
        verificationEmailSent: true,
        customer: expect.objectContaining({
          email: 'ama@example.com',
          isEmailVerified: false,
        }),
      }),
    }));
  });

  it('verifies an active shopper and returns a storefront customer token after OTP verification', async () => {
    const customer = makeCustomer({
      isActive: true,
      metadata: {
        emailVerification: {
          otpHash: 'hashed-otp',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          attempts: 0,
        },
      },
    });
    StorefrontCustomer.findOne.mockResolvedValue(customer);
    const req = { body: { email: 'ama@example.com', otp: '123456' } };
    const res = mockRes();

    await storefrontCustomerController.verifyStorefrontCustomerEmail(req, res, jest.fn());

    expect(bcrypt.compare).toHaveBeenCalledWith('123456', 'hashed-otp');
    expect(customer.update).toHaveBeenCalledWith(expect.objectContaining({
      emailVerifiedAt: expect.any(Date),
      lastLoginAt: expect.any(Date),
      metadata: {},
    }));
    expect(jwt.sign).toHaveBeenCalledWith(
      { id: 'customer-1', type: 'storefront_customer' },
      'test-secret',
      { expiresIn: '1h' }
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        token: 'storefront.jwt',
        customer: expect.objectContaining({ isEmailVerified: true }),
      }),
    }));
  });

  it('allows active unverified shoppers to sign in with password', async () => {
    const customer = makeCustomer({ isActive: true });
    StorefrontCustomer.findOne.mockResolvedValue(customer);
    const req = { body: { email: 'ama@example.com', password: 'strongpass' } };
    const res = mockRes();

    await storefrontCustomerController.loginStorefrontCustomer(req, res, jest.fn());

    expect(customer.comparePassword).toHaveBeenCalledWith('strongpass');
    expect(customer.update).toHaveBeenCalledWith({ lastLoginAt: expect.any(Date) });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        token: 'storefront.jwt',
        customer: expect.objectContaining({ isEmailVerified: false }),
      }),
    }));
  });

  it('reactivates legacy inactive unverified shoppers on password login', async () => {
    const customer = makeCustomer({
      isActive: false,
      emailVerifiedAt: null,
      metadata: { source: 'storefront_signup' },
    });
    StorefrontCustomer.findOne.mockResolvedValue(customer);
    const req = { body: { email: 'ama@example.com', password: 'strongpass' } };
    const res = mockRes();

    await storefrontCustomerController.loginStorefrontCustomer(req, res, jest.fn());

    expect(customer.update).toHaveBeenCalledWith(expect.objectContaining({
      isActive: true,
      metadata: expect.objectContaining({
        reactivatedFromLegacyPendingAt: expect.any(String),
      }),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('blocks inactive shoppers from password login', async () => {
    const customer = makeCustomer({
      isActive: false,
      emailVerifiedAt: new Date(),
      metadata: { disabledByAdmin: true },
    });
    StorefrontCustomer.findOne.mockResolvedValue(customer);
    const req = { body: { email: 'ama@example.com', password: 'strongpass' } };
    const res = mockRes();

    await storefrontCustomerController.loginStorefrontCustomer(req, res, jest.fn());

    expect(customer.comparePassword).toHaveBeenCalledWith('strongpass');
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      errorCode: 'STOREFRONT_ACCOUNT_INACTIVE',
    }));
  });

  it('sends a login OTP for verified shoppers and signs in after OTP verification', async () => {
    const customer = makeCustomer({
      isActive: true,
      emailVerifiedAt: new Date(),
    });
    StorefrontCustomer.findOne.mockResolvedValue(customer);

    const sendReq = { body: { email: 'ama@example.com' } };
    const sendRes = mockRes();
    await storefrontCustomerController.sendStorefrontLoginOtp(sendReq, sendRes, jest.fn());

    expect(customer.update).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        loginOtp: expect.objectContaining({
          otpHash: 'hashed-otp',
          attempts: 0,
        }),
      }),
    }));
    expect(sendRes.status).toHaveBeenCalledWith(200);

    customer.metadata = {
      loginOtp: {
        otpHash: 'hashed-otp',
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        attempts: 0,
      },
    };
    const verifyReq = { body: { email: 'ama@example.com', otp: '123456' } };
    const verifyRes = mockRes();
    await storefrontCustomerController.verifyStorefrontLoginOtp(verifyReq, verifyRes, jest.fn());

    expect(bcrypt.compare).toHaveBeenCalledWith('123456', 'hashed-otp');
    expect(verifyRes.status).toHaveBeenCalledWith(200);
    expect(verifyRes.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({ token: 'storefront.jwt' }),
    }));
  });

  it('resets a storefront shopper password with a metadata reset token', async () => {
    const customer = makeCustomer({
      isActive: true,
      emailVerifiedAt: new Date(),
      metadata: {
        passwordReset: {
          tokenHash: 'token-hash',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
        },
      },
    });
    StorefrontCustomer.findOne.mockResolvedValue(customer);
    const req = { body: { token: 'reset-token', newPassword: 'newstrongpass' } };
    const res = mockRes();

    await storefrontCustomerController.resetStorefrontPassword(req, res, jest.fn());

    expect(customer.update).toHaveBeenCalledWith(expect.objectContaining({
      password: 'newstrongpass',
      metadata: {},
    }));
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('updates only safe shopper profile fields', async () => {
    const customer = makeCustomer({
      isActive: true,
      emailVerifiedAt: new Date(),
    });
    const req = {
      storefrontCustomer: customer,
      body: {
        name: 'Ama Updated',
        phone: '0550000000',
        email: 'other@example.com',
        isActive: false,
      },
    };
    const res = mockRes();

    await storefrontCustomerController.updateStorefrontCustomerProfile(req, res, jest.fn());

    expect(customer.update).toHaveBeenCalledWith({
      name: 'Ama Updated',
      phone: '0550000000',
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        customer: expect.objectContaining({ email: 'ama@example.com' }),
      }),
    }));
  });

  it('requires phone number when updating a storefront shopper profile', async () => {
    const customer = makeCustomer({
      isActive: true,
      emailVerifiedAt: new Date(),
    });
    const req = {
      storefrontCustomer: customer,
      body: {
        name: 'Ama Updated',
        phone: '',
      },
    };
    const res = mockRes();

    await storefrontCustomerController.updateStorefrontCustomerProfile(req, res, jest.fn());

    expect(customer.update).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: false,
      message: 'Phone number is required.',
    }));
  });

  it('lists only orders owned by the authenticated storefront shopper', async () => {
    Sale.findAndCountAll.mockResolvedValue({
      count: 1,
      rows: [{
        get: () => ({
          id: 'sale-1',
          tenantId: 'tenant-1',
          saleNumber: 'SALE-1',
          status: 'pending',
          orderStatus: 'received',
          deliveryStatus: null,
          subtotal: '25.00',
          deliveryFee: '5.00',
          total: '30.00',
          amountPaid: '0.00',
          deliveryRequired: true,
          metadata: {
            source: 'online_store',
            storefrontCustomerId: 'customer-1',
            storeSlug: 'ama-shop',
          },
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
          shop: { name: 'Fallback shop' },
        }),
      }],
    });
    OnlineStoreSettings.findAll.mockResolvedValue([{
      get: () => ({
        tenantId: 'tenant-1',
        slug: 'ama-shop',
        displayName: 'Ama Shop',
        currency: 'GHS',
      }),
    }]);

    const req = {
      storefrontCustomer: makeCustomer({ id: 'customer-1', isActive: true, emailVerifiedAt: new Date() }),
      query: {},
    };
    const res = mockRes();

    await storefrontCustomerController.listStorefrontCustomerOrders(req, res, jest.fn());

    expect(Sale.findAndCountAll).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.any(Object),
      limit: 20,
      offset: 0,
      order: [['createdAt', 'DESC']],
    }));
    expect(sequelize.literal).toHaveBeenCalledWith('"Sale"."metadata"->>\'source\'');
    expect(sequelize.literal).toHaveBeenCalledWith('"Sale"."metadata"->>\'storefrontCustomerId\'');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      success: true,
      data: expect.objectContaining({
        orders: [expect.objectContaining({
          id: 'sale-1',
          storeName: 'Ama Shop',
          total: 30,
        })],
      }),
    }));
  });

  it('saves and marks the first delivery address as default', async () => {
    const customer = makeCustomer({
      id: 'customer-1',
      isActive: true,
      emailVerifiedAt: new Date(),
      metadata: {},
    });
    const req = {
      storefrontCustomer: customer,
      body: {
        label: 'Home',
        recipientName: 'Ama Shopper',
        phone: '0240000000',
        line1: '12 Market Street',
        city: 'Accra',
      },
    };
    const res = mockRes();

    await storefrontCustomerController.createStorefrontDeliveryAddress(req, res, jest.fn());

    expect(customer.update).toHaveBeenCalledWith(expect.objectContaining({
      metadata: expect.objectContaining({
        defaultDeliveryAddressId: expect.any(String),
        savedDeliveryAddresses: [expect.objectContaining({
          label: 'Home',
          isDefault: true,
        })],
      }),
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
