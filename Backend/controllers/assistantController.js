const { Customer, Invoice, Expense, Job, Sale, Tenant, Setting } = require('../models');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const openaiService = require('../services/openaiService');

/**
 * Build tenant-scoped context for the AI assistant (this month + last 3 months).
 * Used to ground answers in actual business data.
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Context blob: { businessType, tenantName, workspaceContact, thisMonth, last3Months, receivables }
 */
async function getAssistantContext(tenantId) {
  const [tenant, orgSetting] = await Promise.all([
    Tenant.findByPk(tenantId, {
      attributes: ['id', 'businessType', 'name', 'metadata']
    }),
    Setting.findOne({
      where: { tenantId, key: 'organization' },
      attributes: ['value']
    })
  ]);
  const businessType = tenant?.businessType || 'printing_press';
  const meta = tenant?.metadata || {};
  const org = orgSetting?.value || {};
  const workspaceContact = {
    businessName: tenant?.name || 'Business',
    email: String(org.email || meta.email || '').trim() || null,
    phone: String(org.phone || meta.phone || '').trim() || null,
    website: String(org.website || meta.website || '').trim() || null
  };

  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  firstDayOfMonth.setHours(0, 0, 0, 0);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  lastDayOfMonth.setHours(23, 59, 59, 999);

  const firstDayThreeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 3, 1);
  firstDayThreeMonthsAgo.setHours(0, 0, 0, 0);

  const isShopOrPharmacy = businessType === 'shop' || businessType === 'pharmacy';

  const [
    totalCustomers,
    newCustomersThisMonth,
    thisMonthRevenue,
    thisMonthExpenses,
    last3MonthsRevenue,
    last3MonthsExpenses,
    last3MonthsNewCustomers,
    totalOutstandingRaw,
    overdueOutstandingRaw,
    outstandingInvoiceCount,
    topDebtorsRows
  ] = await Promise.all([
    Customer.count({ where: { tenantId, isActive: true } }),
    Customer.count({
      where: {
        tenantId,
        isActive: true,
        createdAt: { [Op.between]: [firstDayOfMonth, lastDayOfMonth] }
      }
    }),
    isShopOrPharmacy
      ? Sale.sum('total', {
          where: {
            tenantId,
            status: 'completed',
            createdAt: { [Op.between]: [firstDayOfMonth, lastDayOfMonth] }
          }
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
              )
            ]
          }
        }) || 0,
    Expense.sum('amount', {
      where: {
        tenantId,
        expenseDate: { [Op.between]: [firstDayOfMonth, lastDayOfMonth] }
      }
    }) || 0,
    isShopOrPharmacy
      ? Sale.sum('total', {
          where: {
            tenantId,
            status: 'completed',
            createdAt: { [Op.between]: [firstDayThreeMonthsAgo, lastDayOfMonth] }
          }
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
              )
            ]
          }
        }) || 0,
    Expense.sum('amount', {
      where: {
        tenantId,
        expenseDate: { [Op.between]: [firstDayThreeMonthsAgo, lastDayOfMonth] }
      }
    }) || 0,
    Customer.count({
      where: {
        tenantId,
        isActive: true,
        createdAt: { [Op.between]: [firstDayThreeMonthsAgo, lastDayOfMonth] }
      }
    }),
    Invoice.sum('balance', {
      where: {
        tenantId,
        balance: { [Op.gt]: 0 },
        status: { [Op.notIn]: ['paid', 'cancelled'] }
      }
    }) || 0,
    Invoice.sum('balance', {
      where: {
        tenantId,
        balance: { [Op.gt]: 0 },
        dueDate: { [Op.lt]: today },
        status: { [Op.notIn]: ['paid', 'cancelled'] }
      }
    }) || 0,
    Invoice.count({
      where: {
        tenantId,
        balance: { [Op.gt]: 0 },
        status: { [Op.notIn]: ['paid', 'cancelled'] }
      }
    }),
    Invoice.findAll({
      attributes: [
        'customerId',
        [sequelize.fn('SUM', sequelize.col('balance')), 'outstanding']
      ],
      where: {
        tenantId,
        balance: { [Op.gt]: 0 },
        status: { [Op.notIn]: ['paid', 'cancelled'] }
      },
      include: [
        {
          model: Customer,
          as: 'customer',
          attributes: ['id', 'name', 'company']
        }
      ],
      group: ['customerId', 'customer.id'],
      order: [[sequelize.literal('outstanding'), 'DESC']],
      limit: 5
    })
  ]);

  const thisMonth = {
    totalCustomers,
    newCustomersThisMonth,
    revenue: Number(parseFloat(thisMonthRevenue).toFixed(2)),
    expenses: Number(parseFloat(thisMonthExpenses).toFixed(2)),
    profit: Number(parseFloat(thisMonthRevenue - thisMonthExpenses).toFixed(2)),
    range: { start: firstDayOfMonth.toISOString(), end: lastDayOfMonth.toISOString() }
  };

  const last3Months = {
    revenue: Number(parseFloat(last3MonthsRevenue).toFixed(2)),
    expenses: Number(parseFloat(last3MonthsExpenses).toFixed(2)),
    profit: Number(parseFloat(last3MonthsRevenue - last3MonthsExpenses).toFixed(2)),
    newCustomers: last3MonthsNewCustomers,
    range: { start: firstDayThreeMonthsAgo.toISOString(), end: lastDayOfMonth.toISOString() }
  };

  const totalOutstanding = Number(parseFloat(totalOutstandingRaw || 0).toFixed(2));
  const overdueOutstanding = Number(parseFloat(overdueOutstandingRaw || 0).toFixed(2));
  const topDebtors = (topDebtorsRows || []).map((row) => {
    const c = row.customer || {};
    return {
      customerId: row.customerId || null,
      customerName: c.company || c.name || 'Unknown customer',
      outstanding: Number(parseFloat(row.get ? row.get('outstanding') : row.outstanding || 0).toFixed(2))
    };
  });
  const receivables = {
    totalOutstanding,
    overdueOutstanding,
    outstandingInvoiceCount: Number(outstandingInvoiceCount || 0),
    overdueRatioPercent: totalOutstanding > 0 ? Number(((overdueOutstanding / totalOutstanding) * 100).toFixed(2)) : 0,
    topDebtors
  };

  return {
    businessType,
    tenantName: tenant?.name || 'Business',
    workspaceContact,
    thisMonth,
    last3Months,
    receivables
  };
}

/**
 * POST /api/assistant/chat
 * Chat with the AI assistant; context is fetched and injected into the system prompt.
 */
exports.chat = async (req, res, next) => {
  try {
    if (!req.tenantId) {
      return res.status(400).json({
        success: false,
        error: 'Tenant context is required'
      });
    }

    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'messages array is required and must not be empty'
      });
    }

    const lastMessage = messages[messages.length - 1];
    if (!lastMessage || lastMessage.role !== 'user' || typeof lastMessage.content !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Last message must be a user message with content'
      });
    }

    const context = await getAssistantContext(req.tenantId);
    const businessType = req.tenant?.businessType || context.businessType;

    const assistantMessage = await openaiService.chatWithContext(messages, context, {
      businessType
    });

    res.status(200).json({
      success: true,
      message: assistantMessage
    });
  } catch (error) {
    if (error.code === 'OPENAI_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        error: 'AI assistant is not configured. Set ANTHROPIC_API_KEY in the backend .env to enable.',
        code: 'OPENAI_NOT_CONFIGURED'
      });
    }
    if (error.code === 'invalid_api_key' || error.status === 401) {
      return res.status(503).json({
        success: false,
        error: 'Invalid Anthropic API key. Check ANTHROPIC_API_KEY in Backend/.env and create a key at https://console.anthropic.com/.',
        code: 'OPENAI_INVALID_KEY'
      });
    }
    console.error('Error in assistant chat:', error);
    next(error);
  }
};
