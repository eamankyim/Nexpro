const { Op, Sequelize } = require('sequelize');
const {
  MaterialCategory,
  MaterialItem,
  MaterialMovement,
  Vendor,
  Job,
  User
} = require('../models');
const { sequelize } = require('../config/database');
const config = require('../config/config');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');
const { getPagination } = require('../utils/paginationUtils');
const activityLogger = require('../services/activityLogger');

const logMaterialsDebug = (...args) => {
  if (config.nodeEnv === 'development') {
    console.log('[MaterialsController]', ...args);
  }
};

const parseDecimal = (value, defaultValue = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const buildItemInclude = () => ([
  {
    model: MaterialCategory,
    as: 'category',
    attributes: ['id', 'name']
  },
  {
    model: Vendor,
    as: 'preferredVendor',
    attributes: ['id', 'name', 'company', 'email', 'phone']
  }
]);

exports.getMaterialsCategories = async (req, res, next) => {
  try {
    const tenant = req.tenant;
    const { resolveBusinessType } = require('../config/businessTypes');
    const rawBusinessType = tenant?.businessType ?? null;
    const businessType = resolveBusinessType(rawBusinessType);
    const studioType = tenant?.metadata?.studioType || null;
    const shopType = tenant?.metadata?.shopType || null;

    logMaterialsDebug('getInventoryCategories', {
      tenantId: req.tenantId,
      rawBusinessType,
      resolvedBusinessType: businessType,
      studioType,
      shopType,
      why: shopType ? 'tenant has shopType – only type-matched categories should be returned' : (studioType ? 'tenant has studioType' : 'no specific type – legacy (null) + generic categories included')
    });

    const baseWhere = {
      ...applyTenantFilter(req.tenantId, {}),
      isActive: true
    };

    let categories;
    try {
      const whereConditions = [];
      // Legacy (businessType=null) only when tenant has no specific type — otherwise non‑restaurant
      // shops would see old grocery/restaurant categories that were stored with null type.
      const hasSpecificType = (businessType === 'shop' && shopType) || (businessType === 'studio' && studioType) || businessType === 'pharmacy';
      if (!hasSpecificType) {
        whereConditions.push({ ...baseWhere, businessType: null });
      }
      if (businessType === 'studio' && !studioType) {
        whereConditions.push({ ...baseWhere, businessType: 'studio', studioType: null, shopType: null });
      }
      if (businessType === 'shop' && !shopType) {
        whereConditions.push({ ...baseWhere, businessType: 'shop', studioType: null, shopType: null });
      }
      if (businessType === 'pharmacy') {
        whereConditions.push({ ...baseWhere, businessType: 'pharmacy', studioType: null, shopType: null });
      }
      if (businessType === 'studio' && studioType) {
        whereConditions.push({
          ...baseWhere,
          businessType: 'studio',
          studioType,
          shopType: null
        });
      }
      if (businessType === 'shop' && shopType) {
        whereConditions.push({
          ...baseWhere,
          businessType: 'shop',
          shopType,
          studioType: null
        });
      }

      const conditionSummary = whereConditions.map((c) => ({
        businessType: c.businessType ?? 'null',
        studioType: c.studioType ?? 'null',
        shopType: c.shopType ?? 'null'
      }));
      logMaterialsDebug('getInventoryCategories whereConditions', { hasSpecificType, conditionSummary });

      if (whereConditions.length === 0) {
        categories = [];
      } else {
        categories = await MaterialCategory.findAll({
          where: { [Op.or]: whereConditions },
          order: [['name', 'ASC']]
        });
      }

      logMaterialsDebug('getInventoryCategories result', {
        count: categories.length,
        names: categories.map((c) => c.name),
        perCategory: categories.map((c) => ({
          name: c.name,
          businessType: c.businessType ?? 'null',
          studioType: c.studioType ?? 'null',
          shopType: c.shopType ?? 'null'
        }))
      });
    } catch (columnError) {
      logMaterialsDebug('getInventoryCategories columnError (fallback to baseWhere)', columnError?.message);
      categories = await MaterialCategory.findAll({
        where: baseWhere,
        order: [['name', 'ASC']],
        attributes: ['id', 'tenantId', 'name', 'description', 'isActive', 'metadata', 'createdAt', 'updatedAt']
      });
    }
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

exports.createMaterialsCategory = async (req, res, next) => {
  try {
    const { name, description, metadata, businessType, studioType, shopType } = sanitizePayload(req.body || {});
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    const tenant = req.tenant;
    const { resolveBusinessType } = require('../config/businessTypes');
    const finalBusinessType = businessType || (tenant ? resolveBusinessType(tenant.businessType) : null);
    const finalStudioType = studioType ?? (tenant?.metadata?.studioType || null);
    const finalShopType = shopType ?? (tenant?.metadata?.shopType || null);

    if (finalStudioType && finalBusinessType !== 'studio') {
      return res.status(400).json({ success: false, message: 'studioType can only be set when businessType is "studio"' });
    }
    if (finalShopType && finalBusinessType !== 'shop') {
      return res.status(400).json({ success: false, message: 'shopType can only be set when businessType is "shop"' });
    }

    const category = await MaterialCategory.create({
      name,
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

exports.updateMaterialsCategory = async (req, res, next) => {
  try {
    const category = await MaterialCategory.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const { name, description, isActive, metadata } = sanitizePayload(req.body || {});
    if (name !== undefined) category.name = name;
    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = Boolean(isActive);
    if (metadata !== undefined) category.metadata = metadata;
    await category.save();

    res.status(200).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

exports.getMaterialsItems = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = req.query.search;
    const categoryId = req.query.categoryId;
    const status = req.query.status;
    const includeLowStock = req.query.lowStock === 'true';
    const outOfStockOnly = req.query.outOfStock === 'true';

    const where = applyTenantFilter(req.tenantId, {});

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { sku: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }

    if (status === 'active') {
      where.isActive = true;
    } else if (status === 'inactive') {
      where.isActive = false;
    }

    if (outOfStockOnly) {
      where.quantityOnHand = { [Op.lte]: 0 };
    } else if (includeLowStock) {
      where[Op.and] = [
        Sequelize.literal(`"MaterialItem"."quantityOnHand" <= "MaterialItem"."reorderLevel"`)
      ];
    }

    const { count, rows } = await MaterialItem.findAndCountAll({
      where,
      limit,
      offset,
      order: [['name', 'ASC']],
      include: buildItemInclude()
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

// @desc    Export materials items to CSV
// @route   GET /api/materials/items/export
// @access  Private (admin, manager)
exports.exportMaterialsItems = async (req, res, next) => {
  try {
    const { sendCSV, COLUMN_DEFINITIONS } = require('../utils/dataExport');
    const where = applyTenantFilter(req.tenantId, {});

    const items = await MaterialItem.findAll({
      where,
      order: [['name', 'ASC']],
      include: buildItemInclude(),
      raw: false,
    });
    const rows = items.map((item) => {
      const plain = item.get({ plain: true });
      return { ...plain, category: plain.category || {}, preferredVendor: plain.preferredVendor || {} };
    });

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No materials to export' });
    }

    const filename = `materials_${new Date().toISOString().split('T')[0]}`;
    sendCSV(res, rows, `${filename}.csv`, COLUMN_DEFINITIONS.inventory);
  } catch (error) {
    next(error);
  }
};

exports.getMaterialItem = async (req, res, next) => {
  try {
    const item = await MaterialItem.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        ...buildItemInclude(),
        {
          model: MaterialMovement,
          as: 'movements',
          include: [
            { model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] },
            { model: Job, as: 'job', attributes: ['id', 'jobNumber', 'title'] }
          ],
          order: [['occurredAt', 'DESC']]
        }
      ]
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Material item not found' });
    }

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

exports.createMaterialItem = async (req, res, next) => {
  try {
    const {
      name,
      sku,
      description,
      categoryId,
      unit,
      quantityOnHand,
      reorderLevel,
      preferredVendorId,
      unitCost,
      location,
      metadata,
      isActive
    } = sanitizePayload(req.body || {});

    if (!name) {
      return res.status(400).json({ success: false, message: 'Item name is required' });
    }

    let validatedCategoryId = categoryId || null;
    if (validatedCategoryId) {
      const category = await MaterialCategory.findOne({
        where: applyTenantFilter(req.tenantId, { id: validatedCategoryId })
      });
      if (!category) {
        return res.status(400).json({ success: false, message: 'Category not found for this tenant' });
      }
    }

    let validatedVendorId = preferredVendorId || null;
    if (validatedVendorId) {
      const vendor = await Vendor.findOne({
        where: applyTenantFilter(req.tenantId, { id: validatedVendorId })
      });
      if (!vendor) {
        return res.status(400).json({ success: false, message: 'Vendor not found for this tenant' });
      }
    }

    const initialQuantity = parseDecimal(quantityOnHand, 0);
    
    const item = await MaterialItem.create({
      name,
      sku: sku || null,
      description: description || null,
      categoryId: validatedCategoryId,
      unit: unit || 'pcs',
      quantityOnHand: initialQuantity,
      reorderLevel: parseDecimal(reorderLevel, 0),
      preferredVendorId: validatedVendorId,
      unitCost: parseDecimal(unitCost, 0),
      location: location || null,
      metadata: metadata || {},
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      tenantId: req.tenantId
    });

    // Create initial movement record if item was created with quantity
    if (initialQuantity > 0) {
      await MaterialMovement.create({
        itemId: item.id,
        tenantId: req.tenantId,
        type: 'purchase',
        quantityDelta: initialQuantity,
        previousQuantity: 0,
        newQuantity: initialQuantity,
        unitCost: parseDecimal(unitCost, 0),
        reference: 'Item Creation',
        notes: `Item was created with ${initialQuantity} ${unit || 'pcs'} in stock`,
        createdBy: req.user?.id || null,
        occurredAt: item.createdAt
      });
    }

    const createdItem = await MaterialItem.findOne({
      where: applyTenantFilter(req.tenantId, { id: item.id }),
      include: buildItemInclude()
    });

    res.status(201).json({ success: true, data: createdItem });
  } catch (error) {
    next(error);
  }
};

exports.updateMaterialItem = async (req, res, next) => {
  try {
    const item = await MaterialItem.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Material item not found' });
    }

    const payload = sanitizePayload(req.body || {});

    if (payload.categoryId !== undefined && payload.categoryId !== null) {
      const category = await MaterialCategory.findOne({
        where: applyTenantFilter(req.tenantId, { id: payload.categoryId })
      });
      if (!category) {
        return res.status(400).json({ success: false, message: 'Category not found for this tenant' });
      }
    }

    if (payload.preferredVendorId !== undefined && payload.preferredVendorId !== null) {
      const vendor = await Vendor.findOne({
        where: applyTenantFilter(req.tenantId, { id: payload.preferredVendorId })
      });
      if (!vendor) {
        return res.status(400).json({ success: false, message: 'Vendor not found for this tenant' });
      }
    }

    const updates = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.sku !== undefined) updates.sku = payload.sku || null;
    if (payload.description !== undefined) updates.description = payload.description || null;
    if (payload.categoryId !== undefined) updates.categoryId = payload.categoryId || null;
    if (payload.unit !== undefined) updates.unit = payload.unit;
    if (payload.reorderLevel !== undefined) updates.reorderLevel = parseDecimal(payload.reorderLevel, item.reorderLevel);
    if (payload.preferredVendorId !== undefined) updates.preferredVendorId = payload.preferredVendorId || null;
    if (payload.unitCost !== undefined) updates.unitCost = parseDecimal(payload.unitCost, item.unitCost);
    if (payload.location !== undefined) updates.location = payload.location || null;
    if (payload.metadata !== undefined) updates.metadata = payload.metadata;
    if (payload.isActive !== undefined) updates.isActive = Boolean(payload.isActive);

    await item.update(updates);

    const updatedItem = await MaterialItem.findOne({
      where: applyTenantFilter(req.tenantId, { id: item.id }),
      include: buildItemInclude()
    });

    res.status(200).json({ success: true, data: updatedItem });
  } catch (error) {
    next(error);
  }
};

exports.getMaterialsSummary = async (req, res, next) => {
  try {
    const [totals] = await MaterialItem.findAll({
      attributes: [
        [Sequelize.fn('COUNT', Sequelize.col('MaterialItem.id')), 'totalItems'],
        [
          Sequelize.fn('SUM', Sequelize.col('MaterialItem.quantityOnHand')),
          'totalQuantity'
        ],
        [
          Sequelize.fn('SUM', Sequelize.literal('"MaterialItem"."quantityOnHand" * "MaterialItem"."unitCost"')),
          'inventoryValue'
        ],
        [
          Sequelize.fn('SUM', Sequelize.literal(`CASE WHEN "MaterialItem"."quantityOnHand" <= "MaterialItem"."reorderLevel" THEN 1 ELSE 0 END`)),
          'lowStockCount'
        ],
        [
          Sequelize.fn('SUM', Sequelize.literal(`CASE WHEN "MaterialItem"."quantityOnHand" > 0 AND "MaterialItem"."quantityOnHand" > "MaterialItem"."reorderLevel" THEN 1 ELSE 0 END`)),
          'inStockCount'
        ],
        [
          Sequelize.fn('SUM', Sequelize.literal(`CASE WHEN "MaterialItem"."quantityOnHand" <= 0 THEN 1 ELSE 0 END`)),
          'outOfStockCount'
        ]
      ],
      where: applyTenantFilter(req.tenantId, {})
    });

    const categories = await MaterialCategory.findAll({
      attributes: [
        'id',
        'name',
        [Sequelize.fn('COUNT', Sequelize.col('items.id')), 'itemCount']
      ],
      include: [
        {
          model: MaterialItem,
          as: 'items',
          attributes: [],
          where: applyTenantFilter(req.tenantId, {}),
          required: false
        }
      ],
      group: ['MaterialCategory.id'],
      order: [['name', 'ASC']],
      where: applyTenantFilter(req.tenantId, {})
    });

    res.status(200).json({
      success: true,
      data: {
        totals: totals ? totals.toJSON() : {},
        categories
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getMaterialsMovements = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const itemId = req.query.itemId;

    const where = applyTenantFilter(req.tenantId, {});
    if (itemId) {
      const item = await MaterialItem.findOne({
        where: applyTenantFilter(req.tenantId, { id: itemId })
      });
      if (!item) {
        return res.status(404).json({ success: false, message: 'Material item not found' });
      }
      where.itemId = itemId;
    }

    const { count, rows } = await MaterialMovement.findAndCountAll({
      where,
      limit,
      offset,
      order: [['occurredAt', 'DESC']],
      include: [
        {
          model: MaterialItem,
          as: 'item',
          attributes: ['id', 'name', 'sku', 'unit'],
          where: applyTenantFilter(req.tenantId, {}),
          required: false
        },
        { model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] },
        {
          model: Job,
          as: 'job',
          attributes: ['id', 'jobNumber', 'title'],
          where: applyTenantFilter(req.tenantId, {}),
          required: false
        }
      ]
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

const createMovementAndUpdateItem = async ({
  tenantId,
  item,
  quantityDelta,
  type,
  unitCost,
  reference,
  notes,
  jobId,
  userId
}) => {
  const transaction = await sequelize.transaction();
  try {
    const itemForUpdate = await MaterialItem.findOne({
      where: applyTenantFilter(tenantId, { id: item.id }),
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!itemForUpdate) {
      throw new Error('Material item not found');
    }

    const previousQuantity = parseDecimal(itemForUpdate.quantityOnHand);
    const delta = parseDecimal(quantityDelta);
    const newQuantity = previousQuantity + delta;

    if (newQuantity < 0) {
      throw new Error('Resulting quantity cannot be negative');
    }

    itemForUpdate.quantityOnHand = newQuantity;
    await itemForUpdate.save({ transaction });

    const movement = await MaterialMovement.create({
      itemId: itemForUpdate.id,
      tenantId,
      type,
      quantityDelta: delta,
      previousQuantity,
      newQuantity,
      unitCost: unitCost !== undefined ? parseDecimal(unitCost) : itemForUpdate.unitCost,
      reference: reference || null,
      notes: notes || null,
      jobId: jobId || null,
      createdBy: userId || null,
      occurredAt: new Date()
    }, { transaction });

    await transaction.commit();

    return { item: itemForUpdate, movement };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

exports.restockMaterialItem = async (req, res, next) => {
  try {
    const item = await MaterialItem.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Material item not found' });
    }

    const { quantity, unitCost, reference, notes } = sanitizePayload(req.body || {});
    const delta = parseDecimal(quantity);

    if (!Number.isFinite(delta) || delta <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive number' });
    }

    const { item: updatedItem, movement } = await createMovementAndUpdateItem({
      tenantId: req.tenantId,
      item,
      quantityDelta: delta,
      type: 'purchase',
      unitCost: unitCost !== undefined ? unitCost : item.unitCost,
      reference,
      notes,
      userId: req.user?.id
    });

    const refreshedItem = await MaterialItem.findOne({
      where: applyTenantFilter(req.tenantId, { id: updatedItem.id }),
      include: buildItemInclude()
    });

    res.status(200).json({
      success: true,
      message: 'Material restocked successfully',
      data: {
        item: refreshedItem,
        movement
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.adjustMaterialItem = async (req, res, next) => {
  try {
    const item = await MaterialItem.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Material item not found' });
    }

    const { quantityDelta, newQuantity, reason, notes } = sanitizePayload(req.body || {});

    let delta = null;
    if (quantityDelta !== undefined) {
      delta = parseDecimal(quantityDelta);
    } else if (newQuantity !== undefined) {
      const current = parseDecimal(item.quantityOnHand);
      delta = parseDecimal(newQuantity) - current;
    }

    if (delta === null || !Number.isFinite(delta) || delta === 0) {
      return res.status(400).json({ success: false, message: 'A non-zero quantityDelta or newQuantity is required' });
    }

    const { item: updatedItem, movement } = await createMovementAndUpdateItem({
      tenantId: req.tenantId,
      item,
      quantityDelta: delta,
      type: 'adjustment',
      reference: reason || null,
      notes,
      userId: req.user?.id
    });

    const refreshedItem = await MaterialItem.findOne({
      where: applyTenantFilter(req.tenantId, { id: updatedItem.id }),
      include: buildItemInclude()
    });

    const reorderLevel = parseDecimal(updatedItem.reorderLevel);
    if (movement.newQuantity <= reorderLevel && movement.previousQuantity > reorderLevel) {
      try {
        await activityLogger.logLowStock(
          { id: refreshedItem.id, name: refreshedItem.name, quantityOnHand: refreshedItem.quantityOnHand, reorderLevel: refreshedItem.reorderLevel },
          req.tenantId,
          req.user?.id
        );
      } catch (logErr) {
        console.error('[Materials] logLowStock failed:', logErr?.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Material adjustment recorded',
      data: {
        item: refreshedItem,
        movement
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.recordUsageForJob = async (req, res, next) => {
  try {
    const item = await MaterialItem.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Material item not found' });
    }

    const { quantity, jobId, reference, notes } = sanitizePayload(req.body || {});
    const delta = parseDecimal(quantity);

    if (!Number.isFinite(delta) || delta <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive number' });
    }

    const job = jobId
      ? await Job.findOne({
          where: applyTenantFilter(req.tenantId, { id: jobId })
        })
      : null;
    if (jobId && !job) {
      return res.status(404).json({ success: false, message: 'Associated job not found' });
    }

    const { item: updatedItem, movement } = await createMovementAndUpdateItem({
      tenantId: req.tenantId,
      item,
      quantityDelta: delta * -1,
      type: 'usage',
      reference: reference || job?.jobNumber || null,
      notes,
      jobId: jobId || null,
      userId: req.user?.id
    });

    const reorderLevel = parseDecimal(updatedItem.reorderLevel);
    if (movement.newQuantity <= reorderLevel && movement.previousQuantity > reorderLevel) {
      try {
        await activityLogger.logLowStock(
          { id: updatedItem.id, name: updatedItem.name, quantityOnHand: updatedItem.quantityOnHand, reorderLevel: updatedItem.reorderLevel },
          req.tenantId,
          req.user?.id
        );
      } catch (logErr) {
        console.error('[Materials] logLowStock failed:', logErr?.message);
      }
    }

    const refreshedItem = await MaterialItem.findOne({
      where: applyTenantFilter(req.tenantId, { id: updatedItem.id }),
      include: buildItemInclude()
    });

    res.status(200).json({
      success: true,
      message: 'Material usage recorded',
      data: {
        item: refreshedItem,
        movement
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteMaterialItem = async (req, res, next) => {
  try {
    const item = await MaterialItem.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Material item not found' });
    }

    await item.update({ isActive: false });
    res.status(200).json({ success: true, message: 'Material item deactivated' });
  } catch (error) {
    next(error);
  }
};

// @desc    Bulk create materials
// @route   POST /api/materials/items/bulk
// @access  Private (admin, manager)
exports.bulkCreateMaterials = async (req, res, next) => {
  try {
    const { materials } = req.body;
    const { bulkCreate } = require('../utils/bulkOperations');

    if (!Array.isArray(materials) || materials.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide an array of materials'
      });
    }

    const result = await bulkCreate(MaterialItem, materials, {
      tenantId: req.tenantId,
      userId: req.user?.id,
      continueOnError: true,
      maxBatchSize: 100,
    });

    res.status(result.success ? 201 : 207).json({
      success: result.success,
      ...result
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get CSV template for materials bulk import
// @route   GET /api/materials/items/import/template
// @access  Private (admin, manager)
exports.getMaterialsImportTemplate = (req, res) => {
  const { getTemplateCSV } = require('../utils/importParse');
  const csv = getTemplateCSV('materials');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="materials_import_template.csv"');
  res.send(csv);
};

// @desc    Bulk import materials from CSV/Excel
// @route   POST /api/materials/items/import
// @access  Private (admin, manager)
exports.importMaterials = async (req, res, next) => {
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
      'materials'
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
        ? await MaterialCategory.findAll({
            where: applyTenantFilter(req.tenantId, { name: { [Op.in]: categoryNames } }),
            attributes: ['id', 'name'],
            raw: true,
          })
        : [];
    const categoryByName = Object.fromEntries(categories.map((c) => [c.name, c.id]));

    const materials = mapped.map((m) => {
      const rec = {
        name: m.name,
        sku: m.sku || null,
        description: m.description || null,
        categoryId: m.categoryName ? categoryByName[m.categoryName] || null : null,
        unit: (m.unit && String(m.unit).trim()) || 'pcs',
        quantityOnHand: Number(m.quantityOnHand) ?? 0,
        reorderLevel: Number(m.reorderLevel) ?? 0,
        unitCost: Number(m.unitCost) ?? 0,
        location: m.location || null,
        isActive: m.isActive !== false,
      };
      return sanitizePayload(rec);
    });

    const result = await bulkCreate(MaterialItem, materials, {
      tenantId: req.tenantId,
      userId: req.user?.id,
      continueOnError: true,
      maxBatchSize: 100,
    });

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


