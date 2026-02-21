const { Op } = require('sequelize');
const { EquipmentCategory, Equipment, Vendor } = require('../models');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');
const { getPagination } = require('../utils/paginationUtils');

const buildItemInclude = () => [
  {
    model: EquipmentCategory,
    as: 'category',
    attributes: ['id', 'name']
  },
  {
    model: Vendor,
    as: 'vendor',
    attributes: ['id', 'name', 'company', 'email', 'phone']
  }
];

exports.getEquipmentCategories = async (req, res, next) => {
  try {
    const categories = await EquipmentCategory.findAll({
      where: applyTenantFilter(req.tenantId, { isActive: true }),
      order: [['name', 'ASC']]
    });
    res.status(200).json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
};

exports.createEquipmentCategory = async (req, res, next) => {
  try {
    const { name, description, metadata } = sanitizePayload(req.body || {});
    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }
    const category = await EquipmentCategory.create({
      name,
      description: description || null,
      metadata: metadata || {},
      tenantId: req.tenantId
    });
    res.status(201).json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

exports.updateEquipmentCategory = async (req, res, next) => {
  try {
    const category = await EquipmentCategory.findOne({
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

exports.getEquipmentItems = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const search = req.query.search;
    const categoryId = req.query.categoryId;
    const status = req.query.status;

    const where = applyTenantFilter(req.tenantId, {});

    if (search) {
      where[Op.or] = [
        { name: { [Op.iLike]: `%${search}%` } },
        { serialNumber: { [Op.iLike]: `%${search}%` } },
        { description: { [Op.iLike]: `%${search}%` } }
      ];
    }

    if (categoryId && categoryId !== 'all') {
      where.categoryId = categoryId;
    }

    if (status && status !== 'all') {
      where.status = status;
    }

    const { count, rows } = await Equipment.findAndCountAll({
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

exports.getEquipmentItem = async (req, res, next) => {
  try {
    const item = await Equipment.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: buildItemInclude()
    });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Equipment not found' });
    }

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

exports.createEquipmentItem = async (req, res, next) => {
  try {
    const {
      name,
      description,
      categoryId,
      purchaseDate,
      purchaseValue,
      location,
      serialNumber,
      status,
      vendorId,
      notes,
      metadata,
      isActive
    } = sanitizePayload(req.body || {});

    if (!name) {
      return res.status(400).json({ success: false, message: 'Name is required' });
    }

    let validatedCategoryId = categoryId || null;
    if (validatedCategoryId) {
      const category = await EquipmentCategory.findOne({
        where: applyTenantFilter(req.tenantId, { id: validatedCategoryId })
      });
      if (!category) {
        return res.status(400).json({ success: false, message: 'Category not found for this tenant' });
      }
    }

    let validatedVendorId = vendorId || null;
    if (validatedVendorId) {
      const vendor = await Vendor.findOne({
        where: applyTenantFilter(req.tenantId, { id: validatedVendorId })
      });
      if (!vendor) {
        return res.status(400).json({ success: false, message: 'Vendor not found for this tenant' });
      }
    }

    const item = await Equipment.create({
      name,
      description: description || null,
      categoryId: validatedCategoryId,
      purchaseDate: purchaseDate || null,
      purchaseValue: parseFloat(purchaseValue) || 0,
      location: location || null,
      serialNumber: serialNumber || null,
      status: status || 'active',
      vendorId: validatedVendorId,
      notes: notes || null,
      metadata: metadata || {},
      isActive: isActive !== undefined ? Boolean(isActive) : true,
      tenantId: req.tenantId
    });

    const createdItem = await Equipment.findOne({
      where: applyTenantFilter(req.tenantId, { id: item.id }),
      include: buildItemInclude()
    });

    res.status(201).json({ success: true, data: createdItem });
  } catch (error) {
    next(error);
  }
};

exports.updateEquipmentItem = async (req, res, next) => {
  try {
    const item = await Equipment.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Equipment not found' });
    }

    const payload = sanitizePayload(req.body || {});

    if (payload.categoryId !== undefined && payload.categoryId !== null) {
      const category = await EquipmentCategory.findOne({
        where: applyTenantFilter(req.tenantId, { id: payload.categoryId })
      });
      if (!category) {
        return res.status(400).json({ success: false, message: 'Category not found for this tenant' });
      }
    }

    if (payload.vendorId !== undefined && payload.vendorId !== null) {
      const vendor = await Vendor.findOne({
        where: applyTenantFilter(req.tenantId, { id: payload.vendorId })
      });
      if (!vendor) {
        return res.status(400).json({ success: false, message: 'Vendor not found for this tenant' });
      }
    }

    const updates = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.description !== undefined) updates.description = payload.description || null;
    if (payload.categoryId !== undefined) updates.categoryId = payload.categoryId || null;
    if (payload.purchaseDate !== undefined) updates.purchaseDate = payload.purchaseDate || null;
    if (payload.purchaseValue !== undefined) updates.purchaseValue = parseFloat(payload.purchaseValue) ?? 0;
    if (payload.location !== undefined) updates.location = payload.location || null;
    if (payload.serialNumber !== undefined) updates.serialNumber = payload.serialNumber || null;
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.vendorId !== undefined) updates.vendorId = payload.vendorId || null;
    if (payload.notes !== undefined) updates.notes = payload.notes || null;
    if (payload.metadata !== undefined) updates.metadata = payload.metadata;
    if (payload.isActive !== undefined) updates.isActive = Boolean(payload.isActive);

    await item.update(updates);

    const updatedItem = await Equipment.findOne({
      where: applyTenantFilter(req.tenantId, { id: item.id }),
      include: buildItemInclude()
    });

    res.status(200).json({ success: true, data: updatedItem });
  } catch (error) {
    next(error);
  }
};

exports.deleteEquipmentItem = async (req, res, next) => {
  try {
    const item = await Equipment.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Equipment not found' });
    }
    await item.destroy();
    res.status(200).json({ success: true, message: 'Equipment deleted' });
  } catch (error) {
    next(error);
  }
};
