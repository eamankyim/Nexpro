const { Op, Sequelize } = require('sequelize');
const {
  InventoryCategory,
  InventoryItem,
  InventoryMovement,
  Vendor,
  Job,
  User
} = require('../models');
const { sequelize } = require('../config/database');
const config = require('../config/config');

const logInventoryDebug = (...args) => {
  if (config.nodeEnv === 'development') {
    console.log('[InventoryController]', ...args);
  }
};

const parseDecimal = (value, defaultValue = 0) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : defaultValue;
};

const buildItemInclude = () => ([
  {
    model: InventoryCategory,
    as: 'category',
    attributes: ['id', 'name']
  },
  {
    model: Vendor,
    as: 'preferredVendor',
    attributes: ['id', 'name', 'company', 'email', 'phone']
  }
]);

exports.getInventoryCategories = async (req, res, next) => {
  try {
    const categories = await InventoryCategory.findAll({
      order: [['name', 'ASC']]
    });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

exports.createInventoryCategory = async (req, res, next) => {
  try {
    const { name, description, metadata } = req.body;
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    const category = await InventoryCategory.create({
      name,
      description: description || null,
      metadata: metadata || {}
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

exports.updateInventoryCategory = async (req, res, next) => {
  try {
    const category = await InventoryCategory.findByPk(req.params.id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const { name, description, isActive, metadata } = req.body;
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

exports.getInventoryItems = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const search = req.query.search;
    const categoryId = req.query.categoryId;
    const status = req.query.status;
    const includeLowStock = req.query.lowStock === 'true';

    const where = {};

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

    if (includeLowStock) {
      where[Op.and] = [
        Sequelize.literal(`"InventoryItem"."quantityOnHand" <= "InventoryItem"."reorderLevel"`)
      ];
    }

    const { count, rows } = await InventoryItem.findAndCountAll({
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

exports.getInventoryItem = async (req, res, next) => {
  try {
    const item = await InventoryItem.findByPk(req.params.id, {
      include: [
        ...buildItemInclude(),
        {
          model: InventoryMovement,
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
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

exports.createInventoryItem = async (req, res, next) => {
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
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Item name is required' });
    }

    const item = await InventoryItem.create({
      name,
      sku: sku || null,
      description: description || null,
      categoryId: categoryId || null,
      unit: unit || 'pcs',
      quantityOnHand: parseDecimal(quantityOnHand, 0),
      reorderLevel: parseDecimal(reorderLevel, 0),
      preferredVendorId: preferredVendorId || null,
      unitCost: parseDecimal(unitCost, 0),
      location: location || null,
      metadata: metadata || {},
      isActive: isActive !== undefined ? Boolean(isActive) : true
    });

    const createdItem = await InventoryItem.findByPk(item.id, {
      include: buildItemInclude()
    });

    res.status(201).json({ success: true, data: createdItem });
  } catch (error) {
    next(error);
  }
};

exports.updateInventoryItem = async (req, res, next) => {
  try {
    const item = await InventoryItem.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    const {
      name,
      sku,
      description,
      categoryId,
      unit,
      reorderLevel,
      preferredVendorId,
      unitCost,
      location,
      metadata,
      isActive
    } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (sku !== undefined) updates.sku = sku || null;
    if (description !== undefined) updates.description = description || null;
    if (categoryId !== undefined) updates.categoryId = categoryId || null;
    if (unit !== undefined) updates.unit = unit;
    if (reorderLevel !== undefined) updates.reorderLevel = parseDecimal(reorderLevel, item.reorderLevel);
    if (preferredVendorId !== undefined) updates.preferredVendorId = preferredVendorId || null;
    if (unitCost !== undefined) updates.unitCost = parseDecimal(unitCost, item.unitCost);
    if (location !== undefined) updates.location = location || null;
    if (metadata !== undefined) updates.metadata = metadata;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    await item.update(updates);

    const updatedItem = await InventoryItem.findByPk(item.id, {
      include: buildItemInclude()
    });

    res.status(200).json({ success: true, data: updatedItem });
  } catch (error) {
    next(error);
  }
};

exports.getInventorySummary = async (req, res, next) => {
  try {
    const [totals] = await InventoryItem.findAll({
      attributes: [
        [Sequelize.fn('COUNT', Sequelize.col('InventoryItem.id')), 'totalItems'],
        [
          Sequelize.fn('SUM', Sequelize.col('InventoryItem.quantityOnHand')),
          'totalQuantity'
        ],
        [
          Sequelize.fn('SUM', Sequelize.literal('"InventoryItem"."quantityOnHand" * "InventoryItem"."unitCost"')),
          'inventoryValue'
        ],
        [
          Sequelize.fn('SUM', Sequelize.literal(`CASE WHEN "InventoryItem"."quantityOnHand" <= "InventoryItem"."reorderLevel" THEN 1 ELSE 0 END`)),
          'lowStockCount'
        ]
      ]
    });

    const categories = await InventoryCategory.findAll({
      attributes: [
        'id',
        'name',
        [Sequelize.fn('COUNT', Sequelize.col('items.id')), 'itemCount']
      ],
      include: [
        {
          model: InventoryItem,
          as: 'items',
          attributes: []
        }
      ],
      group: ['InventoryCategory.id'],
      order: [['name', 'ASC']]
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

exports.getInventoryMovements = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const itemId = req.query.itemId;

    const where = {};
    if (itemId) {
      where.itemId = itemId;
    }

    const { count, rows } = await InventoryMovement.findAndCountAll({
      where,
      limit,
      offset,
      order: [['occurredAt', 'DESC']],
      include: [
        { model: InventoryItem, as: 'item', attributes: ['id', 'name', 'sku', 'unit'] },
        { model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] },
        { model: Job, as: 'job', attributes: ['id', 'jobNumber', 'title'] }
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
    const itemForUpdate = await InventoryItem.findByPk(item.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!itemForUpdate) {
      throw new Error('Inventory item not found');
    }

    const previousQuantity = parseDecimal(itemForUpdate.quantityOnHand);
    const delta = parseDecimal(quantityDelta);
    const newQuantity = previousQuantity + delta;

    if (newQuantity < 0) {
      throw new Error('Resulting quantity cannot be negative');
    }

    itemForUpdate.quantityOnHand = newQuantity;
    await itemForUpdate.save({ transaction });

    const movement = await InventoryMovement.create({
      itemId: itemForUpdate.id,
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

exports.restockInventoryItem = async (req, res, next) => {
  try {
    const item = await InventoryItem.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    const { quantity, unitCost, reference, notes } = req.body;
    const delta = parseDecimal(quantity);

    if (!Number.isFinite(delta) || delta <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive number' });
    }

    const { item: updatedItem, movement } = await createMovementAndUpdateItem({
      item,
      quantityDelta: delta,
      type: 'purchase',
      unitCost: unitCost !== undefined ? unitCost : item.unitCost,
      reference,
      notes,
      userId: req.user?.id
    });

    const refreshedItem = await InventoryItem.findByPk(updatedItem.id, {
      include: buildItemInclude()
    });

    res.status(200).json({
      success: true,
      message: 'Inventory restocked successfully',
      data: {
        item: refreshedItem,
        movement
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.adjustInventoryItem = async (req, res, next) => {
  try {
    const item = await InventoryItem.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    const { quantityDelta, newQuantity, reason, notes } = req.body;

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
      item,
      quantityDelta: delta,
      type: 'adjustment',
      reference: reason || null,
      notes,
      userId: req.user?.id
    });

    const refreshedItem = await InventoryItem.findByPk(updatedItem.id, {
      include: buildItemInclude()
    });

    res.status(200).json({
      success: true,
      message: 'Inventory adjustment recorded',
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
    const item = await InventoryItem.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    const { quantity, jobId, reference, notes } = req.body;
    const delta = parseDecimal(quantity);

    if (!Number.isFinite(delta) || delta <= 0) {
      return res.status(400).json({ success: false, message: 'Quantity must be a positive number' });
    }

    const job = jobId ? await Job.findByPk(jobId) : null;
    if (jobId && !job) {
      return res.status(404).json({ success: false, message: 'Associated job not found' });
    }

    const { item: updatedItem, movement } = await createMovementAndUpdateItem({
      item,
      quantityDelta: delta * -1,
      type: 'usage',
      reference: reference || job?.jobNumber || null,
      notes,
      jobId: jobId || null,
      userId: req.user?.id
    });

    const refreshedItem = await InventoryItem.findByPk(updatedItem.id, {
      include: buildItemInclude()
    });

    res.status(200).json({
      success: true,
      message: 'Inventory usage recorded',
      data: {
        item: refreshedItem,
        movement
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.deleteInventoryItem = async (req, res, next) => {
  try {
    const item = await InventoryItem.findByPk(req.params.id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    await item.update({ isActive: false });
    res.status(200).json({ success: true, message: 'Inventory item deactivated' });
  } catch (error) {
    next(error);
  }
};


