const path = require('path');
const fs = require('fs');
const { Setting, User, Tenant } = require('../models');
const { baseUploadDir } = require('../middleware/upload');

const { sanitizePayload } = require('../utils/tenantUtils');

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
      address: organizationSettings.address || {},
      tax: organizationSettings.tax || {}
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
      tenant.metadata = metadata;
      
      await tenant.save();
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
      address: (updated && updated.address) ? updated.address : {},
      tax: (updated && updated.tax) ? updated.tax : {}
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

