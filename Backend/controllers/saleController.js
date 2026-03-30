const { Sale, SaleItem, Product, ProductVariant, Customer, Shop, Invoice, User, SaleActivity, Tenant, Payment, Setting } = require('../models');
const { createInvoiceRevenueJournal } = require('../services/invoiceAccountingService');
const { createSaleCogsJournal, createSaleRevenueJournal } = require('../services/saleAccountingService');
const { Op } = require('sequelize');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');
const { parseDeliveryStatusInput } = require('../utils/deliveryStatus');
const { getPagination } = require('../utils/paginationUtils');
const { invalidateSaleListCache } = require('../middleware/cache');
const { sequelize } = require('../config/database');
const crypto = require('crypto');
const { emitNewSale, emitSaleStatusChange, emitInventoryAlert } = require('../services/websocketService');
const { notifyOrderStatusChanged, notifyNewOrder } = require('../services/notificationService');
const { getTaxConfigForTenant } = require('../utils/taxConfig');
const { computeDocumentTax } = require('../utils/taxCalculation');
const { getTenantLogoUrl } = require('../utils/tenantLogo');

/** Throttle check-Paystack calls per sale (avoid hitting Paystack every poll) */
const paystackCheckLastBySaleId = new Map();
const PAYSTACK_CHECK_THROTTLE_MS = 4000;

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

// Helper function to automatically create invoice for ALL completed sales
// Credit sales: invoice status 'sent' (pay later)
// Cash/card/etc: invoice status 'paid' (immediate payment - acts as receipt)
const autoCreateInvoiceFromSale = async (saleId, tenantId) => {
  try {
    console.log(`[AutoInvoice] Starting invoice creation for saleId: ${saleId}, tenantId: ${tenantId}`);

    const existingInvoice = await Invoice.findOne({
      where: { saleId, tenantId }
    });

    if (existingInvoice) {
      console.log(`[AutoInvoice] Invoice already exists for sale ${saleId}, skipping creation`);
      return existingInvoice;
    }

    const sale = await Sale.findByPk(saleId, {
      include: [
        { model: Customer, as: 'customer' },
        { model: SaleItem, as: 'items' }
      ]
    });

    if (!sale) {
      console.log(`[AutoInvoice] Sale ${saleId} not found, cannot create invoice`);
      return null;
    }

    const totalAmount = parseFloat(sale.total || 0);
    const amountPaid = parseFloat(sale.amountPaid || 0);
    const balance = Math.max(totalAmount - amountPaid, 0);
    const invoiceStatus = balance <= 0 ? 'paid' : amountPaid > 0 ? 'partial' : 'sent';
    console.log(
      `[AutoInvoice] Sale found: ${sale.saleNumber}, items: ${sale.items?.length || 0}, total: ${totalAmount}, amountPaid: ${amountPaid}, status: ${invoiceStatus}`
    );

    const invoiceNumber = await generateInvoiceNumber(tenantId);
    const td = sale.metadata?.taxDetail || {};
    const taxAmt = parseFloat(sale.tax || 0);
    let taxableExclusive =
      td.taxableExclusive != null && td.taxableExclusive !== ''
        ? parseFloat(td.taxableExclusive)
        : Math.max(0, parseFloat(sale.subtotal || 0) - parseFloat(sale.discount || 0));
    if (!Number.isFinite(taxableExclusive)) taxableExclusive = 0;

    let taxRate =
      taxAmt > 0 && taxableExclusive > 0
        ? Math.round((taxAmt / taxableExclusive) * 10000) / 100
        : 0;
    if (taxRate === 0 && td.ratePercent != null && taxAmt > 0) {
      taxRate = Math.min(100, Math.max(0, parseFloat(td.ratePercent) || 0));
    }

    const totalDiscount = parseFloat(sale.discount || 0);

    /** @type {Array<Record<string, unknown>>} */
    let items = [];
    if (sale.items && sale.items.length > 0) {
      items = sale.items.map((item) => {
        const qty = parseFloat(item.quantity || 0);
        const itemTax = parseFloat(item.tax || 0);
        const itemTotal = parseFloat(item.total || 0);
        const itemExclusive = Math.max(0, itemTotal - itemTax);
        const unitPriceNet = qty > 0 ? itemExclusive / qty : itemExclusive;
        return {
          description: item.name || 'Sale item',
          category: 'Sale',
          quantity: item.quantity,
          unitPrice: unitPriceNet,
          discountAmount: 0,
          discountPercent: 0,
          discountReason: null,
          total: itemExclusive
        };
      });
    } else {
      items = [
        {
          description: `Sale ${sale.saleNumber}`,
          quantity: 1,
          unitPrice: taxableExclusive,
          total: taxableExclusive,
          discountAmount: 0,
          discountPercent: 0,
          discountReason: null,
          category: 'Sale'
        }
      ];
    }

    const invoicePayload = {
      invoiceNumber,
      saleId,
      customerId: sale.customerId,
      tenantId,
      sourceType: 'sale',
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      subtotal: taxableExclusive,
      taxRate,
      discountType: 'fixed',
      discountValue: 0,
      discountAmount: 0,
      discountReason: totalDiscount > 0 ? 'Discounts included in line totals' : null,
      paymentTerms: balance <= 0 ? 'Due on Receipt' : 'Net 30',
      status: invoiceStatus,
      totalAmount,
      amountPaid,
      balance,
      items,
      notes: `Invoice generated from sale ${sale.saleNumber}`,
      termsAndConditions:
        'Payment is due within the specified payment terms. Late payments may incur additional charges.'
    };
    if (balance <= 0) {
      invoicePayload.paidDate = new Date();
    }
    const invoice = await Invoice.create(invoicePayload);

    await sale.update({ invoiceId: invoice.id });

    try {
      await createInvoiceRevenueJournal(invoice);
    } catch (journalError) {
      console.error('[AutoInvoice] Failed to create accounting revenue entry:', journalError?.message);
    }

    console.log(`[AutoInvoice] ✅ Invoice created successfully: ${invoice.invoiceNumber} (ID: ${invoice.id}), status: ${invoiceStatus}`);
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
    const orderStatus = req.query.orderStatus;
    const activeOrders = req.query.activeOrders === 'true';
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
    if (orderStatus) {
      where.orderStatus = orderStatus;
    }
    if (activeOrders) {
      where.orderStatus = { [Op.in]: ['received', 'preparing', 'ready'] };
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

    const baseInclude = [
      { model: Shop, as: 'shop', attributes: ['id', 'name'] },
      { model: Customer, as: 'customer', attributes: ['id', 'name', 'phone'] },
      { model: User, as: 'seller', attributes: ['id', 'name'] },
      { model: Invoice, as: 'invoice', attributes: ['id', 'status'], required: false },
      {
        model: SaleItem,
        as: 'items',
        attributes: ['id', 'productId', 'name', 'quantity', 'unitPrice', 'total'],
        required: false,
        include: [
          { model: Product, as: 'product', attributes: ['id', 'name', 'imageUrl'], required: false }
        ]
      }
    ];

    const { count, rows } = await Sale.findAndCountAll({
      where,
      attributes: { exclude: ['notes'] },
      limit,
      offset,
      include: baseInclude,
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

// @desc    Export sales to CSV/Excel
// @route   GET /api/sales/export
// @access  Private (admin, manager)
exports.exportSales = async (req, res, next) => {
  try {
    const { format = 'csv', status } = req.query;
    const { sendCSV, sendExcel, COLUMN_DEFINITIONS } = require('../utils/dataExport');

    const where = applyTenantFilter(req.tenantId, {});
    if (status) where.status = status;

    const sales = await Sale.findAll({
      where,
      include: [{ model: Customer, as: 'customer', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
      raw: false
    });
    const rows = sales.map((s) => {
      const plain = s.get({ plain: true });
      return { ...plain, customer: plain.customer || {} };
    });

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'No sales to export' });
    }

    const filename = `sales_${new Date().toISOString().split('T')[0]}`;
    const columns = COLUMN_DEFINITIONS.sales;

    if (format === 'excel') {
      await sendExcel(res, rows, `${filename}.xlsx`, { columns, sheetName: 'Sales', title: 'Sales List' });
    } else {
      sendCSV(res, rows, `${filename}.csv`, columns);
    }
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
        {
          model: Invoice,
          as: 'invoice',
          include: [{ model: Customer, as: 'customer' }]
        },
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

// Idempotent create: if clientId provided and sale exists for tenant, return existing; otherwise create.
const createSaleCore = async (transaction, tenantId, userId, body, clientId = null, tenant = null) => {
  const { items, cartDiscount: bodyCartDiscount, ...saleData } = sanitizePayload(body);
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('Sale must have at least one item');
  }
  if (clientId) {
    const existing = await Sale.findOne({
      where: { tenantId, clientId },
      transaction
    });
    if (existing) return existing;
  }

  const taxConfig = await getTaxConfigForTenant(tenantId);
  const cartDiscount = Math.max(0, parseFloat(bodyCartDiscount) || 0);
  const lines = items.map((item) => ({
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    discount: item.discount || 0
  }));
  const computed = computeDocumentTax({
    lines,
    cartDiscount,
    config: taxConfig
  });

  const saleNumber = await generateSaleNumber(tenantId);
  const subtotal = computed.subtotal;
  const totalDiscount = computed.discount;
  const totalTax = computed.taxAmount;
  const total = computed.total;
  const amountPaid = saleData.amountPaid != null ? parseFloat(saleData.amountPaid) : total;
  const change = amountPaid > total ? Math.round((amountPaid - total) * 100) / 100 : 0;
  const shopType = tenant?.metadata?.shopType;
  const isRestaurant = shopType === 'restaurant';
  const saleStatus = saleData.status || 'completed';
  const sendToKitchen = saleData.sendToKitchen !== false;
  const orderStatus = isRestaurant && sendToKitchen ? 'received' : null;

  const priorMeta = saleData.metadata && typeof saleData.metadata === 'object' ? saleData.metadata : {};
  const sale = await Sale.create({
    ...saleData,
    tenantId,
    clientId: clientId || null,
    saleNumber,
    subtotal,
    discount: totalDiscount,
    tax: totalTax,
    total,
    amountPaid,
    change,
    soldBy: userId,
    status: saleStatus,
    orderStatus,
    metadata: {
      ...priorMeta,
      taxDetail: {
        ratePercent: taxConfig.enabled ? taxConfig.defaultRatePercent : 0,
        pricesAreTaxInclusive: taxConfig.pricesAreTaxInclusive,
        taxableExclusive: computed.netTaxable,
        taxAmount: totalTax
      }
    }
  }, { transaction });

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const lr = computed.lineResults[i] || { exclusive: 0, tax: 0, gross: 0 };
    const lineSub = (parseFloat(item.quantity) || 0) * (parseFloat(item.unitPrice) || 0);
    const lineItemTotal = Math.round((lr.exclusive + lr.tax) * 100) / 100;
    await SaleItem.create({
      saleId: sale.id,
      productId: item.productId,
      productVariantId: item.productVariantId || null,
      name: item.name,
      sku: item.sku,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount || 0,
      tax: lr.tax,
      subtotal: lineSub,
      total: lineItemTotal
    }, { transaction });

    const product = await Product.findByPk(item.productId, { transaction });
    if (product && product.trackStock !== false) {
      const newQuantity = parseFloat(product.quantityOnHand || 0) - parseFloat(item.quantity || 0);
      await product.update({ quantityOnHand: Math.max(0, newQuantity) }, { transaction });
    }
    if (item.productVariantId) {
      const variant = await ProductVariant.findByPk(item.productVariantId, { transaction });
      const parent = product || await Product.findByPk(item.productId, { transaction });
      if (variant && parent?.trackStock !== false && variant.trackStock !== false) {
        const newVariantQuantity = parseFloat(variant.quantityOnHand || 0) - parseFloat(item.quantity || 0);
        await variant.update({ quantityOnHand: Math.max(0, newVariantQuantity) }, { transaction });
      }
    }
  }

  await SaleActivity.create({
    saleId: sale.id,
    tenantId,
    type: 'note',
    subject: 'Sale Created',
    notes: `Sale ${saleNumber} created`,
    createdBy: userId || null,
    metadata: {
      action: 'created',
      paymentMethod: saleData.paymentMethod || 'cash',
      total
    }
  }, { transaction });

  return { sale, items };
};

// @desc    Create new sale (POS transaction)
// @route   POST /api/sales
// @access  Private
exports.createSale = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const clientId = req.body.clientId || null;
    const { sale, items } = await createSaleCore(transaction, req.tenantId, req.user.id, req.body, clientId, req.tenant);
    const shopType = req.tenant?.metadata?.shopType;
    const isRestaurant = shopType === 'restaurant';

    await transaction.commit();

    // Auto-create invoice for ALL completed sales (cash→paid, credit→sent)
    if (sale.status === 'completed') {
      try {
        console.log(`[CreateSale] Attempting to auto-create invoice for sale ${sale.id}`);
        const autoGeneratedInvoice = await autoCreateInvoiceFromSale(sale.id, req.tenantId);
        if (autoGeneratedInvoice) {
          console.log(`[CreateSale] ✅ Invoice auto-created: ${autoGeneratedInvoice.invoiceNumber}`);
        }
      } catch (invoiceError) {
        console.error('[CreateSale] ❌ Failed to auto-create invoice, but sale was created:', invoiceError);
      }
      try {
        await createSaleRevenueJournal(req.tenantId, sale.id, req.user?.id);
      } catch (revError) {
        console.error('[CreateSale] Failed to create sale revenue journal entry:', revError?.message);
      }
      try {
        await createSaleCogsJournal(req.tenantId, sale.id, req.user?.id);
      } catch (cogsError) {
        console.error('[CreateSale] Failed to create COGS journal entry:', cogsError?.message);
      }
    }

    // Fetch sale with relations (include invoice for receipt printing)
    const createdSale = await Sale.findByPk(sale.id, {
      include: [
        { model: Shop, as: 'shop' },
        { model: Customer, as: 'customer' },
        { model: User, as: 'seller' },
        {
          model: Invoice,
          as: 'invoice',
          include: [{ model: Customer, as: 'customer' }]
        },
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

    // Notify staff of new order (restaurant only, fire-and-forget)
    if (isRestaurant && createdSale.orderStatus) {
      notifyNewOrder({ sale: createdSale, triggeredBy: req.user?.id }).catch((err) =>
        console.error('[createSale] New order notification failed:', err?.message)
      );
    }

    // Emit real-time WebSocket event for new sale
    try {
      emitNewSale(req.tenantId, createdSale);
      
      // Check for low stock alerts after sale (skip for made-to-order products)
      for (const item of items) {
        const product = await Product.findByPk(item.productId);
        if (product && product.trackStock !== false) {
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

    // Auto-send receipt to customer if setting is on (fire-and-forget)
    if (createdSale.status === 'completed') {
      const saleId = createdSale.id;
      const tenantId = req.tenantId;
      setImmediate(() => {
        autoSendReceiptIfEnabled(tenantId, saleId).catch((err) =>
          console.error('[CreateSale] Auto-send receipt failed:', err?.message || err)
        );
      });
    }

    res.status(201).json({
      success: true,
      data: createdSale
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Batch sync offline sales (idempotent by clientId)
// @route   POST /api/sales/sync
// @body    { items: [{ clientId, payload }] } where payload is same as createSale body
// @access  Private
exports.batchSyncSales = async (req, res, next) => {
  const items = req.body?.items;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'items array is required'
    });
  }
  const results = [];
  for (const { clientId, payload } of items) {
    if (!payload || !payload.items?.length) {
      results.push({ clientId: clientId || null, error: 'Invalid payload' });
      continue;
    }
    const transaction = await sequelize.transaction();
    try {
      const { sale } = await createSaleCore(
        transaction,
        req.tenantId,
        req.user.id,
        payload,
        clientId || null,
        req.tenant
      );
      await transaction.commit();
      try {
        if (sale.status === 'completed') {
          await autoCreateInvoiceFromSale(sale.id, req.tenantId);
          await createSaleRevenueJournal(req.tenantId, sale.id, req.user?.id);
          await createSaleCogsJournal(req.tenantId, sale.id, req.user?.id);
        }
      } catch (postErr) {
        console.error('[batchSyncSales] Post-commit failed for sale', sale.id, postErr?.message);
      }
      results.push({ clientId: clientId || null, id: sale.id });
    } catch (err) {
      await transaction.rollback();
      results.push({
        clientId: clientId || null,
        error: err?.message || 'Sync failed'
      });
    }
  }
  res.status(200).json({ success: true, results });
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
    const allowedFields = ['status', 'notes', 'metadata', 'deliveryStatus'];
    const payload = sanitizePayload(req.body);
    const updateData = {};
    
    allowedFields.forEach(field => {
      if (payload[field] !== undefined) {
        updateData[field] = payload[field];
      }
    });

    if (updateData.deliveryStatus !== undefined) {
      const parsed = parseDeliveryStatusInput(updateData.deliveryStatus);
      if (parsed === undefined) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          message: 'Invalid deliveryStatus'
        });
      }
      updateData.deliveryStatus = parsed;
    }

    const previousStatus = sale.status;
    const previousDeliveryStatus = sale.deliveryStatus || null;

    // Validate incremental status progression
    if (updateData.status && updateData.status !== previousStatus) {
      // Define status progression order (incremental only)
      const statusOrder = {
        'pending': 1,
        'partially_paid': 2,
        'completed': 3,
        'refunded': 4,  // terminal
        'cancelled': 4  // terminal
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

    const deliveryStatusChanged =
      updateData.deliveryStatus !== undefined &&
      String(updateData.deliveryStatus || '') !== String(previousDeliveryStatus || '');

    const DELIVERY_LABELS = {
      ready_for_delivery: 'Ready for delivery',
      out_for_delivery: 'Out for delivery',
      delivered: 'Delivered',
      returned: 'Returned'
    };

    if (updateData.status && updateData.status !== previousStatus) {
      const statusLabels = {
        pending: 'Pending',
        partially_paid: 'Partially paid',
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
    }

    if (deliveryStatusChanged) {
      const oldL = previousDeliveryStatus
        ? DELIVERY_LABELS[previousDeliveryStatus] || previousDeliveryStatus
        : 'Not set';
      const newL = updateData.deliveryStatus
        ? DELIVERY_LABELS[updateData.deliveryStatus] || updateData.deliveryStatus
        : 'Not set';
      await SaleActivity.create({
        saleId: sale.id,
        tenantId: req.tenantId,
        type: 'note',
        subject: 'Delivery status updated',
        notes: `Delivery status changed from ${oldL} to ${newL}`,
        createdBy: req.user?.id || null,
        metadata: {
          deliveryStatusChange: true,
          oldDeliveryStatus: previousDeliveryStatus,
          newDeliveryStatus: updateData.deliveryStatus
        }
      }, { transaction });
    }

    const otherUpdatedKeys = Object.keys(updateData).filter(
      (k) => k !== 'status' && k !== 'deliveryStatus'
    );
    if (
      !(updateData.status && updateData.status !== previousStatus) &&
      !deliveryStatusChanged &&
      otherUpdatedKeys.length > 0
    ) {
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
      // Auto-create invoice when sale status changes to 'completed' (handled after commit)
      if (updateData.status === 'completed' && !sale.invoiceId) {
        // Note: This will be handled after transaction commit
      }
    }

    await transaction.commit();

    // Auto-create invoice after transaction commit (outside transaction)
    if (updateData.status === 'completed' && !sale.invoiceId) {
      try {
        console.log(`[UpdateSale] Attempting to auto-create invoice for sale ${sale.id}`);
        const autoGeneratedInvoice = await autoCreateInvoiceFromSale(sale.id, req.tenantId);
        if (autoGeneratedInvoice) {
          console.log(`[UpdateSale] ✅ Invoice auto-created: ${autoGeneratedInvoice.invoiceNumber}`);
        }
      } catch (invoiceError) {
        console.error('[UpdateSale] ❌ Failed to auto-create invoice:', invoiceError?.message);
      }
      try {
        await createSaleRevenueJournal(req.tenantId, sale.id, req.user?.id);
      } catch (revError) {
        console.error('[UpdateSale] Failed to create sale revenue journal:', revError?.message);
      }
      try {
        await createSaleCogsJournal(req.tenantId, sale.id, req.user?.id);
      } catch (cogsError) {
        console.error('[UpdateSale] Failed to create COGS journal:', cogsError?.message);
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

// Map sale payment method to Payment model enum (Payment has credit_card not card)
const salePaymentMethodToPaymentModel = (method) => {
  if (!method) return 'cash';
  const m = String(method).toLowerCase();
  if (m === 'card') return 'credit_card';
  if (['cash', 'mobile_money', 'check', 'bank_transfer', 'other'].includes(m)) return m;
  return 'other';
};

// @desc    Record payment on a sale (partial or full)
// @route   POST /api/sales/:id/payment
// @access  Private
exports.recordPayment = async (req, res, next) => {
  try {
    const { amount, paymentMethod, referenceNumber, paymentDate } = sanitizePayload(req.body);

    const sale = await Sale.findOne({
      where: applyTenantFilter(req.tenantId, { id: req.params.id }),
      include: [
        { model: Customer, as: 'customer' },
        { model: SaleItem, as: 'items' }
      ]
    });

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }

    if (sale.status === 'cancelled' || sale.status === 'refunded') {
      return res.status(400).json({
        success: false,
        message: 'Cannot record payment on a cancelled or refunded sale'
      });
    }

    const totalAmount = parseFloat(sale.total || 0);
    const currentPaid = parseFloat(sale.amountPaid || 0);
    const balanceDue = Math.max(totalAmount - currentPaid, 0);

    if (balanceDue <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Sale is already fully paid'
      });
    }

    const paymentAmount = parseFloat(amount);
    if (!paymentAmount || paymentAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Payment amount must be greater than 0'
      });
    }
    if (paymentAmount > balanceDue) {
      return res.status(400).json({
        success: false,
        message: `Payment amount cannot exceed balance due (₵ ${balanceDue.toFixed(2)})`
      });
    }

    const newAmountPaid = Math.min(currentPaid + paymentAmount, totalAmount);
    const effectivePaymentDate = paymentDate ? new Date(paymentDate) : new Date();
    const previousStatus = sale.status;
    const isNowCompleted = newAmountPaid >= totalAmount;

    const updatePayload = {
      amountPaid: newAmountPaid
    };
    if (paymentMethod) {
      updatePayload.paymentMethod = paymentMethod;
    }
    if (isNowCompleted) {
      updatePayload.status = 'completed';
    } else {
      updatePayload.status = 'partially_paid';
    }

    await sale.update(updatePayload);

    const paymentNumber = `PAY-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await Payment.create({
      paymentNumber,
      type: 'income',
      customerId: sale.customerId,
      tenantId: req.tenantId,
      amount: paymentAmount,
      paymentMethod: salePaymentMethodToPaymentModel(paymentMethod || sale.paymentMethod),
      paymentDate: effectivePaymentDate,
      referenceNumber: referenceNumber || null,
      status: 'completed',
      notes: `Payment for sale ${sale.saleNumber || sale.id}`
    });

    await SaleActivity.create({
      saleId: sale.id,
      tenantId: req.tenantId,
      type: 'payment',
      subject: 'Payment recorded',
      notes: `₵ ${paymentAmount.toFixed(2)} received (${paymentMethod || sale.paymentMethod || 'cash'}). Total paid: ₵ ${newAmountPaid.toFixed(2)}${isNowCompleted ? ' – Sale completed' : ''}`,
      createdBy: req.user?.id || null,
      metadata: {
        amount: paymentAmount,
        paymentMethod: paymentMethod || sale.paymentMethod,
        previousAmountPaid: currentPaid,
        newAmountPaid: newAmountPaid,
        completed: isNowCompleted
      }
    });

    if (isNowCompleted && (previousStatus === 'pending' || previousStatus === 'partially_paid')) {
      if (!sale.invoiceId) {
        try {
          const autoGeneratedInvoice = await autoCreateInvoiceFromSale(sale.id, req.tenantId);
          if (autoGeneratedInvoice) {
            console.log('[RecordPayment] ✅ Invoice auto-created:', autoGeneratedInvoice.invoiceNumber);
          }
        } catch (invoiceError) {
          console.error('[RecordPayment] Failed to auto-create invoice:', invoiceError?.message);
        }
      }
      try {
        await createSaleRevenueJournal(req.tenantId, sale.id, req.user?.id);
      } catch (revError) {
        console.error('[RecordPayment] Failed to create sale revenue journal:', revError?.message);
      }
      try {
        await createSaleCogsJournal(req.tenantId, sale.id, req.user?.id);
      } catch (cogsError) {
        console.error('[RecordPayment] Failed to create COGS journal:', cogsError?.message);
      }
    }

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
    if (isNowCompleted && (previousStatus === 'pending' || previousStatus === 'partially_paid')) {
      try {
        emitSaleStatusChange(req.tenantId, updatedSale, previousStatus);
      } catch (wsErr) {
        console.error('[RecordPayment] WebSocket emit error:', wsErr?.message);
      }
    }

    res.status(200).json({
      success: true,
      data: updatedSale,
      message: isNowCompleted ? 'Payment recorded and sale completed' : 'Payment recorded'
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

    // Restore product stock (skip when trackStock is false - made-to-order)
    for (const item of sale.items) {
      const product = await Product.findByPk(item.productId, { transaction });
      if (product && product.trackStock !== false) {
        const newQuantity = parseFloat(product.quantityOnHand || 0) + parseFloat(item.quantity);
        await product.update({ quantityOnHand: newQuantity }, { transaction });
      }

      if (item.productVariantId) {
        const variant = await ProductVariant.findByPk(item.productVariantId, { transaction });
        const parent = product || await Product.findByPk(item.productId, { transaction });
        if (variant && parent?.trackStock !== false && variant.trackStock !== false) {
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

// @desc    Update order status (restaurant kitchen only)
// @route   PATCH /api/sales/:id/order-status
// @access  Private
exports.updateOrderStatus = async (req, res, next) => {
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

    const shopType = req.tenant?.metadata?.shopType;
    if (shopType !== 'restaurant') {
      return res.status(400).json({
        success: false,
        message: 'Order status tracking is only available for restaurant tenants'
      });
    }

    const { orderStatus } = req.body;
    const validStatuses = ['received', 'preparing', 'ready', 'completed'];
    if (!orderStatus || !validStatuses.includes(orderStatus)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid orderStatus. Must be one of: received, preparing, ready, completed'
      });
    }

    const oldOrderStatus = sale.orderStatus || null;
    const updateData = { orderStatus };
    if (orderStatus === 'completed' && sale.status === 'pending') {
      updateData.status = 'completed';
    }
    await sale.update(updateData);

    // Notify staff of order status change (fire-and-forget, don't block response)
    notifyOrderStatusChanged({
      sale: { ...sale.toJSON(), orderStatus },
      oldStatus: oldOrderStatus,
      newStatus: orderStatus,
      triggeredBy: req.user?.id
    }).catch((err) => console.error('[updateOrderStatus] Notification failed:', err?.message));

    const updatedSale = await Sale.findByPk(sale.id, {
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

    invalidateSaleListCache(req.tenantId);
    res.status(200).json({
      success: true,
      data: updatedSale
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update delivery status (all business types; public tracking uses delivery timeline when set)
// @route   PATCH /api/sales/:id/delivery-status
// @access  Private
exports.updateDeliveryStatus = async (req, res, next) => {
  if (!Object.prototype.hasOwnProperty.call(req.body || {}, 'deliveryStatus')) {
    return res.status(400).json({
      success: false,
      message: 'deliveryStatus is required (send null to clear)'
    });
  }
  const { deliveryStatus } = req.body;
  req.body = { deliveryStatus };
  return exports.updateSale(req, res, next);
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
 * If tenant has "auto send receipt to customer" enabled, send receipt via all configured channels.
 * Called from createSale (setImmediate) so it does not block the response.
 */
async function autoSendReceiptIfEnabled(tenantId, saleId) {
  const prefs = await Setting.findOne({ where: { tenantId, key: 'customer-notification-preferences' } });
  if (!prefs?.value?.autoSendReceiptToCustomer) return;

  const sale = await Sale.findOne({
    where: { tenantId, id: saleId },
    include: [
      { model: SaleItem, as: 'items', include: [{ model: Product, as: 'product' }, { model: ProductVariant, as: 'variant' }] },
      { model: Customer, as: 'customer' }
    ]
  });
  if (!sale?.customer) return;

  const smsService = require('../services/smsService');
  const whatsappService = require('../services/whatsappService');
  const emailService = require('../services/emailService');
  const smsConfig = await smsService.getResolvedConfig(tenantId);
  const whatsappConfig = await whatsappService.getConfig(tenantId);
  const emailConfig = await emailService.getConfig(tenantId);

  const receiptMessage = buildReceiptMessage(sale, tenantId);
  const phone = sale.customer.phone?.trim();
  const email = sale.customer.email?.trim();
  const hasPhone = !!smsService.validatePhoneNumber(phone);

  if (emailConfig && email) {
    await sendEmailReceipt(tenantId, email, sale, receiptMessage).catch((e) =>
      console.error('[AutoSendReceipt] Email failed:', e?.message)
    );
  }
  if (smsConfig && hasPhone) {
    await sendSMSReceipt(tenantId, smsService.validatePhoneNumber(phone), receiptMessage).catch((e) =>
      console.error('[AutoSendReceipt] SMS failed:', e?.message)
    );
  }
  if (whatsappConfig?.phoneNumberId && hasPhone) {
    await sendWhatsAppReceipt(tenantId, whatsappService.validatePhoneNumber(phone), receiptMessage).catch((e) =>
      console.error('[AutoSendReceipt] WhatsApp failed:', e?.message)
    );
  }
}

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
 * Send SMS receipt using tenant or platform SMS config (resolved inside smsService)
 */
async function sendSMSReceipt(tenantId, phone, message) {
  const smsService = require('../services/smsService');
  try {
    const result = await smsService.sendMessage(tenantId, phone, message);
    if (result.success) return { success: true };
    return { success: false, error: result.error };
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
  const { Setting, Tenant } = require('../models');
  const emailService = require('../services/emailService');
  const emailTemplates = require('../services/emailTemplates');

  // Get email settings
  const emailSettings = await Setting.findOne({
    where: { tenantId, key: 'email' }
  });

  if (!emailSettings?.value?.enabled) {
    return { success: false, error: 'Email service not configured' };
  }

  try {
    const tenant = await Tenant.findByPk(tenantId, { attributes: ['name', 'metadata'] });
    const company = {
      name: tenant?.name || 'African Business Suite',
      logoUrl: getTenantLogoUrl(tenant),
      primaryColor: tenant?.metadata?.primaryColor || '#166534'
    };
    const closing = textMessage && String(textMessage).trim() ? String(textMessage).trim() : '';
    const { subject, html, text } = emailTemplates.saleReceiptEmail(sale, company, closing);

    const result = await emailService.sendMessage(tenantId, email, subject, html, text);

    if (!result.success) {
      return { success: false, error: result.error };
    }
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

    // If sale is not cancelled, restore stock first (skip when trackStock is false - made-to-order)
    if (sale.status !== 'cancelled' && sale.status !== 'refunded') {
      for (const item of sale.items) {
        const product = await Product.findByPk(item.productId, { transaction });
        if (product && product.trackStock !== false) {
          const newQuantity = parseFloat(product.quantityOnHand || 0) + parseFloat(item.quantity);
          await product.update({ quantityOnHand: newQuantity }, { transaction });
        }

        if (item.productVariantId) {
          const variant = await ProductVariant.findByPk(item.productVariantId, { transaction });
          const parent = product || await Product.findByPk(item.productId, { transaction });
          if (variant && parent?.trackStock !== false && variant.trackStock !== false) {
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

// @desc    Initialize Paystack payment for a pending sale (POS card/MoMo)
// @route   POST /api/sales/:id/initialize-paystack
// @access  Private
exports.initializePaystackForSale = async (req, res, next) => {
  try {
    const saleId = req.params.id;
    const { email, callbackUrl } = sanitizePayload(req.body || {});

    const sale = await Sale.findOne({
      where: applyTenantFilter(req.tenantId, { id: saleId })
    });
    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }
    if (sale.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Sale is not pending payment' });
    }

    const totalAmount = parseFloat(sale.total || 0);
    if (totalAmount <= 0) {
      return res.status(400).json({ success: false, message: 'Sale total must be greater than zero' });
    }

    const customerEmail = email && String(email).trim() ? String(email).trim() : null;
    if (!customerEmail) {
      return res.status(400).json({ success: false, message: 'Email is required for card/MoMo payment' });
    }

    const paystackService = require('../services/paystackService');
    if (!paystackService.secretKey) {
      return res.status(503).json({ success: false, message: 'Paystack is not configured' });
    }

    const reference = `SALE-${sale.id}-${Date.now()}`.slice(0, 50);
    const orgRow = await Setting.findOne({ where: { tenantId: sale.tenantId, key: 'organization' } });
    const orgTax = orgRow?.value?.tax || {};
    const oc = orgTax?.otherCharges || {};
    const shouldApplyCustomerCharge =
      oc?.enabled === true &&
      oc?.customerBears === true &&
      ['online_payments', 'all_payments'].includes(String(oc?.appliesTo || ''));
    const chargeRate = shouldApplyCustomerCharge ? Math.max(0, Math.min(100, parseFloat(oc?.ratePercent) || 0)) : 0;
    const chargeAmount = Math.round((totalAmount * chargeRate / 100) * 100) / 100;
    const payableAmount = shouldApplyCustomerCharge ? totalAmount + chargeAmount : totalAmount;
    const amountPesewas = Math.round(payableAmount * 100);
    const callback = callbackUrl && String(callbackUrl).trim() ? String(callbackUrl).trim() : null;

    const tenant = await Tenant.findByPk(sale.tenantId);
    const subaccount = tenant?.paystackSubaccountCode || null;

    const result = await paystackService.initializeTransaction({
      email: customerEmail,
      amount: amountPesewas,
      currency: 'GHS',
      callback_url: callback || undefined,
      reference,
      metadata: {
        sale_id: sale.id,
        tenant_id: sale.tenantId,
        paymentSurcharge: shouldApplyCustomerCharge
          ? {
              label: typeof oc?.label === 'string' && oc.label.trim() ? oc.label.trim() : 'Transaction charge',
              ratePercent: chargeRate,
              amount: chargeAmount,
              customerBears: true
            }
          : undefined
      },
      channels: ['card'],
      ...(subaccount ? { subaccount } : {})
    });

    if (!result.status || !result.data?.authorization_url) {
      return res.status(502).json({
        success: false,
        message: result.message || 'Failed to initialize payment'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        authorization_url: result.data.authorization_url,
        authorizationUrl: result.data.authorization_url,
        reference: result.data.reference,
        access_code: result.data.access_code,
        accessCode: result.data.access_code
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Initiate Paystack Mobile Money payment for a pending POS sale
// @route   POST /api/sales/:id/paystack-mobile-money
// @access  Private
exports.paystackMobileMoneyForSale = async (req, res, next) => {
  try {
    const saleId = req.params.id;
    const { phoneNumber, provider } = sanitizePayload(req.body || {});

    if (!phoneNumber || !provider) {
      return res.status(400).json({
        success: false,
        message: 'phoneNumber and provider are required'
      });
    }

    const sale = await Sale.findOne({
      where: applyTenantFilter(req.tenantId, { id: saleId }),
      include: [{ model: Customer, as: 'customer' }]
    });

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    if (sale.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Sale is not pending payment'
      });
    }

    const totalAmount = parseFloat(sale.total || 0);
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Sale total must be greater than zero'
      });
    }

    const tenant = await Tenant.findByPk(sale.tenantId);

    const customerEmail =
      (sale.customer && sale.customer.email) ||
      req.user?.email ||
      tenant?.metadata?.companyEmail ||
      tenant?.email ||
      null;

    if (!customerEmail) {
      return res.status(400).json({
        success: false,
        message: 'Customer or user email is required for mobile money payment'
      });
    }

    const paystackService = require('../services/paystackService');
    if (!paystackService.secretKey) {
      return res.status(503).json({
        success: false,
        message: 'Paystack is not configured'
      });
    }

    const reference = `SALE-MM-${sale.id}-${Date.now()}`.slice(0, 50);

    const logicalProvider = String(provider || '').toUpperCase();

    const orgRow = await Setting.findOne({ where: { tenantId: sale.tenantId, key: 'organization' } });
    const orgTax = orgRow?.value?.tax || {};
    const oc = orgTax?.otherCharges || {};
    const shouldApplyCustomerCharge =
      oc?.enabled === true &&
      oc?.customerBears === true &&
      ['online_payments', 'all_payments'].includes(String(oc?.appliesTo || ''));
    const chargeRate = shouldApplyCustomerCharge ? Math.max(0, Math.min(100, parseFloat(oc?.ratePercent) || 0)) : 0;
    const chargeAmount = Math.round((totalAmount * chargeRate / 100) * 100) / 100;
    const payableAmount = shouldApplyCustomerCharge ? totalAmount + chargeAmount : totalAmount;

    const result = await paystackService.chargeMobileMoney({
      email: customerEmail,
      amount: payableAmount,
      reference,
      phoneNumber,
      provider: logicalProvider,
      metadata: {
        sale_id: sale.id,
        tenant_id: sale.tenantId,
        paymentSurcharge: shouldApplyCustomerCharge
          ? {
              label: typeof oc?.label === 'string' && oc.label.trim() ? oc.label.trim() : 'Transaction charge',
              ratePercent: chargeRate,
              amount: chargeAmount,
              customerBears: true
            }
          : undefined
      },
      ...(tenant?.paystackSubaccountCode ? { subaccount: tenant.paystackSubaccountCode } : {})
    });

    console.log('[MoMo] Paystack chargeMobileMoney result:', {
      saleId: sale.id,
      hasResult: !!result,
      resultStatus: result?.status,
      resultMessage: result?.message,
      resultKeys: result ? Object.keys(result) : null
    });

    if (!result || result.status === false) {
      console.warn('[MoMo] Returning 502 – result missing or result.status === false:', { result });
      return res.status(502).json({
        success: false,
        message: result?.message || 'Failed to initiate mobile money payment'
      });
    }

    // Persist basic Paystack MoMo info in sale metadata
    const existingMetadata = sale.metadata || {};
    const updatedMetadata = {
      ...existingMetadata,
      paystackMobileMoney: {
        ...(existingMetadata.paystackMobileMoney || {}),
        reference,
        provider: logicalProvider,
        phoneNumber,
        initiatedAt: new Date().toISOString()
      }
    };

    await sale.update({ metadata: updatedMetadata });

    const payload = {
      success: true,
      data: {
        reference,
        provider: logicalProvider,
        status: 'PENDING'
      }
    };
    console.log('[MoMo] Returning 200 success:', { saleId: sale.id, payload });
    res.status(200).json(payload);
  } catch (error) {
    console.error('[MoMo] paystackMobileMoneyForSale error:', { saleId: req.params?.id, error: error.message, stack: error.stack });
    next(error);
  }
};

/**
 * Check Paystack charge status for a pending POS MoMo sale and update sale when charge succeeds.
 * Used when webhook cannot reach the server (e.g. local dev) so the frontend can poll and still see completion.
 * GET /api/sales/:id/check-paystack-charge
 */
exports.checkPaystackChargeForSale = async (req, res, next) => {
  try {
    const saleId = req.params.id;
    const sale = await Sale.findOne({
      where: applyTenantFilter(req.tenantId, { id: saleId }),
      include: [{ model: Customer, as: 'customer' }]
    });

    if (!sale) {
      return res.status(404).json({ success: false, message: 'Sale not found' });
    }

    // If already completed, return as-is
    if (sale.status === 'completed') {
      return res.status(200).json({ success: true, data: sale });
    }

    const ref = sale.metadata?.paystackMobileMoney?.reference;
    if (!ref) {
      return res.status(200).json({ success: true, data: sale });
    }

    // Throttle: don't call Paystack more than once per 8s per sale
    const now = Date.now();
    const last = paystackCheckLastBySaleId.get(saleId) || 0;
    if (now - last < PAYSTACK_CHECK_THROTTLE_MS) {
      return res.status(200).json({ success: true, data: sale });
    }
    paystackCheckLastBySaleId.set(saleId, now);

    const paystackService = require('../services/paystackService');
    if (!paystackService.secretKey) {
      return res.status(200).json({ success: true, data: sale });
    }

    const result = await paystackService.verifyTransaction(ref);
    if (!result.status || !result.data) {
      return res.status(200).json({ success: true, data: sale });
    }

    const tx = result.data;
    const txStatus = (tx.status || '').toLowerCase();
    if (txStatus !== 'success') {
      return res.status(200).json({ success: true, data: sale });
    }

    const amount = parseFloat(tx.amount || 0) / 100;
    const saleTotal = parseFloat(sale.total || 0);
    const appliedAmount = Number.isFinite(saleTotal) && saleTotal > 0 ? Math.min(amount, saleTotal) : amount;
    const tenant = await Tenant.findByPk(sale.tenantId);
    const pc = tenant?.metadata?.paymentCollection || {};
    const isMoMo = pc.settlementType === 'momo' && pc.momoPhone;
    const useLegacyMomoTransfer = isMoMo && !tenant?.paystackSubaccountCode;

    await sale.update({
      status: 'completed',
      paymentMethod: sale.paymentMethod || 'mobile_money',
      amountPaid: appliedAmount,
      metadata: {
        ...(sale.metadata || {}),
        paystackRef: ref,
        paystackCompletedAt: new Date().toISOString()
      }
    });

    if (useLegacyMomoTransfer) {
      try {
        const platformFeePercent = parseFloat(process.env.PAYSTACK_PLATFORM_FEE_PERCENT || '2');
        const tenantShare = appliedAmount * (1 - platformFeePercent / 100);
        const tenantSharePesewas = Math.round(tenantShare * 100);
        if (tenantSharePesewas >= 100) {
          let recipientCode = pc.paystackTransferRecipientCode;
          if (!recipientCode) {
            const momoAccount = (pc.momoPhone || '').replace(/^\+?233/, '0');
            const recipientRes = await paystackService.createTransferRecipient({
              type: 'mobile_money',
              name: tenant?.name || 'Business',
              account_number: momoAccount || pc.momoPhone,
              bank_code: paystackService.getMoMoBankCode(pc.momoProvider),
              currency: 'GHS'
            });
            recipientCode = recipientRes?.data?.recipient_code;
            if (recipientCode && tenant) {
              tenant.metadata = tenant.metadata || {};
              tenant.metadata.paymentCollection = tenant.metadata.paymentCollection || {};
              tenant.metadata.paymentCollection.paystackTransferRecipientCode = recipientCode;
              await tenant.save();
            }
          }
          if (recipientCode) {
            const transferRef = `sale_${sale.id}_${Date.now()}`.slice(0, 50);
            await paystackService.initiateTransfer({
              amount: tenantSharePesewas,
              recipient: recipientCode,
              reference: transferRef,
              reason: `POS sale ${sale.saleNumber}`
            });
            console.log('[MoMo] Transfer initiated for sale (check-paystack):', sale.id);
          }
        }
      } catch (transferErr) {
        console.error('[MoMo] Transfer failed for sale (check-paystack):', sale.id, transferErr?.response?.data || transferErr.message);
      }
    }

    try {
      await autoCreateInvoiceFromSale(sale.id, sale.tenantId);
    } catch (invErr) {
      console.error('[MoMo] Auto-invoice failed for POS sale (check-paystack):', invErr.message);
    }
    try {
      invalidateSaleListCache(sale.tenantId);
      emitNewSale(sale.tenantId, sale);
    } catch (e) {
      console.error('[MoMo] WebSocket/cache error (check-paystack):', e.message);
    }
    console.log('[MoMo] Sale completed via check-paystack-charge:', sale.id);

    return res.status(200).json({ success: true, data: sale });
  } catch (error) {
    console.error('[MoMo] checkPaystackChargeForSale error:', { saleId: req.params?.id, error: error.message });
    next(error);
  }
};
