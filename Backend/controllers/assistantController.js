const { Customer, Invoice, Expense, Job, Sale, Tenant, Setting, Product } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const openaiService = require('../services/openaiService');
const { parseReportDateRange } = require('../utils/reportDateFilter');

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
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant context is required',
      });
    }

    const { messages, pageContext, startDate, endDate, periodLabel } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'messages array is required and must not be empty',
      });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user' || typeof lastMessage.content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Last message must be a user message with content',
      });
    }

    const context = await getAssistantContext(req.tenantId, {
      shopFilterId: req.shopFilterId || null,
      startDate: typeof startDate === 'string' ? startDate : undefined,
      endDate: typeof endDate === 'string' ? endDate : undefined,
      periodLabel: typeof periodLabel === 'string' ? periodLabel : undefined,
    });
    const businessType = req.tenant?.businessType || context.businessType;

    const assistantMessage = await openaiService.chatWithContext(messages, context, {
      businessType,
      tenantId: req.tenantId,
      pageContext: typeof pageContext === 'string' ? pageContext : undefined,
    });

    res.status(200).json({
      success: true,
      message: assistantMessage,
    });
  } catch (error) {
    if (error.code === 'OPENAI_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        error: 'AI assistant is not configured. Set ANTHROPIC_API_KEY in the backend .env to enable.',
        code: 'OPENAI_NOT_CONFIGURED',
      });
    }
    if (error.code === 'invalid_api_key' || error.status === 401) {
      return res.status(503).json({
        success: false,
        error:
          'Invalid Anthropic API key. Check the workspace AI key or ANTHROPIC_API_KEY in Backend/.env.',
        code: 'OPENAI_INVALID_KEY',
      });
    }
    console.error('Error in assistant chat:', error);
    next(error);
  }
};
