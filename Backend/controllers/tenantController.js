const jwt = require('jsonwebtoken');
const dayjs = require('dayjs');
const { sequelize } = require('../config/database');
const config = require('../config/config');
const { Tenant, User, UserTenant, Setting } = require('../models');
const { seedDefaultCategories } = require('../utils/categorySeeder');

const generateToken = (userId) =>
  jwt.sign({ id: userId }, config.jwt.secret, {
    expiresIn: config.jwt.expire,
  });

const slugify = (value = '') => {
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
    .substring(0, 150) || `tenant-${Date.now()}`;
};

/**
 * Generate a unique slug for a new tenant.
 * Uses random suffix to avoid DB round-trip – critical for remote DB latency (~100–300ms saved).
 */
const generateUniqueSlug = (name) => {
  const base = slugify(name);
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base}-${suffix}`;
};

exports.signupTenant = async (req, res, next) => {
  const t0 = Date.now();
  const {
    companyName,
    companyEmail,
    companyPhone,
    companyWebsite,
    adminName,
    adminEmail,
    password,
    plan = 'trial',
    businessType, // NEW: business type ('printing_press', 'shop', 'pharmacy')
    shopType, // NEW: shop type (only if businessType is 'shop')
    businessInfo, // NEW: business information object
  } = req.body || {};

  try {
    if (!adminName || !adminEmail || !password) {
      return res.status(400).json({
        success: false,
        message:
          'Account owner name, email, and password are required to create a workspace.',
      });
    }

    const normalizedEmail = adminEmail.trim().toLowerCase();
    // Company name is optional - default to a placeholder if not provided
    const trimmedCompanyName = (companyName?.trim() || 'My Workspace');
    const trimmedAdminName = adminName.trim();

    const t1 = Date.now();
    const existingUser = await User.findOne({
      where: { email: normalizedEmail },
    });
    if (process.env.NODE_ENV === 'development') {
      console.log('[signup] User.findOne:', Date.now() - t1, 'ms');
    }

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message:
          'An account with this email already exists. Please sign in instead.',
      });
    }

    const transaction = await sequelize.transaction();

    try {
      const slug = generateUniqueSlug(trimmedCompanyName);

      const trialEndDate =
        plan === 'trial' ? dayjs().add(1, 'month').toDate() : null;

      // Build metadata object with business information
      const metadata = {
        website: companyWebsite || null,
        email: companyEmail || null,
        phone: companyPhone || null,
        signupSource: 'self_service',
      };

      // Add shopType to metadata if provided (only for shop business type)
      if (businessType === 'shop' && shopType) {
        metadata.shopType = shopType;
        console.log('[tenant] createTenant businessType=shop shopType=%s (stored in metadata)', shopType);
      } else if (businessType === 'shop' && !shopType) {
        console.log('[tenant] createTenant businessType=shop shopType=missing (no type-specific categories)');
      } else {
        console.log('[tenant] createTenant businessType=%s shopType=n/a', businessType || 'printing_press');
      }

      // Add businessInfo to metadata if provided
      if (businessInfo) {
        metadata.businessInfo = businessInfo;
      }

      // Default to 'printing_press' if businessType is not provided (for backward compatibility)
      const finalBusinessType = businessType || 'printing_press';

      const tenant = await Tenant.create(
        {
          name: trimmedCompanyName,
          slug,
          plan,
          businessType: finalBusinessType, // Store business type (defaults to 'printing_press')
          status: 'active',
          metadata,
          trialEndsAt: trialEndDate,
        },
        { transaction }
      );

      // Category seeding moved to after response – runs in background so signup returns quickly

      const user = await User.create(
        {
          name: trimmedAdminName,
          email: normalizedEmail,
          password,
          role: 'admin',
        },
        { transaction }
      );

      const membershipRecord = await UserTenant.create(
        {
          tenantId: tenant.id,
          userId: user.id,
          role: 'owner',
          status: 'active',
          isDefault: true,
          invitedBy: null,
          invitedAt: new Date(),
          joinedAt: new Date(),
        },
        { transaction }
      );

      await Setting.bulkCreate(
        [
          {
            tenantId: tenant.id,
            key: 'organization',
            value: {
              name: trimmedCompanyName,
              legalName: trimmedCompanyName,
              email: companyEmail || normalizedEmail,
              phone: companyPhone || '',
              website: companyWebsite || '',
              logoUrl: '',
              address: {
                line1: '',
                city: '',
                state: '',
                country: '',
                postalCode: '',
              },
              tax: {
                vatNumber: '',
                tin: '',
              },
              invoiceFooter: 'Thank you for doing business with us.',
            },
            description: 'Organization profile',
          },
          {
            tenantId: tenant.id,
            key: 'subscription',
            value: {
              plan,
              status: plan === 'trial' ? 'trialing' : 'active',
              trialEndsAt: trialEndDate,
              paymentMethod: null,
              seats: 1,
            },
            description: 'Subscription and billing information',
          },
          {
            tenantId: tenant.id,
            key: 'payroll',
            value: {
              payeRate: 0.1,
              ssnitRate: 0.135,
              currency: 'GHS',
              payCycle: 'monthly',
            },
            description: 'Default payroll configuration',
          },
        ],
        { transaction }
      );

      await transaction.commit();

      // Seed default categories in background so signup responds quickly (~2–3s faster)
      seedDefaultCategories(tenant.id, finalBusinessType, shopType || null)
        .then(() => console.log(`✅ Seeded default categories for business type: ${finalBusinessType}`))
        .catch((err) => console.error('Error seeding default categories (non-blocking):', err.message));

      const token = generateToken(user.id);

      // Build memberships from in-memory data – saves 1 remote DB round-trip (~100–300ms)
      const safeMemberships = [
        {
          ...membershipRecord.toJSON(),
          tenant: tenant.toJSON(),
        },
      ];
      const safeUser = user.toJSON();

      if (process.env.NODE_ENV === 'development') {
        console.log('[signup] total:', Date.now() - t0, 'ms');
      }
      return res.status(201).json({
        success: true,
        data: {
          user: safeUser,
          token,
          memberships: safeMemberships,
          defaultTenantId: tenant.id,
        },
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Complete onboarding
// @route   POST /api/tenants/onboarding
// @access  Private
exports.completeOnboarding = async (req, res, next) => {
  const { businessType, shopType, industry, companyName, companyEmail, companyPhone, companyWebsite, companyAddress } = req.body;
  const companyLogo = req.file;
  const tenantId = req.tenantId;

  try {
    if (!tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Tenant ID is required'
      });
    }    const tenant = await Tenant.findByPk(tenantId);
    if (!tenant) {
      return res.status(404).json({
        success: false,
        message: 'Tenant not found'
      });
    }

    const trimmedCompanyName = typeof companyName === 'string' ? companyName.trim() : '';
    if (!trimmedCompanyName) {
      return res.status(400).json({
        success: false,
        message: 'Company name is required'
      });
    }

    // Update tenant with onboarding data
    const updates = {};
    
    if (businessType) {
      updates.businessType = businessType;
    }

    updates.name = trimmedCompanyName;

    // Store onboarding data in metadata
    // Create a new metadata object to ensure Sequelize detects the change
    const metadata = { ...(tenant.metadata || {}) };
    metadata.onboarding = {
      industry,
      completedAt: new Date().toISOString()
    };
    
    // Store shop type in metadata (for shop business type)
    if (businessType === 'shop' && shopType) {
      metadata.shopType = shopType;
      console.log('[tenant] completeOnboarding tenantId=%s businessType=shop shopType=%s (stored in metadata)', tenantId, shopType);
    } else if (businessType === 'shop' && !shopType) {
      console.log('[tenant] completeOnboarding tenantId=%s businessType=shop shopType=missing', tenantId);
    } else if (businessType) {
      console.log('[tenant] completeOnboarding tenantId=%s businessType=%s shopType=n/a', tenantId, businessType);
    }

    // Store business contact information in metadata
    if (companyEmail) metadata.email = companyEmail;
    if (companyPhone) metadata.phone = companyPhone;
    if (companyWebsite) metadata.website = companyWebsite;
    if (companyAddress) metadata.address = companyAddress;
    
    // Handle logo upload (convert to base64 or save file path)
    if (companyLogo) {
      const fs = require('fs');
      const logoBuffer = companyLogo.buffer;
      const logoBase64 = logoBuffer.toString('base64');
      metadata.logo = `data:${companyLogo.mimetype};base64,${logoBase64}`;
    }
    
    // Apply updates
    if (businessType) {
      tenant.businessType = businessType;
    }
    tenant.name = trimmedCompanyName;
    
    // Directly assign metadata and save to ensure JSONB changes are persisted
    tenant.metadata = metadata;
    await tenant.save();
    
    // Reload to get the latest data
    await tenant.reload();

    // Seed default categories based on business type and shop type
    // This runs if business type is set/changed, or if shop type is provided
    const shouldSeedCategories = businessType && (
      !tenant.businessType || // First time setting business type
      tenant.businessType !== businessType || // Business type changed
      (businessType === 'shop' && shopType) // Shop type provided
    );
    
    if (shouldSeedCategories) {
      try {
        await seedDefaultCategories(tenantId, businessType, shopType || null);
        console.log(`✅ Seeded default categories for ${businessType}${shopType ? ` (${shopType})` : ''}`);
      } catch (error) {
        console.error('Failed to seed categories during onboarding:', error);
        // Don't fail onboarding if category seeding fails
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Onboarding completed successfully',
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          businessType: tenant.businessType,
          metadata: tenant.metadata
        }
      }
    });
  } catch (error) {
    next(error);
  }
};


// Update the completeOnboarding function - replace the destructuring line