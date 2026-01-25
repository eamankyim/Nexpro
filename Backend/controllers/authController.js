const jwt = require('jsonwebtoken');
const axios = require('axios');
const { User, InviteToken, UserTenant, Tenant } = require('../models');
const config = require('../config/config');
const { Op } = require('sequelize');
const dayjs = require('dayjs');

// Slug utility functions (copied from tenantController)
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

const generateUniqueSlug = async (name, transaction) => {
  const base = slugify(name);
  let candidate = base;
  let counter = 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await Tenant.findOne({
      where: { slug: candidate },
      transaction,
      attributes: ['id'],
    });

    if (!existing) {
      return candidate;
    }

    candidate = `${base}-${counter++}`;
  }
};

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, config.jwt.secret, {
    expiresIn: config.jwt.expire
  });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, inviteToken } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    // Check if invite token is required (for security, we want invites to be required)
    if (!inviteToken) {
      return res.status(400).json({
        success: false,
        message: 'Invite token is required for registration'
      });
    }

    // Validate and find invite token
    const invite = await InviteToken.findOne({
      where: { token: inviteToken },
      include: [
        {
          model: Tenant,
          as: 'tenant'
        }
      ]
    });

    if (!invite) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invite token'
      });
    }

    if (invite.used) {
      return res.status(400).json({
        success: false,
        message: 'This invite has already been used'
      });
    }

    if (invite.expiresAt && new Date() > invite.expiresAt) {
      return res.status(400).json({
        success: false,
        message: 'This invite has expired'
      });
    }

    // Verify email matches invite
    if (invite.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({
        success: false,
        message: 'Email does not match the invite'
      });
    }

    // Ensure invite has a tenantId
    if (!invite.tenantId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid invite: missing tenant information'
      });
    }

    // Create user with role from invite
    const user = await User.create({
      name,
      email,
      password,
      role: invite.role
    });

    const existingMembershipCount = await UserTenant.count({
      where: { userId: user.id }
    });

    // Create UserTenant relationship - this makes the user a member of the tenant's organization
    await UserTenant.create({
      userId: user.id,
      tenantId: invite.tenantId,
      role: invite.role,
      status: 'active',
      isDefault: existingMembershipCount === 0,
      invitedBy: invite.createdBy,
      invitedAt: invite.createdAt,
      joinedAt: new Date()
    });

    // Mark invite as used
    await invite.update({
      used: true,
      usedAt: new Date(),
      usedBy: user.id
    });

    const token = generateToken(user.id);

    const memberships = await UserTenant.findAll({
      where: { userId: user.id },
      include: [
        {
          model: Tenant,
          as: 'tenant'
        }
      ],
      order: [
        ['isDefault', 'DESC'],
        ['createdAt', 'ASC']
      ]
    });

    res.status(201).json({
      success: true,
      data: {
        user,
        token,
        memberships,
        defaultTenantId: memberships[0]?.tenantId || null
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check for user
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if password matches
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive'
      });
    }

    const token = generateToken(user.id);

    const memberships = await UserTenant.findAll({
      where: { userId: user.id, status: 'active' },
      include: [
        {
          model: Tenant,
          as: 'tenant'
        }
      ],
      order: [
        ['isDefault', 'DESC'],
        ['createdAt', 'ASC']
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        user,
        token,
        memberships,
        defaultTenantId: memberships[0]?.tenantId || null
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        {
          model: UserTenant,
          as: 'tenantMemberships',
          include: [{ model: Tenant, as: 'tenant' }]
        }
      ]
    });
    const firstMembership = user?.tenantMemberships?.[0];
    const firstTenant = firstMembership?.tenant;
    console.log('[getMe] userId=%s, memberships=%s, first tenant id=%s, first tenant.metadata.onboarding=%j', req.user.id, user?.tenantMemberships?.length, firstTenant?.id, firstTenant?.metadata?.onboarding);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user details
// @route   PUT /api/auth/updatedetails
// @access  Private
exports.updateDetails = async (req, res, next) => {
  try {
    const fieldsToUpdate = {
      name: req.body.name,
      email: req.body.email
    };

    const user = await User.findByPk(req.user.id);
    await user.update(fieldsToUpdate);

    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update password
// @route   PUT /api/auth/updatepassword
// @access  Private
exports.updatePassword = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);

    // Check current password
    if (!(await user.comparePassword(req.body.currentPassword))) {
      return res.status(401).json({
        success: false,
        message: 'Password is incorrect'
      });
    }

    user.password = req.body.newPassword;
    await user.save();

    const token = generateToken(user.id);

    res.status(200).json({
      success: true,
      data: {
        user,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify NEXPro token for Sabito SSO (called by Sabito)
// @route   GET /api/auth/verify-token
// @access  Public (but requires API key from Sabito)
// This endpoint allows Sabito to verify NEXPro JWT tokens and get user info for auto-login
exports.verifyNexproToken = async (req, res, next) => {
  try {
    // Get token from query parameter or Authorization header
    const token = req.query.token || 
                  (req.headers.authorization && req.headers.authorization.startsWith('Bearer') 
                    ? req.headers.authorization.split(' ')[1] 
                    : null);

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    // Optional: Verify API key from Sabito
    const apiKey = req.headers['x-api-key'];
    const expectedApiKey = process.env.SABITO_API_KEY;
    
    if (expectedApiKey && apiKey !== expectedApiKey) {
      return res.status(401).json({
        success: false,
        message: 'Invalid API key'
      });
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // Get user with Sabito user ID if linked
      const user = await User.findByPk(decoded.id, {
        attributes: ['id', 'email', 'name', 'sabitoUserId', 'isActive']
      });

      if (!user || !user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'User not found or inactive'
        });
      }

      // Return user info for Sabito to use for SSO
      res.status(200).json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          sabitoUserId: user.sabitoUserId || null,
          nexproUserId: user.id
        }
      });
    } catch (error) {
      if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
};

// @desc    SSO login from Sabito (Sabito → NEXPro)
// @route   POST /api/auth/sso/sabito
// @access  Public
exports.sabitoSSO = async (req, res, next) => {
  // Log immediately - this should always appear
  console.log('='.repeat(80));
  console.log('[SSO POST] 🚀🚀🚀 ENDPOINT CALLED 🚀🚀🚀');
  console.log('[SSO POST] Method:', req.method);
  console.log('[SSO POST] URL:', req.url);
  console.log('[SSO POST] Path:', req.path);
  console.log('[SSO POST] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('[SSO POST] Has Body:', !!req.body);
  console.log('[SSO POST] Body Keys:', req.body ? Object.keys(req.body) : []);
  console.log('[SSO POST] Body:', JSON.stringify(req.body, null, 2));
  console.log('='.repeat(80));
  
  try {
    const { sabitoToken } = req.body;
    console.log('[SSO POST] 📝 Received sabitoToken:', sabitoToken ? `${sabitoToken.substring(0, 20)}...` : 'MISSING');

    if (!sabitoToken) {
      return res.status(400).json({
        success: false,
        message: 'Sabito token is required'
      });
    }

    // Verify token with Sabito API
    const sabitoApiUrl = process.env.SABITO_API_URL || 'http://localhost:4002';
    const sabitoApiKey = process.env.SABITO_API_KEY;

    if (!sabitoApiKey) {
      return res.status(500).json({
        success: false,
        message: 'Sabito API key not configured'
      });
    }

    try {
      // Verify token with Sabito
      console.log('[SSO POST] 🔍 Verifying token with Sabito:', {
        sabitoApiUrl,
        token: sabitoToken ? `${sabitoToken.substring(0, 20)}...` : 'missing'
      });
      
      const verifyResponse = await axios.get(`${sabitoApiUrl}/api/auth/verify-token`, {
        headers: {
          'Authorization': `Bearer ${sabitoToken}`,
          'X-API-Key': sabitoApiKey
        },
        timeout: 10000
      });

      console.log('='.repeat(100));
      console.log('[SSO POST] 📥 RAW SABITO RESPONSE (COMPLETE)');
      console.log('='.repeat(100));
      console.log('[SSO POST] Status:', verifyResponse.status);
      console.log('[SSO POST] Status Text:', verifyResponse.statusText);
      console.log('[SSO POST] Has Data:', !!verifyResponse.data);
      console.log('[SSO POST] Data Type:', typeof verifyResponse.data);
      console.log('[SSO POST] Data Keys:', verifyResponse.data ? Object.keys(verifyResponse.data) : []);
      console.log('[SSO POST] Full Response (JSON):');
      console.log(JSON.stringify(verifyResponse.data, null, 2));
      console.log('='.repeat(100));

      const responseData = verifyResponse.data?.data || verifyResponse.data || {};
      
      console.log('[SSO POST] 🔍 Extracted responseData:', {
        hasData: !!responseData,
        dataKeys: Object.keys(responseData),
        fullResponseData: JSON.stringify(responseData, null, 2)
      });
      
      const sabitoUser = responseData.user;
      const sabitoBusiness = responseData.business; // Business object from Sabito
      const installation = responseData.installation;
      
      console.log('='.repeat(100));
      console.log('[SSO POST] 📊 PARSED SABITO DATA');
      console.log('='.repeat(100));
      console.log('[SSO POST] User Object:', {
        exists: !!sabitoUser,
        email: sabitoUser?.email,
        id: sabitoUser?.id,
        name: sabitoUser?.name,
        fullUser: JSON.stringify(sabitoUser, null, 2)
      });
      console.log('[SSO POST] Installation Object:', {
        exists: !!installation,
        id: installation?.id,
        apiKey: installation?.apiKey ? `${installation.apiKey.substring(0, 20)}...` : 'MISSING',
        fullInstallation: JSON.stringify(installation, null, 2)
      });
      console.log('[SSO POST] Business Object:', {
        exists: !!sabitoBusiness,
        type: typeof sabitoBusiness,
        isNull: sabitoBusiness === null,
        isUndefined: sabitoBusiness === undefined,
        keys: sabitoBusiness ? Object.keys(sabitoBusiness) : [],
        name: sabitoBusiness?.name,
        email: sabitoBusiness?.email,
        phone: sabitoBusiness?.phone,
        address: sabitoBusiness?.address,
        website: sabitoBusiness?.website,
        description: sabitoBusiness?.description,
        industry: sabitoBusiness?.industry,
        FULL_BUSINESS_OBJECT: JSON.stringify(sabitoBusiness, null, 2)
      });
      console.log('='.repeat(100));
      
      if (!sabitoUser || !sabitoUser.id) {
        return res.status(401).json({
          success: false,
          message: 'Invalid Sabito token'
        });
      }

      // Find or create user in NEXPro
      let user = await User.findOne({
        where: {
          [Op.or]: [
            { sabitoUserId: sabitoUser.id },
            { email: sabitoUser.email }
          ]
        }
      });

      if (user) {
        // Update existing user with Sabito ID if not set
        if (!user.sabitoUserId) {
          user.sabitoUserId = sabitoUser.id;
          await user.save();
        }

        // Update user info if changed
        if (sabitoUser.name && sabitoUser.name !== user.name) {
          user.name = sabitoUser.name;
          await user.save();
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();
      } else {
        // Create new user (SSO users need a default password - they'll set it on first login)
        // Generate a random password that won't be used (SSO users don't need password)
        const crypto = require('crypto');
        const randomPassword = crypto.randomBytes(32).toString('hex');
        
        console.log('[SSO POST] 👤 Creating new user:', {
          email: sabitoUser.email,
          name: sabitoUser.name || sabitoUser.email
        });
        
        user = await User.create({
          name: sabitoUser.name || sabitoUser.email,
          email: sabitoUser.email,
          password: randomPassword, // Will be hashed by hook
          sabitoUserId: sabitoUser.id,
          role: 'staff', // Default role
          isFirstLogin: true
        });
        
        console.log('[SSO POST] ✅ New user created:', {
          userId: user.id,
          email: user.email
        });
        
        // Create a default tenant for the new SSO user
        // Use business name from Sabito if available, otherwise use user's name
        const tenantName = sabitoBusiness?.name || `Workspace for ${sabitoUser.name || sabitoUser.email}`;
        const tenantSlug = await generateUniqueSlug(tenantName);
        
        // Set trial end date to 1 month from now
        const trialEndDate = dayjs().add(1, 'month').toDate();
        
        console.log('[SSO POST] 🏢 Creating default tenant for new user:', {
          tenantName,
          tenantSlug,
          userId: user.id,
          hasBusinessData: !!sabitoBusiness
        });
        
        const defaultTenant = await Tenant.create({
          name: tenantName,
          slug: tenantSlug,
          plan: 'trial',
          status: 'active',
          trialEndsAt: trialEndDate,
          metadata: sabitoBusiness ? {
            website: sabitoBusiness.website || null,
            email: sabitoBusiness.email || null,
            phone: sabitoBusiness.phone || null,
            description: sabitoBusiness.description || null,
            industry: sabitoBusiness.industry || null,
            signupSource: 'sabito_sso'
          } : {
            signupSource: 'sabito_sso'
          }
        });
        
        console.log('[SSO POST] ✅ Default tenant created:', {
          tenantId: defaultTenant.id,
          tenantName: defaultTenant.name
        });
        
        // Create UserTenant relationship
        await UserTenant.create({
          userId: user.id,
          tenantId: defaultTenant.id,
          role: 'owner',
          status: 'active',
          isDefault: true,
          invitedBy: null,
          invitedAt: new Date(),
          joinedAt: new Date()
        });
        
        console.log('[SSO POST] ✅ UserTenant relationship created');
      }

      if (!user.isActive) {
        return res.status(401).json({
          success: false,
          message: 'Account is inactive'
        });
      }

      // Generate NEXPro JWT token
      const token = generateToken(user.id);

      // Get user memberships
      console.log('[SSO POST] 👤 Getting memberships for user:', {
        userId: user.id,
        userEmail: user.email
      });
      
      let memberships = await UserTenant.findAll({
        where: { userId: user.id, status: 'active' },
        include: [
          {
            model: Tenant,
            as: 'tenant'
          }
        ],
        order: [
          ['isDefault', 'DESC'],
          ['createdAt', 'ASC']
        ]
      });

      console.log('[SSO POST] 📋 Memberships retrieved:', {
        membershipsCount: memberships.length,
        membershipDetails: memberships.map(m => ({
          tenantId: m.tenantId,
          tenantName: m.tenant?.name,
          isDefault: m.isDefault
        }))
      });

      // If user has no tenant membership, create one (for existing users who logged in before this fix)
      if (memberships.length === 0) {
        console.log('[SSO POST] ⚠️ User has no tenant membership, creating one...');
        
        // Use business name from Sabito if available, otherwise use user's name
        const tenantName = sabitoBusiness?.name || `Workspace for ${user.name || user.email}`;
        const tenantSlug = await generateUniqueSlug(tenantName);
        
        // Set trial end date to 1 month from now
        const trialEndDate = dayjs().add(1, 'month').toDate();
        
        console.log('[SSO POST] 🏢 Creating tenant for existing user without membership:', {
          tenantName,
          tenantSlug,
          userId: user.id,
          hasBusinessData: !!sabitoBusiness
        });
        
        const defaultTenant = await Tenant.create({
          name: tenantName,
          slug: tenantSlug,
          plan: 'trial',
          status: 'active',
          trialEndsAt: trialEndDate,
          metadata: sabitoBusiness ? {
            website: sabitoBusiness.website || null,
            email: sabitoBusiness.email || null,
            phone: sabitoBusiness.phone || null,
            description: sabitoBusiness.description || null,
            industry: sabitoBusiness.industry || null,
            signupSource: 'sabito_sso'
          } : {
            signupSource: 'sabito_sso'
          }
        });
        
        console.log('[SSO POST] ✅ Tenant created for existing user:', {
          tenantId: defaultTenant.id,
          tenantName: defaultTenant.name
        });
        
        // Create UserTenant relationship
        await UserTenant.create({
          userId: user.id,
          tenantId: defaultTenant.id,
          role: 'owner',
          status: 'active',
          isDefault: true,
          invitedBy: null,
          invitedAt: new Date(),
          joinedAt: new Date()
        });
        
        console.log('[SSO POST] ✅ UserTenant relationship created for existing user');
        
        // Re-fetch memberships
        memberships = await UserTenant.findAll({
          where: { userId: user.id, status: 'active' },
          include: [
            {
              model: Tenant,
              as: 'tenant'
            }
          ],
          order: [
            ['isDefault', 'DESC'],
            ['createdAt', 'ASC']
          ]
        });
        
        console.log('[SSO POST] 📋 Memberships after creation:', {
          membershipsCount: memberships.length,
          membershipDetails: memberships.map(m => ({
            tenantId: m.tenantId,
            tenantName: m.tenant?.name,
            isDefault: m.isDefault
          }))
        });
      }

      // Auto-populate organization settings from Sabito business object
      console.log('[SSO POST] 🔄 Checking if should auto-populate:', {
        membershipsCount: memberships.length,
        hasBusiness: !!sabitoBusiness,
        businessName: sabitoBusiness?.name,
        businessEmail: sabitoBusiness?.email,
        businessPhone: sabitoBusiness?.phone
      });
      
      if (memberships.length > 0 && sabitoBusiness) {
        const defaultTenant = memberships[0].tenant;
        const nexproTenantId = defaultTenant?.id;
        
        console.log('[SSO POST] ✅ Proceeding with auto-populate for tenant:', nexproTenantId);
        
        if (nexproTenantId) {
          try {
            const Setting = require('../models').Setting;
            
            const getSettingValue = async (tenantId, key, fallback = {}) => {
              const setting = await Setting.findOne({ where: { tenantId, key } });
              return setting ? setting.value : fallback;
            };
            
            const upsertSettingValue = async (tenantId, key, value, description = null) => {
              const [setting] = await Setting.findOrCreate({
                where: { tenantId, key },
                defaults: {
                  tenantId,
                  key,
                  value,
                  description
                }
              });
              await setting.update({ value, description });
              return setting.value;
            };
            
            const existingOrgSettings = await getSettingValue(nexproTenantId, 'organization', {});
            const isIncomplete = !existingOrgSettings?.name || 
                                !existingOrgSettings?.email || 
                                !existingOrgSettings?.phone ||
                                existingOrgSettings?.name === 'My Workspace';
            
            console.log('[SSO POST] 🔍 Processing business object for tenant:', nexproTenantId, {
              hasBusiness: !!sabitoBusiness,
              existingOrgSettings: {
                name: existingOrgSettings?.name,
                email: existingOrgSettings?.email,
                phone: existingOrgSettings?.phone,
                isIncomplete
              },
              businessObject: sabitoBusiness ? JSON.stringify(sabitoBusiness, null, 2) : 'null'
            });
            
            console.log('='.repeat(100));
            console.log('[SSO POST] 📋 EXTRACTING BUSINESS FIELDS FROM SABITO');
            console.log('='.repeat(100));
            console.log('[SSO POST] Business Object Type:', typeof sabitoBusiness);
            console.log('[SSO POST] Business Object Value:', sabitoBusiness);
            console.log('[SSO POST] Business Object Stringified:', JSON.stringify(sabitoBusiness, null, 2));
            
            const businessName = sabitoBusiness?.name;
            const businessEmail = sabitoBusiness?.email;
            const businessPhone = sabitoBusiness?.phone;
            const businessAddress = sabitoBusiness?.address;
            const businessWebsite = sabitoBusiness?.website;
            const businessDescription = sabitoBusiness?.description;
            const businessIndustry = sabitoBusiness?.industry;
            
            console.log('[SSO POST] Extracted Values:');
            console.log('  - businessName:', businessName, `(${typeof businessName})`);
            console.log('  - businessEmail:', businessEmail, `(${typeof businessEmail})`);
            console.log('  - businessPhone:', businessPhone, `(${typeof businessPhone})`);
            console.log('  - businessAddress:', businessAddress, `(${typeof businessAddress})`);
            console.log('  - businessWebsite:', businessWebsite, `(${typeof businessWebsite})`);
            console.log('  - businessDescription:', businessDescription, `(${typeof businessDescription})`);
            console.log('  - businessIndustry:', businessIndustry, `(${typeof businessIndustry})`);
            console.log('='.repeat(100));
            
            console.log('[SSO POST] 📋 Extracted business fields (summary):', {
              businessName: businessName || 'MISSING',
              businessEmail: businessEmail || 'MISSING',
              businessPhone: businessPhone || 'MISSING',
              businessAddress: businessAddress || 'MISSING',
              businessWebsite: businessWebsite || 'MISSING',
              businessDescription: businessDescription || 'MISSING',
              businessIndustry: businessIndustry || 'MISSING'
            });
            
            const hasAnyBusinessData = businessName || businessEmail || businessPhone;
            const shouldAutoPopulate = isIncomplete || (hasAnyBusinessData && !existingOrgSettings?.name);
            
            console.log('[SSO POST] 🤔 Auto-populate decision:', {
              hasAnyBusinessData,
              isIncomplete,
              existingName: existingOrgSettings?.name,
              shouldAutoPopulate
            });
            
            // Populate with whatever business data is available
            if (shouldAutoPopulate && hasAnyBusinessData) {
              let addressObj = existingOrgSettings?.address || {};
              if (businessAddress) {
                if (typeof businessAddress === 'string') {
                  addressObj = { ...addressObj, line1: businessAddress };
                } else if (typeof businessAddress === 'object') {
                  addressObj = { ...addressObj, ...businessAddress };
                }
              }
              
              const orgUpdate = {
                ...existingOrgSettings,
                name: existingOrgSettings?.name || businessName || defaultTenant.name,
                email: existingOrgSettings?.email || businessEmail || '',
                phone: existingOrgSettings?.phone || businessPhone || '',
                legalName: existingOrgSettings?.legalName || businessName || '',
                website: existingOrgSettings?.website || businessWebsite || '',
                address: addressObj,
                tax: existingOrgSettings?.tax || {}
              };
              
              console.log('[SSO POST] 💾 Saving organization settings:', {
                tenantId: nexproTenantId,
                orgUpdate: JSON.stringify(orgUpdate, null, 2),
                name: orgUpdate.name,
                email: orgUpdate.email,
                phone: orgUpdate.phone
              });
              
              const savedSettings = await upsertSettingValue(nexproTenantId, 'organization', orgUpdate);
              
              console.log('[SSO POST] ✅ Organization settings saved:', {
                tenantId: nexproTenantId,
                savedSettings: JSON.stringify(savedSettings, null, 2),
                savedName: savedSettings?.name,
                savedEmail: savedSettings?.email,
                savedPhone: savedSettings?.phone
              });
              
              // Verify the save worked by reading it back
              const verifySettings = await getSettingValue(nexproTenantId, 'organization', {});
              console.log('[SSO POST] 🔍 Verification - Read back organization settings:', {
                tenantId: nexproTenantId,
                verifiedName: verifySettings?.name,
                verifiedEmail: verifySettings?.email,
                verifiedPhone: verifySettings?.phone,
                fullVerifiedSettings: JSON.stringify(verifySettings, null, 2)
              });
              
              if (businessName && (defaultTenant.name === 'My Workspace' || !defaultTenant.name)) {
                defaultTenant.name = businessName;
                await defaultTenant.save();
                console.log('[SSO POST] ✅ Updated tenant name to:', businessName);
              }
              
              const tenantMetadata = defaultTenant.metadata || {};
              if (businessWebsite) tenantMetadata.website = businessWebsite;
              if (sabitoBusiness.description) tenantMetadata.description = sabitoBusiness.description;
              if (sabitoBusiness.industry) tenantMetadata.industry = sabitoBusiness.industry;
              if (Object.keys(tenantMetadata).length > 0) {
                defaultTenant.metadata = tenantMetadata;
                await defaultTenant.save();
                console.log('[SSO POST] ✅ Updated tenant metadata:', tenantMetadata);
              }
              
              console.log('[SSO POST] ✅ Auto-populated organization settings from Sabito business object:', {
                tenantId: nexproTenantId,
                name: orgUpdate.name,
                email: orgUpdate.email,
                phone: orgUpdate.phone
              });
            } else {
              console.log('[SSO POST] ⚠️ Skipping auto-populate:', {
                shouldAutoPopulate,
                hasAnyBusinessData,
                reason: !shouldAutoPopulate ? 'shouldAutoPopulate is false' : 'hasAnyBusinessData is false'
              });
            }
          } catch (orgError) {
            console.error('[SSO POST] ❌ Error auto-populating organization settings:', {
              message: orgError.message,
              stack: orgError.stack,
              tenantId: nexproTenantId
            });
          }
        } else {
          console.log('[SSO POST] ⚠️ No tenant ID available for auto-populate');
        }
      } else {
        console.log('[SSO POST] ⚠️ Skipping auto-populate - conditions not met:', {
          hasMemberships: memberships.length > 0,
          hasBusiness: !!sabitoBusiness
        });
      }

      // Auto-create tenant mapping if business ID is available from Sabito
      // This happens automatically when user logs in via SSO
      if (sabitoUser.businessId && memberships.length > 0) {
        const defaultTenant = memberships[0].tenant;
        const nexproTenantId = defaultTenant?.id;
        
        if (nexproTenantId) {
          // Step 1: Store tenant ID in Sabito installation settings
          try {
            // Get installation ID from Sabito
            const installationsResponse = await axios.get(`${sabitoApiUrl}/api/apps/installations`, {
              headers: {
                'Authorization': `Bearer ${sabitoToken}`,
                'X-API-Key': sabitoApiKey
              },
              timeout: 10000
            });
            
            const installations = installationsResponse.data?.data || installationsResponse.data || [];
            const installation = installations[0];
            
            if (installation && installation.id) {
              // Store tenant ID in installation settings (merge with existing settings)
              await axios.put(
                `${sabitoApiUrl}/api/apps/installations/${installation.id}/settings`,
                {
                  settings: {
                    nexproTenantId: nexproTenantId,
                    // Preserve existing settings
                    ...(installation.settings || {})
                  },
                  fromSettings: false, // Not stored in settings yet
                  fallbackToBusinessId: true // Fallback to business ID if tenant ID not found
                },
                {
                  headers: {
                    'Authorization': `Bearer ${sabitoToken}`,
                    'X-API-Key': sabitoApiKey,
                    'Content-Type': 'application/json'
                  },
                  timeout: 10000
                }
              );
              
              console.log('[SSO] ✅ Stored Nexpro tenant ID in Sabito installation:', {
                installationId: installation.id,
                nexproTenantId,
                businessId: sabitoUser.businessId
              });
            }
          } catch (settingsError) {
            // Don't fail SSO if this fails, just log it
            console.error('[SSO] Error storing tenant ID in Sabito installation:', {
              message: settingsError.message,
              response: settingsError.response?.data
            });
          }
          
          // Step 2: Auto-create tenant mapping in Nexpro database
          try {
            const { SabitoTenantMapping } = require('../models');
            
            if (defaultTenant) {
              // Check if mapping already exists
              const existingMapping = await SabitoTenantMapping.findOne({
                where: { sabitoBusinessId: sabitoUser.businessId }
              });

              if (!existingMapping) {
                // Auto-create mapping
                await SabitoTenantMapping.create({
                  sabitoBusinessId: sabitoUser.businessId,
                  nexproTenantId: defaultTenant.id,
                  businessName: sabitoUser.businessName || defaultTenant.name
                });
                console.log('[SSO] Auto-created tenant mapping for business:', sabitoUser.businessId);
              }
            }
          } catch (mappingError) {
            // Don't fail SSO if mapping creation fails, just log it
            console.error('[SSO] Error auto-creating tenant mapping:', mappingError.message);
          }
        }
      }

      res.status(200).json({
        success: true,
        data: {
          user,
          token,
          memberships,
          defaultTenantId: memberships[0]?.tenantId || null
        }
      });

    } catch (sabitoError) {
      console.error('='.repeat(100));
      console.error('[SSO POST] ❌ SABITO TOKEN VERIFICATION ERROR');
      console.error('='.repeat(100));
      console.error('[SSO POST] Error Type:', sabitoError.name);
      console.error('[SSO POST] Error Message:', sabitoError.message);
      console.error('[SSO POST] Error Status:', sabitoError.response?.status);
      console.error('[SSO POST] Error Status Text:', sabitoError.response?.statusText);
      console.error('[SSO POST] Error Response Data:', JSON.stringify(sabitoError.response?.data, null, 2));
      console.error('[SSO POST] Full Error:', sabitoError);
      console.error('='.repeat(100));
      
      // Check if token expired
      if (sabitoError.response?.status === 401 || sabitoError.response?.status === 403) {
        const errorMessage = sabitoError.response?.data?.message || sabitoError.message;
        if (errorMessage?.toLowerCase().includes('expired') || errorMessage?.toLowerCase().includes('invalid')) {
          return res.status(401).json({
            success: false,
            message: 'Sabito token has expired or is invalid. Please try logging in again from Sabito.',
            error: 'token_expired'
          });
        }
      }
      
      if (sabitoError.response?.status === 401) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired Sabito token'
        });
      }

      return res.status(500).json({
        success: false,
        message: 'Failed to verify token with Sabito'
      });
    }

  } catch (error) {
    next(error);
  }
};

// @desc    SSO login from Sabito via GET (Sabito → NEXPro)
// @route   GET /sso?token=xxx&appName=nexpro
// @access  Public
exports.sabitoSSOGet = async (req, res, next) => {
  // Log immediately - this should always appear
  console.log('='.repeat(100));
  console.log('[SSO GET] 🚀🚀🚀 GET ENDPOINT CALLED 🚀🚀🚀');
  console.log('[SSO GET] Method:', req.method);
  console.log('[SSO GET] URL:', req.url);
  console.log('[SSO GET] Path:', req.path);
  console.log('[SSO GET] Query:', JSON.stringify(req.query, null, 2));
  console.log('[SSO GET] Query Keys:', Object.keys(req.query));
  console.log('[SSO GET] Headers:', JSON.stringify(req.headers, null, 2));
  console.log('='.repeat(100));
  
  try {
    const { token, appName } = req.query;
    console.log('[SSO GET] 📝 Extracted from query:');
    console.log('  - token:', token ? `${token.substring(0, 20)}...` : 'MISSING');
    console.log('  - appName:', appName || 'MISSING');
    console.log('  - token length:', token?.length || 0);

    if (!token) {
      console.error('[SSO GET] ❌ No token provided in query string');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      console.log('[SSO GET] 🔄 Redirecting to login (missing_token)');
      return res.redirect(`${frontendUrl}/login?error=missing_token`);
    }

    // Verify token with Sabito API
    const sabitoApiUrl = process.env.SABITO_API_URL || 'http://localhost:4002';
    const sabitoApiKey = process.env.SABITO_API_KEY;

    if (!sabitoApiKey) {
      console.error('[SSO GET] ❌ Sabito API key not configured');
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      console.log('[SSO GET] 🔄 Redirecting to login (config_error)');
      return res.redirect(`${frontendUrl}/login?error=config_error`);
    }
    
    console.log('[SSO GET] ✅ Configuration check passed:', {
      sabitoApiUrl,
      hasApiKey: !!sabitoApiKey
    });

    try {
      // Verify token with Sabito using query params
      console.log('[SSO GET] 🔍 Verifying token with Sabito:', {
        sabitoApiUrl,
        token: token ? `${token.substring(0, 20)}...` : 'missing',
        appName: appName || 'nexpro'
      });
      
      const verifyResponse = await axios.get(`${sabitoApiUrl}/api/auth/verify-token`, {
        params: {
          token: token,
          appName: appName || 'nexpro'
        },
        headers: {
          'X-API-Key': sabitoApiKey
        },
        timeout: 10000
      });

      console.log('='.repeat(100));
      console.log('[SSO GET] 📥 RAW SABITO RESPONSE (COMPLETE)');
      console.log('='.repeat(100));
      console.log('[SSO GET] Status:', verifyResponse.status);
      console.log('[SSO GET] Status Text:', verifyResponse.statusText);
      console.log('[SSO GET] Has Data:', !!verifyResponse.data);
      console.log('[SSO GET] Data Type:', typeof verifyResponse.data);
      console.log('[SSO GET] Data Keys:', verifyResponse.data ? Object.keys(verifyResponse.data) : []);
      console.log('[SSO GET] Full Response (JSON):');
      console.log(JSON.stringify(verifyResponse.data, null, 2));
      console.log('='.repeat(100));

      const responseData = verifyResponse.data?.data || verifyResponse.data || {};
      
      console.log('[SSO GET] 🔍 Extracted responseData:', {
        hasData: !!responseData,
        dataKeys: Object.keys(responseData),
        fullResponseData: JSON.stringify(responseData, null, 2)
      });
      
      const sabitoUser = responseData.user;
      const installation = responseData.installation;
      const sabitoBusiness = responseData.business; // Business object from Sabito
      const apiKey = installation?.apiKey;

      console.log('='.repeat(100));
      console.log('[SSO GET] 📊 PARSED SABITO DATA');
      console.log('='.repeat(100));
      console.log('[SSO GET] User Object:', {
        exists: !!sabitoUser,
        email: sabitoUser?.email,
        id: sabitoUser?.id,
        name: sabitoUser?.name,
        fullUser: JSON.stringify(sabitoUser, null, 2)
      });
      console.log('[SSO GET] Installation Object:', {
        exists: !!installation,
        id: installation?.id,
        apiKey: installation?.apiKey ? `${installation.apiKey.substring(0, 20)}...` : 'MISSING',
        fullInstallation: JSON.stringify(installation, null, 2)
      });
      console.log('[SSO GET] Business Object:', {
        exists: !!sabitoBusiness,
        type: typeof sabitoBusiness,
        isNull: sabitoBusiness === null,
        isUndefined: sabitoBusiness === undefined,
        keys: sabitoBusiness ? Object.keys(sabitoBusiness) : [],
        name: sabitoBusiness?.name,
        email: sabitoBusiness?.email,
        phone: sabitoBusiness?.phone,
        address: sabitoBusiness?.address,
        website: sabitoBusiness?.website,
        description: sabitoBusiness?.description,
        industry: sabitoBusiness?.industry,
        FULL_BUSINESS_OBJECT: JSON.stringify(sabitoBusiness, null, 2)
      });
      console.log('='.repeat(100));

      if (!sabitoUser || !sabitoUser.id) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/login?error=invalid_token`);
      }

      // Find or create user in NEXPro
      let user = await User.findOne({
        where: {
          [Op.or]: [
            { sabitoUserId: sabitoUser.id },
            { email: sabitoUser.email }
          ]
        }
      });

      if (user) {
        // Update existing user with Sabito ID if not set
        if (!user.sabitoUserId) {
          user.sabitoUserId = sabitoUser.id;
          await user.save();
        }

        // Update user info if changed
        if (sabitoUser.name && sabitoUser.name !== user.name) {
          user.name = sabitoUser.name;
          await user.save();
        }

        // Store API key if provided (in metadata or separate field)
        if (apiKey) {
          // Store API key - you can add a sabitoApiKey field to User model or use metadata
          // For now, we'll store it in a way that can be retrieved later
          // If User model has a metadata JSON field, use that, otherwise skip
          try {
            if (user.metadata) {
              user.metadata = {
                ...(typeof user.metadata === 'object' ? user.metadata : {}),
                sabitoApiKey: apiKey,
                sabitoInstallationId: installation?.id
              };
              await user.save();
            }
          } catch (metadataError) {
            console.error('[SSO GET] Error storing API key:', metadataError.message);
            // Continue even if storing API key fails
          }
        }

        // Update last login
        user.lastLogin = new Date();
        await user.save();
      } else {
        // Create new user
        const crypto = require('crypto');
        const randomPassword = crypto.randomBytes(32).toString('hex');
        
        const userData = {
          name: sabitoUser.name || sabitoUser.email,
          email: sabitoUser.email,
          password: randomPassword,
          sabitoUserId: sabitoUser.id,
          role: 'staff',
          isFirstLogin: true
        };

        // Add metadata if User model supports it
        if (apiKey) {
          try {
            userData.metadata = {
              sabitoApiKey: apiKey,
              sabitoInstallationId: installation?.id
            };
          } catch (e) {
            // Metadata not supported, skip
          }
        }

        user = await User.create(userData);
      }

      if (!user.isActive) {
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
        return res.redirect(`${frontendUrl}/login?error=account_inactive`);
      }

      // Generate NEXPro JWT token
      const nexproToken = generateToken(user.id);

      // Get user memberships
      const memberships = await UserTenant.findAll({
        where: { userId: user.id, status: 'active' },
        include: [
          {
            model: Tenant,
            as: 'tenant'
          }
        ],
        order: [
          ['isDefault', 'DESC'],
          ['createdAt', 'ASC']
        ]
      });

      // Auto-populate organization settings from Sabito business info
      if (memberships.length > 0) {
        const defaultTenant = memberships[0].tenant;
        const nexproTenantId = defaultTenant?.id;
        
        if (nexproTenantId) {
            try {
            // Check if organization settings are incomplete
            // Import settings utility functions (they're defined in settingsController but we need them here)
            const Setting = require('../models').Setting;
            
            const getSettingValue = async (tenantId, key, fallback = {}) => {
              const setting = await Setting.findOne({ where: { tenantId, key } });
              return setting ? setting.value : fallback;
            };
            
            const upsertSettingValue = async (tenantId, key, value, description = null) => {
              const [setting] = await Setting.findOrCreate({
                where: { tenantId, key },
                defaults: {
                  tenantId,
                  key,
                  value,
                  description
                }
              });
              await setting.update({ value, description });
              return setting.value;
            };
            const existingOrgSettings = await getSettingValue(nexproTenantId, 'organization', {});
            
            const isIncomplete = !existingOrgSettings?.name || 
                                !existingOrgSettings?.email || 
                                !existingOrgSettings?.phone ||
                                existingOrgSettings?.name === 'My Workspace';
            
            // Get business info from Sabito business object (new structure)
            console.log('[SSO GET] 🔍 Processing business object for tenant:', nexproTenantId, {
              hasBusiness: !!sabitoBusiness,
              existingOrgSettings: {
                name: existingOrgSettings?.name,
                email: existingOrgSettings?.email,
                phone: existingOrgSettings?.phone,
                isIncomplete
              },
              businessObject: sabitoBusiness ? JSON.stringify(sabitoBusiness, null, 2) : 'null'
            });
            
            if (sabitoBusiness) {
            console.log('='.repeat(100));
            console.log('[SSO GET] 📋 EXTRACTING BUSINESS FIELDS FROM SABITO');
            console.log('='.repeat(100));
            console.log('[SSO GET] Business Object Type:', typeof sabitoBusiness);
            console.log('[SSO GET] Business Object Value:', sabitoBusiness);
            console.log('[SSO GET] Business Object Stringified:', JSON.stringify(sabitoBusiness, null, 2));
            
            const businessName = sabitoBusiness?.name;
            const businessEmail = sabitoBusiness?.email;
            const businessPhone = sabitoBusiness?.phone;
            const businessAddress = sabitoBusiness?.address;
            const businessWebsite = sabitoBusiness?.website;
            const businessDescription = sabitoBusiness?.description;
            const businessIndustry = sabitoBusiness?.industry;
            
            console.log('[SSO GET] Extracted Values:');
            console.log('  - businessName:', businessName, `(${typeof businessName})`);
            console.log('  - businessEmail:', businessEmail, `(${typeof businessEmail})`);
            console.log('  - businessPhone:', businessPhone, `(${typeof businessPhone})`);
            console.log('  - businessAddress:', businessAddress, `(${typeof businessAddress})`);
            console.log('  - businessWebsite:', businessWebsite, `(${typeof businessWebsite})`);
            console.log('  - businessDescription:', businessDescription, `(${typeof businessDescription})`);
            console.log('  - businessIndustry:', businessIndustry, `(${typeof businessIndustry})`);
            console.log('='.repeat(100));
            
            console.log('[SSO GET] 📋 Extracted business fields (summary):', {
              businessName: businessName || 'MISSING',
              businessEmail: businessEmail || 'MISSING',
              businessPhone: businessPhone || 'MISSING',
              businessAddress: businessAddress || 'MISSING',
              businessWebsite: businessWebsite || 'MISSING',
              businessDescription: businessDescription || 'MISSING',
              businessIndustry: businessIndustry || 'MISSING'
            });
              
              // Check if we should auto-populate (if incomplete or if business has any fields)
              const hasAnyBusinessData = businessName || businessEmail || businessPhone;
              const shouldAutoPopulate = isIncomplete || (hasAnyBusinessData && !existingOrgSettings?.name);
              
              console.log('[SSO GET] 🤔 Auto-populate decision:', {
                hasAnyBusinessData,
                isIncomplete,
                existingName: existingOrgSettings?.name,
                shouldAutoPopulate
              });
              
              // Populate with whatever business data is available
              if (shouldAutoPopulate && hasAnyBusinessData) {
                // Parse address if it's a string, otherwise use as object
                let addressObj = existingOrgSettings?.address || {};
                if (businessAddress) {
                  if (typeof businessAddress === 'string') {
                    // If address is a string, try to parse it or use as line1
                    addressObj = {
                      ...addressObj,
                      line1: businessAddress
                    };
                  } else if (typeof businessAddress === 'object') {
                    // If address is an object, merge it
                    addressObj = {
                      ...addressObj,
                      ...businessAddress
                    };
                  }
                }
                
                const orgUpdate = {
                  ...existingOrgSettings,
                  name: existingOrgSettings?.name || businessName || defaultTenant.name,
                  email: existingOrgSettings?.email || businessEmail || '',
                  phone: existingOrgSettings?.phone || businessPhone || '',
                  legalName: existingOrgSettings?.legalName || businessName || '',
                  website: existingOrgSettings?.website || businessWebsite || '',
                  address: addressObj,
                  tax: existingOrgSettings?.tax || {}
                };
                
                console.log('[SSO GET] 💾 Saving organization settings:', {
                  tenantId: nexproTenantId,
                  orgUpdate: JSON.stringify(orgUpdate, null, 2),
                  name: orgUpdate.name,
                  email: orgUpdate.email,
                  phone: orgUpdate.phone
                });
                
                const savedSettings = await upsertSettingValue(nexproTenantId, 'organization', orgUpdate);
                
                console.log('[SSO GET] ✅ Organization settings saved:', {
                  tenantId: nexproTenantId,
                  savedSettings: JSON.stringify(savedSettings, null, 2),
                  savedName: savedSettings?.name,
                  savedEmail: savedSettings?.email,
                  savedPhone: savedSettings?.phone
                });
                
                // Also update tenant name if we have business name
                if (businessName && (defaultTenant.name === 'My Workspace' || !defaultTenant.name)) {
                  defaultTenant.name = businessName;
                  await defaultTenant.save();
                }
                
                // Update tenant metadata with additional business info
                const tenantMetadata = defaultTenant.metadata || {};
                if (businessWebsite) tenantMetadata.website = businessWebsite;
                if (businessDescription) tenantMetadata.description = businessDescription;
                if (businessIndustry) tenantMetadata.industry = businessIndustry;
                if (Object.keys(tenantMetadata).length > 0) {
                  defaultTenant.metadata = tenantMetadata;
                  await defaultTenant.save();
                }
                
                console.log('[SSO GET] ✅ Auto-populated organization settings from Sabito business object:', {
                  tenantId: nexproTenantId,
                  name: orgUpdate.name,
                  email: orgUpdate.email,
                  phone: orgUpdate.phone,
                  website: orgUpdate.website,
                  hasAddress: !!businessAddress,
                  businessName,
                  businessEmail,
                  businessPhone
                });
              } else {
                console.log('[SSO GET] ⚠️ Sabito business object present but no data to populate:', {
                  hasBusinessName: !!businessName,
                  hasBusinessEmail: !!businessEmail,
                  hasBusinessPhone: !!businessPhone,
                  isIncomplete,
                  shouldAutoPopulate
                });
              }
            } else {
              // Fallback to old structure if business object doesn't exist
              const businessName = sabitoUser.businessName || installation?.businessName;
              const businessEmail = sabitoUser.businessEmail || installation?.businessEmail || sabitoUser.email;
              const businessPhone = sabitoUser.businessPhone || installation?.businessPhone;
              
              if (isIncomplete && (businessName || businessEmail || businessPhone)) {
                const orgUpdate = {
                  ...existingOrgSettings,
                  name: existingOrgSettings?.name || businessName || defaultTenant.name,
                  email: existingOrgSettings?.email || businessEmail || '',
                  phone: existingOrgSettings?.phone || businessPhone || '',
                  legalName: existingOrgSettings?.legalName || businessName || '',
                  address: existingOrgSettings?.address || {},
                  tax: existingOrgSettings?.tax || {}
                };
                
                await upsertSettingValue(nexproTenantId, 'organization', orgUpdate);
                
                if (businessName && defaultTenant.name === 'My Workspace') {
                  defaultTenant.name = businessName;
                  await defaultTenant.save();
                }
                
                console.log('[SSO GET] ✅ Auto-populated organization settings from Sabito (fallback):', {
                  tenantId: nexproTenantId,
                  name: orgUpdate.name,
                  email: orgUpdate.email,
                  phone: orgUpdate.phone
                });
              }
            }
          } catch (orgError) {
            console.error('[SSO GET] Error auto-populating organization settings:', orgError.message);
            // Don't fail SSO if this fails
          }
        }
      }

      // Auto-create tenant mapping and store tenant ID in Sabito installation settings
      if (sabitoUser.businessId && memberships.length > 0) {
        const defaultTenant = memberships[0].tenant;
        const nexproTenantId = defaultTenant?.id;
        
        if (nexproTenantId && installation?.id) {
          // Store tenant ID in Sabito installation settings
          try {
            await axios.put(
              `${sabitoApiUrl}/api/apps/installations/${installation.id}/settings`,
              {
                settings: {
                  nexproTenantId: nexproTenantId,
                  ...(installation.settings || {})
                },
                fromSettings: false,
                fallbackToBusinessId: true
              },
              {
                headers: {
                  'Authorization': `Bearer ${token}`,
                  'X-API-Key': sabitoApiKey,
                  'Content-Type': 'application/json'
                },
                timeout: 10000
              }
            );
            
            console.log('[SSO GET] ✅ Stored Nexpro tenant ID in Sabito installation:', {
              installationId: installation.id,
              nexproTenantId,
              businessId: sabitoUser.businessId
            });
          } catch (settingsError) {
            console.error('[SSO GET] Error storing tenant ID in Sabito installation:', {
              message: settingsError.message,
              response: settingsError.response?.data
            });
          }
          
          // Auto-create tenant mapping in Nexpro database
          try {
            const { SabitoTenantMapping } = require('../models');
            
            if (defaultTenant) {
              const existingMapping = await SabitoTenantMapping.findOne({
                where: { sabitoBusinessId: sabitoUser.businessId }
              });

              if (!existingMapping) {
                await SabitoTenantMapping.create({
                  sabitoBusinessId: sabitoUser.businessId,
                  nexproTenantId: defaultTenant.id,
                  businessName: sabitoUser.businessName || defaultTenant.name
                });
                console.log('[SSO GET] Auto-created tenant mapping for business:', sabitoUser.businessId);
              }
            }
          } catch (mappingError) {
            console.error('[SSO GET] Error auto-creating tenant mapping:', mappingError.message);
          }
        }
      }

      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/sso-callback?token=${nexproToken}&success=true`);

    } catch (sabitoError) {
      console.error('='.repeat(100));
      console.error('[SSO GET] ❌ SABITO TOKEN VERIFICATION ERROR');
      console.error('='.repeat(100));
      console.error('[SSO GET] Error Type:', sabitoError.name);
      console.error('[SSO GET] Error Message:', sabitoError.message);
      console.error('[SSO GET] Error Status:', sabitoError.response?.status);
      console.error('[SSO GET] Error Status Text:', sabitoError.response?.statusText);
      console.error('[SSO GET] Error Response Data:', JSON.stringify(sabitoError.response?.data, null, 2));
      console.error('[SSO GET] Full Error:', sabitoError);
      console.error('='.repeat(100));
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      
      if (sabitoError.response?.status === 401 || sabitoError.response?.status === 403) {
        console.log('[SSO GET] 🔄 Redirecting to login (invalid_token)');
        return res.redirect(`${frontendUrl}/login?error=invalid_token`);
      }

      console.log('[SSO GET] 🔄 Redirecting to login (verification_failed)');
      return res.redirect(`${frontendUrl}/login?error=verification_failed`);
    }

  } catch (error) {
    console.error('='.repeat(100));
    console.error('[SSO GET] ❌ UNEXPECTED ERROR');
    console.error('='.repeat(100));
    console.error('[SSO GET] Error Type:', error.name);
    console.error('[SSO GET] Error Message:', error.message);
    console.error('[SSO GET] Error Stack:', error.stack);
    console.error('='.repeat(100));
    
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    console.log('[SSO GET] 🔄 Redirecting to login (server_error)');
    return res.redirect(`${frontendUrl}/login?error=server_error`);
  }
};


