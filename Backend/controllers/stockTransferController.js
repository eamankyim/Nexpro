const { Op } = require('sequelize');
const {
  StockTransfer,
  Shop,
  Product,
  ProductVariant,
} = require('../models');
const { sequelize } = require('../config/database');
const { applyTenantFilter } = require('../utils/tenantUtils');
const { getPagination } = require('../utils/paginationUtils');
const { userCanAccessShopId } = require('../utils/shopUtils');
const { invalidateProductListCache } = require('../middleware/cache');

const parseQuantity = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : NaN;
};

const includeGraph = [
  { model: Shop, as: 'sourceShop', attributes: ['id', 'name'] },
  { model: Shop, as: 'destinationShop', attributes: ['id', 'name'] },
  { model: Product, as: 'sourceProduct', attributes: ['id', 'name', 'sku', 'barcode', 'unit'] },
  { model: Product, as: 'destinationProduct', attributes: ['id', 'name', 'sku', 'barcode', 'unit'] },
  { model: ProductVariant, as: 'sourceVariant', attributes: ['id', 'name', 'sku', 'barcode'] },
  { model: ProductVariant, as: 'destinationVariant', attributes: ['id', 'name', 'sku', 'barcode'] },
];

const ensureShopAccess = (req, sourceShopId, destinationShopId) => {
  if (!userCanAccessShopId(req, sourceShopId) || !userCanAccessShopId(req, destinationShopId)) {
    const error = new Error('You do not have access to one or both selected shops');
    error.statusCode = 403;
    throw error;
  }
};

const validateShops = async ({ req, sourceShopId, destinationShopId, transaction }) => {
  if (!sourceShopId || !destinationShopId) {
    const error = new Error('Source shop and destination shop are required');
    error.statusCode = 400;
    throw error;
  }
  if (sourceShopId === destinationShopId) {
    const error = new Error('Source and destination shops must be different');
    error.statusCode = 400;
    throw error;
  }

  ensureShopAccess(req, sourceShopId, destinationShopId);

  const [sourceShop, destinationShop] = await Promise.all([
    Shop.findOne({ where: applyTenantFilter(req.tenantId, { id: sourceShopId, isActive: true }), transaction }),
    Shop.findOne({ where: applyTenantFilter(req.tenantId, { id: destinationShopId, isActive: true }), transaction }),
  ]);
  if (!sourceShop || !destinationShop) {
    const error = new Error('Source or destination shop not found');
    error.statusCode = 404;
    throw error;
  }

  return { sourceShop, destinationShop };
};

const findDestinationProduct = async ({ sourceProduct, destinationShopId, tenantId, transaction }) => {
  const sourceMetadata = sourceProduct.metadata || {};
  const lookup = {
    shopId: destinationShopId,
    isActive: true,
  };

  const fromMetadata = await Product.findOne({
    where: applyTenantFilter(tenantId, {
      ...lookup,
      metadata: {
        transferSourceProductId: sourceProduct.id,
      },
    }),
    transaction,
  });
  if (fromMetadata) return fromMetadata;

  if (sourceProduct.barcode) {
    const byBarcode = await Product.findOne({
      where: applyTenantFilter(tenantId, {
        ...lookup,
        barcode: sourceProduct.barcode,
      }),
      transaction,
    });
    if (byBarcode) return byBarcode;
  }

  const byName = await Product.findOne({
    where: applyTenantFilter(tenantId, {
      ...lookup,
      name: sourceProduct.name,
      categoryId: sourceProduct.categoryId || null,
      unit: sourceProduct.unit,
    }),
    transaction,
  });
  if (byName) return byName;

  return Product.create({
    tenantId,
    shopId: destinationShopId,
    name: sourceProduct.name,
    sku: null,
    barcode: sourceProduct.barcode || null,
    description: sourceProduct.description,
    categoryId: sourceProduct.categoryId,
    costPrice: sourceProduct.costPrice,
    sellingPrice: sourceProduct.sellingPrice,
    quantityOnHand: 0,
    reorderLevel: sourceProduct.reorderLevel,
    reorderQuantity: sourceProduct.reorderQuantity,
    unit: sourceProduct.unit || 'pcs',
    brand: sourceProduct.brand,
    supplier: sourceProduct.supplier,
    hasVariants: sourceProduct.hasVariants,
    isActive: sourceProduct.isActive,
    trackStock: sourceProduct.trackStock,
    imageUrl: sourceProduct.imageUrl || null,
    metadata: {
      ...sourceMetadata,
      transferSourceProductId: sourceProduct.id,
      createdByStockTransfer: true,
    },
  }, { transaction });
};

const findDestinationVariant = async ({
  sourceVariant,
  destinationProductId,
  tenantId,
  transaction,
}) => {
  const byMeta = await ProductVariant.findOne({
    where: {
      productId: destinationProductId,
      metadata: { transferSourceVariantId: sourceVariant.id },
    },
    include: [{ model: Product, as: 'product', where: applyTenantFilter(tenantId, {}), attributes: [] }],
    transaction,
  });
  if (byMeta) return byMeta;

  const byName = await ProductVariant.findOne({
    where: {
      productId: destinationProductId,
      name: sourceVariant.name,
    },
    transaction,
  });
  if (byName) return byName;

  return ProductVariant.create({
    productId: destinationProductId,
    name: sourceVariant.name,
    sku: sourceVariant.sku || null,
    barcode: sourceVariant.barcode || null,
    costPrice: sourceVariant.costPrice,
    sellingPrice: sourceVariant.sellingPrice,
    quantityOnHand: 0,
    attributes: sourceVariant.attributes || {},
    isActive: sourceVariant.isActive,
    trackStock: sourceVariant.trackStock,
    metadata: {
      ...(sourceVariant.metadata || {}),
      transferSourceVariantId: sourceVariant.id,
      createdByStockTransfer: true,
    },
  }, { transaction });
};

const createTransferRecord = async ({
  req,
  sourceShopId,
  destinationShopId,
  sourceProduct,
  destinationProduct,
  sourceVariant,
  destinationVariant,
  transferQty,
  sourceBefore,
  sourceAfter,
  destinationBefore,
  destinationAfter,
  reason,
  notes,
  transaction,
  metadata = {},
}) => {
  return StockTransfer.create({
    tenantId: req.tenantId,
    sourceShopId,
    destinationShopId,
    sourceProductId: sourceProduct.id,
    destinationProductId: destinationProduct.id,
    sourceVariantId: sourceVariant?.id || null,
    destinationVariantId: destinationVariant?.id || null,
    quantity: transferQty,
    unit: sourceProduct.unit || 'pcs',
    status: 'completed',
    sourceBeforeQuantity: sourceBefore,
    sourceAfterQuantity: sourceAfter,
    destinationBeforeQuantity: destinationBefore,
    destinationAfterQuantity: destinationAfter,
    reason: reason || null,
    notes: notes || null,
    createdBy: req.user?.id || null,
    metadata: {
      autoCreatedDestinationProduct: destinationProduct.sku === null,
      sourceProductName: sourceProduct.name,
      ...metadata,
    },
  }, { transaction });
};

const transferProductStock = async ({
  req,
  sourceShopId,
  destinationShopId,
  sourceProduct,
  sourceVariantId = null,
  requestedQuantity,
  reason = '',
  notes = '',
  allowPartial = false,
  transaction,
}) => {
  if (!sourceProduct || sourceProduct.trackStock === false || sourceProduct.isActive === false) {
    return { skipped: true, reason: 'Product is inactive or does not track stock' };
  }

  const destinationProduct = await findDestinationProduct({
    sourceProduct,
    destinationShopId,
    tenantId: req.tenantId,
    transaction,
  });

  let sourceTrackable = sourceProduct;
  let destinationTrackable = destinationProduct;
  let destinationVariant = null;
  let sourceVariant = null;

  if (sourceVariantId) {
    sourceVariant = await ProductVariant.findOne({
      where: {
        id: sourceVariantId,
        productId: sourceProduct.id,
      },
      transaction,
    });
    if (!sourceVariant) {
      return { skipped: true, reason: 'Source variant not found for source product' };
    }
    if (sourceVariant.trackStock === false || sourceVariant.isActive === false) {
      return { skipped: true, reason: 'Source variant is inactive or does not track stock' };
    }

    destinationVariant = await findDestinationVariant({
      sourceVariant,
      destinationProductId: destinationProduct.id,
      tenantId: req.tenantId,
      transaction,
    });

    sourceTrackable = sourceVariant;
    destinationTrackable = destinationVariant;
  }

  const sourceBefore = parseQuantity(sourceTrackable.quantityOnHand);
  const destinationBefore = parseQuantity(destinationTrackable.quantityOnHand);
  if (!Number.isFinite(sourceBefore) || sourceBefore <= 0) {
    return { skipped: true, reason: 'No stock available in source location' };
  }

  const quantityToTransfer = allowPartial
    ? Math.min(requestedQuantity, sourceBefore)
    : requestedQuantity;

  if (!Number.isFinite(quantityToTransfer) || quantityToTransfer <= 0) {
    return { skipped: true, reason: 'Invalid transfer quantity' };
  }

  if (!allowPartial && sourceBefore < quantityToTransfer) {
    return { skipped: true, reason: 'Insufficient stock in source location' };
  }

  const sourceAfter = sourceBefore - quantityToTransfer;
  const safeDestinationBefore = Number.isFinite(destinationBefore) ? destinationBefore : 0;
  const destinationAfter = safeDestinationBefore + quantityToTransfer;

  await sourceTrackable.update({ quantityOnHand: sourceAfter }, { transaction });
  await destinationTrackable.update({ quantityOnHand: destinationAfter }, { transaction });

  const created = await createTransferRecord({
    req,
    sourceShopId,
    destinationShopId,
    sourceProduct,
    destinationProduct,
    sourceVariant,
    destinationVariant,
    transferQty: quantityToTransfer,
    sourceBefore,
    sourceAfter,
    destinationBefore: safeDestinationBefore,
    destinationAfter,
    reason,
    notes,
    transaction,
    metadata: {
      partialQuantityApplied: quantityToTransfer < requestedQuantity,
      requestedQuantity,
    },
  });

  return {
    skipped: false,
    created,
    quantityTransferred: quantityToTransfer,
    sourceBefore,
    sourceAfter,
  };
};

exports.getStockTransfers = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req, { defaultPageSize: 20 });
    const { shopId, productId } = req.query;

    const where = applyTenantFilter(req.tenantId, {});

    if (shopId) {
      where[Op.or] = [{ sourceShopId: shopId }, { destinationShopId: shopId }];
    } else if (req.shopScoped && req.allowedShopIds?.length) {
      where[Op.or] = [
        { sourceShopId: { [Op.in]: req.allowedShopIds } },
        { destinationShopId: { [Op.in]: req.allowedShopIds } },
      ];
    }

    if (productId) {
      where[Op.and] = [
        ...(Array.isArray(where[Op.and]) ? where[Op.and] : []),
        { [Op.or]: [{ sourceProductId: productId }, { destinationProductId: productId }] },
      ];
    }

    const { count, rows } = await StockTransfer.findAndCountAll({
      where,
      include: includeGraph,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.status(200).json({
      success: true,
      count,
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

exports.createStockTransfer = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      sourceShopId,
      destinationShopId,
      sourceProductId,
      sourceVariantId = null,
      quantity,
      reason = '',
      notes = '',
    } = req.body || {};

    if (!sourceProductId) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Source product is required' });
    }

    const transferQty = parseQuantity(quantity);
    if (!Number.isFinite(transferQty) || transferQty <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Transfer quantity must be greater than zero' });
    }

    await validateShops({ req, sourceShopId, destinationShopId, transaction });

    const sourceProduct = await Product.findOne({
      where: applyTenantFilter(req.tenantId, {
        id: sourceProductId,
        shopId: sourceShopId,
      }),
      transaction,
    });
    if (!sourceProduct) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Source product not found in selected source shop' });
    }

    const transferResult = await transferProductStock({
      req,
      sourceShopId,
      destinationShopId,
      sourceProduct,
      sourceVariantId,
      requestedQuantity: transferQty,
      reason,
      notes,
      allowPartial: false,
      transaction,
    });

    if (transferResult.skipped) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: transferResult.reason });
    }

    await transaction.commit();
    invalidateProductListCache(req.tenantId);

    const transfer = await StockTransfer.findByPk(transferResult.created.id, {
      include: includeGraph,
    });

    res.status(201).json({ success: true, data: transfer });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

exports.createBulkStockTransfer = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      sourceShopId,
      destinationShopId,
      quantity,
      mode = 'selected',
      productIds = [],
      reason = '',
      notes = '',
    } = req.body || {};

    const transferQty = parseQuantity(quantity);
    if (!Number.isFinite(transferQty) || transferQty <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Transfer quantity must be greater than zero' });
    }

    if (!['selected', 'all'].includes(mode)) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Invalid bulk transfer mode' });
    }

    await validateShops({ req, sourceShopId, destinationShopId, transaction });

    let sourceProducts = [];
    if (mode === 'selected') {
      const uniqueIds = [...new Set((Array.isArray(productIds) ? productIds : []).filter(Boolean))];
      if (!uniqueIds.length) {
        await transaction.rollback();
        return res.status(400).json({ success: false, message: 'Select at least one product for bulk transfer' });
      }
      sourceProducts = await Product.findAll({
        where: applyTenantFilter(req.tenantId, {
          shopId: sourceShopId,
          id: { [Op.in]: uniqueIds },
        }),
        transaction,
      });
    } else {
      sourceProducts = await Product.findAll({
        where: applyTenantFilter(req.tenantId, {
          shopId: sourceShopId,
          isActive: true,
          trackStock: { [Op.ne]: false },
          quantityOnHand: { [Op.gt]: 0 },
        }),
        transaction,
      });
    }

    if (!sourceProducts.length) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'No eligible products found for transfer' });
    }

    const createdIds = [];
    const skipped = [];
    let totalQuantityTransferred = 0;

    for (const sourceProduct of sourceProducts) {
      const result = await transferProductStock({
        req,
        sourceShopId,
        destinationShopId,
        sourceProduct,
        requestedQuantity: transferQty,
        reason,
        notes,
        allowPartial: true,
        transaction,
      });

      if (result.skipped) {
        skipped.push({ productId: sourceProduct.id, productName: sourceProduct.name, reason: result.reason });
        continue;
      }

      createdIds.push(result.created.id);
      totalQuantityTransferred += result.quantityTransferred;
    }

    await transaction.commit();
    invalidateProductListCache(req.tenantId);

    const transfers = createdIds.length
      ? await StockTransfer.findAll({
          where: applyTenantFilter(req.tenantId, { id: { [Op.in]: createdIds } }),
          include: includeGraph,
          order: [['createdAt', 'DESC']],
        })
      : [];

    res.status(200).json({
      success: true,
      data: {
        mode,
        requestedQuantity: transferQty,
        processedCount: sourceProducts.length,
        transferredCount: createdIds.length,
        skippedCount: skipped.length,
        totalQuantityTransferred,
        transfers,
        skipped,
      },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};
