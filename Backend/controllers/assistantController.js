const { Customer, Invoice, Expense, Job, Sale, Tenant } = require('../models');
const { Op } = require('sequelize');
const openaiService = require('../services/openaiService');

/**
 * Build tenant-scoped context for the AI assistant (this month + last 3 months).
 * Used to ground answers in actual business data.
 * @param {string} tenantId - Tenant ID
 * @returns {Promise<Object>} Context blob: { businessType, thisMonth, last3Months }
 */
async function getAssistantContext(tenantId) {
  const tenant = await Tenant.findByPk(tenantId, {
    attributes: ['id', 'businessType', 'name']
  });
  const businessType = tenant?.businessType || 'printing_press';

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
    last3MonthsNewCustomers
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
            status: 'paid',
            paidDate: { [Op.between]: [firstDayOfMonth, lastDayOfMonth] }
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
            status: 'paid',
            paidDate: { [Op.between]: [firstDayThreeMonthsAgo, lastDayOfMonth] }
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

  return {
    businessType,
    tenantName: tenant?.name || 'Business',
    thisMonth,
    last3Months
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
        error: 'AI assistant is not configured. Set OPENAI_API_KEY in the backend .env to enable.',
        code: 'OPENAI_NOT_CONFIGURED'
      });
    }
    if (error.code === 'invalid_api_key' || error.status === 401) {
      return res.status(503).json({
        success: false,
        error: 'Invalid OpenAI API key. Check OPENAI_API_KEY in Backend/.env, ensure no extra spaces or line breaks, and create a new key at https://platform.openai.com/api-keys if needed.',
        code: 'OPENAI_INVALID_KEY'
      });
    }
    console.error('Error in assistant chat:', error);
    next(error);
  }
};
