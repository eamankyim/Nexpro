const { Product, ProductVariant, Shop, InventoryCategory, Barcode } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');

// @desc    Get all products
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const search = req.query.search || '';
    const shopId = req.query.shopId;
    const categoryId = req.query.categoryId;

    const where = applyTenantFilter(req.tenantId, {});
    if (shopId) {
      where.shopId = shopId;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { sku: { [Op.iLike]: `%${search}%` } },
        { barcode: { [Op.iLike]: `%${search}%` } },
        { brand: { [Op.iLike]: `%${search}%` } }
      ];
    }

    const { count, rows } = await Product.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: Shop, as: 'shop', attributes: ['id', 'name'] },
        { model: InventoryCategory, as: 'category', attributes: ['id', 'name'] }
      ],
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

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Private
exports.getProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        { model: Shop, as: 'shop', attributes: ['id', 'name'] },
        { model: InventoryCategory, as: 'category', attributes: ['id', 'name'] },
        { model: ProductVariant, as: 'variants' },
        { model: Barcode, as: 'barcodes' }
      ]
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new product
// @route   POST /api/products
// @access  Private
exports.createProduct = async (req, res, next) => {
  try {
    const payload = sanitizePayload(req.body);
    const product = await Product.create({
      ...payload,
      tenantId: req.tenantId
    });

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
exports.updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const payload = sanitizePayload(req.body);
    const oldQuantity = parseFloat(product.quantity || 0);
    const newQuantity = parseFloat(payload.quantity || oldQuantity);
    const reorderLevel = parseFloat(product.reorderLevel || 0);
    
    await product.update(payload);

    const updatedProduct = await Product.findOne({
      where: applyTenantFilter(req.tenantId, { id: product.id }),
      include: [
        { model: Shop, as: 'shop', attributes: ['id', 'name'] },
        { model: InventoryCategory, as: 'category', attributes: ['id', 'name'] }
      ]
    });

    // Check for low stock alert
    if (reorderLevel > 0 && newQuantity <= reorderLevel && newQuantity < oldQuantity) {
      try {
        const whatsappService = require('../services/whatsappService');
        const whatsappTemplates = require('../services/whatsappTemplates');
        const { Tenant, UserTenant } = require('../models');
        
        // Get tenant to find admin/manager phone numbers
        const tenant = await Tenant.findByPk(req.tenantId);
        const config = await whatsappService.getConfig(req.tenantId);
        
        if (config && tenant) {
          // Get admin/manager users for this tenant
          const adminUsers = await UserTenant.findAll({
            where: {
              tenantId: req.tenantId,
              role: { [Op.in]: ['admin', 'manager', 'owner'] }
            },
            include: [{ model: require('../models').User, as: 'user', attributes: ['id', 'name', 'phone'] }]
          });
          
          // Send WhatsApp alerts to admins/managers
          for (const adminUser of adminUsers) {
            if (adminUser.user && adminUser.user.phone) {
              const phoneNumber = whatsappService.validatePhoneNumber(adminUser.user.phone);
              if (phoneNumber) {
                const parameters = whatsappTemplates.prepareLowStockAlert(updatedProduct);
                await whatsappService.sendMessage(
                  req.tenantId,
                  phoneNumber,
                  'low_stock_alert',
                  parameters
                ).catch(error => {
                  console.error('[Product] WhatsApp low stock alert failed:', error);
                });
              }
            }
          }
        }
      } catch (error) {
        console.error('[Product] WhatsApp low stock alert error:', error);
      }
    }

    res.status(200).json({
      success: true,
      data: updatedProduct
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
exports.deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    await product.destroy();

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get product by barcode
// @route   GET /api/products/barcode/:barcode
// @access  Private
exports.getProductByBarcode = async (req, res, next) => {
  try {
    const { barcode } = req.params;
    
    const product = await Product.findOne({
      where: applyTenantFilter(req.tenantId, { barcode })
    });

    if (!product) {
      // Try finding by barcode in Barcode table
      const barcodeRecord = await Barcode.findOne({
        where: { barcode, tenantId: req.tenantId },
        include: [
          { model: Product, as: 'product' },
          { model: ProductVariant, as: 'productVariant' }
        ]
      });

      if (barcodeRecord && barcodeRecord.product) {
        return res.status(200).json({
          success: true,
          data: barcodeRecord.product
        });
      }

      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};
