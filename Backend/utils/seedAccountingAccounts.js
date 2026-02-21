/**
 * Accounting Accounts Seeder Utility
 * 
 * Seeds default chart of accounts for a tenant.
 * 
 * PERFORMANCE OPTIMIZATIONS:
 * - Uses bulkCreate instead of findOrCreate loops
 * - Checks existing accounts in single query before seeding
 * - Uses in-memory cache to skip recently seeded tenants
 * - Checks Tenant.accountsSeeded flag before processing
 */

const { Account, Tenant } = require('../models');
const { ENV_DEFAULTS } = require('../config/accountingAccountCodes');

// In-memory cache to skip seeding for recently processed tenants (5 minute TTL)
const ACCOUNTS_CACHE = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Check if tenant was recently seeded (from memory cache)
 */
function isRecentlySeeded(tenantId) {
  const cached = ACCOUNTS_CACHE.get(tenantId);
  if (!cached) return false;
  if (Date.now() - cached > CACHE_TTL_MS) {
    ACCOUNTS_CACHE.delete(tenantId);
    return false;
  }
  return true;
}

/**
 * Mark tenant as seeded in memory cache
 */
function markSeeded(tenantId) {
  ACCOUNTS_CACHE.set(tenantId, Date.now());
}

/**
 * Default chart of accounts used by sales/invoices/expenses automation and payroll.
 * Sales/invoice/expense codes come from config/accountingAccountCodes.js; payroll codes are fixed in payrollController.
 */
const DEFAULT_ACCOUNTS = [
  { code: ENV_DEFAULTS.cash, name: 'Cash and Bank', type: 'asset', category: 'Current Assets' },
  { code: ENV_DEFAULTS.undeposited, name: 'Undeposited Funds', type: 'asset', category: 'Current Assets' },
  { code: ENV_DEFAULTS.accountsReceivable, name: 'Accounts Receivable', type: 'asset', category: 'Current Assets' },
  { code: ENV_DEFAULTS.inventory, name: 'Inventory', type: 'asset', category: 'Current Assets' },
  { code: ENV_DEFAULTS.revenue, name: 'Sales Revenue', type: 'income', category: 'Operating Income' },
  { code: ENV_DEFAULTS.cogs, name: 'Cost of Goods Sold', type: 'cogs', category: 'Cost of Sales' },
  { code: ENV_DEFAULTS.expense, name: 'Operating Expense', type: 'expense', category: 'Operating Expense' },
  { code: '2130', name: 'Payroll Payable', type: 'liability', category: 'Current Liabilities' },
  { code: '2140', name: 'Tax Payable', type: 'liability', category: 'Current Liabilities' },
  { code: ENV_DEFAULTS.vatPayable, name: 'VAT Payable', type: 'liability', category: 'Current Liabilities' },
  { code: '5210', name: 'Salaries and Wages', type: 'expense', category: 'Operating Expense' }
];

/**
 * Seed the default chart of accounts for a tenant using optimized bulk operations.
 * Idempotent: only creates accounts that don't already exist (by tenantId + code).
 * @param {string} tenantId - Tenant UUID
 * @param {boolean} force - Skip cache and flag checks (use during onboarding)
 * @returns {Promise<{ created: number, skipped: number }>}
 */
async function seedDefaultChartOfAccounts(tenantId, force = false) {
  if (!tenantId) return { created: 0, skipped: 0 };

  // Check memory cache first (skip if force)
  if (!force && isRecentlySeeded(tenantId)) {
    console.log('[seedDefaultChartOfAccounts] Skipping - tenant %s was recently seeded (cached)', tenantId);
    return { created: 0, skipped: DEFAULT_ACCOUNTS.length };
  }

  // Check database flag (skip if force)
  if (!force) {
    try {
      const tenant = await Tenant.findByPk(tenantId, { attributes: ['accountsSeeded'] });
      if (tenant?.accountsSeeded) {
        markSeeded(tenantId);
        console.log('[seedDefaultChartOfAccounts] Skipping - tenant %s already has accountsSeeded=true', tenantId);
        return { created: 0, skipped: DEFAULT_ACCOUNTS.length };
      }
    } catch (err) {
      console.warn('[seedDefaultChartOfAccounts] Could not check tenant flag:', err.message);
    }
  }

  // OPTIMIZATION: Get existing account codes in single query
  const existingCodes = new Set(
    (await Account.findAll({
      where: { tenantId },
      attributes: ['code'],
      raw: true
    })).map(a => a.code)
  );

  // Filter to only new accounts
  const newAccounts = DEFAULT_ACCOUNTS
    .filter(def => !existingCodes.has(def.code))
    .map(def => ({
      tenantId,
      code: def.code,
      name: def.name,
      type: def.type,
      category: def.category,
      isActive: true
    }));

  const skipped = DEFAULT_ACCOUNTS.length - newAccounts.length;

  // OPTIMIZATION: Bulk create
  let created = 0;
  if (newAccounts.length > 0) {
    try {
      const result = await Account.bulkCreate(newAccounts, {
        ignoreDuplicates: true,
        returning: true
      });
      created = result.length;
      console.log(`✅ Bulk created ${created} accounts for tenant ${tenantId}`);
    } catch (err) {
      console.error('[seedDefaultChartOfAccounts] Bulk create error:', err.message);
    }
  } else {
    console.log(`ℹ️  All accounts already exist for tenant ${tenantId}`);
  }

  // Mark tenant as seeded in database and cache
  try {
    await Tenant.update({ accountsSeeded: true }, { where: { id: tenantId } });
    markSeeded(tenantId);
    console.log('[seedDefaultChartOfAccounts] Marked tenant %s as accountsSeeded', tenantId);
  } catch (err) {
    console.warn('[seedDefaultChartOfAccounts] Could not update tenant flag:', err.message);
  }

  return { created, skipped };
}

/**
 * Clear the in-memory seeding cache (useful for testing)
 */
function clearAccountsSeedingCache() {
  ACCOUNTS_CACHE.clear();
}

module.exports = {
  seedDefaultChartOfAccounts,
  clearAccountsSeedingCache,
  DEFAULT_ACCOUNTS
};
