const { PricingTemplate } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');

// @desc    Get all pricing templates
// @route   GET /api/pricing
// @access  Private
exports.getPricingTemplates = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const category = req.query.category;
    const isActive = req.query.isActive;

    const where = { tenantId: req.tenantId };
    if (category && category !== '') where.category = category;
    if (isActive !== undefined && isActive !== '') where.isActive = isActive === 'true';

    const { count, rows } = await PricingTemplate.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']]
    });

    res.status(200).json({
      success: true,
      count,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(count / limit)
      },
      data: rows
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single pricing template
// @route   GET /api/pricing/:id
// @access  Private
exports.getPricingTemplate = async (req, res, next) => {
  try {
    const pricingTemplate = await PricingTemplate.findOne({
      where: {
        id: req.params.id,
        tenantId: req.tenantId
      }
    });

    if (!pricingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Pricing template not found'
      });
    }

    res.status(200).json({
      success: true,
      data: pricingTemplate
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new pricing template
// @route   POST /api/pricing
// @access  Private
exports.createPricingTemplate = async (req, res, next) => {
  try {
    const pricingTemplate = await PricingTemplate.create({
      ...req.body,
      tenantId: req.tenantId
    });

    res.status(201).json({
      success: true,
      data: pricingTemplate
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update pricing template
// @route   PUT /api/pricing/:id
// @access  Private
exports.updatePricingTemplate = async (req, res, next) => {
  try {
    const pricingTemplate = await PricingTemplate.findOne({
      where: {
        id: req.params.id,
        tenantId: req.tenantId
      }
    });

    if (!pricingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Pricing template not found'
      });
    }

    await pricingTemplate.update(req.body);

    res.status(200).json({
      success: true,
      data: pricingTemplate
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete pricing template
// @route   DELETE /api/pricing/:id
// @access  Private
exports.deletePricingTemplate = async (req, res, next) => {
  try {
    const pricingTemplate = await PricingTemplate.findOne({
      where: {
        id: req.params.id,
        tenantId: req.tenantId
      }
    });

    if (!pricingTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Pricing template not found'
      });
    }

    await pricingTemplate.destroy();

    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Calculate price for a job
// @route   POST /api/pricing/calculate
// @access  Private
exports.calculatePrice = async (req, res, next) => {
  try {
    const { jobType, paperType, paperSize, colorType, quantity, additionalOptions } = req.body;

    // Find matching pricing template
    const template = await PricingTemplate.findOne({
      where: {
        isActive: true,
        ...(jobType && { jobType }),
        ...(paperType && { paperType }),
        ...(paperSize && { paperSize }),
        ...(colorType && { colorType })
      }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'No pricing template found for the given criteria'
      });
    }

    let calculatedPrice = parseFloat(template.basePrice);
    
    // Add per unit price
    if (template.pricePerUnit && quantity) {
      calculatedPrice += parseFloat(template.pricePerUnit) * quantity;
    }

    // Add setup fee
    if (template.setupFee) {
      calculatedPrice += parseFloat(template.setupFee);
    }

    // Track discount details
    let appliedDiscount = null;
    let discountAmount = 0;
    let priceBeforeDiscount = calculatedPrice;

    // Apply discount tiers
    if (template.discountTiers && quantity) {
      const tiers = template.discountTiers;
      for (const tier of tiers) {
        if (quantity >= tier.minQuantity && quantity <= (tier.maxQuantity || Infinity)) {
          discountAmount = (calculatedPrice * tier.discountPercent) / 100;
          calculatedPrice -= discountAmount;
          appliedDiscount = {
            type: 'quantity',
            tier: tier,
            percentage: tier.discountPercent,
            amount: discountAmount.toFixed(2),
            reason: `Volume discount (${tier.minQuantity}+ units = ${tier.discountPercent}% off)`
          };
          break;
        }
      }
    }

    // Add additional options pricing
    let additionalOptionsCost = 0;
    if (template.additionalOptions && additionalOptions) {
      for (const option of additionalOptions) {
        const templateOption = template.additionalOptions.find(o => o.name === option);
        if (templateOption) {
          const optionPrice = parseFloat(templateOption.price);
          calculatedPrice += optionPrice;
          additionalOptionsCost += optionPrice;
        }
      }
    }

    res.status(200).json({
      success: true,
      data: {
        template,
        calculatedPrice: calculatedPrice.toFixed(2),
        quantity,
        breakdown: {
          basePrice: parseFloat(template.basePrice).toFixed(2),
          unitPrice: template.pricePerUnit ? (parseFloat(template.pricePerUnit) * quantity).toFixed(2) : '0.00',
          setupFee: parseFloat(template.setupFee || 0).toFixed(2),
          additionalOptions: additionalOptionsCost.toFixed(2),
          subtotal: priceBeforeDiscount.toFixed(2),
          discount: appliedDiscount ? {
            amount: appliedDiscount.amount,
            percentage: appliedDiscount.percentage,
            reason: appliedDiscount.reason
          } : null,
          finalPrice: calculatedPrice.toFixed(2)
        },
        appliedDiscount
      }
    });
  } catch (error) {
    next(error);
  }
};


