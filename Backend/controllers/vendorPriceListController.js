const { VendorPriceList, Vendor } = require('../models');

// @desc    Get all price list items for a vendor
// @route   GET /api/vendors/:vendorId/price-list
// @access  Private
exports.getVendorPriceList = async (req, res, next) => {
  try {
    const { vendorId } = req.params;
    
    const priceList = await VendorPriceList.findAll({
      where: { vendorId },
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
    
    // Verify vendor exists
    const vendor = await Vendor.findByPk(vendorId);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: 'Vendor not found'
      });
    }

    const priceListItem = await VendorPriceList.create({
      ...req.body,
      vendorId
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

    const priceListItem = await VendorPriceList.findOne({
      where: { id, vendorId }
    });

    if (!priceListItem) {
      return res.status(404).json({
        success: false,
        message: 'Price list item not found'
      });
    }

    await priceListItem.update(req.body);

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

    const priceListItem = await VendorPriceList.findOne({
      where: { id, vendorId }
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

