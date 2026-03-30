const fs = require('fs');
const path = require('path');
const { Product, ProductVariant, Shop, ProductCategory, Barcode, SaleItem, Sale, Customer, User } = require('../models');
const { Op } = require('sequelize');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');
const { getPagination } = require('../utils/paginationUtils');
const { baseUploadDir, ensureDirExists } = require('../middleware/upload');
const { invalidateProductListCache } = require('../middleware/cache');

// @desc    Get all products
// @route   GET /api/products
// @access  Private
exports.getProducts = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = req.query.search || '';
    const shopId = req.query.shopId;
    const categoryId = req.query.categoryId;
    const isActive = req.query.isActive;

    const where = applyTenantFilter(req.tenantId, {});
    if (shopId) {
      where.shopId = shopId;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (isActive !== undefined) {
      where.isActive = isActive === 'true' || isActive === true;
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
        { model: ProductCategory, as: 'category', attributes: ['id', 'name'] }
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
        { model: ProductCategory, as: 'category', attributes: ['id', 'name'] },
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

// @desc    Get sales/movement history for a product
// @route   GET /api/products/:id/sales
// @access  Private
exports.getProductSales = async (req, res, next) => {
  try {
    const product = await Product.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      attributes: ['id', 'name']
    });
    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const { page, limit, offset } = getPagination(req, { defaultPageSize: 20 });
    const { count, rows } = await SaleItem.findAndCountAll({
      where: { productId: req.params.id },
      limit,
      offset,
      include: [
        {
          model: Sale,
          as: 'sale',
          required: true,
          attributes: ['id', 'saleNumber', 'createdAt', 'status', 'total', 'soldBy'],
          where: applyTenantFilter(req.tenantId),
          include: [
            { model: Customer, as: 'customer', attributes: ['id', 'name'], required: false },
            { model: User, as: 'seller', attributes: ['id', 'name'], required: false }
          ]
        }
      ],
      order: [[{ model: Sale, as: 'sale' }, 'createdAt', 'DESC']]
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

// @desc    Upload product image
// @route   POST /api/products/upload-image
// @access  Private
exports.uploadProductImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

    if (isServerless) {
      // Serverless (Vercel/Lambda): no writable filesystem; store as base64 in DB
      const mime = req.file.mimetype || 'image/jpeg';
      const base64 = req.file.buffer.toString('base64');
      const imageUrl = `data:${mime};base64,${base64}`;
      return res.status(200).json({ success: true, imageUrl });
    }

    // Node.js with disk: write to uploads/products/<tenantId>/
    const tenantId = req.tenantId;
    const subDir = path.join('products', tenantId);
    const uploadPath = path.join(baseUploadDir, subDir);
    ensureDirExists(uploadPath);
    const ext = path.extname(req.file.originalname) || '.jpg';
    const sanitized = req.file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_').replace(/\.[^.]+$/, '') || 'image';
    const filename = `${Date.now()}-${sanitized}${ext}`;
    const filePath = path.join(uploadPath, filename);
    fs.writeFileSync(filePath, req.file.buffer);
    const imageUrl = `/uploads/products/${tenantId}/${filename}`;
    res.status(200).json({ success: true, imageUrl });
  } catch (error) {
    next(error);
  }
};

// @desc    Get product categories
// @route   GET /api/products/categories
// @access  Private
exports.getProductCategories = async (req, res, next) => {
  const tenantId = req.tenantId;
  const tenant = req.tenant;
  const { resolveBusinessType } = require('../config/businessTypes');
  const businessType = resolveBusinessType(tenant?.businessType);
  const studioType = tenant?.metadata?.studioType || null;
  const shopType = tenant?.metadata?.shopType || null;

  try {
    console.log('[getProductCategories] tenantId=%s businessType=%s studioType=%s shopType=%s (product_categories)', tenantId || 'missing', businessType, studioType || 'none', shopType || 'none');
    if (!tenantId) {
      console.warn('[getProductCategories] No tenantId on request – categories may be empty');
    }

    // Base filter: tenant + active
    const baseWhere = {
      ...applyTenantFilter(tenantId, {}),
      isActive: true
    };

    let categories;

    try {
      // Try full query with businessType/studioType/shopType (requires migration to have run)
      const whereConditions = [
        { ...baseWhere, businessType: null },
        { ...baseWhere, businessType: businessType, studioType: null, shopType: null }
      ];
      if (businessType === 'studio' && studioType) {
        whereConditions.push({
          ...baseWhere,
          businessType: 'studio',
          studioType: studioType,
          shopType: null
        });
      }
      if (businessType === 'shop' && shopType) {
        whereConditions.push({
          ...baseWhere,
          businessType: 'shop',
          shopType: shopType,
          studioType: null
        });
      }
      categories = await ProductCategory.findAll({
        where: { [Op.or]: whereConditions },
        order: [['name', 'ASC']]
      });
    } catch (columnError) {
      console.warn('[getProductCategories] businessType/studioType query failed (columns may not exist), falling back to tenant-only:', columnError?.message);
      categories = await ProductCategory.findAll({
        where: baseWhere,
        order: [['name', 'ASC']],
        attributes: ['id', 'tenantId', 'name', 'description', 'isActive', 'metadata', 'createdAt', 'updatedAt']
      });
    }

    console.log('[getProductCategories] tenantId=%s count=%d', tenantId || 'missing', categories.length);
    if (categories.length === 0) {
      console.log('[getProductCategories] No product_categories for this tenant – run seed-default-product-categories migration');
    }
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    console.error('[getProductCategories] Error loading categories:', {
      tenantId,
      message: error?.message,
      name: error?.name,
      stack: error?.stack
    });
    next(error);
  }
};

// @desc    Create product category
// @route   POST /api/products/categories
// @access  Private
exports.createProductCategory = async (req, res, next) => {
  try {
    const { name, description, metadata, businessType, studioType, shopType } = sanitizePayload(req.body || {});
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    
    const tenant = req.tenant;
    const { resolveBusinessType } = require('../config/businessTypes');
    
    // Check for duplicate category name within tenant
    const existingCategory = await ProductCategory.findOne({
      where: { tenantId: req.tenantId, name: name.trim() }
    });
    if (existingCategory) {
      return res.status(400).json({ 
        success: false, 
        message: `Category "${name}" already exists` 
      });
    }
    
    // If businessType/studioType/shopType not provided, use tenant's values
    const finalBusinessType = businessType || (tenant ? resolveBusinessType(tenant.businessType) : null);
    const finalStudioType = studioType || (tenant?.metadata?.studioType || null);
    const finalShopType = shopType ?? (tenant?.metadata?.shopType || null);
    
    // Validate: studioType only makes sense if businessType is 'studio'
    if (finalStudioType && finalBusinessType !== 'studio') {
      return res.status(400).json({ 
        success: false, 
        message: 'studioType can only be set when businessType is "studio"' 
      });
    }
    // Validate: shopType only makes sense if businessType is 'shop'
    if (finalShopType && finalBusinessType !== 'shop') {
      return res.status(400).json({ 
        success: false, 
        message: 'shopType can only be set when businessType is "shop"' 
      });
    }
    
    const category = await ProductCategory.create({
      name: name.trim(),
      description: description || null,
      metadata: metadata || {},
      businessType: finalBusinessType,
      studioType: finalStudioType,
      shopType: finalShopType,
      tenantId: req.tenantId
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product category
// @route   DELETE /api/products/categories/:id
// @access  Private
exports.deleteProductCategory = async (req, res, next) => {
  try {
    const category = await ProductCategory.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const productCount = await Product.count({
      where: { tenantId: req.tenantId, categoryId: category.id }
    });
    if (productCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete: ${productCount} product(s) use this category. Reassign or remove the category from those products first.`
      });
    }

    await category.destroy();
    res.status(200).json({ success: true, data: {} });
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

    invalidateProductListCache(req.tenantId);
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
    invalidateProductListCache(req.tenantId);

    await product.reload({
      include: [
        { model: Shop, as: 'shop', attributes: ['id', 'name'] },
        { model: ProductCategory, as: 'category', attributes: ['id', 'name'] }
      ]
    });

    // Defer low stock alert so response is sent immediately
    if (reorderLevel > 0 && newQuantity <= reorderLevel && newQuantity < oldQuantity) {
      const productForAlert = product;
      const tenantIdForAlert = req.tenantId;
      setImmediate(() => {
        (async () => {
          try {
            const whatsappService = require('../services/whatsappService');
            const whatsappTemplates = require('../services/whatsappTemplates');
            const { Tenant, UserTenant } = require('../models');

            const tenant = await Tenant.findByPk(tenantIdForAlert);
            const config = await whatsappService.getConfig(tenantIdForAlert);

            if (config && tenant) {
              const adminUsers = await UserTenant.findAll({
                where: {
                  tenantId: tenantIdForAlert,
                  role: { [Op.in]: ['admin', 'manager', 'owner'] }
                },
                include: [{ model: require('../models').User, as: 'user', attributes: ['id', 'name', 'phone'] }]
              });

              for (const adminUser of adminUsers) {
                if (adminUser.user && adminUser.user.phone) {
                  const phoneNumber = whatsappService.validatePhoneNumber(adminUser.user.phone);
                  if (phoneNumber) {
                    const parameters = whatsappTemplates.prepareLowStockAlert(productForAlert);
                    await whatsappService.sendMessage(
                      tenantIdForAlert,
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
            try {
              const taskAutomationService = require('../services/taskAutomationService');
              await taskAutomationService.createLowStockTask({
                item: {
                  id: productForAlert.id,
                  name: productForAlert.name,
                  quantityOnHand: Number(newQuantity) || 0,
                  reorderLevel: Number(reorderLevel) || 0
                },
                tenantId: tenantIdForAlert,
                triggeredBy: req.user?.id || null
              });
            } catch (taskErr) {
              console.error('[Product] Low stock task automation failed:', taskErr?.message);
            }
          } catch (error) {
            console.error('[Product] WhatsApp low stock alert error:', error);
          }
        })();
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
    invalidateProductListCache(req.tenantId);

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

// =============================================
// PRODUCT VARIANT OPERATIONS
// =============================================

// @desc    Get variants for a product
// @route   GET /api/products/:id/variants
// @access  Private
exports.getProductVariants = async (req, res, next) => {
  try {
    // First verify the product exists and belongs to tenant
    const product = await Product.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const variants = await ProductVariant.findAll({
      where: { productId: req.params.id },
      order: [['createdAt', 'ASC']]
    });

    res.status(200).json({
      success: true,
      count: variants.length,
      data: variants
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create product variant
// @route   POST /api/products/:id/variants
// @access  Private
exports.createProductVariant = async (req, res, next) => {
  try {
    // First verify the product exists and belongs to tenant
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
    
    // Create the variant
    const variant = await ProductVariant.create({
      ...payload,
      productId: product.id
    });

    // Update product to indicate it has variants
    if (!product.hasVariants) {
      await product.update({ hasVariants: true });
    }

    res.status(201).json({
      success: true,
      data: variant
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update product variant
// @route   PUT /api/products/variants/:variantId
// @access  Private
exports.updateProductVariant = async (req, res, next) => {
  try {
    const variant = await ProductVariant.findByPk(req.params.variantId, {
      include: [{ model: Product, as: 'product' }]
    });

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found'
      });
    }

    // Verify the variant's product belongs to the tenant
    if (variant.product.tenantId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this variant'
      });
    }

    const payload = sanitizePayload(req.body);
    await variant.update(payload);

    res.status(200).json({
      success: true,
      data: variant
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete product variant
// @route   DELETE /api/products/variants/:variantId
// @access  Private
exports.deleteProductVariant = async (req, res, next) => {
  try {
    const variant = await ProductVariant.findByPk(req.params.variantId, {
      include: [{ model: Product, as: 'product' }]
    });

    if (!variant) {
      return res.status(404).json({
        success: false,
        message: 'Variant not found'
      });
    }

    // Verify the variant's product belongs to the tenant
    if (variant.product.tenantId !== req.tenantId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this variant'
      });
    }

    const productId = variant.productId;
    await variant.destroy();

    // Check if product still has variants
    const remainingVariants = await ProductVariant.count({
      where: { productId }
    });

    if (remainingVariants === 0) {
      await Product.update(
        { hasVariants: false },
        { where: { id: productId } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Variant deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk create products
// @route   POST /api/products/bulk
// @access  Private (admin, manager)
exports.bulkCreateProducts = async (req, res, next) => {
  try {
    const { products } = req.body;
    const { bulkCreate } = require('../utils/bulkOperations');

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of products'
      });
    }

    const result = await bulkCreate(Product, products, {
      tenantId: req.tenantId,
      userId: req.user?.id,
      continueOnError: true,
      maxBatchSize: 100,
    });

    invalidateProductListCache(req.tenantId);
    res.status(result.success ? 201 : 207).json({
      success: result.success,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk update products
// @route   PUT /api/products/bulk
// @access  Private (admin, manager)
exports.bulkUpdateProducts = async (req, res, next) => {
  try {
    const { products } = req.body;
    const { bulkUpdate } = require('../utils/bulkOperations');

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of product updates'
      });
    }

    const result = await bulkUpdate(Product, products, {
      tenantId: req.tenantId,
      userId: req.user?.id,
      continueOnError: true,
      maxBatchSize: 100,
    });

    invalidateProductListCache(req.tenantId);
    res.status(result.success ? 200 : 207).json({
      success: result.success,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk delete products
// @route   DELETE /api/products/bulk
// @access  Private (admin only)
exports.bulkDeleteProducts = async (req, res, next) => {
  try {
    const { ids } = req.body;
    const { bulkDelete } = require('../utils/bulkOperations');

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of product IDs'
      });
    }

    const result = await bulkDelete(Product, ids, {
      tenantId: req.tenantId,
      continueOnError: true,
      maxBatchSize: 100,
    });

    invalidateProductListCache(req.tenantId);
    res.status(result.success ? 200 : 207).json({
      success: result.success,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Export products to CSV/Excel
// @route   GET /api/products/export
// @access  Private (admin, manager)
exports.exportProducts = async (req, res, next) => {
  try {
    const { format = 'csv', categoryId, isActive } = req.query;
    const { sendCSV, sendExcel, COLUMN_DEFINITIONS } = require('../utils/dataExport');

    const where = applyTenantFilter(req.tenantId, {});
    if (categoryId) where.categoryId = categoryId;
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const products = await Product.findAll({
      where,
      include: [
        { model: ProductCategory, as: 'category', attributes: ['id', 'name'] }
      ],
      order: [['name', 'ASC']],
      raw: true,
      nest: true
    });

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No products to export'
      });
    }

    const filename = `products_${new Date().toISOString().split('T')[0]}`;
    const columns = COLUMN_DEFINITIONS.products;

    if (format === 'excel') {
      await sendExcel(res, products, `${filename}.xlsx`, {
        columns,
        sheetName: 'Products',
        title: 'Product Inventory'
      });
    } else {
      sendCSV(res, products, `${filename}.csv`, columns);
    }
  } catch (error) {
    next(error);
  }
};

// @desc    Get CSV template for product bulk import
// @route   GET /api/products/import/template
// @access  Private (admin, manager)
exports.getProductImportTemplate = (req, res) => {
  const { getTemplateCSV } = require('../utils/importParse');
  const csv = getTemplateCSV('products');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="products_import_template.csv"');
  res.send(csv);
};

// @desc    Bulk import products from CSV/Excel (no images)
// @route   POST /api/products/import
// @access  Private (admin, manager)
exports.importProducts = async (req, res, next) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    const { parseImportFile } = require('../utils/importParse');
    const { bulkCreate } = require('../utils/bulkOperations');
    const mime = req.file.mimetype || '';
    const ext = (req.file.originalname || '').toLowerCase().slice(-5);
    const { mapped, errors: parseErrors } = await parseImportFile(
      req.file.buffer,
      mime || ext,
      'products'
    );

    if (parseErrors.length > 0 && mapped.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid file or rows',
        errors: parseErrors,
      });
    }

    const categoryNames = [...new Set(mapped.map((m) => m.categoryName).filter(Boolean))];
    const categories =
      categoryNames.length > 0
        ? await ProductCategory.findAll({
            where: applyTenantFilter(req.tenantId, { name: { [Op.in]: categoryNames } }),
            attributes: ['id', 'name'],
            raw: true,
          })
        : [];
    const categoryByName = Object.fromEntries(categories.map((c) => [c.name, c.id]));

    const products = mapped.map((m) => {
      const rec = {
        name: m.name,
        sku: m.sku || null,
        barcode: m.barcode || null,
        description: m.description || null,
        categoryId: m.categoryName ? categoryByName[m.categoryName] || null : null,
        costPrice: Number(m.costPrice) || 0,
        sellingPrice: Number(m.sellingPrice) || 0,
        quantityOnHand: Number(m.quantityOnHand) ?? 0,
        reorderLevel: Number(m.reorderLevel) ?? 0,
        reorderQuantity: Number(m.reorderLevel) ?? 0,
        unit: (m.unit && String(m.unit).trim()) || 'pcs',
        isActive: m.isActive !== false,
      };
      return sanitizePayload(rec);
    });

    const result = await bulkCreate(Product, products, {
      tenantId: req.tenantId,
      userId: req.user?.id,
      continueOnError: true,
      maxBatchSize: 100,
    });

    invalidateProductListCache(req.tenantId);
    const allErrors = [
      ...parseErrors.map((e) => ({ row: e.row, message: e.message })),
      ...result.errors.map((e) => ({ row: e.index + 2, message: e.error })),
    ];
    res.status(result.success ? 201 : 207).json({
      success: result.success,
      successCount: result.successCount,
      errorCount: allErrors.length,
      totalProcessed: mapped.length,
      created: result.created,
      errors: allErrors.length ? allErrors : result.errors,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk update product stock
// @route   PUT /api/products/bulk/stock
// @access  Private (admin, manager, staff)
exports.bulkUpdateStock = async (req, res, next) => {
  const transaction = await require('../config/database').sequelize.transaction();
  
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of stock updates'
      });
    }

    if (items.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Maximum batch size is 100 items'
      });
    }

    const updated = [];
    const errors = [];

    for (const item of items) {
      try {
        const { productId, adjustment, type = 'adjustment' } = item;
        
        const product = await Product.findOne({
          where: applyTenantFilter(req.tenantId, { id: productId }),
          transaction
        });

        if (!product) {
          errors.push({ productId, error: 'Product not found' });
          continue;
        }

        const oldQuantity = parseFloat(product.quantityOnHand) || 0;
        const newQuantity = oldQuantity + parseFloat(adjustment);

        await product.update({ quantityOnHand: newQuantity }, { transaction });
        updated.push({ productId, oldQuantity, newQuantity, adjustment });
      } catch (error) {
        errors.push({ productId: item.productId, error: error.message });
      }
    }

    await transaction.commit();

    res.status(errors.length === 0 ? 200 : 207).json({
      success: errors.length === 0,
      totalProcessed: items.length,
      successCount: updated.length,
      errorCount: errors.length,
      updated,
      errors
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
