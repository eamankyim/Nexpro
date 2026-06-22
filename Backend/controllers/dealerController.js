const { sequelize } = require('../config/database');
const {
  Dealer,
  DealerLedgerEntry,
  DealerPriceTier,
  DealerProductPrice,
  Payment,
  User,
  Shop,
} = require('../models');
const { Op } = require('sequelize');
const { applyTenantFilter, sanitizePayload } = require('../utils/tenantUtils');
const {
  applyShopFilter,
  attachShopToPayload,
  getShopIdForWrite,
  getShopSqlFragment,
  assertShopRecordAccess,
} = require('../utils/shopUtils');
const { getPagination } = require('../utils/paginationUtils');
const {
  roundMoney,
  getAvailableCredit,
  checkCreditLimit,
  parseAmount,
} = require('../services/dealerBalanceService');
const {
  recordOpeningBalance,
  recordPayment,
  recordAdjustment,
} = require('../services/dealerLedgerService');
const {
  resolvePrice,
  resolvePricesForItems,
  listDealerPrices,
  upsertDealerPrices,
} = require('../services/dealerPricingService');
const {
  getDealerStatement,
  getOutstandingDealersReport,
} = require('../services/dealerStatementService');

const dealerWhere = (req, extra = {}) => applyShopFilter(req, applyTenantFilter(req.tenantId, extra));

const resolveShopId = (req) => {
  if (req.shopFilterId) return req.shopFilterId;
  if (req.shopScoped) return getShopIdForWrite(req);
  return req.query.shopId || req.headers['x-shop-id'] || null;
};

const requireShopContext = (req, res) => {
  if (!req.shopScoped) return true;
  if (req.shopFilterId) return true;
  res.status(400).json({
    success: false,
    message: 'Select an active shop branch to manage dealers.',
  });
  return false;
};

const mapDealerSummary = (dealer) => ({
  ...dealer.toJSON(),
  balance: roundMoney(dealer.balance),
  creditLimit: roundMoney(dealer.creditLimit),
  availableCredit: getAvailableCredit(dealer),
});

// @desc    Dealer stats for summary cards
// @route   GET /api/dealers/stats
exports.getDealerStats = async (req, res, next) => {
  try {
    if (!requireShopContext(req, res)) return;
    const tenantId = req.tenantId;
    const shopFrag = getShopSqlFragment(req);
    const [result] = await sequelize.query(
      `SELECT
        COUNT(*)::int AS "totalDealers",
        COUNT(*) FILTER (WHERE "isActive" = true)::int AS "activeDealers",
        COALESCE(SUM(CASE WHEN "isActive" = true THEN balance ELSE 0 END), 0)::numeric AS "totalOutstanding",
        COALESCE(SUM(CASE WHEN "isActive" = true THEN GREATEST("creditLimit" - balance, 0) ELSE 0 END), 0)::numeric AS "totalAvailableCredit"
      FROM dealers WHERE "tenantId" = :tenantId${shopFrag.sql}`,
      { replacements: { tenantId, ...shopFrag.replacements }, type: sequelize.QueryTypes.SELECT }
    );

    res.status(200).json({
      success: true,
      data: {
        totalDealers: result?.totalDealers ?? 0,
        activeDealers: result?.activeDealers ?? 0,
        totalOutstanding: roundMoney(result?.totalOutstanding ?? 0),
        totalAvailableCredit: roundMoney(result?.totalAvailableCredit ?? 0),
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    List dealers
// @route   GET /api/dealers
exports.getDealers = async (req, res, next) => {
  try {
    if (!requireShopContext(req, res)) return;
    const { page, limit, offset } = getPagination(req);
    const search = (req.query.search || '').trim();
    const isActive = req.query.isActive;

    let where = dealerWhere(req, {});
    if (isActive !== undefined && isActive !== 'all') {
      where.isActive = isActive === 'true';
    }
    if (search) {
      const term = `%${search}%`;
      where = {
        [Op.and]: [
          where,
          {
            [Op.or]: [
              { businessName: { [Op.iLike]: term } },
              { contactName: { [Op.iLike]: term } },
              { email: { [Op.iLike]: term } },
              { phone: { [Op.iLike]: term } },
            ],
          },
        ],
      };
    }

    const { count, rows } = await Dealer.findAndCountAll({
      where,
      limit,
      offset,
      include: [
        { model: DealerPriceTier, as: 'priceTier', attributes: ['id', 'name'], required: false },
        { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
      ],
      order: [['businessName', 'ASC']],
    });

    res.status(200).json({
      success: true,
      count,
      pagination: { page, limit, totalPages: Math.ceil(count / limit) },
      data: rows.map(mapDealerSummary),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    POS dealer search
// @route   GET /api/dealers/pos-search
exports.posSearchDealers = async (req, res, next) => {
  try {
    if (!requireShopContext(req, res)) return;
    const search = (req.query.search || req.query.q || '').trim();
    const where = dealerWhere(req, { isActive: true });
    if (search) {
      const term = `%${search}%`;
      where[Op.or] = [
        { businessName: { [Op.iLike]: term } },
        { contactName: { [Op.iLike]: term } },
        { phone: { [Op.iLike]: term } },
      ];
    }

    const dealers = await Dealer.findAll({
      where,
      attributes: ['id', 'businessName', 'contactName', 'phone', 'balance', 'creditLimit', 'priceTierId'],
      limit: Math.min(parseInt(req.query.limit, 10) || 20, 50),
      order: [['businessName', 'ASC']],
    });

    res.status(200).json({
      success: true,
      data: dealers.map(mapDealerSummary),
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Outstanding dealers report
// @route   GET /api/dealers/report/outstanding
exports.getOutstandingReport = async (req, res, next) => {
  try {
    if (!requireShopContext(req, res)) return;
    const report = await getOutstandingDealersReport(req.tenantId, req.shopFilterId || null);
    res.status(200).json({ success: true, data: report });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single dealer
// @route   GET /api/dealers/:id
exports.getDealer = async (req, res, next) => {
  try {
    const dealer = await Dealer.findOne({
      where: dealerWhere(req, { id: req.params.id }),
      include: [{ model: DealerPriceTier, as: 'priceTier', required: false }],
    });
    if (!dealer) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }
    assertShopRecordAccess(req, dealer);
    res.status(200).json({ success: true, data: mapDealerSummary(dealer) });
  } catch (error) {
    next(error);
  }
};

// @desc    Create dealer (+ optional opening balance)
// @route   POST /api/dealers
exports.createDealer = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    if (!requireShopContext(req, res)) {
      await transaction.rollback();
      return;
    }
    const payload = attachShopToPayload(req, sanitizePayload(req.body));
    const openingBalance = payload.openingBalance != null ? parseAmount(payload.openingBalance) : 0;
    delete payload.openingBalance;

    const dealer = await Dealer.create({
      ...payload,
      tenantId: req.tenantId,
      balance: 0,
    }, { transaction });

    if (openingBalance > 0) {
      await recordOpeningBalance({
        tenantId: req.tenantId,
        dealerId: dealer.id,
        shopId: dealer.shopId,
        amount: openingBalance,
        entryDate: payload.openingBalanceDate ? new Date(payload.openingBalanceDate) : new Date(),
        createdBy: req.user?.id || null,
        transaction,
      });
      await dealer.reload({ transaction });
    }

    await transaction.commit();
    res.status(201).json({ success: true, data: mapDealerSummary(dealer) });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Update dealer
// @route   PUT /api/dealers/:id
exports.updateDealer = async (req, res, next) => {
  try {
    const dealer = await Dealer.findOne({ where: dealerWhere(req, { id: req.params.id }) });
    if (!dealer) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }
    const payload = sanitizePayload(req.body);
    delete payload.openingBalance;
    delete payload.balance;
    await dealer.update(payload);
    res.status(200).json({ success: true, data: mapDealerSummary(dealer) });
  } catch (error) {
    next(error);
  }
};

// @desc    Deactivate dealer
// @route   PATCH /api/dealers/:id
exports.patchDealer = async (req, res, next) => {
  try {
    const dealer = await Dealer.findOne({ where: dealerWhere(req, { id: req.params.id }) });
    if (!dealer) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }
    const allowed = ['isActive', 'notes', 'creditTerms', 'creditLimit', 'priceTierId'];
    const updates = {};
    allowed.forEach((key) => {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    });
    await dealer.update(updates);
    res.status(200).json({ success: true, data: mapDealerSummary(dealer) });
  } catch (error) {
    next(error);
  }
};

// @desc    List dealer ledger entries
// @route   GET /api/dealers/:id/ledger
exports.getDealerLedger = async (req, res, next) => {
  try {
    const dealer = await Dealer.findOne({ where: dealerWhere(req, { id: req.params.id }) });
    if (!dealer) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }

    const { page, limit, offset } = getPagination(req);
    const shopId = req.query.shopId;

    const where = {
      tenantId: req.tenantId,
      dealerId: dealer.id,
    };
    if (shopId) where.shopId = shopId;

    const { count, rows } = await DealerLedgerEntry.findAndCountAll({
      where,
      include: [
        { model: Shop, as: 'shop', attributes: ['id', 'name'], required: false },
        { model: User, as: 'createdByUser', attributes: ['id', 'name'], required: false },
      ],
      limit,
      offset,
      order: [['entryDate', 'DESC'], ['createdAt', 'DESC']],
    });

    res.status(200).json({
      success: true,
      count,
      pagination: { page, limit, totalPages: Math.ceil(count / limit) },
      data: rows,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Record dealer payment
// @route   POST /api/dealers/:id/payments
exports.recordDealerPayment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const dealer = await Dealer.findOne({
      where: dealerWhere(req, { id: req.params.id }),
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!dealer) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }

    const amount = parseAmount(req.body.amount);
    if (amount <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Payment amount must be greater than zero' });
    }

    const paymentMethodMap = {
      cash: 'cash',
      mobile_money: 'mobile_money',
      momo_direct: 'mobile_money',
      bank_transfer: 'bank_transfer',
      other: 'other',
    };
    const rawMethod = String(req.body.paymentMethod || 'cash').toLowerCase();
    const paymentMethod = paymentMethodMap[rawMethod] || 'other';
    const paymentNumber = `DPAY-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    const payment = await Payment.create({
      paymentNumber,
      type: 'income',
      tenantId: req.tenantId,
      dealerId: dealer.id,
      amount,
      paymentMethod,
      paymentDate: req.body.paymentDate ? new Date(req.body.paymentDate) : new Date(),
      referenceNumber: req.body.referenceNumber || null,
      status: 'completed',
      description: `dealer:${dealer.id}`,
      notes: req.body.notes || null,
    }, { transaction });

    const ledgerEntry = await recordPayment({
      tenantId: req.tenantId,
      dealerId: dealer.id,
      shopId: dealer.shopId,
      amount,
      paymentId: payment.id,
      description: req.body.description || `Payment – ${paymentMethod.replace('_', ' ')}`,
      entryDate: payment.paymentDate,
      createdBy: req.user?.id || null,
      metadata: {
        paymentMethod,
        referenceNumber: req.body.referenceNumber || null,
      },
      transaction,
    });

    await dealer.reload({ transaction });
    await transaction.commit();

    res.status(201).json({
      success: true,
      data: {
        payment,
        ledgerEntry,
        dealer: mapDealerSummary(dealer),
      },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Manager ledger adjustment
// @route   POST /api/dealers/:id/ledger/adjustment
exports.createLedgerAdjustment = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const dealer = await Dealer.findOne({
      where: dealerWhere(req, { id: req.params.id }),
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!dealer) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }

    const direction = req.body.direction === 'credit' ? 'credit' : 'debit';
    const amount = parseAmount(req.body.amount);
    if (amount <= 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Adjustment amount must be greater than zero' });
    }

    const ledgerEntry = await recordAdjustment({
      tenantId: req.tenantId,
      dealerId: dealer.id,
      shopId: dealer.shopId,
      direction,
      amount,
      description: req.body.description || 'Manual adjustment',
      entryDate: req.body.entryDate ? new Date(req.body.entryDate) : new Date(),
      createdBy: req.user?.id || null,
      metadata: req.body.metadata || {},
      transaction,
    });

    await dealer.reload({ transaction });
    await transaction.commit();

    res.status(201).json({
      success: true,
      data: { ledgerEntry, dealer: mapDealerSummary(dealer) },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Dealer statement
// @route   GET /api/dealers/:id/statement
exports.getDealerStatement = async (req, res, next) => {
  try {
    const statement = await getDealerStatement({
      dealerId: req.params.id,
      tenantId: req.tenantId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
    });
    res.status(200).json({ success: true, data: statement });
  } catch (error) {
    if (error.message === 'Dealer not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

// @desc    Resolve dealer price for product
// @route   GET /api/dealers/:id/prices/resolve
exports.resolveDealerPrice = async (req, res, next) => {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId is required' });
    }
    const dealer = await Dealer.findOne({ where: dealerWhere(req, { id: req.params.id }) });
    if (!dealer) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }

    const result = await resolvePrice({
      tenantId: req.tenantId,
      shopId,
      dealerId: dealer.id,
      productId: req.query.productId,
      productVariantId: req.query.productVariantId || null,
      priceTierId: dealer.priceTierId,
    });

    res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

// @desc    Batch resolve dealer prices
// @route   POST /api/dealers/:id/prices/resolve-batch
exports.resolveDealerPricesBatch = async (req, res, next) => {
  try {
    const shopId = resolveShopId(req) || req.body.shopId;
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId is required' });
    }
    const dealer = await Dealer.findOne({ where: dealerWhere(req, { id: req.params.id }) });
    if (!dealer) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }

    const prices = await resolvePricesForItems({
      tenantId: req.tenantId,
      shopId,
      dealerId: dealer.id,
      priceTierId: dealer.priceTierId,
      items: req.body.items || [],
    });

    res.status(200).json({ success: true, data: prices });
  } catch (error) {
    next(error);
  }
};

// @desc    List dealer prices for branch
// @route   GET /api/dealers/:id/prices
exports.getDealerPrices = async (req, res, next) => {
  try {
    const shopId = resolveShopId(req);
    if (!shopId) {
      return res.status(400).json({ success: false, message: 'shopId is required' });
    }
    const dealer = await Dealer.findOne({ where: dealerWhere(req, { id: req.params.id }) });
    if (!dealer) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }

    const prices = await listDealerPrices({
      tenantId: req.tenantId,
      shopId,
      dealerId: dealer.id,
      search: req.query.search || '',
    });

    res.status(200).json({ success: true, data: prices });
  } catch (error) {
    next(error);
  }
};

// @desc    Upsert dealer prices for branch
// @route   PUT /api/dealers/:id/prices
exports.upsertDealerPrices = async (req, res, next) => {
  const transaction = await sequelize.transaction();
  try {
    const shopId = resolveShopId(req) || req.body.shopId;
    if (!shopId) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'shopId is required' });
    }
    const dealer = await Dealer.findOne({ where: dealerWhere(req, { id: req.params.id }) });
    if (!dealer) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }

    const saved = await upsertDealerPrices({
      tenantId: req.tenantId,
      shopId,
      dealerId: dealer.id,
      prices: req.body.prices || [],
      transaction,
    });

    await transaction.commit();
    res.status(200).json({ success: true, data: saved });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// @desc    Price tier CRUD list
// @route   GET /api/dealers/price-tiers
exports.getPriceTiers = async (req, res, next) => {
  try {
    const tiers = await DealerPriceTier.findAll({
      where: dealerWhere(req, {}),
      order: [['name', 'ASC']],
    });
    res.status(200).json({ success: true, data: tiers });
  } catch (error) {
    next(error);
  }
};

// @desc    Create price tier
// @route   POST /api/dealers/price-tiers
exports.createPriceTier = async (req, res, next) => {
  try {
    const tier = await DealerPriceTier.create({
      ...sanitizePayload(req.body),
      tenantId: req.tenantId,
    });
    res.status(201).json({ success: true, data: tier });
  } catch (error) {
    next(error);
  }
};

// @desc    Update price tier
// @route   PUT /api/dealers/price-tiers/:tierId
exports.updatePriceTier = async (req, res, next) => {
  try {
    const tier = await DealerPriceTier.findOne({
      where: dealerWhere(req, { id: req.params.tierId }),
    });
    if (!tier) {
      return res.status(404).json({ success: false, message: 'Price tier not found' });
    }
    await tier.update(sanitizePayload(req.body));
    res.status(200).json({ success: true, data: tier });
  } catch (error) {
    next(error);
  }
};

// @desc    Credit limit check helper for POS
// @route   POST /api/dealers/:id/credit-check
exports.checkDealerCredit = async (req, res, next) => {
  try {
    const dealer = await Dealer.findOne({ where: dealerWhere(req, { id: req.params.id }) });
    if (!dealer) {
      return res.status(404).json({ success: false, message: 'Dealer not found' });
    }
    const chargeAmount = parseAmount(req.body.chargeAmount || 0);
    const creditOverride = req.body.creditOverride === true;
    const result = checkCreditLimit(dealer, chargeAmount, creditOverride);
    res.status(200).json({
      success: true,
      data: {
        ...result,
        dealer: mapDealerSummary(dealer),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.checkCreditLimit = checkCreditLimit;
