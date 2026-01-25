const { Sale, SaleItem, Product, ProductVariant, Customer, Shop, Invoice, User } = require('../models');
const { Op } = require('sequelize');
const config = require('../config/config');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');
const { sequelize } = require('../config/database');
const crypto = require('crypto');

// Generate unique sale number
const generateSaleNumber = async (tenantId) => {
  const prefix = 'SALE';
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Get count of sales today
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const endOfDay = new Date(today.setHours(23, 59, 59, 999));
  
  const count = await Sale.count({
    where: {
      tenantId,
      createdAt: {
        [Op.between]: [startOfDay, endOfDay]
      }
    }
  });
  
  const sequence = String(count + 1).padStart(4, '0');
  return `${prefix}-${dateStr}-${sequence}`;
};

// Generate invoice number
const generateInvoiceNumber = async (tenantId) => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');

  const lastInvoice = await Invoice.findOne({
    where: {
      tenantId,
      invoiceNumber: {
        [Op.like]: `INV-${year}${month}%`
      }
    },
    order: [['createdAt', 'DESC']]
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoiceNumber.split('-').pop());
    sequence = lastSequence + 1;
  }

  return `INV-${year}${month}-${String(sequence).padStart(4, '0')}`;
};

// @desc    Get all sales
// @route   GET /api/sales
// @access  Private
exports.getSales = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || config.pagination.defaultPageSize;
    const offset = (page - 1) * limit;
    const shopId = req.query.shopId;
    const status = req.query.status;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const where = applyTenantFilter(req.tenantId, {});
    if (shopId) {
      where.shopId = shopId;
    }
    if (status) {
      where.status = status;
    }
    if (startDate && endDate) {
      where.createdAt = {
        [Op.between]: [new Date(startDate), new Date(endDate)]
      };
    }

    const { count, rows } = await Sale.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: Shop, as: 'shop', attributes: ['id', 'name'] },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
        { model: User, as: 'seller', attributes: ['id', 'name'] }
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

// @desc    Get single sale
// @route   GET /api/sales/:id
// @access  Private
exports.getSale = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        { model: Shop, as: 'shop' },
        { model: Customer, as: 'customer' },
        { model: User, as: 'seller' },
        { model: Invoice, as: 'invoice' },
        {
          model: SaleItem,
          as: 'items',
          include: [
            { model: Product, as: 'product' },
            { model: ProductVariant, as: 'variant' }
          ]
        }
      ]
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Create new sale (POS transaction)
// @route   POST /api/sales
// @access  Private
exports.createSale = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { items, ...saleData } = sanitizePayload(req.body);
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Sale must have at least one item'
      });
    }

    // Generate sale number
    const saleNumber = await generateSaleNumber(req.tenantId);

    // Calculate totals
    let subtotal = 0;
    let totalDiscount = 0;
    let totalTax = 0;

    items.forEach(item => {
      const itemSubtotal = (item.quantity || 0) * (item.unitPrice || 0);
      subtotal += itemSubtotal;
      totalDiscount += item.discount || 0;
      totalTax += item.tax || 0;
    });

    const total = subtotal - totalDiscount + totalTax;
    const amountPaid = saleData.amountPaid || total;
    const change = amountPaid > total ? amountPaid - total : 0;

    // Create sale
    const sale = await Sale.create({
      ...saleData,
      tenantId: req.tenantId,
      saleNumber,
      subtotal,
      discount: totalDiscount,
      tax: totalTax,
      total,
      amountPaid,
      change,
      soldBy: req.user.id,
      status: 'completed'
    }, { transaction });

    // Create sale items and update product stock
    for (const item of items) {
      await SaleItem.create({
        saleId: sale.id,
        productId: item.productId,
        productVariantId: item.productVariantId || null,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        tax: item.tax || 0,
        subtotal: (item.quantity || 0) * (item.unitPrice || 0),
        total: ((item.quantity || 0) * (item.unitPrice || 0)) - (item.discount || 0) + (item.tax || 0)
      }, { transaction });

      // Update product stock
      const product = await Product.findByPk(item.productId, { transaction });
      if (product) {
        const newQuantity = parseFloat(product.quantityOnHand || 0) - parseFloat(item.quantity || 0);
        await product.update({ quantityOnHand: Math.max(0, newQuantity) }, { transaction });
      }

      // Update variant stock if applicable
      if (item.productVariantId) {
        const variant = await ProductVariant.findByPk(item.productVariantId, { transaction });
        if (variant) {
          const newVariantQuantity = parseFloat(variant.quantityOnHand || 0) - parseFloat(item.quantity || 0);
          await variant.update({ quantityOnHand: Math.max(0, newVariantQuantity) }, { transaction });
        }
      }
    }

    await transaction.commit();

    // Fetch sale with relations
    const createdSale = await Sale.findByPk(sale.id, {
      include: [
        { model: Shop, as: 'shop' },
        { model: Customer, as: 'customer' },
        { model: User, as: 'seller' },
        {
          model: SaleItem,
          as: 'items',
          include: [
            { model: Product, as: 'product' },
            { model: ProductVariant, as: 'variant' }
          ]
        }
      ]
    });

    res.status(201).json({
      success: true,
      data: createdSale
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Update sale
// @route   PUT /api/sales/:id
// @access  Private
exports.updateSale = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Only allow updating certain fields (status, notes, etc.)
    const allowedFields = ['status', 'notes', 'metadata'];
    const payload = sanitizePayload(req.body);
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (payload[field] !== undefined) {
        updateData[field] = payload[field];
      }
    });

    await sale.update(updateData);

    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel/Refund sale
// @route   POST /api/sales/:id/cancel
// @access  Private
exports.cancelSale = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const sale = await Sale.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [{ model: SaleItem, as: 'items' }]
    }, { transaction });

    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    if (sale.status === 'cancelled' || sale.status === 'refunded') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Sale is already cancelled or refunded'
      });
    }

    // Restore product stock
    for (const item of sale.items) {
      const product = await Product.findByPk(item.productId, { transaction });
      if (product) {
        const newQuantity = parseFloat(product.quantityOnHand || 0) + parseFloat(item.quantity);
        await product.update({ quantityOnHand: newQuantity }, { transaction });
      }

      if (item.productVariantId) {
        const variant = await ProductVariant.findByPk(item.productVariantId, { transaction });
        if (variant) {
          const newVariantQuantity = parseFloat(variant.quantityOnHand || 0) + parseFloat(item.quantity);
          await variant.update({ quantityOnHand: newVariantQuantity }, { transaction });
        }
      }
    }

    // Update sale status
    await sale.update({ status: 'cancelled' }, { transaction });

    await transaction.commit();

    res.status(200).json({
      success: true,
      data: sale,
      message: 'Sale cancelled and stock restored'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Generate invoice from sale
// @route   POST /api/sales/:id/generate-invoice
// @access  Private
exports.generateInvoice = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        { model: SaleItem, as: 'items' },
        { model: Customer, as: 'customer' },
        { model: Shop, as: 'shop' }
      ]
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Check if sale is already paid
    if (sale.status === 'completed' && sale.amountPaid >= sale.total) {
      return res.status(400).json({
        success: false,
        message: 'Cannot generate invoice for an already paid sale'
      });
    }

    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { saleId: sale.id })
    });

    if (existingInvoice) {
      return res.status(400).json({
        success: false,
        message: 'Invoice already exists for this sale',
        data: existingInvoice
      });
    }

    const invoiceNumber = await generateInvoiceNumber(req.tenantId);
    const items = sale.items.map(item => ({
      description: item.name || item.product?.name || 'Product',
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      total: item.total || (item.quantity * item.unitPrice)
    }));

    const balance = sale.total - (sale.amountPaid || 0);
    const invoiceStatus = balance <= 0 ? 'paid' : (sale.amountPaid > 0 ? 'partial' : 'sent');

    const invoice = await Invoice.create({
      invoiceNumber,
      tenantId: req.tenantId,
      customerId: sale.customerId,
      saleId: sale.id,
      sourceType: 'sale',
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days default
      subtotal: sale.subtotal || sale.total,
      totalAmount: sale.total,
      amountPaid: sale.amountPaid || 0,
      balance: balance,
      status: invoiceStatus,
      items,
      notes: `Invoice for Sale ${sale.saleNumber || sale.id}`,
      paymentToken: crypto.randomBytes(32).toString('hex')
    });

    const updatedInvoice = await Invoice.findOne({
      where: applyTenantFilter(req.tenantId, { id: invoice.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: Sale, as: 'sale' }
      ]
    });

    res.status(201).json({
      success: true,
      message: 'Invoice generated successfully',
      data: updatedInvoice
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get sale receipt data for printing
// @route   GET /api/sales/:id/receipt
// @access  Private
exports.printReceipt = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        {
          model: SaleItem,
          as: 'items',
          include: [
            { model: Product, as: 'product' },
            { model: ProductVariant, as: 'variant' }
          ]
        },
        { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone', 'email'] },
        { model: Shop, as: 'shop', attributes: ['id', 'name', 'address', 'phone', 'email'] },
        { model: User, as: 'seller', attributes: ['id', 'name'] }
      ]
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    res.status(200).json({
      success: true,
      data: sale
    });
  } catch (error) {
    next(error);
  }
};
