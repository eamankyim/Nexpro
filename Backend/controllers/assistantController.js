const { Customer, Invoice, Expense, Job, Sale, Tenant, Setting, Product } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const openaiService = require('../services/openaiService');
const { parseReportDateRange } = require('../utils/reportDateFilter');
const { startHotPathTimer } = require('../utils/performanceLogger');
const {
  assertAiProviderConfigured,
  buildBillingCircuitError,
  classifyAiProviderError,
  openBillingCircuit,
  toDurationMs,
} = require('../utils/aiProviderErrors');

const sendAssistantError = (res, error) => {
  const classified = classifyAiProviderError(error);
  const statusCode = classified?.statusCode || error.statusCode || 500;
  const errorCode = classified?.errorCode || error.errorCode || error.code || 'INTERNAL_ERROR';
  const message = classified?.message || error.message || 'Server Error';

  return res.status(statusCode).json({
    success: false,
    error: message,
    errorCode,
    code: errorCode,
  });
};

const parseClientSubmittedAt = (headerValue) => {
  if (!headerValue) return null;
  const parsed = Number(headerValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
};

/** In-memory cache for assistant context (per tenant + shop + date range). */
const assistantContextCache = new Map();
const ASSISTANT_CONTEXT_TTL_MS = 90 * 1000;

const buildAssistantContextCacheKey = (tenantId, options = {}) => {
  const shop = options.shopFilterId || 'none';
  const start = options.startDate || 'none';
  const end = options.endDate || 'none';
  const tier = options.tier || 'full';
  return `${tenantId}:${shop}:${start}:${end}:${tier}`;
};

const getCachedAssistantContext = (cacheKey) => {
  const entry = assistantContextCache.get(cacheKey);
  if (entry && Date.now() - entry.timestamp < ASSISTANT_CONTEXT_TTL_MS) {
    return entry.data;
  }
  if (entry) assistantContextCache.delete(cacheKey);
  return null;
};

const setCachedAssistantContext = (cacheKey, data) => {
  if (assistantContextCache.size > 200) {
    const oldestKey = assistantContextCache.keys().next().value;
    assistantContextCache.delete(oldestKey);
  }
  assistantContextCache.set(cacheKey, { data, timestamp: Date.now() });
};

/**
 * Heuristic: support/how-to and draft requests need less business data in context.
 * @param {string} message
 * @returns {'light' | 'full'}
 */
const resolveAssistantContextTier = (message) => {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return 'full';
  if (text.length < 24 && !/\d|revenue|sales|profit|invoice|stock|customer|expense|owe|debt|collect/.test(text)) {
    return 'light';
  }
  if (/^(hi|hello|hey|thanks|thank you|ok|okay)\b/.test(text)) return 'light';
  if (/\b(how do i|how to|where (is|can|do)|help me|show me how|navigate|menu|settings|steps to)\b/.test(text)) {
    return 'light';
  }
  if (/\b(draft|write|compose|message|email|sms|whatsapp|reminder|template)\b/.test(text) && !/\b(how much|total|revenue|sales|profit|owe|outstanding)\b/.test(text)) {
    return 'light';
  }
  return 'full';
};

/**
 * Minimal tenant context for support/draft questions (no heavy aggregates).
 * @param {string} tenantId
 * @returns {Promise<Object>}
 */
async function getAssistantContextLight(tenantId) {
  const [tenant, orgSetting] = await Promise.all([
    Tenant.findByPk(tenantId, {
      attributes: ['id', 'businessType', 'name', 'metadata'],
    }),
    Setting.findOne({
      where: { tenantId, key: 'organization' },
      attributes: ['value'],
    }),
  ]);
  const meta = tenant?.metadata || {};
  const org = orgSetting?.value || {};
  return {
    businessType: tenant?.businessType || 'printing_press',
    tenantName: tenant?.name || 'Business',
    workspaceContact: {
      businessName: tenant?.name || 'Business',
      email: String(org.email || meta.email || '').trim() || null,
      phone: String(org.phone || meta.phone || '').trim() || null,
      website: String(org.website || meta.website || '').trim() || null,
    },
    dateFilter: { active: false },
  };
}

/**
 * Build tenant-scoped context for ABS Assistant (this month, today, receivables, inventory, etc.).
 * @param {string} tenantId
 * @param {{ shopFilterId?: string | null, startDate?: string, endDate?: string, periodLabel?: string }} [options]
 * @returns {Promise<Object>}
 */
async function getAssistantContext(tenantId, options = {}) {
  const shopFilterId = options.shopFilterId || null;
  const selectedDateFilter = parseReportDateRange(options.startDate, options.endDate);
  const hasSelectedPeriod = Boolean(selectedDateFilter);
  const [selectedStart, selectedEnd] = hasSelectedPeriod ? selectedDateFilter[Op.between] : [null, null];

  const [tenant, orgSetting] = await Promise.all([
    Tenant.findByPk(tenantId, {
      attributes: ['id', 'businessType', 'name', 'metadata'],
    }),
    Setting.findOne({
      where: { tenantId, key: 'organization' },
      attributes: ['value'],
    }),
  ]);
  const businessType = tenant?.businessType || 'printing_press';
  const meta = tenant?.metadata || {};
  const org = orgSetting?.value || {};
  const workspaceContact = {
    businessName: tenant?.name || 'Business',
    email: String(org.email || meta.email || '').trim() || null,
    phone: String(org.phone || meta.phone || '').trim() || null,
    website: String(org.website || meta.website || '').trim() || null,
  };

  const today = new Date();
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  firstDayOfMonth.setHours(0, 0, 0, 0);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  lastDayOfMonth.setHours(23, 59, 59, 999);

  const firstDayThreeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  firstDayThreeMonthsAgo.setHours(0, 0, 0, 0);

  const isShopOrPharmacy = businessType === 'shop' || businessType === 'pharmacy';
  const isStudio = ['printing_press', 'mechanic', 'barber', 'salon', 'studio'].includes(businessType);

  const saleWhereBase = { tenantId, ...(shopFilterId ? { shopId: shopFilterId } : {}) };
  const productWhereBase = {
    tenantId,
    isActive: true,
    ...(shopFilterId ? { shopId: shopFilterId } : {}),
  };

  const [
    totalCustomers,
    newCustomersThisMonth,
    newCustomersToday,
    thisMonthRevenue,
    thisMonthExpenses,
    todayRevenue,
    todayExpenses,
    last3MonthsRevenue,
    last3MonthsExpenses,
    last3MonthsNewCustomers,
    totalOutstandingRaw,
    overdueOutstandingRaw,
    outstandingInvoiceCount,
    topDebtorsRows,
    recentSalesRows,
    lowStockProducts,
    topProductsRows,
    pendingJobsCount,
    inProgressJobsCount,
  ] = await Promise.all([
    Customer.count({ where: { tenantId, isActive: true } }),
    Customer.count({
      where: {
        tenantId,
        isActive: true,
        createdAt: { [Op.between]: [firstDayOfMonth, lastDayOfMonth] },
      },
    }),
    Customer.count({
      where: {
        tenantId,
        isActive: true,
        createdAt: { [Op.between]: [todayStart, todayEnd] },
      },
    }),
    isShopOrPharmacy
      ? Sale.sum('total', {
          where: {
            ...saleWhereBase,
            status: 'completed',
            createdAt: { [Op.between]: [firstDayOfMonth, lastDayOfMonth] },
          },
        }) || 0
      : Invoice.sum('amountPaid', {
          where: {
            tenantId,
            status: { [Op.ne]: 'cancelled' },
            amountPaid: { [Op.gt]: 0 },
            [Op.and]: [
              sequelize.where(
                sequelize.fn('COALESCE', sequelize.col('paidDate'), sequelize.col('updatedAt')),
                { [Op.between]: [firstDayOfMonth, lastDayOfMonth] }
              ),
            ],
          },
        }) || 0,
    Expense.sum('amount', {
      where: {
        tenantId,
        expenseDate: { [Op.between]: [firstDayOfMonth, lastDayOfMonth] },
      },
    }) || 0,
    isShopOrPharmacy
      ? Sale.sum('total', {
          where: {
            ...saleWhereBase,
            status: 'completed',
            createdAt: { [Op.between]: [todayStart, todayEnd] },
          },
        }) || 0
      : Invoice.sum('amountPaid', {
          where: {
            tenantId,
            status: { [Op.ne]: 'cancelled' },
            amountPaid: { [Op.gt]: 0 },
            [Op.and]: [
              sequelize.where(
                sequelize.fn('COALESCE', sequelize.col('paidDate'), sequelize.col('updatedAt')),
                { [Op.between]: [todayStart, todayEnd] }
              ),
            ],
          },
        }) || 0,
    Expense.sum('amount', {
      where: {
        tenantId,
        expenseDate: { [Op.between]: [todayStart, todayEnd] },
      },
    }) || 0,
    isShopOrPharmacy
      ? Sale.sum('total', {
          where: {
            ...saleWhereBase,
            status: 'completed',
            createdAt: { [Op.between]: [firstDayThreeMonthsAgo, lastDayOfMonth] },
          },
        }) || 0
      : Invoice.sum('amountPaid', {
          where: {
            tenantId,
            status: { [Op.ne]: 'cancelled' },
            amountPaid: { [Op.gt]: 0 },
            [Op.and]: [
              sequelize.where(
                sequelize.fn('COALESCE', sequelize.col('paidDate'), sequelize.col('updatedAt')),
                { [Op.between]: [firstDayThreeMonthsAgo, lastDayOfMonth] }
              ),
            ],
          },
        }) || 0,
    Expense.sum('amount', {
      where: {
        tenantId,
        expenseDate: { [Op.between]: [firstDayThreeMonthsAgo, lastDayOfMonth] },
      },
    }) || 0,
    Customer.count({
      where: {
        tenantId,
        isActive: true,
        createdAt: { [Op.between]: [firstDayThreeMonthsAgo, lastDayOfMonth] },
      },
    }),
    Invoice.sum('balance', {
      where: {
        tenantId,
        balance: { [Op.gt]: 0 },
        status: { [Op.notIn]: ['paid', 'cancelled'] },
      },
    }) || 0,
    Invoice.sum('balance', {
      where: {
        tenantId,
        balance: { [Op.gt]: 0 },
        dueDate: { [Op.lt]: today },
        status: { [Op.notIn]: ['paid', 'cancelled'] },
      },
    }) || 0,
    Invoice.count({
      where: {
        tenantId,
        balance: { [Op.gt]: 0 },
        status: { [Op.notIn]: ['paid', 'cancelled'] },
      },
    }),
    Invoice.findAll({
      attributes: [
        [sequelize.col('Invoice.customerId'), 'customerId'],
        [sequelize.fn('SUM', sequelize.col('Invoice.balance')), 'outstanding'],
      ],
      where: {
        tenantId,
        balance: { [Op.gt]: 0 },
        status: { [Op.notIn]: ['paid', 'cancelled'] },
      },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'company'],
        },
      ],
      group: ['Invoice.customerId', 'customer.id'],
      order: [[sequelize.literal('outstanding'), 'DESC']],
      limit: 5,
    }),
    isShopOrPharmacy
      ? Sale.findAll({
          where: saleWhereBase,
          attributes: ['id', 'saleNumber', 'total', 'status', 'createdAt'],
          limit: 5,
          order: [['createdAt', 'DESC']],
          include: [
            { model: Customer, as: 'customer', attributes: ['name'], required: false },
          ],
        })
      : Promise.resolve([]),
    isShopOrPharmacy
      ? Product.findAll({
          where: {
            ...productWhereBase,
            trackStock: true,
            [Op.and]: [
              sequelize.where(sequelize.col('quantityOnHand'), Op.lte, sequelize.col('reorderLevel')),
            ],
          },
          attributes: ['name', 'quantityOnHand', 'reorderLevel', 'unit'],
          limit: 8,
          order: [['quantityOnHand', 'ASC']],
        })
      : Promise.resolve([]),
    isShopOrPharmacy
      ? sequelize.query(
          `
        SELECT "SaleItem"."name" as "productName",
          SUM("SaleItem"."total") as "totalRevenue",
          SUM("SaleItem"."quantity") as "totalQuantity"
        FROM "sale_items" AS "SaleItem"
        INNER JOIN "sales" AS "Sale" ON "SaleItem"."saleId" = "Sale"."id"
        WHERE "Sale"."tenantId" = :tenantId
          AND "Sale"."status" = 'completed'
          AND "Sale"."createdAt" BETWEEN :monthStart AND :monthEnd
          ${shopFilterId ? 'AND "Sale"."shopId" = :shopId' : ''}
        GROUP BY "SaleItem"."name"
        ORDER BY SUM("SaleItem"."total") DESC
        LIMIT 5
      `,
          {
            replacements: {
              tenantId,
              monthStart: firstDayOfMonth,
              monthEnd: lastDayOfMonth,
              ...(shopFilterId ? { shopId: shopFilterId } : {}),
            },
            type: sequelize.QueryTypes.SELECT,
          }
        )
      : Promise.resolve([]),
    isStudio
      ? Job.count({ where: { tenantId, status: 'new' } })
      : Promise.resolve(0),
    isStudio
      ? Job.count({ where: { tenantId, status: 'in_progress' } })
      : Promise.resolve(0),
  ]);

  const thisMonth = {
    totalCustomers,
    newCustomersThisMonth,
    revenue: Number(parseFloat(thisMonthRevenue).toFixed(2)),
    expenses: Number(parseFloat(thisMonthExpenses).toFixed(2)),
    profit: Number(parseFloat(thisMonthRevenue - thisMonthExpenses).toFixed(2)),
    range: { start: firstDayOfMonth.toISOString(), end: lastDayOfMonth.toISOString() },
  };

  const todaySummary = {
    revenue: Number(parseFloat(todayRevenue).toFixed(2)),
    expenses: Number(parseFloat(todayExpenses).toFixed(2)),
    profit: Number(parseFloat(todayRevenue - todayExpenses).toFixed(2)),
    newCustomers: newCustomersToday,
  };

  const last3Months = {
    revenue: Number(parseFloat(last3MonthsRevenue).toFixed(2)),
    expenses: Number(parseFloat(last3MonthsExpenses).toFixed(2)),
    profit: Number(parseFloat(last3MonthsRevenue - last3MonthsExpenses).toFixed(2)),
    newCustomers: last3MonthsNewCustomers,
    range: { start: firstDayThreeMonthsAgo.toISOString(), end: lastDayOfMonth.toISOString() },
  };

  const totalOutstanding = Number(parseFloat(totalOutstandingRaw || 0).toFixed(2));
  const overdueOutstanding = Number(parseFloat(overdueOutstandingRaw || 0).toFixed(2));
  const topDebtors = (topDebtorsRows || []).map((row) => {
    const c = row.customer || {};
    return {
      customerId: row.customerId || null,
      customerName: c.company || c.name || 'Unknown customer',
      outstanding: Number(parseFloat(row.get ? row.get('outstanding') : row.outstanding || 0).toFixed(2)),
    };
  });
  const receivables = {
    totalOutstanding,
    overdueOutstanding,
    outstandingInvoiceCount: Number(outstandingInvoiceCount || 0),
    overdueRatioPercent:
      totalOutstanding > 0 ? Number(((overdueOutstanding / totalOutstanding) * 100).toFixed(2)) : 0,
    topDebtors,
  };

  const recentSales = (recentSalesRows || []).map((sale) => ({
    saleNumber: sale.saleNumber,
    total: Number(parseFloat(sale.total).toFixed(2)),
    status: sale.status,
    customerName: sale.customer?.name || 'Walk-in',
    createdAt: sale.createdAt,
  }));

  const lowStock = (lowStockProducts || []).map((p) => ({
    name: p.name,
    quantityOnHand: Number(parseFloat(p.quantityOnHand || 0)),
    reorderLevel: Number(parseFloat(p.reorderLevel || 0)),
    unit: p.unit,
  }));

  const topProducts = (topProductsRows || []).map((row) => ({
    productName: row.productName,
    totalRevenue: Number(parseFloat(row.totalRevenue || 0).toFixed(2)),
    totalQuantity: Number(parseFloat(row.totalQuantity || 0)),
  }));

  let selectedPeriod = null;
  if (hasSelectedPeriod) {
    const [
      selectedRevenueRaw,
      selectedExpensesRaw,
      selectedNewCustomers,
      selectedTopProductsRows,
      selectedRecentSalesRows,
    ] = await Promise.all([
      isShopOrPharmacy
        ? Sale.sum('total', {
            where: {
              ...saleWhereBase,
              status: 'completed',
              createdAt: { [Op.between]: [selectedStart, selectedEnd] },
            },
          }) || 0
        : Invoice.sum('amountPaid', {
            where: {
              tenantId,
              status: { [Op.ne]: 'cancelled' },
              amountPaid: { [Op.gt]: 0 },
              [Op.and]: [
                sequelize.where(
                  sequelize.fn('COALESCE', sequelize.col('paidDate'), sequelize.col('updatedAt')),
                  { [Op.between]: [selectedStart, selectedEnd] }
                ),
              ],
            },
          }) || 0,
      Expense.sum('amount', {
        where: {
          tenantId,
          expenseDate: { [Op.between]: [selectedStart, selectedEnd] },
        },
      }) || 0,
      Customer.count({
        where: {
          tenantId,
          isActive: true,
          createdAt: { [Op.between]: [selectedStart, selectedEnd] },
        },
      }),
      isShopOrPharmacy
        ? sequelize.query(
            `
        SELECT "SaleItem"."name" as "productName",
          SUM("SaleItem"."total") as "totalRevenue",
          SUM("SaleItem"."quantity") as "totalQuantity"
        FROM "sale_items" AS "SaleItem"
        INNER JOIN "sales" AS "Sale" ON "SaleItem"."saleId" = "Sale"."id"
        WHERE "Sale"."tenantId" = :tenantId
          AND "Sale"."status" = 'completed'
          AND "Sale"."createdAt" BETWEEN :periodStart AND :periodEnd
          ${shopFilterId ? 'AND "Sale"."shopId" = :shopId' : ''}
        GROUP BY "SaleItem"."name"
        ORDER BY SUM("SaleItem"."total") DESC
        LIMIT 5
      `,
            {
              replacements: {
                tenantId,
                periodStart: selectedStart,
                periodEnd: selectedEnd,
                ...(shopFilterId ? { shopId: shopFilterId } : {}),
              },
              type: sequelize.QueryTypes.SELECT,
            }
          )
        : Promise.resolve([]),
      isShopOrPharmacy
        ? Sale.findAll({
            where: {
              ...saleWhereBase,
              createdAt: { [Op.between]: [selectedStart, selectedEnd] },
            },
            attributes: ['id', 'saleNumber', 'total', 'status', 'createdAt'],
            limit: 5,
            order: [['createdAt', 'DESC']],
            include: [
              { model: Customer, as: 'customer', attributes: ['name'], required: false },
            ],
          })
        : Promise.resolve([]),
    ]);

    const selectedRevenue = Number(parseFloat(selectedRevenueRaw || 0).toFixed(2));
    const selectedExpenses = Number(parseFloat(selectedExpensesRaw || 0).toFixed(2));
    selectedPeriod = {
      label: options.periodLabel || 'Selected period',
      revenue: selectedRevenue,
      expenses: selectedExpenses,
      profit: Number(parseFloat(selectedRevenue - selectedExpenses).toFixed(2)),
      newCustomers: Number(selectedNewCustomers || 0),
      range: {
        start: selectedStart.toISOString(),
        end: selectedEnd.toISOString(),
        startDate: options.startDate,
        endDate: options.endDate,
      },
      topProducts: (selectedTopProductsRows || []).map((row) => ({
        productName: row.productName,
        totalRevenue: Number(parseFloat(row.totalRevenue || 0).toFixed(2)),
        totalQuantity: Number(parseFloat(row.totalQuantity || 0)),
      })),
      recentSales: (selectedRecentSalesRows || []).map((sale) => ({
        saleNumber: sale.saleNumber,
        total: Number(parseFloat(sale.total).toFixed(2)),
        status: sale.status,
        customerName: sale.customer?.name || 'Walk-in',
        createdAt: sale.createdAt,
      })),
    };
  }

  return {
    businessType,
    tenantName: tenant?.name || 'Business',
    workspaceContact,
    activeShopId: shopFilterId,
    dateFilter: hasSelectedPeriod
      ? {
          active: true,
          periodLabel: options.periodLabel || 'Selected period',
          startDate: options.startDate,
          endDate: options.endDate,
        }
      : { active: false },
    selectedPeriod,
    thisMonth,
    today: todaySummary,
    last3Months,
    receivables,
    inventory: isShopOrPharmacy
      ? {
          lowStockCount: lowStock.length,
          lowStockProducts: lowStock,
          topProductsThisMonth: topProducts,
        }
      : null,
    recentSales: isShopOrPharmacy ? recentSales : [],
    jobs: isStudio
      ? {
          pendingCount: Number(pendingJobsCount || 0),
          inProgressCount: Number(inProgressJobsCount || 0),
        }
      : null,
  };
}

/**
 * POST /api/assistant/chat
 * Chat with ABS Assistant; context is fetched and injected into the system prompt.
 */
exports.chat = async (req, res, next) => {
  const finishRequestTiming = startHotPathTimer('assistant.chat', req);
  const timings = {
    preflightMs: 0,
    contextMs: 0,
    providerMs: 0,
  };
  const clientSubmittedAt = parseClientSubmittedAt(req.headers['x-client-submitted-at']);
  const serverReceivedAt = Date.now();

  const logAssistantTiming = (extra = {}) => {
    finishRequestTiming({
      ...timings,
      clientSubmittedAt,
      clientToServerMs: clientSubmittedAt ? serverReceivedAt - clientSubmittedAt : null,
      ...extra,
    });
  };

  try {
    if (!req.tenantId) {
      logAssistantTiming({ outcome: 'validation_error' });
      return res.status(400).json({
        success: false,
        error: 'Tenant context is required',
        errorCode: 'VALIDATION_ERROR',
        code: 'VALIDATION_ERROR',
      });
    }

    const { messages, pageContext, startDate, endDate, periodLabel } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      logAssistantTiming({ outcome: 'validation_error' });
      return res.status(400).json({
        success: false,
        error: 'messages array is required and must not be empty',
        errorCode: 'VALIDATION_ERROR',
        code: 'VALIDATION_ERROR',
      });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user' || typeof lastMessage.content !== 'string') {
      logAssistantTiming({ outcome: 'validation_error' });
      return res.status(400).json({
        success: false,
        error: 'Last message must be a user message with content',
        errorCode: 'VALIDATION_ERROR',
        code: 'VALIDATION_ERROR',
      });
    }

    const preflightStart = process.hrtime.bigint();
    const circuitError = buildBillingCircuitError(req.tenantId);
    if (circuitError) {
      timings.preflightMs = toDurationMs(preflightStart);
      logAssistantTiming({ outcome: 'circuit_breaker', errorCode: circuitError.errorCode });
      return sendAssistantError(res, circuitError);
    }

    const apiKey = await assertAiProviderConfigured(req.tenantId);
    timings.preflightMs = toDurationMs(preflightStart);

    const contextTier = resolveAssistantContextTier(lastMessage.content);
    const contextOptions = {
      shopFilterId: req.shopFilterId || null,
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      periodLabel: typeof periodLabel === 'string' ? periodLabel : undefined,
      tier: contextTier,
    };
    const contextCacheKey = buildAssistantContextCacheKey(req.tenantId, contextOptions);

    const contextStart = process.hrtime.bigint();
    let context = getCachedAssistantContext(contextCacheKey);
    if (!context) {
      context = contextTier === 'light'
        ? await getAssistantContextLight(req.tenantId)
        : await getAssistantContext(req.tenantId, contextOptions);
      setCachedAssistantContext(contextCacheKey, context);
    }
    timings.contextMs = toDurationMs(contextStart);
    const businessType = req.tenant?.businessType || context.businessType;

    const providerStart = process.hrtime.bigint();
    const assistantMessage = await openaiService.chatWithContext(messages, context, {
      businessType,
      tenantId: req.tenantId,
      pageContext: typeof pageContext === 'string' ? pageContext : undefined,
      apiKey,
      contextTier,
    });
    timings.providerMs = toDurationMs(providerStart);

    logAssistantTiming({ outcome: 'success' });
    res.status(200).json({
      success: true,
      message: assistantMessage,
    });
  } catch (error) {
    const classified = classifyAiProviderError(error);
    if (error.aiProviderError || classified) {
      const billingErrorCode = error.errorCode || error.code || classified?.errorCode;
      if (billingErrorCode === 'AI_PROVIDER_BILLING_REQUIRED') {
        openBillingCircuit(req.tenantId, error);
      }
      logAssistantTiming({
        outcome: 'provider_error',
        errorCode: billingErrorCode || null,
        circuitBreaker: Boolean(error.circuitBreaker),
      });
      return sendAssistantError(res, error);
    }

    logAssistantTiming({ outcome: 'error' });
    console.error('Error in assistant chat:', {
      message: error?.message,
      code: error?.code,
      status: error?.status,
    });
    next(error);
  }
};

exports.clearAssistantContextCache = () => {
  assistantContextCache.clear();
};
