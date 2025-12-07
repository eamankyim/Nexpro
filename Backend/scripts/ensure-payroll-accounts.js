require('dotenv').config();
const { sequelize } = require('../config/database');
const { Account, Job } = require('../models');

// Required accounts for payroll
const requiredAccounts = [
  { code: '5210', name: 'Salaries and Wages', type: 'Expense', category: 'Operating Expenses', parentCode: '5200' },
  { code: '2130', name: 'Payroll Payable', type: 'Liability', category: 'Current Liabilities', parentCode: '2100' },
  { code: '2140', name: 'Tax Payable', type: 'Liability', category: 'Current Liabilities', parentCode: '2100' }
];

// Parent accounts that might be needed
const parentAccounts = [
  { code: '5000', name: 'Expenses', type: 'Expense', category: 'Operating Expenses', parentId: null },
  { code: '5200', name: 'Operating Expenses', type: 'Expense', category: 'Operating Expenses', parentCode: '5000' },
  { code: '2000', name: 'Liabilities', type: 'Liability', category: 'Current Liabilities', parentId: null },
  { code: '2100', name: 'Current Liabilities', type: 'Liability', category: 'Current Liabilities', parentCode: '2000' }
];

async function ensurePayrollAccounts() {
  try {
    console.log('[Script] Ensuring payroll accounts exist...');

    // Get tenant ID from first job
    const firstJob = await Job.findOne({ limit: 1 });
    if (!firstJob) {
      console.log('[Script] No jobs found. Please create jobs first.');
      return;
    }

    const tenantId = firstJob.tenantId;
    console.log(`[Script] Using tenant ID: ${tenantId}`);

    const accountMap = {};
    const parentAccountMap = {};

    // First, create parent accounts if they don't exist
    console.log('[Script] Checking parent accounts...');
    for (const accountData of parentAccounts) {
      if (!accountData.parentCode) {
        // Top-level parent
        const [account, created] = await Account.findOrCreate({
          where: { tenantId, code: accountData.code },
          defaults: {
            tenantId,
            code: accountData.code,
            name: accountData.name,
            type: accountData.type,
            category: accountData.category,
            parentId: null,
            description: `${accountData.name} account`,
            isActive: true
          }
        });
        accountMap[accountData.code] = account;
        parentAccountMap[accountData.code] = account.id;
        if (created) {
          console.log(`[Script] Created parent account: ${accountData.code} - ${accountData.name}`);
        } else {
          console.log(`[Script] Parent account exists: ${accountData.code} - ${accountData.name}`);
        }
      }
    }

    // Then create child parent accounts
    for (const accountData of parentAccounts) {
      if (accountData.parentCode) {
        const parentId = parentAccountMap[accountData.parentCode];
        if (!parentId) {
          console.log(`[Script] Warning: Parent account ${accountData.parentCode} not found for ${accountData.code}`);
          continue;
        }

        const [account, created] = await Account.findOrCreate({
          where: { tenantId, code: accountData.code },
          defaults: {
            tenantId,
            code: accountData.code,
            name: accountData.name,
            type: accountData.type,
            category: accountData.category,
            parentId: parentId,
            description: `${accountData.name} account`,
            isActive: true
          }
        });
        accountMap[accountData.code] = account;
        parentAccountMap[accountData.code] = account.id;
        if (created) {
          console.log(`[Script] Created parent account: ${accountData.code} - ${accountData.name}`);
        } else {
          console.log(`[Script] Parent account exists: ${accountData.code} - ${accountData.name}`);
        }
      }
    }

    // Now create the required payroll accounts
    console.log('[Script] Checking required payroll accounts...');
    for (const accountData of requiredAccounts) {
      const parentId = parentAccountMap[accountData.parentCode];
      if (!parentId) {
        console.log(`[Script] Error: Parent account ${accountData.parentCode} not found for ${accountData.code}`);
        continue;
      }

      const [account, created] = await Account.findOrCreate({
        where: { tenantId, code: accountData.code },
        defaults: {
          tenantId,
          code: accountData.code,
          name: accountData.name,
          type: accountData.type,
          category: accountData.category,
          parentId: parentId,
          description: `${accountData.name} account`,
          isActive: true
        }
      });

      if (created) {
        console.log(`[Script] ✅ Created account: ${accountData.code} - ${accountData.name}`);
      } else {
        console.log(`[Script] ✅ Account exists: ${accountData.code} - ${accountData.name}`);
      }
    }

    console.log('[Script] ✅ Payroll accounts verification completed!');

  } catch (error) {
    console.error('[Script] ❌ Error ensuring payroll accounts:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
if (require.main === module) {
  ensurePayrollAccounts()
    .then(() => {
      console.log('[Script] Script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Script] Script failed:', error);
      process.exit(1);
    });
}

module.exports = ensurePayrollAccounts;


