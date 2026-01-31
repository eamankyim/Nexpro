const { Sale, SaleItem, Product, ProductVariant, Customer, Shop, Invoice, User, SaleActivity } = require('../models');
const { Op } = require('sequelize');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');
const { getPagination } = require('../utils/paginationUtils');
const { invalidateSaleListCache } = require('../middleware/cache');
const { sequelize } = require('../config/database');
const crypto = require('crypto');
const { emitNewSale, emitSaleStatusChange, emitInventoryAlert } = require('../services/websocketService');

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

// Helper function to automatically create invoice for credit sales
const autoCreateInvoiceFromSale = async (saleId, tenantId) => {
  try {
    console.log(`[AutoInvoice] Starting invoice creation for saleId: ${saleId}, tenantId: ${tenantId}`);
    
    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({
      where: { saleId, tenantId }
    });
    
    if (existingInvoice) {
      console.log(`[AutoInvoice] Invoice already exists for sale ${saleId}, skipping creation`);
      return existingInvoice;
    }

    // Fetch sale with relations
    const sale = await Sale.findByPk(saleId, {
      include: [
        { model: Customer, as: 'customer' },
        {
          model: SaleItem,
          as: 'items'
        }
      ]
    });

    if (!sale) {
      console.log(`[AutoInvoice] Sale ${saleId} not found, cannot create invoice`);
      return null;
    }

    // Only create invoice for credit sales
    if (sale.paymentMethod !== 'credit') {
      console.log(`[AutoInvoice] Sale ${saleId} payment method is ${sale.paymentMethod}, skipping invoice creation`);
      return null;
    }

    console.log(`[AutoInvoice] Sale found: ${sale.saleNumber}, items: ${sale.items?.length || 0}, total: ${sale.total}`);

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(tenantId);

    // Build invoice items from sale items
    let subtotal = 0;
    let items = [];

    if (sale.items && sale.items.length > 0) {
      items = sale.items.map(item => {
        const itemSubtotal = parseFloat(item.quantity || 0) * parseFloat(item.unitPrice || 0);
        const itemDiscount = parseFloat(item.discount || 0);
        return {
          description: item.name || 'Sale item',
          category: 'Sale',
          quantity: item.quantity,
          unitPrice: parseFloat(item.unitPrice),
          discountAmount: itemDiscount,
          discountPercent: 0,
          discountReason: null,
          total: itemSubtotal - itemDiscount
        };
      });
      subtotal = items.reduce((sum, item) => sum + (parseFloat(item.quantity) * parseFloat(item.unitPrice)), 0);
      
      // Calculate total discount from all items
      const totalItemDiscount = items.reduce((sum, item) => sum + parseFloat(item.discountAmount || 0), 0);
      
      if (totalItemDiscount > 0) {
        const invoice = await Invoice.create({
          invoiceNumber,
          saleId,
          customerId: sale.customerId,
          tenantId,
          sourceType: 'sale',
          invoiceDate: new Date(),
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          subtotal,
          taxRate: parseFloat(sale.tax || 0) / subtotal * 100 || 0,
          discountType: 'fixed',
          discountValue: totalItemDiscount,
          discountAmount: totalItemDiscount,
          discountReason: 'Sale discounts applied',
          paymentTerms: 'Net 30',
          items,
          notes: `Invoice generated from sale ${sale.saleNumber}`,
          termsAndConditions: 'Payment is due within the specified payment terms. Late payments may incur additional charges.'
        });

        // Update sale with invoiceId
        await sale.update({ invoiceId: invoice.id });

        console.log(`[AutoInvoice] ✅ Invoice created successfully: ${invoice.invoiceNumber} (ID: ${invoice.id})`);
        return invoice;
      }
    }

    // Create invoice without discounts or with sale-level discount
    const totalDiscount = parseFloat(sale.discount || 0);
    const invoice = await Invoice.create({
      invoiceNumber,
      saleId,
      customerId: sale.customerId,
      tenantId,
      sourceType: 'sale',
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: subtotal || parseFloat(sale.subtotal || 0),
      taxRate: parseFloat(sale.tax || 0) / (subtotal || parseFloat(sale.subtotal || 0)) * 100 || 0,
      discountType: 'fixed',
      discountValue: totalDiscount,
      discountAmount: totalDiscount,
      discountReason: sale.notes || null,
      paymentTerms: 'Net 30',
      items: items.length > 0 ? items : [{
        description: `Sale ${sale.saleNumber}`,
        quantity: 1,
        unitPrice: parseFloat(sale.total || 0),
        total: parseFloat(sale.total || 0)
      }],
      notes: `Invoice generated from sale ${sale.saleNumber}`,
      termsAndConditions: 'Payment is due within the specified payment terms. Late payments may incur additional charges.'
    });

    // Update sale with invoiceId
    await sale.update({ invoiceId: invoice.id });

    console.log(`[AutoInvoice] ✅ Invoice created successfully: ${invoice.invoiceNumber} (ID: ${invoice.id})`);
    return invoice;
  } catch (error) {
    console.error('Error auto-creating invoice from sale:', error);
    return null;
  }
};

// @desc    Get all sales
// @route   GET /api/sales
// @access  Private
exports.getSales = async (req, res, next) => {
  try {
    const { page, limit, offset } = getPagination(req);
    const shopId = req.query.shopId;
    const status = req.query.status;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const where = applyTenantFilter(req.tenantId, {});
    // Staff see only sales they created (soldBy); admin/manager see all
    const effectiveRole = (req.tenantRole && ['owner', 'admin'].includes(req.tenantRole)) ? 'admin' : req.user?.role;
    if (effectiveRole === 'staff') {
      where.soldBy = req.user.id;
    }
    if (shopId) {
      where.shopId = shopId;
    }
    if (status) {
      where.status = status;
    }
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      where.createdAt = {
        [Op.between]: [start, end]
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

    // Staff may only view sales they created
    const effectiveRole = (req.tenantRole && ['owner', 'admin'].includes(req.tenantRole)) ? 'admin' : req.user?.role;
    if (effectiveRole === 'staff' && sale.soldBy !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view this sale'
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

    // Create activity for sale creation
    await SaleActivity.create({
      saleId: sale.id,
      tenantId: req.tenantId,
      type: 'note',
      subject: 'Sale Created',
      notes: `Sale ${saleNumber} created`,
      createdBy: req.user?.id || null,
      metadata: {
        action: 'created',
        paymentMethod: saleData.paymentMethod || 'cash',
        total: total
      }
    }, { transaction });

    await transaction.commit();

    // Auto-create invoice for credit sales (outside transaction)
    if (saleData.paymentMethod === 'credit' && sale.status === 'completed') {
      try {
        console.log(`[CreateSale] Attempting to auto-create invoice for sale ${sale.id}`);
        const autoGeneratedInvoice = await autoCreateInvoiceFromSale(sale.id, req.tenantId);
        if (autoGeneratedInvoice) {
          console.log(`[CreateSale] ✅ Invoice auto-created: ${autoGeneratedInvoice.invoiceNumber}`);
        }
      } catch (invoiceError) {
        console.error('[CreateSale] ❌ Failed to auto-create invoice, but sale was created:', invoiceError);
      }
    }

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

    // Emit real-time WebSocket event for new sale
    try {
      emitNewSale(req.tenantId, createdSale);
      
      // Check for low stock alerts after sale
      for (const item of items) {
        const product = await Product.findByPk(item.productId);
        if (product) {
          if (product.quantityOnHand <= 0) {
            emitInventoryAlert(req.tenantId, product, 'out_of_stock');
          } else if (product.quantityOnHand <= (product.reorderLevel || 10)) {
            emitInventoryAlert(req.tenantId, product, 'low_stock');
          }
        }
      }
    } catch (wsError) {
      console.error('[WebSocket] Failed to emit sale event:', wsError);
    }

    invalidateSaleListCache(req.tenantId);
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
  const transaction = await sequelize.transaction();
  
  try {
    const sale = await Sale.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      transaction,
      lock: transaction.LOCK.UPDATE
    });

    if (!sale) {
      await transaction.rollback();
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

    const previousStatus = sale.status;

    // Validate incremental status progression
    if (updateData.status && updateData.status !== previousStatus) {
      // Define status progression order (incremental only)
      const statusOrder = {
        'pending': 1,
        'completed': 2,
        'refunded': 3,  // terminal
        'cancelled': 3  // terminal
      };

      const previousOrder = statusOrder[previousStatus];
      const newOrder = statusOrder[updateData.status];

      // Terminal states cannot be changed from
      if (previousStatus === 'refunded' || previousStatus === 'cancelled') {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot change status from '${previousStatus}'. Once a sale is ${previousStatus}, the status cannot be changed.`
        });
      }

      // Validate that status change is forward/incremental only
      if (newOrder < previousOrder) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: `Cannot change status from '${previousStatus}' to '${updateData.status}'. Status changes must be incremental (forward progression only).`
        });
      }
    }

    await sale.update(updateData, { transaction });

    if (updateData.status && updateData.status !== previousStatus) {
      const statusLabels = {
        pending: 'Pending',
        completed: 'Completed',
        cancelled: 'Cancelled',
        refunded: 'Refunded'
      };
      const oldStatusLabel = statusLabels[previousStatus] || previousStatus;
      const newStatusLabel = statusLabels[updateData.status] || updateData.status;
      await SaleActivity.create({
        saleId: sale.id,
        tenantId: req.tenantId,
        type: 'status_change',
        subject: 'Status Updated',
        notes: `Status changed from ${oldStatusLabel} to ${newStatusLabel}`,
        createdBy: req.user?.id || null,
        metadata: {
          oldStatus: previousStatus,
          newStatus: updateData.status
        }
      }, { transaction });
    } else if (Object.keys(updateData).length > 0) {
      await SaleActivity.create({
        saleId: sale.id,
        tenantId: req.tenantId,
        type: 'note',
        subject: 'Sale Updated',
        notes: 'Details were updated',
        createdBy: req.user?.id || null,
        metadata: {}
      }, { transaction });
    }

    if (updateData.status && updateData.status !== previousStatus) {
      // Auto-create invoice when sale status changes to 'completed' and payment method is 'credit'
      if (updateData.status === 'completed' && sale.paymentMethod === 'credit' && !sale.invoiceId) {
        // Note: This will be handled after transaction commit
      }
    }

    await transaction.commit();

    // Auto-create invoice after transaction commit (outside transaction)
    if (updateData.status === 'completed' && sale.paymentMethod === 'credit' && !sale.invoiceId) {
      try {
        console.log(`[UpdateSale] Attempting to auto-create invoice for sale ${sale.id}`);
        const autoGeneratedInvoice = await autoCreateInvoiceFromSale(sale.id, req.tenantId);
        if (autoGeneratedInvoice) {
          console.log(`[UpdateSale] ✅ Invoice auto-created: ${autoGeneratedInvoice.invoiceNumber}`);
        }
      } catch (invoiceError) {
        console.error('[UpdateSale] ❌ Failed to auto-create invoice:', invoiceError);
      }
    }

    // Fetch updated sale
    const updatedSale = await Sale.findByPk(sale.id, {
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

    invalidateSaleListCache(req.tenantId);
    res.status(200).json({
      success: true,
      data: updatedSale
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
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
    invalidateSaleListCache(req.tenantId);

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

exports.addSaleActivity = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    const payload = sanitizePayload(req.body);

    const activity = await SaleActivity.create({
      saleId: sale.id,
      tenantId: req.tenantId,
      type: payload.type || 'note',
      subject: payload.subject || null,
      notes: payload.notes || null,
      createdBy: req.user?.id || null,
      nextStep: payload.nextStep || null,
      followUpDate: payload.followUpDate || null,
      metadata: payload.metadata || {}
    });

    const populatedActivity = await SaleActivity.findOne({
      where: applyTenantFilter(req.tenantId, { id: activity.id }),
      include: [{ model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] }]
    });

    res.status(201).json({ success: true, data: populatedActivity });
  } catch (error) {
    next(error);
  }
};

exports.getSaleActivities = async (req, res, next) => {
  try {
    const sale = await Sale.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id })
    });
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    const activities = await SaleActivity.findAll({
      where: applyTenantFilter(req.tenantId, { saleId: sale.id }),
      order: [['createdAt', 'DESC']],
      include: [{ model: User, as: 'createdByUser', attributes: ['id', 'name', 'email'] }]
    });

    res.status(200).json({ success: true, data: activities });
  } catch (error) {
    next(error);
  }
};

// @desc    Send receipt via SMS/WhatsApp/Email
// @route   POST /api/sales/:id/send-receipt
// @access  Private
exports.sendReceipt = async (req, res, next) => {
  try {
    const { channels, phone, email } = req.body;

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one delivery channel is required'
      });
    }

    // Get sale with all details
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
        { model: Customer, as: 'customer' },
        { model: Shop, as: 'shop' },
        { model: User, as: 'seller', attributes: ['id', 'name'] }
      ]
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Determine phone and email to use; normalize phone for SMS/WhatsApp (0XX / +233)
    const rawPhone = phone || sale.customer?.phone;
    const { formatToE164 } = require('../utils/phoneUtils');
    const recipientPhone = rawPhone ? (formatToE164(rawPhone) || rawPhone) : null;
    const recipientEmail = email || sale.customer?.email;

    const results = {
      sms: null,
      whatsapp: null,
      email: null
    };

    // Build receipt message
    const receiptMessage = buildReceiptMessage(sale, req.tenantId);

    // Send via requested channels
    for (const channel of channels) {
      try {
        switch (channel) {
          case 'sms':
            if (!recipientPhone) {
              results.sms = { success: false, error: 'No phone number provided' };
              break;
            }
            results.sms = await sendSMSReceipt(req.tenantId, recipientPhone, receiptMessage);
            break;

          case 'whatsapp':
            if (!recipientPhone) {
              results.whatsapp = { success: false, error: 'No phone number provided' };
              break;
            }
            results.whatsapp = await sendWhatsAppReceipt(req.tenantId, recipientPhone, receiptMessage);
            break;

          case 'email':
            if (!recipientEmail) {
              results.email = { success: false, error: 'No email address provided' };
              break;
            }
            results.email = await sendEmailReceipt(req.tenantId, recipientEmail, sale, receiptMessage);
            break;

          default:
            results[channel] = { success: false, error: 'Unknown channel' };
        }
      } catch (channelError) {
        console.error(`Failed to send receipt via ${channel}:`, channelError);
        results[channel] = { success: false, error: channelError.message };
      }
    }

    // Log activity
    await SaleActivity.create({
      saleId: sale.id,
      tenantId: req.tenantId,
      type: 'receipt_sent',
      subject: 'Receipt Sent',
      notes: `Receipt sent via: ${channels.join(', ')}`,
      createdBy: req.user?.id || null,
      metadata: { channels, results, phone: recipientPhone, email: recipientEmail }
    });

    res.status(200).json({
      success: true,
      message: 'Receipt delivery processed',
      data: results
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Build receipt message for SMS/WhatsApp
 * @param {Object} sale - Sale object
 * @param {string} tenantId - Tenant ID
 * @returns {string} - Formatted receipt message
 */
function buildReceiptMessage(sale, tenantId) {
  const lines = [];
  
  lines.push('=== RECEIPT ===');
  lines.push(`Sale #: ${sale.saleNumber}`);
  lines.push(`Date: ${new Date(sale.createdAt).toLocaleDateString()}`);
  lines.push('');
  
  // Items (abbreviated for SMS)
  sale.items?.forEach(item => {
    lines.push(`${item.quantity}x ${item.name.substring(0, 20)}`);
    lines.push(`   GHS ${item.total?.toFixed(2) || (item.quantity * item.unitPrice).toFixed(2)}`);
  });
  
  lines.push('---------------');
  lines.push(`TOTAL: GHS ${sale.total?.toFixed(2)}`);
  
  if (sale.amountPaid) {
    lines.push(`Paid: GHS ${sale.amountPaid?.toFixed(2)}`);
  }
  
  if (sale.change > 0) {
    lines.push(`Change: GHS ${sale.change?.toFixed(2)}`);
  }
  
  lines.push('');
  lines.push('Thank you for your purchase!');
  
  return lines.join('\n');
}

/**
 * Send SMS receipt using configured SMS service
 */
async function sendSMSReceipt(tenantId, phone, message) {
  const { Setting } = require('../models');
  const smsService = require('../services/smsService');
  
  // Get SMS settings
  const smsSettings = await Setting.findOne({
    where: { tenantId, key: 'sms' }
  });
  
  if (!smsSettings?.value?.enabled) {
    return { success: false, error: 'SMS service not configured' };
  }
  
  try {
    await smsService.sendSMS(smsSettings.value, phone, message);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Send WhatsApp receipt using configured WhatsApp service
 */
async function sendWhatsAppReceipt(tenantId, phone, message) {
  const { Setting } = require('../models');
  
  // Get WhatsApp settings
  const whatsappSettings = await Setting.findOne({
    where: { tenantId, key: 'whatsapp' }
  });
  
  if (!whatsappSettings?.value?.enabled) {
    return { success: false, error: 'WhatsApp service not configured' };
  }
  
  // WhatsApp Business API implementation would go here
  // For now, return a placeholder response
  return { success: false, error: 'WhatsApp integration not yet implemented' };
}

/**
 * Send Email receipt using configured email service
 */
async function sendEmailReceipt(tenantId, email, sale, textMessage) {
  const { Setting } = require('../models');
  const emailService = require('../services/emailService');
  
  // Get email settings
  const emailSettings = await Setting.findOne({
    where: { tenantId, key: 'email' }
  });
  
  if (!emailSettings?.value?.enabled) {
    return { success: false, error: 'Email service not configured' };
  }
  
  try {
    const subject = `Receipt - ${sale.saleNumber}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Receipt</h2>
        <p><strong>Sale Number:</strong> ${sale.saleNumber}</p>
        <p><strong>Date:</strong> ${new Date(sale.createdAt).toLocaleDateString()}</p>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 10px; text-align: left; border-bottom: 1px solid #ddd;">Item</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">Qty</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">Price</th>
              <th style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${sale.items?.map(item => `
              <tr>
                <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.name}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">${item.quantity}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">GHS ${item.unitPrice?.toFixed(2)}</td>
                <td style="padding: 10px; text-align: right; border-bottom: 1px solid #eee;">GHS ${(item.quantity * item.unitPrice).toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 10px; text-align: right; font-weight: bold;">Total:</td>
              <td style="padding: 10px; text-align: right; font-weight: bold;">GHS ${sale.total?.toFixed(2)}</td>
            </tr>
          </tfoot>
        </table>
        
        <p style="color: #666;">Thank you for your purchase!</p>
      </div>
    `;
    
    await emailService.sendEmail(emailSettings.value, {
      to: email,
      subject,
      html: htmlContent,
      text: textMessage
    });
    
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// @desc    Delete sale (admin only)
// @route   DELETE /api/sales/:id
// @access  Private (admin only)
exports.deleteSale = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  
  try {
    const sale = await Sale.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        { model: SaleItem, as: 'items' },
        { model: Invoice, as: 'invoice' }
      ]
    }, { transaction });

    if (!sale) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    // Prevent deletion of completed sales with paid invoices
    if (sale.invoice && sale.invoice.status === 'paid') {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: 'Cannot delete sale with paid invoice. Cancel or refund the sale instead.'
      });
    }

    // If sale is not cancelled, restore stock first
    if (sale.status !== 'cancelled' && sale.status !== 'refunded') {
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
    }

    // Delete related invoice if exists and not paid
    if (sale.invoice && sale.invoice.status !== 'paid') {
      await sale.invoice.destroy({ transaction });
    }

    // Delete sale activities
    await SaleActivity.destroy({
      where: { saleId: sale.id },
      transaction
    });

    // Delete sale items
    await SaleItem.destroy({
      where: { saleId: sale.id },
      transaction
    });

    // Delete the sale
    await sale.destroy({ transaction });

    await transaction.commit();
    invalidateSaleListCache(req.tenantId);

    res.status(200).json({
      success: true,
      message: 'Sale deleted successfully'
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Export autoCreateInvoiceFromSale for use in other controllers
exports.autoCreateInvoiceFromSale = autoCreateInvoiceFromSale;
