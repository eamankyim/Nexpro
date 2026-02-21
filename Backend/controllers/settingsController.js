const path = require('path');
const fs = require('fs');
const { Setting, User, Tenant } = require('../models');
const { baseUploadDir } = require('../middleware/upload');
const { seedDefaultCategories } = require('../utils/categorySeeder');
const { sanitizePayload } = require('../utils/tenantUtils');
const { getCustomerSourceOptions } = require('../config/customerSourceOptions');
const { getLeadSourceOptions } = require('../config/leadSourceOptions');

const getSettingValue = async (tenantId, key, fallback = {}) => {
  const setting = await Setting.findOne({ where: { tenantId, key } });
  return setting ? setting.value : fallback;
};

const upsertSettingValue = async (tenantId, key, value, description = null) => {
  const [setting, created] = await Setting.findOrCreate({
    where: { tenantId, key },
    defaults: {
      tenantId,
      key,
      value,
      description
    }
  });

  if (!created) {
    setting.value = value;
    if (description !== null) {
      setting.description = description;
    }
    await setting.save();
  }

  return setting.value;
};

const deleteFileIfExists = async (fileUrl) => {
  if (!fileUrl || !fileUrl.startsWith('/uploads/')) {
    return;
  }

  const relativePath = fileUrl.replace('/uploads/', '').split('/').join(path.sep);
  const absolutePath = path.join(baseUploadDir, relativePath);
  try {
    await fs.promises.unlink(absolutePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error('Failed to delete file:', absolutePath, error);
    }
  }
};

const buildPublicUrl = (storagePath) => `/uploads/${storagePath.replace(/\\/g, '/')}`;

// @desc    Get customer source options for current tenant (business-type specific)
// @route   GET /api/settings/customer-sources
// @access  Private
exports.getCustomerSources = async (req, res, next) => {
  try {
    const tenant = req.tenant || (req.tenantMembership && await req.tenantMembership.getTenant());
    const businessType = tenant?.businessType || 'shop';
    const metadata = tenant?.metadata || {};
    const options = getCustomerSourceOptions(businessType, metadata);
    res.status(200).json({ success: true, data: options });
  } catch (error) {
    next(error);
  }
};

// @desc    Get lead source options for current tenant (business-type specific)
// @route   GET /api/settings/lead-sources
// @access  Private
exports.getLeadSources = async (req, res, next) => {
  try {
    const tenant = req.tenant || (req.tenantMembership && await req.tenantMembership.getTenant());
    const businessType = tenant?.businessType || 'shop';
    const metadata = tenant?.metadata || {};
    const options = getLeadSourceOptions(businessType, metadata);
    res.status(200).json({ success: true, data: options });
  } catch (error) {
    next(error);
  }
};

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { name, profilePicture, password, currentPassword } = req.body;

    if (name !== undefined) {
      user.name = name;
    }

    if (profilePicture !== undefined) {
      if (!profilePicture && user.profilePicture) {
        await deleteFileIfExists(user.profilePicture);
      }
      user.profilePicture = profilePicture;
    }

    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ success: false, message: 'Current password is required to set a new password' });
      }

      const matches = await user.comparePassword(currentPassword);
      if (!matches) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }

      user.password = password;
    }

    await user.save();

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

exports.uploadProfilePicture = async (req, res, next) => {
  try {
    console.log('[Profile Picture Upload] Starting upload...');
    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (!req.file) {
      console.log('[Profile Picture Upload] ❌ No file uploaded');
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    console.log('[Profile Picture Upload] File info:', {
      mimetype: req.file.mimetype,
      size: req.file.size,
      hasBuffer: !!req.file.buffer,
      hasPath: !!req.file.path
    });

    // Convert image to base64 and store in database
    let base64Image;
    const mimeType = req.file.mimetype || 'image/png';
    
    try {
      if (req.file.buffer) {
        console.log('[Profile Picture Upload] File is in memory, converting to base64...');
        const base64String = req.file.buffer.toString('base64');
        base64Image = `data:${mimeType};base64,${base64String}`;
        console.log('[Profile Picture Upload] ✅ Base64 conversion complete. Length:', base64Image.length);
      } else if (req.file.path) {
        console.log('[Profile Picture Upload] File is on disk, reading from path:', req.file.path);
        const fs = require('fs');
        
        if (!fs.existsSync(req.file.path)) {
          console.log('[Profile Picture Upload] ❌ File path does not exist');
          return res.status(400).json({ success: false, message: 'Uploaded file not found on server' });
        }
        
        const fileBuffer = fs.readFileSync(req.file.path);
        const base64String = fileBuffer.toString('base64');
        base64Image = `data:${mimeType};base64,${base64String}`;
        console.log('[Profile Picture Upload] ✅ Base64 conversion complete. Length:', base64Image.length);
        
        // Delete the temporary file since we're storing in DB
        try {
          fs.unlinkSync(req.file.path);
          console.log('[Profile Picture Upload] ✅ Temporary file deleted');
        } catch (unlinkError) {
          console.log('[Profile Picture Upload] ⚠️  Warning: Could not delete temporary file:', unlinkError.message);
        }
      } else {
        console.log('[Profile Picture Upload] ❌ File has neither buffer nor path');
        return res.status(400).json({ success: false, message: 'Unable to process uploaded file' });
      }
    } catch (processingError) {
      console.error('[Profile Picture Upload] ❌ Error processing file:', processingError);
      return res.status(500).json({ success: false, message: 'Error processing uploaded file', error: processingError.message });
    }

    // Delete old image if it was a file path (not base64)
    if (user.profilePicture && !user.profilePicture.startsWith('data:')) {
      await deleteFileIfExists(user.profilePicture);
    }

    user.profilePicture = base64Image;
    await user.save();

    console.log('[Profile Picture Upload] ✅ Upload completed successfully');
    res.status(200).json({ success: true, data: user });
  } catch (error) {
    console.error('[Profile Picture Upload] ❌ Error:', error);
    next(error);
  }
};

exports.getOrganizationSettings = async (req, res, next) => {
  try {
    // Get organization settings from Settings model
    const organizationSettings = await getSettingValue(req.tenantId, 'organization', {});
    
    // Get tenant data (name, metadata with email, phone, website)
    const tenant = await Tenant.findByPk(req.tenantId);
    
    // Merge tenant data with organization settings
    // Priority: Settings model > Tenant model
    // Check if value exists in Settings (even if empty string) before falling back to Tenant
    const organization = {
      name: (organizationSettings.name !== undefined && organizationSettings.name !== null)
        ? organizationSettings.name
        : (tenant?.name || ''),
      legalName: organizationSettings.legalName || '',
      email: (organizationSettings.email !== undefined && organizationSettings.email !== null)
        ? organizationSettings.email
        : (tenant?.metadata?.email || ''),
      phone: (organizationSettings.phone !== undefined && organizationSettings.phone !== null)
        ? organizationSettings.phone
        : (tenant?.metadata?.phone || ''),
      website: (organizationSettings.website !== undefined && organizationSettings.website !== null)
        ? organizationSettings.website
        : (tenant?.metadata?.website || ''),
      logoUrl: organizationSettings.logoUrl || '',
      invoiceFooter: organizationSettings.invoiceFooter || '',
      defaultPaymentTerms: organizationSettings.defaultPaymentTerms || '',
      defaultTermsAndConditions: organizationSettings.defaultTermsAndConditions || '',
      supportEmail: organizationSettings.supportEmail || '',
      address: organizationSettings.address || {},
      tax: {
        vatNumber: organizationSettings.tax?.vatNumber || '',
        tin: organizationSettings.tax?.tin || ''
      },
      businessType: tenant?.businessType || 'printing_press',
      shopType: tenant?.metadata?.shopType || ''
    };

    res.status(200).json({ success: true, data: organization });
  } catch (error) {
    next(error);
  }
};

exports.updateOrganizationSettings = async (req, res, next) => {
  try {
    console.log('🔵 [Backend] updateOrganizationSettings called');
    console.log('🔵 [Backend] Tenant ID:', req.tenantId);
    console.log('🔵 [Backend] Raw request body:', JSON.stringify(req.body, null, 2));
    console.log('🔵 [Backend] Request body type:', typeof req.body);
    console.log('🔵 [Backend] Request body keys:', req.body ? Object.keys(req.body) : 'null/undefined');
    
    const existing = await getSettingValue(req.tenantId, 'organization', {});
    console.log('🔵 [Backend] Existing Settings from DB:', JSON.stringify(existing, null, 2));
    
    const incoming = sanitizePayload(req.body || {});
    console.log('🔵 [Backend] Incoming data (after sanitize):', JSON.stringify(incoming, null, 2));
    console.log('🔵 [Backend] Incoming data details:', {
      name: incoming.name,
      email: incoming.email,
      phone: incoming.phone,
      nameType: typeof incoming.name,
      nameLength: incoming.name?.length,
      emailType: typeof incoming.email,
      emailLength: incoming.email?.length,
      phoneType: typeof incoming.phone,
      phoneLength: incoming.phone?.length,
      hasName: incoming.hasOwnProperty('name'),
      hasEmail: incoming.hasOwnProperty('email'),
      hasPhone: incoming.hasOwnProperty('phone')
    });

    if (!incoming.logoUrl && existing.logoUrl && existing.logoUrl !== incoming.logoUrl) {
      await deleteFileIfExists(existing.logoUrl);
    }

    // Merge incoming data with existing to preserve fields that aren't being updated
    const mergedIncoming = {
      ...existing,
      ...incoming,
      // Ensure address and tax are properly merged
      address: {
        ...(existing.address || {}),
        ...(incoming.address || {})
      },
      tax: {
        ...(existing.tax || {}),
        ...(incoming.tax || {})
      }
    };

    console.log('🔵 [Backend] Merged incoming data (before save):', JSON.stringify(mergedIncoming, null, 2));
    console.log('🔵 [Backend] Merged incoming details:', {
      name: mergedIncoming.name,
      email: mergedIncoming.email,
      phone: mergedIncoming.phone,
      nameType: typeof mergedIncoming.name,
      nameLength: mergedIncoming.name?.length,
      emailType: typeof mergedIncoming.email,
      emailLength: mergedIncoming.email?.length,
      phoneType: typeof mergedIncoming.phone,
      phoneLength: mergedIncoming.phone?.length
    });

    // Update organization settings in Settings model
    const updated = await upsertSettingValue(req.tenantId, 'organization', mergedIncoming);
    
    console.log('🔵 [Backend] Updated Settings value (from DB):', JSON.stringify(updated, null, 2));
    console.log('🔵 [Backend] Updated Settings details:', {
      name: updated?.name,
      email: updated?.email,
      phone: updated?.phone,
      nameType: typeof updated?.name,
      nameLength: updated?.name?.length,
      emailType: typeof updated?.email,
      emailLength: updated?.email?.length,
      phoneType: typeof updated?.phone,
      phoneLength: updated?.phone?.length,
      hasName: updated?.hasOwnProperty('name'),
      hasEmail: updated?.hasOwnProperty('email'),
      hasPhone: updated?.hasOwnProperty('phone')
    });
    
    // Also update Tenant model with name, email, phone, website
    const tenant = await Tenant.findByPk(req.tenantId);
    console.log('🔵 [Backend] Tenant before update:', {
      id: tenant?.id,
      name: tenant?.name,
      metadata: tenant?.metadata
    });
    
    if (tenant) {
      // Update tenant name if provided (even if empty string, we want to save it)
      if (incoming.name !== undefined) {
        const newName = incoming.name.trim() || incoming.name;
        console.log('🔵 [Backend] Updating tenant name:', {
          oldName: tenant.name,
          newName: newName,
          incomingName: incoming.name,
          trimmed: incoming.name.trim()
        });
        tenant.name = newName;
      }
      
      // Update tenant metadata (email, phone, website)
      const metadata = tenant.metadata || {};
      if (incoming.email !== undefined) {
        console.log('🔵 [Backend] Updating tenant email:', {
          oldEmail: metadata.email,
          newEmail: incoming.email
        });
        metadata.email = incoming.email || null;
      }
      if (incoming.phone !== undefined) {
        console.log('🔵 [Backend] Updating tenant phone:', {
          oldPhone: metadata.phone,
          newPhone: incoming.phone
        });
        metadata.phone = incoming.phone || null;
      }
      if (incoming.website !== undefined) {
        metadata.website = incoming.website || null;
      }
      if (incoming.shopType !== undefined && tenant.businessType === 'shop') {
        metadata.shopType = incoming.shopType || null;
      }
      tenant.metadata = metadata;

      await tenant.save();

      if (incoming.shopType !== undefined && tenant.businessType === 'shop') {
        try {
          await seedDefaultCategories(req.tenantId, 'shop', incoming.shopType || null);
        } catch (seedError) {
          console.error('Failed to seed categories after shop type update:', seedError);
        }
      }
      console.log('🔵 [Backend] Tenant updated and saved:', {
        name: tenant.name,
        metadata: tenant.metadata
      });
      
      // Reload tenant to verify save
      await tenant.reload();
      console.log('🔵 [Backend] Tenant after reload:', {
        name: tenant.name,
        metadata: tenant.metadata
      });
    }

    // Return merged data (same structure as getOrganizationSettings)
    // Priority: Settings model > Tenant model
    // The `updated` variable is the entire organization object from Settings
    // Use Settings value if it exists AND is not empty, otherwise fall back to Tenant
    const nameFromSettings = updated && updated.hasOwnProperty('name') && updated.name !== undefined && updated.name !== null && updated.name.trim() !== '';
    const emailFromSettings = updated && updated.hasOwnProperty('email') && updated.email !== undefined && updated.email !== null && updated.email.trim() !== '';
    const phoneFromSettings = updated && updated.hasOwnProperty('phone') && updated.phone !== undefined && updated.phone !== null && updated.phone.trim() !== '';
    
    console.log('🔵 [Backend] Merge logic checks:', {
      nameFromSettings,
      emailFromSettings,
      phoneFromSettings,
      settingsName: updated?.name,
      settingsEmail: updated?.email,
      settingsPhone: updated?.phone,
      tenantName: tenant?.name,
      tenantEmail: tenant?.metadata?.email,
      tenantPhone: tenant?.metadata?.phone
    });
    
    const mergedData = {
      name: nameFromSettings
        ? updated.name
        : (tenant?.name || ''),
      legalName: (updated && updated.hasOwnProperty('legalName')) ? updated.legalName : '',
      email: emailFromSettings
        ? updated.email
        : (tenant?.metadata?.email || ''),
      phone: phoneFromSettings
        ? updated.phone
        : (tenant?.metadata?.phone || ''),
      website: (updated && updated.hasOwnProperty('website') && updated.website !== undefined && updated.website !== null && updated.website.trim() !== '')
        ? updated.website
        : (tenant?.metadata?.website || ''),
      logoUrl: (updated && updated.hasOwnProperty('logoUrl')) ? updated.logoUrl : '',
      invoiceFooter: (updated && updated.hasOwnProperty('invoiceFooter')) ? updated.invoiceFooter : '',
      defaultPaymentTerms: (updated && updated.hasOwnProperty('defaultPaymentTerms')) ? updated.defaultPaymentTerms : '',
      defaultTermsAndConditions: (updated && updated.hasOwnProperty('defaultTermsAndConditions')) ? updated.defaultTermsAndConditions : '',
      supportEmail: (updated && updated.hasOwnProperty('supportEmail')) ? updated.supportEmail : '',
      address: (updated && updated.address) ? updated.address : {},
      tax: {
        vatNumber: (updated && updated.tax?.vatNumber) ? updated.tax.vatNumber : '',
        tin: (updated && updated.tax?.tin) ? updated.tax.tin : ''
      },
      businessType: tenant?.businessType || 'printing_press',
      shopType: tenant?.metadata?.shopType || ''
    };
    
    console.log('🔵 [Backend] Final merged data:', JSON.stringify(mergedData, null, 2));
    console.log('🔵 [Backend] Final merged data details:', {
      name: mergedData.name,
      email: mergedData.email,
      phone: mergedData.phone,
      nameType: typeof mergedData.name,
      nameLength: mergedData.name?.length,
      emailType: typeof mergedData.email,
      emailLength: mergedData.email?.length,
      phoneType: typeof mergedData.phone,
      phoneLength: mergedData.phone?.length
    });
    
    res.status(200).json({ success: true, data: mergedData });
  } catch (error) {
    next(error);
  }
};

exports.uploadOrganizationLogo = async (req, res, next) => {
  try {
    console.log('[Organization Logo Upload] Starting upload...');
    const organization = await getSettingValue(req.tenantId, 'organization', {});
    
    if (!req.file) {
      console.log('[Organization Logo Upload] ❌ No file uploaded');
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    console.log('[Organization Logo Upload] File info:', {
      mimetype: req.file.mimetype,
      size: req.file.size,
      hasBuffer: !!req.file.buffer,
      hasPath: !!req.file.path
    });

    // Convert image to base64 and store in database
    let base64Image;
    const mimeType = req.file.mimetype || 'image/png';
    
    try {
      if (req.file.buffer) {
        console.log('[Organization Logo Upload] File is in memory, converting to base64...');
        const base64String = req.file.buffer.toString('base64');
        base64Image = `data:${mimeType};base64,${base64String}`;
        console.log('[Organization Logo Upload] ✅ Base64 conversion complete. Length:', base64Image.length);
      } else if (req.file.path) {
        console.log('[Organization Logo Upload] File is on disk, reading from path:', req.file.path);
        const fs = require('fs');
        
        if (!fs.existsSync(req.file.path)) {
          console.log('[Organization Logo Upload] ❌ File path does not exist');
          return res.status(400).json({ success: false, message: 'Uploaded file not found on server' });
        }
        
        const fileBuffer = fs.readFileSync(req.file.path);
        const base64String = fileBuffer.toString('base64');
        base64Image = `data:${mimeType};base64,${base64String}`;
        console.log('[Organization Logo Upload] ✅ Base64 conversion complete. Length:', base64Image.length);
        
        // Delete the temporary file since we're storing in DB
        try {
          fs.unlinkSync(req.file.path);
          console.log('[Organization Logo Upload] ✅ Temporary file deleted');
        } catch (unlinkError) {
          console.log('[Organization Logo Upload] ⚠️  Warning: Could not delete temporary file:', unlinkError.message);
        }
      } else {
        console.log('[Organization Logo Upload] ❌ File has neither buffer nor path');
        return res.status(400).json({ success: false, message: 'Unable to process uploaded file' });
      }
    } catch (processingError) {
      console.error('[Organization Logo Upload] ❌ Error processing file:', processingError);
      return res.status(500).json({ success: false, message: 'Error processing uploaded file', error: processingError.message });
    }

    // Delete old logo if it was a file path (not base64)
    if (organization.logoUrl && !organization.logoUrl.startsWith('data:')) {
      await deleteFileIfExists(organization.logoUrl);
    }

    organization.logoUrl = base64Image;
    const updated = await upsertSettingValue(req.tenantId, 'organization', organization);

    console.log('[Organization Logo Upload] ✅ Upload completed successfully');
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    console.error('[Organization Logo Upload] ❌ Error:', error);
    next(error);
  }
};

exports.getSubscriptionSettings = async (req, res, next) => {
  try {
    const subscription = await getSettingValue(req.tenantId, 'subscription', {
      plan: 'free',
      seats: 5,
      status: 'active',
      currentPeriodEnd: null,
      paymentMethod: null,
      history: []
    });
    res.status(200).json({ success: true, data: subscription });
  } catch (error) {
    next(error);
  }
};

exports.updateSubscriptionSettings = async (req, res, next) => {
  try {
    const updated = await upsertSettingValue(
      req.tenantId,
      'subscription',
      sanitizePayload(req.body || {})
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

exports.getPayrollSettings = async (req, res, next) => {
  try {
    const payroll = await getSettingValue(req.tenantId, 'payroll', {
      incomeTaxRate: 0.15,
      ssnitEmployeeRate: 0.055,
      ssnitEmployerRate: 0.13,
      bonusTaxRate: 0.05,
      overtimeRate: 1.5
    });
    res.status(200).json({ success: true, data: payroll });
  } catch (error) {
    next(error);
  }
};

exports.updatePayrollSettings = async (req, res, next) => {
  try {
    const updated = await upsertSettingValue(
      req.tenantId,
      'payroll',
      sanitizePayload(req.body || {})
    );
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// @desc    Get WhatsApp settings
// @route   GET /api/settings/whatsapp
// @access  Private
exports.getWhatsAppSettings = async (req, res, next) => {
  try {
    const whatsappSettings = await getSettingValue(req.tenantId, 'whatsapp', {
      enabled: false,
      phoneNumberId: '',
      accessToken: '',
      businessAccountId: '',
      webhookVerifyToken: '',
      templateNamespace: ''
    });

    // Don't expose access token in response
    const safeSettings = {
      ...whatsappSettings,
      accessToken: whatsappSettings.accessToken ? '***' : ''
    };

    res.status(200).json({
      success: true,
      data: safeSettings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update WhatsApp settings
// @route   PUT /api/settings/whatsapp
// @access  Private
exports.updateWhatsAppSettings = async (req, res, next) => {
  try {
    const {
      enabled,
      phoneNumberId,
      accessToken,
      businessAccountId,
      webhookVerifyToken,
      templateNamespace
    } = sanitizePayload(req.body);

    // Get existing settings to preserve access token if not provided
    const existing = await getSettingValue(req.tenantId, 'whatsapp', {});

    // Validate required fields if enabling
    if (enabled) {
      const finalAccessToken = accessToken || existing.accessToken;
      const finalPhoneNumberId = phoneNumberId || existing.phoneNumberId;

      if (!finalPhoneNumberId || !finalAccessToken) {
        return res.status(400).json({
          success: false,
          message: 'Phone Number ID and Access Token are required when enabling WhatsApp'
        });
      }

      // Test connection
      const whatsappService = require('../services/whatsappService');
      const testResult = await whatsappService.testConnection(finalAccessToken, finalPhoneNumberId);
      
      if (!testResult.success) {
        return res.status(400).json({
          success: false,
          message: 'Failed to connect to WhatsApp API',
          error: testResult.error
        });
      }
    }

    const whatsappData = {
      enabled: enabled !== undefined ? enabled : existing.enabled || false,
      phoneNumberId: phoneNumberId || existing.phoneNumberId || '',
      accessToken: accessToken || existing.accessToken || '', // In production, encrypt this
      businessAccountId: businessAccountId || existing.businessAccountId || '',
      webhookVerifyToken: webhookVerifyToken || existing.webhookVerifyToken || '',
      templateNamespace: templateNamespace || existing.templateNamespace || ''
    };

    const updated = await upsertSettingValue(
      req.tenantId,
      'whatsapp',
      whatsappData,
      'WhatsApp Business API configuration'
    );

    // Don't expose access token in response
    const safeSettings = {
      ...updated,
      accessToken: updated.accessToken ? '***' : ''
    };

    res.status(200).json({
      success: true,
      message: 'WhatsApp settings updated successfully',
      data: safeSettings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Test WhatsApp connection
// @route   POST /api/settings/whatsapp/test
// @access  Private
exports.testWhatsAppConnection = async (req, res, next) => {
  try {
    const { accessToken, phoneNumberId } = sanitizePayload(req.body);

    if (!accessToken || !phoneNumberId) {
      return res.status(400).json({
        success: false,
        message: 'Access Token and Phone Number ID are required'
      });
    }

    const whatsappService = require('../services/whatsappService');
    const result = await whatsappService.testConnection(accessToken, phoneNumberId);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Connection successful',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Connection failed',
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get SMS settings
// @route   GET /api/settings/sms
// @access  Private
exports.getSMSSettings = async (req, res, next) => {
  try {
    const smsSettings = await getSettingValue(req.tenantId, 'sms', {
      enabled: false,
      provider: 'twilio',
      accountSid: '',
      authToken: '',
      fromNumber: '',
      apiKey: '',
      username: ''
    });

    // Don't expose sensitive tokens in response
    const safeSettings = {
      ...smsSettings,
      authToken: smsSettings.authToken ? '***' : '',
      apiKey: smsSettings.apiKey ? '***' : ''
    };

    res.status(200).json({
      success: true,
      data: safeSettings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update SMS settings
// @route   PUT /api/settings/sms
// @access  Private
exports.updateSMSSettings = async (req, res, next) => {
  try {
    const {
      enabled,
      provider,
      accountSid,
      authToken,
      fromNumber,
      apiKey,
      username
    } = sanitizePayload(req.body);

    // Get existing settings to preserve sensitive data if not provided
    const existing = await getSettingValue(req.tenantId, 'sms', {});

    // Validate required fields if enabling
    if (enabled) {
      const finalProvider = provider || existing.provider || 'twilio';
      
      if (finalProvider === 'twilio') {
        const finalAccountSid = accountSid || existing.accountSid;
        const finalAuthToken = authToken || existing.authToken;
        const finalFromNumber = fromNumber || existing.fromNumber;

        if (!finalAccountSid || !finalAuthToken || !finalFromNumber) {
          return res.status(400).json({
            success: false,
            message: 'Account SID, Auth Token, and From Number are required for Twilio'
          });
        }

        // Test connection
        const smsService = require('../services/smsService');
        const testResult = await smsService.testConnection({
          provider: 'twilio',
          accountSid: finalAccountSid,
          authToken: finalAuthToken
        });
        
        if (!testResult.success) {
          return res.status(400).json({
            success: false,
            message: 'Failed to connect to SMS service',
            error: testResult.error
          });
        }
      } else if (finalProvider === 'africas_talking') {
        const finalApiKey = apiKey || existing.apiKey;
        const finalUsername = username || existing.username;
        const finalFromNumber = fromNumber || existing.fromNumber;

        if (!finalApiKey || !finalUsername || !finalFromNumber) {
          return res.status(400).json({
            success: false,
            message: 'API Key, Username, and From Number are required for Africa\'s Talking'
          });
        }

        // Test connection
        const smsService = require('../services/smsService');
        const testResult = await smsService.testConnection({
          provider: 'africas_talking',
          apiKey: finalApiKey,
          username: finalUsername
        });
        
        if (!testResult.success) {
          return res.status(400).json({
            success: false,
            message: 'Failed to connect to SMS service',
            error: testResult.error
          });
        }
      }
    }

    const smsData = {
      enabled: enabled !== undefined ? enabled : existing.enabled || false,
      provider: provider || existing.provider || 'twilio',
      accountSid: accountSid || existing.accountSid || '',
      authToken: authToken || existing.authToken || '',
      fromNumber: fromNumber || existing.fromNumber || '',
      apiKey: apiKey || existing.apiKey || '',
      username: username || existing.username || ''
    };

    const updated = await upsertSettingValue(
      req.tenantId,
      'sms',
      smsData,
      'SMS service configuration'
    );

    // Don't expose sensitive tokens in response
    const safeSettings = {
      ...updated,
      authToken: updated.authToken ? '***' : '',
      apiKey: updated.apiKey ? '***' : ''
    };

    res.status(200).json({
      success: true,
      message: 'SMS settings updated successfully',
      data: safeSettings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Test SMS connection
// @route   POST /api/settings/sms/test
// @access  Private
exports.testSMSConnection = async (req, res, next) => {
  try {
    const config = sanitizePayload(req.body);

    if (!config.provider) {
      return res.status(400).json({
        success: false,
        message: 'Provider is required'
      });
    }

    const smsService = require('../services/smsService');
    const result = await smsService.testConnection(config);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Connection successful',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Connection failed',
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get Email settings
// @route   GET /api/settings/email
// @access  Private
exports.getEmailSettings = async (req, res, next) => {
  try {
    const emailSettings = await getSettingValue(req.tenantId, 'email', {
      enabled: false,
      provider: 'smtp',
      smtpHost: '',
      smtpPort: 587,
      smtpUser: '',
      smtpPassword: '',
      smtpRejectUnauthorized: true,
      fromEmail: '',
      fromName: '',
      sendgridApiKey: '',
      sesAccessKeyId: '',
      sesSecretAccessKey: '',
      sesRegion: 'us-east-1',
      sesHost: ''
    });

    // Don't expose sensitive passwords/keys in response
    const safeSettings = {
      ...emailSettings,
      smtpPassword: emailSettings.smtpPassword ? '***' : '',
      sendgridApiKey: emailSettings.sendgridApiKey ? '***' : '',
      sesSecretAccessKey: emailSettings.sesSecretAccessKey ? '***' : ''
    };

    res.status(200).json({
      success: true,
      data: safeSettings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Email settings
// @route   PUT /api/settings/email
// @access  Private
exports.updateEmailSettings = async (req, res, next) => {
  try {
    const {
      enabled,
      provider,
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPassword,
      smtpRejectUnauthorized,
      fromEmail,
      fromName,
      sendgridApiKey,
      sesAccessKeyId,
      sesSecretAccessKey,
      sesRegion,
      sesHost
    } = sanitizePayload(req.body);

    // Get existing settings to preserve sensitive data if not provided
    const existing = await getSettingValue(req.tenantId, 'email', {});

    // Validate required fields if enabling
    if (enabled) {
      const finalProvider = provider || existing.provider || 'smtp';
      
      if (finalProvider === 'smtp') {
        const finalSmtpHost = smtpHost || existing.smtpHost;
        const finalSmtpUser = smtpUser || existing.smtpUser;
        const finalSmtpPassword = smtpPassword || existing.smtpPassword;

        if (!finalSmtpHost || !finalSmtpUser || !finalSmtpPassword) {
          return res.status(400).json({
            success: false,
            message: 'SMTP Host, User, and Password are required'
          });
        }

        // Test connection
        const emailService = require('../services/emailService');
        const testResult = await emailService.testConnection({
          provider: 'smtp',
          smtpHost: finalSmtpHost,
          smtpPort: smtpPort || existing.smtpPort || 587,
          smtpUser: finalSmtpUser,
          smtpPassword: finalSmtpPassword,
          smtpRejectUnauthorized: smtpRejectUnauthorized !== undefined ? smtpRejectUnauthorized : existing.smtpRejectUnauthorized !== false
        });
        
        if (!testResult.success) {
          return res.status(400).json({
            success: false,
            message: 'Failed to connect to email service',
            error: testResult.error
          });
        }
      } else if (finalProvider === 'sendgrid') {
        const finalSendgridApiKey = sendgridApiKey || existing.sendgridApiKey;

        if (!finalSendgridApiKey) {
          return res.status(400).json({
            success: false,
            message: 'SendGrid API Key is required'
          });
        }

        // Test connection
        const emailService = require('../services/emailService');
        const testResult = await emailService.testConnection({
          provider: 'sendgrid',
          sendgridApiKey: finalSendgridApiKey
        });
        
        if (!testResult.success) {
          return res.status(400).json({
            success: false,
            message: 'Failed to connect to email service',
            error: testResult.error
          });
        }
      } else if (finalProvider === 'ses') {
        const finalSesAccessKeyId = sesAccessKeyId || existing.sesAccessKeyId;
        const finalSesSecretAccessKey = sesSecretAccessKey || existing.sesSecretAccessKey;

        if (!finalSesAccessKeyId || !finalSesSecretAccessKey) {
          return res.status(400).json({
            success: false,
            message: 'AWS SES Access Key ID and Secret Access Key are required'
          });
        }

        // Test connection
        const emailService = require('../services/emailService');
        const testResult = await emailService.testConnection({
          provider: 'ses',
          sesAccessKeyId: finalSesAccessKeyId,
          sesSecretAccessKey: finalSesSecretAccessKey,
          sesRegion: sesRegion || existing.sesRegion || 'us-east-1',
          sesHost: sesHost || existing.sesHost
        });
        
        if (!testResult.success) {
          return res.status(400).json({
            success: false,
            message: 'Failed to connect to email service',
            error: testResult.error
          });
        }
      }
    }

    const emailData = {
      enabled: enabled !== undefined ? enabled : existing.enabled || false,
      provider: provider || existing.provider || 'smtp',
      smtpHost: smtpHost || existing.smtpHost || '',
      smtpPort: smtpPort !== undefined ? smtpPort : (existing.smtpPort || 587),
      smtpUser: smtpUser || existing.smtpUser || '',
      smtpPassword: smtpPassword || existing.smtpPassword || '',
      smtpRejectUnauthorized: smtpRejectUnauthorized !== undefined ? smtpRejectUnauthorized : (existing.smtpRejectUnauthorized !== false),
      fromEmail: fromEmail || existing.fromEmail || '',
      fromName: fromName || existing.fromName || '',
      sendgridApiKey: sendgridApiKey || existing.sendgridApiKey || '',
      sesAccessKeyId: sesAccessKeyId || existing.sesAccessKeyId || '',
      sesSecretAccessKey: sesSecretAccessKey || existing.sesSecretAccessKey || '',
      sesRegion: sesRegion || existing.sesRegion || 'us-east-1',
      sesHost: sesHost || existing.sesHost || ''
    };

    const updated = await upsertSettingValue(
      req.tenantId,
      'email',
      emailData,
      'Email service configuration'
    );

    // Don't expose sensitive passwords/keys in response
    const safeSettings = {
      ...updated,
      smtpPassword: updated.smtpPassword ? '***' : '',
      sendgridApiKey: updated.sendgridApiKey ? '***' : '',
      sesSecretAccessKey: updated.sesSecretAccessKey ? '***' : ''
    };

    res.status(200).json({
      success: true,
      message: 'Email settings updated successfully',
      data: safeSettings
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get POS config
// @route   GET /api/settings/pos-config
// @access  Private
const POS_CONFIG_DEFAULTS = {
  receipt: { mode: 'ask', channels: ['sms', 'print'] },
  print: { format: 'a4', showLogo: true, color: true, fontSize: 'normal' },
  customer: { phoneRequired: false, nameRequired: false }
};

const VALID_RECEIPT_MODES = ['ask', 'auto_send', 'auto_print', 'auto_both'];
const VALID_CHANNELS = ['sms', 'whatsapp', 'email', 'print'];
const VALID_PRINT_FORMATS = ['a4', 'thermal_58', 'thermal_80'];
const VALID_FONT_SIZES = ['normal', 'small'];

exports.getPOSConfig = async (req, res, next) => {
  try {
    const config = await getSettingValue(req.tenantId, 'pos_config', POS_CONFIG_DEFAULTS);
    const merged = {
      receipt: { ...POS_CONFIG_DEFAULTS.receipt, ...(config.receipt || {}) },
      print: { ...POS_CONFIG_DEFAULTS.print, ...(config.print || {}) },
      customer: { ...POS_CONFIG_DEFAULTS.customer, ...(config.customer || {}) }
    };

    // Check which receipt channels (SMS, WhatsApp, Email) are actually integrated
    const smsService = require('../services/smsService');
    const [smsSetting, whatsappSetting, emailSetting] = await Promise.all([
      Setting.findOne({ where: { tenantId: req.tenantId, key: 'sms' } }),
      Setting.findOne({ where: { tenantId: req.tenantId, key: 'whatsapp' } }),
      Setting.findOne({ where: { tenantId: req.tenantId, key: 'email' } })
    ]);
    merged.receiptChannelsAvailable = {
      sms: !!(smsSetting?.value?.enabled) || smsService.isPlatformSmsEnabled(),
      whatsapp: !!(whatsappSetting?.value?.enabled),
      email: !!(emailSetting?.value?.enabled)
    };

    res.status(200).json({ success: true, data: merged });
  } catch (error) {
    next(error);
  }
};

// @desc    Update POS config
// @route   PUT /api/settings/pos-config
// @access  Private
exports.updatePOSConfig = async (req, res, next) => {
  try {
    const existing = await getSettingValue(req.tenantId, 'pos_config', POS_CONFIG_DEFAULTS);
    const incoming = sanitizePayload(req.body || {});

    const receipt = { ...(existing.receipt || {}), ...(incoming.receipt || {}) };
    if (receipt.mode && !VALID_RECEIPT_MODES.includes(receipt.mode)) {
      return res.status(400).json({ success: false, message: 'Invalid receipt mode' });
    }
    if (receipt.channels) {
      if (!Array.isArray(receipt.channels)) {
        return res.status(400).json({ success: false, message: 'channels must be an array' });
      }
      const invalid = receipt.channels.filter((c) => !VALID_CHANNELS.includes(c));
      if (invalid.length) {
        return res.status(400).json({ success: false, message: `Invalid channels: ${invalid.join(', ')}` });
      }
    }

    const print = { ...(existing.print || {}), ...(incoming.print || {}) };
    if (print.format && !VALID_PRINT_FORMATS.includes(print.format)) {
      return res.status(400).json({ success: false, message: 'Invalid print format' });
    }
    if (print.fontSize && !VALID_FONT_SIZES.includes(print.fontSize)) {
      return res.status(400).json({ success: false, message: 'Invalid font size' });
    }
    if (['thermal_58', 'thermal_80'].includes(print.format)) {
      print.showLogo = false;
      print.color = false;
      print.fontSize = 'small';
    }

    const customer = { ...(existing.customer || {}), ...(incoming.customer || {}) };
    if (typeof customer.phoneRequired !== 'undefined') {
      customer.phoneRequired = Boolean(customer.phoneRequired);
    }
    if (typeof customer.nameRequired !== 'undefined') {
      customer.nameRequired = Boolean(customer.nameRequired);
    }

    const merged = { receipt, print, customer };
    const updated = await upsertSettingValue(req.tenantId, 'pos_config', merged, 'POS and checkout configuration');
    res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};

// @desc    Test Email connection
// @route   POST /api/settings/email/test
// @access  Private
exports.testEmailConnection = async (req, res, next) => {
  try {
    const config = sanitizePayload(req.body);

    if (!config.provider) {
      return res.status(400).json({
        success: false,
        message: 'Provider is required'
      });
    }

    const emailService = require('../services/emailService');
    const result = await emailService.testConnection(config);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: 'Connection successful',
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Connection failed',
        error: result.error
      });
    }
  } catch (error) {
    next(error);
  }
};
