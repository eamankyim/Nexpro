const { Tenant } = require('../models');

const ENV_DEFAULTS = {
  cash: process.env.ACCOUNTING_CASH_ACCOUNT_CODE || '1000',
  undeposited: process.env.ACCOUNTING_UNDEPOSITED_ACCOUNT_CODE || '1200',
  accountsReceivable: process.env.ACCOUNTING_AR_ACCOUNT_CODE || '1100',
  revenue: process.env.ACCOUNTING_REVENUE_ACCOUNT_CODE || '4110',
  expense: process.env.ACCOUNTING_EXPENSE_ACCOUNT_CODE || '5200',
  cogs: process.env.ACCOUNTING_COGS_ACCOUNT_CODE || '5100',
  inventory: process.env.ACCOUNTING_INVENTORY_ACCOUNT_CODE || '1300',
  vatPayable: process.env.ACCOUNTING_VAT_PAYABLE_ACCOUNT_CODE || '2141'
};

/**
 * Get default account codes for accounting automation (invoices, expenses, sales, reports).
 * System defaults come from env; tenant metadata.accountingAccountCodes can override.
 * @param {string} [tenantId] - Tenant UUID (optional; if provided, tenant overrides are applied)
 * @returns {Promise<{ cash: string, undeposited: string, accountsReceivable: string, revenue: string, expense: string, cogs: string, inventory: string }>}
 */
async function getAccountCodes(tenantId = null) {
  const base = { ...ENV_DEFAULTS };
  if (tenantId) {
    const tenant = await Tenant.findByPk(tenantId, { attributes: ['metadata'], raw: true });
    const overrides = tenant?.metadata?.accountingAccountCodes;
    if (overrides && typeof overrides === 'object') {
      Object.assign(base, overrides);
    }
  }
  return base;
}

module.exports = {
  getAccountCodes,
  ENV_DEFAULTS
};
