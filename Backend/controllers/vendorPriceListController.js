const { VendorPriceList, Vendor } = require('../models');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');

// @desc    Get all price list items for a vendor
// @route   GET /api/vendors/:vendorId/price-list
// @access  Private
exports.getVendorPriceList = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    
    // Verify vendor belongs to tenant
    const vendor = await Vendor.findOne({
      where: applyTenantFilter(req.tenantId, { id: vendorId })
    });
    
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }
    
    const priceList = await VendorPriceList.findAll({
      where: applyTenantFilter(req.tenantId, { vendorId }),
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count: priceList.length,
      data: priceList
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create price list item
// @route   POST /api/vendors/:vendorId/price-list
// @access  Private (Manager only)
exports.createPriceListItem = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    const payload = sanitizePayload(req.body);
    
    // Verify vendor exists and belongs to tenant
    const vendor = await Vendor.findOne({
      where: applyTenantFilter(req.tenantId, { id: vendorId })
    });
    
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    // If imageUrl is provided and is a base64 data URL, store it directly
    // Otherwise, it will be uploaded separately via the upload endpoint
    const priceListItem = await VendorPriceList.create({
      ...payload,
      vendorId,
      tenantId: req.tenantId,
      // imageUrl is already in payload if provided (can be base64 or null)
    });

    res.status(201).json({
      success: true,
      data: priceListItem
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update price list item
// @route   PUT /api/vendors/:vendorId/price-list/:id
// @access  Private (Manager only)
exports.updatePriceListItem = async (req, res, next) => {
  try {
    const { id, vendorId } = req.params;
    const payload = sanitizePayload(req.body);

    // Verify vendor belongs to tenant
    const vendor = await Vendor.findOne({
      where: applyTenantFilter(req.tenantId, { id: vendorId })
    });
    
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const priceListItem = await VendorPriceList.findOne({
      where: applyTenantFilter(req.tenantId, { id, vendorId })
    });

    if (!priceListItem) {
      return res.status(404).json({
        success: false,
        message: 'Price list item not found'
      });
    }

    await priceListItem.update(payload);

    res.status(200).json({
      success: true,
      data: priceListItem
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete price list item
// @route   DELETE /api/vendors/:vendorId/price-list/:id
// @access  Private (Manager only)
exports.deletePriceListItem = async (req, res, next) => {
  try {
    const { id, vendorId } = req.params;

    // Verify vendor belongs to tenant
    const vendor = await Vendor.findOne({
      where: applyTenantFilter(req.tenantId, { id: vendorId })
    });
    
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const priceListItem = await VendorPriceList.findOne({
      where: applyTenantFilter(req.tenantId, { id, vendorId })
    });

    if (!priceListItem) {
      return res.status(404).json({
        success: false,
        message: 'Price list item not found'
      });
    }

    await priceListItem.destroy();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload image for price list item
// @route   POST /api/vendors/:vendorId/price-list/:id/image
// @access  Private (Manager only)
exports.uploadPriceListItemImage = async (req, res, next) => {
  try {
    console.log('[Image Upload] Starting image upload process...');
    console.log('[Image Upload] Request params:', req.params);
    console.log('[Image Upload] Tenant ID:', req.tenantId);
    console.log('[Image Upload] File info:', req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      hasBuffer: !!req.file.buffer,
      hasPath: !!req.file.path
    } : 'No file in request');

    const { id, vendorId } = req.params;

    // Verify vendor belongs to tenant
    console.log('[Image Upload] Verifying vendor...');
    const vendor = await Vendor.findOne({
      where: applyTenantFilter(req.tenantId, { id: vendorId })
    });
    
    if (!vendor) {
      console.log('[Image Upload] ❌ Vendor not found:', vendorId);
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }
    console.log('[Image Upload] ✅ Vendor found:', vendor.name);

    console.log('[Image Upload] Finding price list item...');
    const priceListItem = await VendorPriceList.findOne({
      where: applyTenantFilter(req.tenantId, { id, vendorId })
    });

    if (!priceListItem) {
      console.log('[Image Upload] ❌ Price list item not found:', id);
      return res.status(404).json({
        success: false,
        message: 'Price list item not found'
      });
    }
    console.log('[Image Upload] ✅ Price list item found:', priceListItem.name);

    if (!req.file) {
      console.log('[Image Upload] ❌ No file in request');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Convert image to base64 and store in database
    console.log('[Image Upload] Processing file...');
    let base64Image;
    const mimeType = req.file.mimetype || 'image/png';
    console.log('[Image Upload] File MIME type:', mimeType);
    console.log('[Image Upload] File size:', req.file.size, 'bytes');
    
    try {
      if (req.file.buffer) {
        console.log('[Image Upload] File is in memory (buffer), converting to base64...');
        const bufferSize = req.file.buffer.length;
        console.log('[Image Upload] Buffer size:', bufferSize, 'bytes');
        const base64String = req.file.buffer.toString('base64');
        const base64Length = base64String.length;
        console.log('[Image Upload] Base64 string length:', base64Length, 'characters');
        base64Image = `data:${mimeType};base64,${base64String}`;
        console.log('[Image Upload] ✅ Base64 conversion complete. Total data URL length:', base64Image.length);
      } else if (req.file.path) {
        console.log('[Image Upload] File is on disk, reading from path:', req.file.path);
        const fs = require('fs');
        
        if (!fs.existsSync(req.file.path)) {
          console.log('[Image Upload] ❌ File path does not exist:', req.file.path);
          return res.status(400).json({
            success: false,
            message: 'Uploaded file not found on server'
          });
        }
        
        const fileBuffer = fs.readFileSync(req.file.path);
        console.log('[Image Upload] File read from disk, size:', fileBuffer.length, 'bytes');
        const base64String = fileBuffer.toString('base64');
        base64Image = `data:${mimeType};base64,${base64String}`;
        console.log('[Image Upload] ✅ Base64 conversion complete. Total data URL length:', base64Image.length);
        
        // Delete the temporary file since we're storing in DB
        try {
          fs.unlinkSync(req.file.path);
          console.log('[Image Upload] ✅ Temporary file deleted:', req.file.path);
        } catch (unlinkError) {
          console.log('[Image Upload] ⚠️  Warning: Could not delete temporary file:', unlinkError.message);
        }
      } else {
        console.log('[Image Upload] ❌ File has neither buffer nor path');
        console.log('[Image Upload] File object keys:', Object.keys(req.file));
        return res.status(400).json({
          success: false,
          message: 'Unable to process uploaded file - no buffer or path available'
        });
      }
    } catch (processingError) {
      console.error('[Image Upload] ❌ Error processing file:', processingError);
      console.error('[Image Upload] Error stack:', processingError.stack);
      return res.status(500).json({
        success: false,
        message: 'Error processing uploaded file',
        error: processingError.message
      });
    }

    // Update price list item with base64 image data
    console.log('[Image Upload] Updating price list item in database...');
    console.log('[Image Upload] Image data length:', base64Image.length, 'characters');
    
    try {
      priceListItem.imageUrl = base64Image;
      await priceListItem.save();
      console.log('[Image Upload] ✅ Price list item updated successfully');
      console.log('[Image Upload] Item ID:', priceListItem.id);
    } catch (dbError) {
      console.error('[Image Upload] ❌ Database error:', dbError);
      console.error('[Image Upload] Error details:', {
        name: dbError.name,
        message: dbError.message,
        stack: dbError.stack
      });
      return res.status(500).json({
        success: false,
        message: 'Error saving image to database',
        error: dbError.message
      });
    }

    console.log('[Image Upload] ✅ Image upload completed successfully');
    res.status(200).json({
      success: true,
      data: priceListItem
    });
  } catch (error) {
    console.error('[Image Upload] ❌ Unexpected error:', error);
    console.error('[Image Upload] Error name:', error.name);
    console.error('[Image Upload] Error message:', error.message);
    console.error('[Image Upload] Error stack:', error.stack);
    next(error);
  }
};
